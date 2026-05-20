import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/device/app_media_prewarm_service.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

void main() {
  test('warms bounded remote images with stable widget cache keys', () async {
    var active = 0;
    var maxActive = 0;
    final seen = <String, String>{};
    final service = AppMediaPrewarmService(
      fetchFile: (url, cacheKey) async {
        active += 1;
        maxActive = maxActive < active ? active : maxActive;
        seen[url] = cacheKey;
        await Future<void>.delayed(const Duration(milliseconds: 1));
        active -= 1;
      },
    );

    await service.warmRemoteImages(
      [
        'https://cdn.test/1.jpg',
        'https://cdn.test/2.jpg',
        'https://cdn.test/3.jpg',
        'https://cdn.test/4.jpg',
      ],
      usage: DateasyImageUsage.card,
      limit: 3,
      concurrency: 2,
    );

    expect(seen, hasLength(3));
    expect(maxActive, lessThanOrEqualTo(2));
    expect(
      seen['https://cdn.test/1.jpg'],
      DateasyRemoteImage.cacheKeyFor(
        'https://cdn.test/1.jpg',
        DateasyImageUsage.card,
      ),
    );
  });

  test('uses stable cache keys for signed media urls', () {
    final first = DateasyRemoteImage.cacheKeyFor(
      'https://cdn.test/media/a.jpg?X-Amz-Signature=one&X-Amz-Expires=60',
      DateasyImageUsage.card,
    );
    final second = DateasyRemoteImage.cacheKeyFor(
      'https://cdn.test/media/a.jpg?X-Amz-Signature=two&X-Amz-Expires=120',
      DateasyImageUsage.card,
    );

    expect(first, second);
  });

  test('retries image prewarm after a failed attempt', () async {
    var calls = 0;
    final service = AppMediaPrewarmService(
      fetchFile: (_, __) async {
        calls += 1;
        if (calls == 1) {
          throw StateError('temporary network error');
        }
      },
    );

    await service.warmRemoteImages(
      ['https://cdn.test/retry.jpg'],
      usage: DateasyImageUsage.card,
    );
    await service.warmRemoteImages(
      ['https://cdn.test/retry.jpg'],
      usage: DateasyImageUsage.card,
    );

    expect(calls, 2);
  });
}
