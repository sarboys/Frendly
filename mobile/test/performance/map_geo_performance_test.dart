import 'package:big_break_mobile/features/map/presentation/map_screen.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('map geo build stays bounded for 1000 points', () {
    final events = List<Event>.generate(
      1000,
      (index) => Event(
        id: 'event-$index',
        title: 'Точка $index',
        emoji: '☕',
        time: 'Сегодня · 12:00',
        place: 'Москва',
        distance: '1.0 км',
        attendees: const [],
        going: 1,
        capacity: 8,
        vibe: 'Спокойно',
        tone: EventTone.warm,
        latitude: 55.70 + index * 0.00002,
        longitude: 37.50 + index * 0.00002,
        joined: false,
      ),
    );

    final stopwatch = Stopwatch()..start();
    final placemarks = buildEventPlacemarks(
      events: events,
      selectedId: 'event-0',
      onEventTap: (_) {},
    );
    final fitKey = buildMapViewportFitKey(events, 'all');
    stopwatch.stop();
    // ignore: avoid_print
    print('map_geo_build_ms=${stopwatch.elapsedMilliseconds}');

    // Keep this high enough for local machines, low enough to catch O(n^2) work.
    expect(stopwatch.elapsedMilliseconds, lessThan(200));
    expect(placemarks, hasLength(1000));
    expect(fitKey, isNotEmpty);
  });
}
