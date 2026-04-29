import 'dart:async';
import 'dart:io';

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/utils/voice_metrics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

final chatVoicePlaybackEngineFactoryProvider =
    Provider<ChatVoicePlaybackEngine Function()>((ref) {
  return () => JustAudioChatVoicePlaybackEngine();
});

final chatVoicePlaybackControllerProvider = StateNotifierProvider.autoDispose
    .family<ChatVoicePlaybackController, ChatVoicePlaybackState, String>((
  ref,
  chatId,
) {
  return ChatVoicePlaybackController(
    engine: ref.read(chatVoicePlaybackEngineFactoryProvider)(),
    accessTokenProvider:
        ref.read(authTokensProvider.notifier).requireAccessToken,
  );
});

class ChatVoicePlaybackRequest {
  const ChatVoicePlaybackRequest({
    required this.playbackId,
    required this.attachmentId,
    required this.durationMs,
    this.url,
    this.localPath,
    this.resolveLocalPath,
    this.resolveRemoteUrl,
  });

  final String playbackId;
  final String attachmentId;
  final String? url;
  final String? localPath;
  final int durationMs;
  final Future<String?> Function()? resolveLocalPath;
  final Future<String?> Function()? resolveRemoteUrl;
}

class ChatVoicePlaybackState {
  const ChatVoicePlaybackState({
    this.activePlaybackId,
    this.isPlaying = false,
    this.isLoading = false,
    this.didComplete = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.hasError = false,
  });

  final String? activePlaybackId;
  final Duration duration;
  final bool didComplete;
  final bool hasError;
  final bool isLoading;
  final bool isPlaying;
  final Duration position;

  ChatVoicePlaybackState copyWith({
    String? activePlaybackId,
    bool clearActivePlaybackId = false,
    bool? isPlaying,
    bool? isLoading,
    bool? didComplete,
    Duration? position,
    Duration? duration,
    bool? hasError,
  }) {
    return ChatVoicePlaybackState(
      activePlaybackId: clearActivePlaybackId
          ? null
          : activePlaybackId ?? this.activePlaybackId,
      isPlaying: isPlaying ?? this.isPlaying,
      isLoading: isLoading ?? this.isLoading,
      didComplete: didComplete ?? this.didComplete,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      hasError: hasError ?? this.hasError,
    );
  }
}

class ChatVoicePlaybackController
    extends StateNotifier<ChatVoicePlaybackState> {
  ChatVoicePlaybackController({
    required ChatVoicePlaybackEngine engine,
    Future<String> Function()? accessTokenProvider,
    VoiceMetricReporter? voiceMetricReporter,
  })  : _engine = engine,
        _accessTokenProvider = accessTokenProvider,
        _voiceMetricReporter = voiceMetricReporter,
        super(const ChatVoicePlaybackState()) {
    _positionSubscription = _engine.positionStream.listen(_handlePosition);
    _durationSubscription = _engine.durationStream.listen(_handleDuration);
    _playbackStateSubscription =
        _engine.playbackStateStream.listen(_handlePlaybackState);
  }

  final Future<String> Function()? _accessTokenProvider;
  StreamSubscription<Duration?>? _durationSubscription;
  final ChatVoicePlaybackEngine _engine;
  final VoiceMetricReporter? _voiceMetricReporter;
  String? _loadedPlaybackId;
  int _playbackGeneration = 0;
  Stopwatch? _loadStopwatch;
  StreamSubscription<ChatVoiceEngineState>? _playbackStateSubscription;
  final _durationByPlayback = <String, Duration>{};
  final _positionByPlayback = <String, Duration>{};
  StreamSubscription<Duration>? _positionSubscription;

  Future<void> toggle(ChatVoicePlaybackRequest request) async {
    final isSamePlayback = state.activePlaybackId == request.playbackId;
    if (!isSamePlayback) {
      await _loadAndPlay(request);
      return;
    }

    if (state.isLoading) {
      return;
    }

    if (state.hasError) {
      _loadedPlaybackId = null;
      await _loadAndPlay(request);
      return;
    }

    if (state.isPlaying) {
      await _pauseCurrent();
      return;
    }

    if (state.didComplete) {
      await _engine.seek(Duration.zero);
      if (!_isCurrentGeneration(_playbackGeneration)) {
        return;
      }
      _positionByPlayback[request.playbackId] = Duration.zero;
      state = state.copyWith(
        position: Duration.zero,
        didComplete: false,
        hasError: false,
      );
    }

    await _engine.play();
    state = state.copyWith(
      isPlaying: true,
      isLoading: false,
      didComplete: false,
      hasError: false,
    );
  }

  Future<Map<String, String>?> _buildHeadersForUrl(String url) async {
    if (!_isProtectedBackendMediaUrl(url) || _accessTokenProvider == null) {
      return null;
    }

    final token = await _accessTokenProvider();
    return {'Authorization': 'Bearer $token'};
  }

  void _handleDuration(Duration? duration) {
    if (duration == null || duration <= Duration.zero) {
      return;
    }

    final activePlaybackId = state.activePlaybackId;
    if (activePlaybackId != null) {
      _durationByPlayback[activePlaybackId] = duration;
    }

    state = state.copyWith(duration: duration);
  }

  void _handlePlaybackState(ChatVoiceEngineState playbackState) {
    final activePlaybackId = state.activePlaybackId;
    if (activePlaybackId == null) {
      return;
    }

    final didComplete =
        playbackState.processingState == ProcessingState.completed;
    if (didComplete) {
      _positionByPlayback[activePlaybackId] = Duration.zero;
      state = state.copyWith(
        isPlaying: false,
        isLoading: false,
        didComplete: true,
        position: Duration.zero,
        hasError: false,
      );
      unawaited(_rewindCompleted());
      return;
    }

    if (state.didComplete &&
        !playbackState.playing &&
        playbackState.processingState == ProcessingState.ready) {
      return;
    }

    final isLoading = !playbackState.playing &&
        (playbackState.processingState == ProcessingState.loading ||
            playbackState.processingState == ProcessingState.buffering);

    state = state.copyWith(
      isPlaying: playbackState.playing,
      isLoading: isLoading,
      didComplete: false,
      hasError: false,
    );

    if (playbackState.playing && _loadStopwatch != null) {
      emitVoiceMetric(
        'voice_time_to_play_ms',
        _loadStopwatch!,
        reporter: _voiceMetricReporter,
      );
      _loadStopwatch = null;
    }
  }

  void _handlePosition(Duration position) {
    final activePlaybackId = state.activePlaybackId;
    if (activePlaybackId == null) {
      return;
    }

    _positionByPlayback[activePlaybackId] = position;

    final currentBucket = state.position.inMilliseconds ~/ 90;
    final nextBucket = position.inMilliseconds ~/ 90;
    if (currentBucket == nextBucket) {
      return;
    }

    state = state.copyWith(
      position: position,
      didComplete: false,
    );
  }

  bool _isCurrentGeneration(int generation) =>
      generation == _playbackGeneration;

  bool _isProtectedBackendMediaUrl(String url) {
    final targetUri = Uri.tryParse(url);
    final backendUri = Uri.tryParse(BackendConfig.apiBaseUrl);
    if (targetUri == null || backendUri == null) {
      return false;
    }

    final sameOrigin = targetUri.scheme == backendUri.scheme &&
        targetUri.host == backendUri.host &&
        targetUri.port == backendUri.port;
    if (!sameOrigin) {
      return false;
    }

    return targetUri.path.startsWith('/media/');
  }

  Future<void> _loadAndPlay(ChatVoicePlaybackRequest request) async {
    final generation = ++_playbackGeneration;
    final previousPlaybackId = state.activePlaybackId;
    if (previousPlaybackId != null &&
        previousPlaybackId != request.playbackId) {
      _positionByPlayback[previousPlaybackId] = state.position;
      _durationByPlayback[previousPlaybackId] = state.duration;
      await _engine.stop();
      if (!_isCurrentGeneration(generation)) {
        return;
      }
    }

    final savedPosition =
        _positionByPlayback[request.playbackId] ?? Duration.zero;
    final savedDuration = _durationByPlayback[request.playbackId] ??
        Duration(milliseconds: request.durationMs);

    state = ChatVoicePlaybackState(
      activePlaybackId: request.playbackId,
      isLoading: true,
      isPlaying: false,
      didComplete: false,
      position: savedPosition,
      duration: savedDuration,
      hasError: false,
    );
    _loadStopwatch = Stopwatch()..start();

    try {
      await _loadSource(request);
      if (!_isCurrentGeneration(generation)) {
        return;
      }

      _loadedPlaybackId = request.playbackId;
      if (savedPosition > Duration.zero) {
        await _engine.seek(savedPosition);
        if (!_isCurrentGeneration(generation)) {
          return;
        }
      }
      await _engine.play();
      if (!_isCurrentGeneration(generation)) {
        return;
      }

      state = state.copyWith(
        isLoading: false,
        isPlaying: true,
        didComplete: false,
        hasError: false,
      );
    } catch (_) {
      _loadedPlaybackId = null;
      if (!_isCurrentGeneration(generation)) {
        return;
      }
      state = state.copyWith(
        isLoading: false,
        isPlaying: false,
        didComplete: false,
        hasError: true,
      );
    }
  }

  Future<void> _loadSource(ChatVoicePlaybackRequest request) async {
    if (_loadedPlaybackId == request.playbackId) {
      return;
    }

    final localPath = request.localPath;
    if (localPath != null && localPath.isNotEmpty) {
      try {
        if (await File(localPath).exists()) {
          await _engine.setFilePath(localPath);
          return;
        }
      } catch (_) {}
    }

    final url = request.url;
    if (_shouldPreferResolvedLocalPath(url, request.resolveLocalPath)) {
      final resolved = await _resolveLocalPathSafely(request.resolveLocalPath);
      if (resolved != null && resolved.isNotEmpty) {
        try {
          await _engine.setFilePath(resolved);
          return;
        } catch (_) {}
      }
    }

    if (_shouldResolveRemoteUrl(url, request.resolveRemoteUrl)) {
      final resolvedUrl =
          await _resolveRemoteUrlSafely(request.resolveRemoteUrl);
      if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
        await _engine.setUrl(resolvedUrl);
        return;
      }
    }

    if (url != null && url.isNotEmpty) {
      await _engine.setUrl(
        url,
        headers: await _buildHeadersForUrl(url),
      );
      return;
    }

    final resolved = await _resolveLocalPathSafely(request.resolveLocalPath);
    if (resolved != null && resolved.isNotEmpty) {
      try {
        await _engine.setFilePath(resolved);
        return;
      } catch (_) {}
    }

    throw StateError('voice_source_missing');
  }

  Future<String?> _resolveLocalPathSafely(
    Future<String?> Function()? resolveLocalPath,
  ) async {
    if (resolveLocalPath == null) {
      return null;
    }

    try {
      return await resolveLocalPath();
    } catch (_) {
      return null;
    }
  }

  Future<String?> _resolveRemoteUrlSafely(
    Future<String?> Function()? resolveRemoteUrl,
  ) async {
    if (resolveRemoteUrl == null) {
      return null;
    }

    try {
      return await resolveRemoteUrl();
    } catch (_) {
      return null;
    }
  }

  bool _shouldPreferResolvedLocalPath(
    String? url,
    Future<String?> Function()? resolveLocalPath,
  ) {
    if (resolveLocalPath == null || url == null || url.isEmpty) {
      return false;
    }

    return _isProtectedBackendMediaUrl(url);
  }

  bool _shouldResolveRemoteUrl(
    String? url,
    Future<String?> Function()? resolveRemoteUrl,
  ) {
    if (resolveRemoteUrl == null || url == null || url.isEmpty) {
      return false;
    }

    return _isProtectedBackendMediaUrl(url);
  }

  Future<void> _pauseCurrent() async {
    final activePlaybackId = state.activePlaybackId;
    if (activePlaybackId == null) {
      return;
    }

    _positionByPlayback[activePlaybackId] = state.position;
    _durationByPlayback[activePlaybackId] = state.duration;
    await _engine.pause();
    state = state.copyWith(
      isPlaying: false,
      isLoading: false,
      hasError: false,
    );
  }

  Future<void> _rewindCompleted() async {
    try {
      await _engine.pause();
      await _engine.seek(Duration.zero);
    } catch (_) {}
  }

  @override
  void dispose() {
    unawaited(_positionSubscription?.cancel());
    unawaited(_durationSubscription?.cancel());
    unawaited(_playbackStateSubscription?.cancel());
    unawaited(_engine.dispose());
    super.dispose();
  }
}

class ChatVoiceEngineState {
  const ChatVoiceEngineState({
    required this.playing,
    required this.processingState,
  });

  final bool playing;
  final ProcessingState processingState;
}

abstract class ChatVoicePlaybackEngine {
  Stream<Duration> get positionStream;
  Stream<Duration?> get durationStream;
  Stream<ChatVoiceEngineState> get playbackStateStream;

  Future<void> setFilePath(String path);
  Future<void> setUrl(String url, {Map<String, String>? headers});
  Future<void> play();
  Future<void> pause();
  Future<void> seek(Duration position);
  Future<void> stop();
  Future<void> dispose();
}

class JustAudioChatVoicePlaybackEngine implements ChatVoicePlaybackEngine {
  JustAudioChatVoicePlaybackEngine() : _player = AudioPlayer();

  final AudioPlayer _player;

  @override
  Stream<Duration?> get durationStream => _player.durationStream;

  @override
  Stream<ChatVoiceEngineState> get playbackStateStream =>
      _player.playerStateStream.map(
        (state) => ChatVoiceEngineState(
          playing: state.playing,
          processingState: state.processingState,
        ),
      );

  @override
  Stream<Duration> get positionStream => _player.positionStream;

  @override
  Future<void> dispose() => _player.dispose();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> setFilePath(String path) => _player.setFilePath(path);

  @override
  Future<void> setUrl(String url, {Map<String, String>? headers}) =>
      _player.setUrl(url, headers: headers);

  @override
  Future<void> stop() => _player.stop();
}
