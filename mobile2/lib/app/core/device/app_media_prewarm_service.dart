import 'dart:math' as math;

import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

typedef AppMediaPrewarmFetch = Future<void> Function(
  String url,
  String cacheKey,
);

class AppMediaPrewarmService {
  AppMediaPrewarmService({
    AppMediaPrewarmFetch? fetchFile,
  }) : _fetchFile = fetchFile ??
            ((url, cacheKey) async {
              await dateasyRemoteImageCacheManager.getSingleFile(
                url,
                key: cacheKey,
              );
            });

  static const _maxConcurrentWarmups = 3;
  static const _maxRememberedKeys = 512;

  final AppMediaPrewarmFetch _fetchFile;
  final Set<String> _rememberedKeys = <String>{};
  final Set<String> _activeKeys = <String>{};

  Future<void> warmRemoteImages(
    Iterable<String?> urls, {
    required DateasyImageUsage usage,
    int limit = 6,
    int concurrency = 2,
  }) async {
    final targets = urls
        .map((url) => url?.trim())
        .whereType<String>()
        .where((url) => url.isNotEmpty)
        .take(limit)
        .map((url) => _PrewarmTarget(
              url: url,
              cacheKey: DateasyRemoteImage.cacheKeyFor(url, usage),
            ))
        .where((target) => _markActive(target.cacheKey))
        .toList(growable: false);
    if (targets.isEmpty) {
      return;
    }

    var next = 0;
    final workerCount = math.min(
      math.min(math.max(1, concurrency), _maxConcurrentWarmups),
      targets.length,
    );
    await Future.wait(
      List.generate(workerCount, (_) async {
        while (next < targets.length) {
          final target = targets[next];
          next += 1;
          try {
            await _fetchFile(target.url, target.cacheKey);
            _markSucceeded(target.cacheKey);
          } catch (_) {
          } finally {
            _activeKeys.remove(target.cacheKey);
          }
        }
      }),
    );
  }

  bool _markActive(String cacheKey) {
    if (_rememberedKeys.contains(cacheKey) || !_activeKeys.add(cacheKey)) {
      return false;
    }
    return true;
  }

  void _markSucceeded(String cacheKey) {
    _rememberedKeys.add(cacheKey);
    if (_rememberedKeys.length > _maxRememberedKeys) {
      _rememberedKeys.remove(_rememberedKeys.first);
    }
  }
}

class _PrewarmTarget {
  const _PrewarmTarget({
    required this.url,
    required this.cacheKey,
  });

  final String url;
  final String cacheKey;
}
