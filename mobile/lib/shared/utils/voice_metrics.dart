import 'dart:developer' as developer;

typedef VoiceMetricReporter = void Function(String name, int milliseconds);

void emitVoiceMetric(
  String name,
  Stopwatch stopwatch, {
  VoiceMetricReporter? reporter,
}) {
  final milliseconds = stopwatch.elapsedMilliseconds;
  if (reporter != null) {
    reporter(name, milliseconds);
    return;
  }

  developer.log(
    '$name=$milliseconds',
    name: 'voice_metrics',
  );
}
