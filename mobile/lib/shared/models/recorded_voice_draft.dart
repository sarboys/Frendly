import 'package:file_picker/file_picker.dart';

class RecordedVoiceDraft {
  const RecordedVoiceDraft({
    required this.file,
    required this.duration,
    required this.waveform,
  });

  final PlatformFile file;
  final Duration duration;
  final List<double> waveform;

  RecordedVoiceDraft copyWith({
    PlatformFile? file,
    Duration? duration,
    List<double>? waveform,
  }) {
    return RecordedVoiceDraft(
      file: file ?? this.file,
      duration: duration ?? this.duration,
      waveform: waveform ?? this.waveform,
    );
  }
}
