import 'dart:async';

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_voice_playback_controller.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:big_break_mobile/shared/widgets/bb_voice_message.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

class _FakeChatVoicePlaybackEngine implements ChatVoicePlaybackEngine {
  final positionController = StreamController<Duration>.broadcast();
  final durationController = StreamController<Duration?>.broadcast();
  final playbackStateController =
      StreamController<ChatVoiceEngineState>.broadcast();
  var remainingSetFilePathFailures = 0;
  var remainingSetUrlFailures = 0;
  var filePathCalls = 0;
  var urlCalls = 0;
  var pauseCalls = 0;
  var stopCalls = 0;
  final seekCalls = <Duration>[];
  String? lastUrl;
  Map<String, String>? lastUrlHeaders;

  @override
  Stream<Duration?> get durationStream => durationController.stream;

  @override
  Stream<ChatVoiceEngineState> get playbackStateStream =>
      playbackStateController.stream;

  @override
  Stream<Duration> get positionStream => positionController.stream;

  @override
  Future<void> dispose() async {
    await positionController.close();
    await durationController.close();
    await playbackStateController.close();
  }

  @override
  Future<void> pause() async {
    pauseCalls += 1;
    playbackStateController.add(
      const ChatVoiceEngineState(
        playing: false,
        processingState: ProcessingState.ready,
      ),
    );
  }

  @override
  Future<void> play() async {
    playbackStateController.add(
      const ChatVoiceEngineState(
        playing: true,
        processingState: ProcessingState.ready,
      ),
    );
  }

  @override
  Future<void> seek(Duration position) async {
    seekCalls.add(position);
    positionController.add(position);
  }

  @override
  Future<void> setFilePath(String path) async {
    filePathCalls += 1;
    if (remainingSetFilePathFailures > 0) {
      remainingSetFilePathFailures -= 1;
      throw StateError('set_file_path_failed');
    }
    durationController.add(const Duration(seconds: 5));
  }

  @override
  Future<void> setUrl(String url, {Map<String, String>? headers}) async {
    urlCalls += 1;
    lastUrl = url;
    lastUrlHeaders = headers;
    if (remainingSetUrlFailures > 0) {
      remainingSetUrlFailures -= 1;
      throw StateError('set_url_failed');
    }
    durationController.add(const Duration(seconds: 5));
  }

  @override
  Future<void> stop() async {
    stopCalls += 1;
    playbackStateController.add(
      const ChatVoiceEngineState(
        playing: false,
        processingState: ProcessingState.idle,
      ),
    );
  }
}

void main() {
  test('playback controller pauses current voice and restores saved position',
      () async {
    final engine = _FakeChatVoicePlaybackEngine();
    final controller = ChatVoicePlaybackController(engine: engine);

    await controller.toggle(
      const ChatVoicePlaybackRequest(
        playbackId: 'voice-1',
        attachmentId: 'voice-1',
        url: 'http://example.com/1.m4a',
        durationMs: 5000,
      ),
    );
    engine.positionController.add(const Duration(seconds: 2));
    await Future<void>.delayed(Duration.zero);

    await controller.toggle(
      const ChatVoicePlaybackRequest(
        playbackId: 'voice-2',
        attachmentId: 'voice-2',
        url: 'http://example.com/2.m4a',
        durationMs: 6000,
      ),
    );

    expect(engine.stopCalls, 1);
    expect(engine.urlCalls, 2);

    await controller.toggle(
      const ChatVoicePlaybackRequest(
        playbackId: 'voice-1',
        attachmentId: 'voice-1',
        url: 'http://example.com/1.m4a',
        durationMs: 5000,
      ),
    );

    expect(engine.seekCalls, contains(const Duration(seconds: 2)));
    controller.dispose();
  });

  test('playback controller rewinds completed voice and replays on first tap',
      () async {
    final engine = _FakeChatVoicePlaybackEngine();
    final controller = ChatVoicePlaybackController(engine: engine);

    await controller.toggle(
      const ChatVoicePlaybackRequest(
        playbackId: 'voice-1',
        attachmentId: 'voice-1',
        url: 'http://example.com/1.m4a',
        durationMs: 5000,
      ),
    );

    engine.positionController.add(const Duration(seconds: 5));
    engine.playbackStateController.add(
      const ChatVoiceEngineState(
        playing: true,
        processingState: ProcessingState.completed,
      ),
    );
    await Future<void>.delayed(Duration.zero);

    expect(controller.state.didComplete, true);
    expect(controller.state.position, Duration.zero);
    expect(controller.state.isPlaying, false);
    expect(engine.pauseCalls, 1);
    expect(engine.seekCalls, contains(Duration.zero));

    await controller.toggle(
      const ChatVoicePlaybackRequest(
        playbackId: 'voice-1',
        attachmentId: 'voice-1',
        url: 'http://example.com/1.m4a',
        durationMs: 5000,
      ),
    );

    expect(controller.state.isPlaying, true);
    expect(controller.state.didComplete, false);
    controller.dispose();
  });

  test('playback controller retries loading source after previous error',
      () async {
    final engine = _FakeChatVoicePlaybackEngine()..remainingSetUrlFailures = 1;
    final controller = ChatVoicePlaybackController(engine: engine);
    const request = ChatVoicePlaybackRequest(
      playbackId: 'voice-1',
      attachmentId: 'voice-1',
      url: 'http://example.com/1.m4a',
      durationMs: 5000,
    );

    await controller.toggle(request);

    expect(controller.state.hasError, true);
    expect(engine.urlCalls, 1);

    await controller.toggle(request);

    expect(engine.urlCalls, 2);
    expect(controller.state.hasError, false);
    expect(controller.state.isPlaying, true);
    controller.dispose();
  });

  test('playback controller prefers resolved signed url over backend proxy',
      () async {
    final engine = _FakeChatVoicePlaybackEngine();
    final controller = ChatVoicePlaybackController(engine: engine);

    await controller.toggle(
      ChatVoicePlaybackRequest(
        playbackId: 'voice-1',
        attachmentId: 'voice-1',
        url: '${BackendConfig.apiBaseUrl}/media/voice-1',
        durationMs: 5000,
        resolveRemoteUrl: () async =>
            'https://storage.example.com/signed-voice-1',
      ),
    );

    expect(engine.urlCalls, 1);
    expect(engine.lastUrl, 'https://storage.example.com/signed-voice-1');
    expect(engine.lastUrlHeaders, isNull);
    controller.dispose();
  });

  testWidgets('voice message prefers remote url over local resolve callback', (
    tester,
  ) async {
    var resolved = false;
    final engine = _FakeChatVoicePlaybackEngine();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
            () => engine,
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: BbVoiceMessage(
              chatId: 'p1',
              playbackId: 'voice-1',
              attachmentId: 'voice-1',
              url: 'http://example.com/media/1',
              durationMs: 5000,
              waveform: const [0.3, 0.5, 0.7],
              resolveLocalPath: () async {
                resolved = true;
                return '/tmp/voice.m4a';
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.play_arrow_rounded));
    await tester.pump();

    expect(resolved, false);
    expect(engine.urlCalls, 1);
    expect(engine.filePathCalls, 0);
  });

  testWidgets(
      'voice message prefers cached file for backend media url when resolver is available',
      (tester) async {
    var resolved = false;
    final engine = _FakeChatVoicePlaybackEngine();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
            () => engine,
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: BbVoiceMessage(
              chatId: 'p1',
              playbackId: 'voice-1',
              attachmentId: 'voice-1',
              url: '${BackendConfig.apiBaseUrl}/media/voice-1',
              durationMs: 5000,
              waveform: const [0.3, 0.5, 0.7],
              resolveLocalPath: () async {
                resolved = true;
                return '/tmp/voice.m4a';
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.play_arrow_rounded));
    await tester.pump();

    expect(resolved, true);
    expect(engine.filePathCalls, 1);
    expect(engine.urlCalls, 0);
  });

  testWidgets(
      'voice message falls back to backend stream when cache resolver throws',
      (tester) async {
    final engine = _FakeChatVoicePlaybackEngine();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
            () => engine,
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: BbVoiceMessage(
              chatId: 'p1',
              playbackId: 'voice-1',
              attachmentId: 'voice-1',
              url: '${BackendConfig.apiBaseUrl}/media/voice-1',
              durationMs: 5000,
              waveform: const [0.3, 0.5, 0.7],
              resolveLocalPath: () async {
                throw StateError('cache_unavailable');
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.play_arrow_rounded));
    await tester.pump();

    expect(engine.filePathCalls, 0);
    expect(engine.urlCalls, 1);
    expect(
      engine.lastUrlHeaders,
      containsPair('Authorization', 'Bearer access-token'),
    );
    expect(find.byIcon(Icons.pause_rounded), findsOneWidget);
  });

  testWidgets(
      'inactive voice message does not rebuild on active position updates',
      (tester) async {
    final engine = _FakeChatVoicePlaybackEngine();
    final rebuildLog = <String>[];
    final oldDebugPrint = debugPrint;
    final oldDebugPrintRebuildDirtyWidgets = debugPrintRebuildDirtyWidgets;

    try {
      debugPrint = (message, {wrapWidth}) {
        if (message != null) {
          rebuildLog.add(message);
        }
      };
      debugPrintRebuildDirtyWidgets = true;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
              () => engine,
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: Column(
                children: [
                  BbVoiceMessage(
                    chatId: 'p1',
                    playbackId: 'voice-1',
                    attachmentId: 'voice-1',
                    url: 'http://example.com/media/1',
                    durationMs: 5000,
                    waveform: [0.3, 0.5, 0.7],
                  ),
                  BbVoiceMessage(
                    chatId: 'p1',
                    playbackId: 'voice-2',
                    attachmentId: 'voice-2',
                    url: 'http://example.com/media/2',
                    durationMs: 5000,
                    waveform: [0.4, 0.6, 0.8],
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byIcon(Icons.play_arrow_rounded).first);
      await tester.pump();

      rebuildLog.clear();
      engine.positionController.add(const Duration(seconds: 1));
      await tester.pump();

      final voiceRebuilds =
          rebuildLog.where((entry) => entry.contains('BbVoiceMessage')).length;
      expect(voiceRebuilds, 1);
    } finally {
      debugPrint = oldDebugPrint;
      debugPrintRebuildDirtyWidgets = oldDebugPrintRebuildDirtyWidgets;
    }
  });

  testWidgets('voice message sends auth header for backend media url', (
    tester,
  ) async {
    final engine = _FakeChatVoicePlaybackEngine();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
            () => engine,
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: BbVoiceMessage(
              chatId: 'p1',
              playbackId: 'voice-1',
              attachmentId: 'voice-1',
              url: '${BackendConfig.apiBaseUrl}/media/voice-1',
              durationMs: 5000,
              waveform: [0.3, 0.5, 0.7],
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.play_arrow_rounded));
    await tester.pump();

    expect(engine.lastUrl, '${BackendConfig.apiBaseUrl}/media/voice-1');
    expect(
      engine.lastUrlHeaders,
      containsPair('Authorization', 'Bearer access-token'),
    );
  });

  testWidgets(
      'voice message keeps pause icon while buffering after playback started',
      (tester) async {
    final engine = _FakeChatVoicePlaybackEngine();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
            () => engine,
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: BbVoiceMessage(
              chatId: 'p1',
              playbackId: 'voice-1',
              attachmentId: 'voice-1',
              url: 'http://example.com/media/1',
              durationMs: 5000,
              waveform: [0.3, 0.5, 0.7],
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.play_arrow_rounded));
    await tester.pump();

    engine.playbackStateController.add(
      const ChatVoiceEngineState(
        playing: true,
        processingState: ProcessingState.buffering,
      ),
    );
    await tester.pump();

    expect(find.byIcon(Icons.pause_rounded), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
