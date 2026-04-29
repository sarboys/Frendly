import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:big_break_mobile/shared/models/recorded_voice_draft.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:record/record.dart';

const _voiceRecordBitRate = 64000;
const _voiceRecordSampleRate = 32000;
const _voiceRecordChannels = 1;

RecordConfig buildVoiceRecordConfig() {
  return const RecordConfig(
    encoder: AudioEncoder.aacLc,
    bitRate: _voiceRecordBitRate,
    sampleRate: _voiceRecordSampleRate,
    numChannels: _voiceRecordChannels,
    iosConfig: IosRecordConfig(),
  );
}

final appVoiceRecorderServiceProvider =
    Provider<AppVoiceRecorderService>((ref) {
  final service = NativeAppVoiceRecorderService();
  ref.onDispose(() {
    service.dispose();
  });
  return service;
});

abstract class AppVoiceRecorderService {
  Stream<double> get amplitudeStream;
  Future<void> start();
  Future<RecordedVoiceDraft> stop();
  Future<void> cancel();
  Future<void> dispose();
}

class NativeAppVoiceRecorderService implements AppVoiceRecorderService {
  NativeAppVoiceRecorderService({
    AudioRecorder? recorder,
  }) : _recorder = recorder ?? AudioRecorder();

  static const _amplitudeInterval = Duration(milliseconds: 80);

  AudioRecorder _recorder;
  final StreamController<double> _amplitudeController =
      StreamController<double>.broadcast();
  StreamSubscription<Amplitude>? _amplitudeSubscription;
  final List<double> _amplitudeSamples = <double>[];
  String? _currentPath;
  DateTime? _startedAt;
  Directory? _currentDirectory;

  @override
  Stream<double> get amplitudeStream => _amplitudeController.stream;

  @override
  Future<void> start() async {
    await _stopAmplitudeSubscription();
    _amplitudeSamples.clear();

    final tempDir = await Directory.systemTemp.createTemp('bb-voice');
    final fileName = 'voice-${DateTime.now().microsecondsSinceEpoch}.m4a';
    final path = '${tempDir.path}/$fileName';

    await _recorder.ios?.manageAudioSession(true);

    try {
      await _recorder.start(
        buildVoiceRecordConfig(),
        path: path,
      );
    } catch (_) {
      await _recreateRecorder();
      await _recorder.ios?.manageAudioSession(true);
      await _recorder.start(
        buildVoiceRecordConfig(),
        path: path,
      );
    }

    _amplitudeSubscription =
        _recorder.onAmplitudeChanged(_amplitudeInterval).listen((amplitude) {
      final normalized = _normalizeAmplitude(amplitude.current);
      _amplitudeSamples.add(normalized);
      if (!_amplitudeController.isClosed) {
        _amplitudeController.add(normalized);
      }
    });

    _currentPath = path;
    _currentDirectory = tempDir;
    _startedAt = DateTime.now();
  }

  @override
  Future<RecordedVoiceDraft> stop() async {
    final path = await _recorder.stop() ?? _currentPath;
    await _stopAmplitudeSubscription();
    if (path == null) {
      throw StateError('Voice recording path is missing');
    }

    final file = File(path);
    final size = await file.length();
    final duration = _normalizedDuration(
      DateTime.now().difference(_startedAt ?? DateTime.now()),
    );
    final waveform = _buildWaveform(duration);

    _currentPath = null;
    _currentDirectory = null;
    _startedAt = null;

    return RecordedVoiceDraft(
      file: PlatformFile(
        name: file.uri.pathSegments.last,
        size: size,
        path: file.path,
      ),
      duration: duration,
      waveform: waveform,
    );
  }

  @override
  Future<void> cancel() async {
    await _stopAmplitudeSubscription();
    await _recorder.cancel();
    _currentPath = null;
    final directory = _currentDirectory;
    _currentDirectory = null;
    _startedAt = null;
    await _deleteDirectory(directory);
  }

  @override
  Future<void> dispose() async {
    await _stopAmplitudeSubscription();
    await _amplitudeController.close();
    try {
      await _recorder.dispose();
    } catch (_) {}
  }

  Future<void> _recreateRecorder() async {
    try {
      await _recorder.dispose();
    } catch (_) {}
    _recorder = AudioRecorder();
  }

  Duration _normalizedDuration(Duration duration) {
    if (duration <= Duration.zero) {
      return const Duration(seconds: 1);
    }
    return duration;
  }

  Future<void> _deleteDirectory(Directory? directory) async {
    if (directory == null) {
      return;
    }

    try {
      if (await directory.exists()) {
        await directory.delete(recursive: true);
      }
    } catch (_) {}
  }

  Future<void> _stopAmplitudeSubscription() async {
    await _amplitudeSubscription?.cancel();
    _amplitudeSubscription = null;
  }

  double _normalizeAmplitude(double currentDbfs) {
    if (!currentDbfs.isFinite) {
      return 0.0;
    }
    final clamped = currentDbfs.clamp(-50.0, 0.0).toDouble();
    final normalized = (clamped + 50.0) / 50.0;
    return math.pow(normalized, 1.6).toDouble().clamp(0.0, 1.0);
  }

  List<double> _buildWaveform(Duration duration) {
    if (_amplitudeSamples.isEmpty) {
      return _fallbackWaveform(duration);
    }

    final targetBars = math.max(
      24,
      math.min(48, duration.inMilliseconds ~/ 350),
    );
    final samplesPerBar = math.max(
      1,
      (_amplitudeSamples.length / targetBars).ceil(),
    );
    final bars = <double>[];

    for (var index = 0;
        index < _amplitudeSamples.length;
        index += samplesPerBar) {
      final chunk = _amplitudeSamples
          .skip(index)
          .take(samplesPerBar)
          .toList(growable: false);
      if (chunk.isEmpty) {
        continue;
      }
      bars.add(chunk.reduce(math.max).clamp(0.0, 1.0));
    }

    return bars.isEmpty ? _fallbackWaveform(duration) : bars;
  }

  List<double> _fallbackWaveform(Duration duration) {
    final bars = math.max(24, math.min(40, duration.inMilliseconds ~/ 450));
    return List<double>.generate(
      bars,
      (index) => 0.22 + ((index % 5) * 0.12),
      growable: false,
    );
  }
}
