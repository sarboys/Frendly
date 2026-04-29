import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart';

void main() {
  test('yandex geosearch cache returns fresh entries and expires old ones', () {
    final cache = YandexGeosearchCache(
      ttl: const Duration(minutes: 10),
      now: () => DateTime.utc(2026, 4, 25, 12),
    );
    const key = YandexGeosearchCacheKey(
      kind: 'places',
      query: ' кофе ',
      near: Point(latitude: 55.75001, longitude: 37.61001),
    );
    const result = [
      ResolvedAddress(
        name: 'Кофемания',
        address: 'Тверская 10',
        point: Point(latitude: 55.765, longitude: 37.605),
      ),
    ];

    cache.put(key, result);

    expect(cache.get(key)!.single.name, 'Кофемания');

    cache.now = () => DateTime.utc(2026, 4, 25, 12, 11);

    expect(cache.get(key), isNull);
  });

  test('yandex geosearch cache normalizes query and nearby point', () {
    final cache = YandexGeosearchCache(
      ttl: const Duration(minutes: 10),
      now: () => DateTime.utc(2026, 4, 25, 12),
    );
    const storedKey = YandexGeosearchCacheKey(
      kind: 'places',
      query: 'Кофе',
      near: Point(latitude: 55.750014, longitude: 37.610014),
    );
    const lookupKey = YandexGeosearchCacheKey(
      kind: 'places',
      query: ' кофе ',
      near: Point(latitude: 55.750016, longitude: 37.610016),
    );
    const result = [
      ResolvedAddress(
        name: 'Кофемания',
        address: 'Тверская 10',
        point: Point(latitude: 55.765, longitude: 37.605),
      ),
    ];

    cache.put(storedKey, result);

    expect(cache.get(lookupKey)!.single.name, 'Кофемания');
  });
}
