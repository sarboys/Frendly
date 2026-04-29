import 'package:big_break_mobile/app/core/device/app_voice_recorder_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:record/record.dart';

void main() {
  test('voice recorder uses speech optimized audio config', () {
    final config = buildVoiceRecordConfig();

    expect(config.encoder, AudioEncoder.aacLc);
    expect(config.bitRate, 64000);
    expect(config.sampleRate, 32000);
    expect(config.numChannels, 1);
  });
}
