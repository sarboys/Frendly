import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/map/presentation/map_screen.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('radar native map does not require dart mapkit define', () {
    expect(
      radarShouldRenderNativeMap(
        nativeMapEnabled: true,
        hasDartMapKitKey: false,
      ),
      isTrue,
    );
  });

  test('reuses map objects when visible pins do not change', () {
    final cache = DateasyMapObjectCache();
    final pins = [
      _pin('a', 55.7, 37.6),
      _pin('b', 55.8, 37.7),
    ];

    final first = cache.objectsFor(
      pins: pins,
      onPinTap: (_) {},
    );
    final second = cache.objectsFor(
      pins: List<BackendCardItem>.of(pins),
      onPinTap: (_) {},
    );
    final changed = cache.objectsFor(
      pins: [_pin('a', 55.71, 37.6), _pin('b', 55.8, 37.7)],
      onPinTap: (_) {},
    );

    expect(identical(first, second), isTrue);
    expect(identical(second, changed), isFalse);
  });
}

BackendCardItem _pin(String id, double latitude, double longitude) {
  return BackendCardItem(
    id: id,
    title: id,
    latitude: latitude,
    longitude: longitude,
    raw: {'id': id},
  );
}
