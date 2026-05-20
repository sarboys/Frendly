import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/meetings/presentation/meetings_screen.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('meetings prewarm uses only the first six meeting covers', () {
    final meetings = List.generate(
      8,
      (index) => BackendCardItem(
        id: 'meeting-$index',
        title: 'Meeting $index',
        imageUrl: 'https://cdn.test/meeting-$index.jpg',
      ),
    );

    expect(meetingPrewarmImageUrls(meetings).toList(growable: false), [
      'https://cdn.test/meeting-0.jpg',
      'https://cdn.test/meeting-1.jpg',
      'https://cdn.test/meeting-2.jpg',
      'https://cdn.test/meeting-3.jpg',
      'https://cdn.test/meeting-4.jpg',
      'https://cdn.test/meeting-5.jpg',
    ]);
  });
}
