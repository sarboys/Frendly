import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

typedef AppAttachmentFetchFile = Future<void> Function(
  String url,
  String cacheKey,
);

typedef AppAttachmentClearCachedFiles = Future<void> Function();

class SignedMediaUrl {
  const SignedMediaUrl({
    required this.url,
    required this.expiresAt,
  });

  final String url;
  final DateTime expiresAt;
}

class AppAttachmentService {
  AppAttachmentService({
    required Future<SignedMediaUrl> Function(String path) fetchSignedUrl,
    AppAttachmentFetchFile? fetchFile,
    AppAttachmentClearCachedFiles? clearCachedFiles,
  })  : _fetchSignedUrl = fetchSignedUrl,
        _fetchFile = fetchFile ??
            ((url, cacheKey) async {
              await dateasyRemoteImageCacheManager.getSingleFile(
                url,
                key: cacheKey,
              );
            }),
        _clearCachedFiles = clearCachedFiles ??
            (() {
              return dateasyRemoteImageCacheManager.emptyCache();
            });

  final Future<SignedMediaUrl> Function(String path) _fetchSignedUrl;
  final AppAttachmentFetchFile _fetchFile;
  final AppAttachmentClearCachedFiles _clearCachedFiles;
  final Map<String, SignedMediaUrl> _cache = {};
  final Map<String, Future<String>> _inFlight = {};

  Future<String> resolveSignedUrl(String path) {
    final now = DateTime.now();
    final cached = _cache[path];
    if (cached != null && cached.expiresAt.isAfter(now)) {
      return Future.value(cached.url);
    }
    final pending = _inFlight[path];
    if (pending != null) {
      return pending;
    }
    final future = _fetchSignedUrl(path).then((signed) {
      _cache[path] = signed;
      return signed.url;
    });
    _inFlight[path] = future;
    return future.whenComplete(() {
      _inFlight.remove(path);
    });
  }

  Future<void> warmCache(Iterable<String> paths) async {
    final queue = paths.toSet().take(6).toList(growable: false);
    var nextIndex = 0;
    Future<void> worker() async {
      while (nextIndex < queue.length) {
        final index = nextIndex;
        nextIndex += 1;
        final url = await resolveSignedUrl(queue[index]);
        await _fetchFile(
          url,
          DateasyRemoteImage.cacheKeyFor(url, DateasyImageUsage.card),
        );
      }
    }

    await Future.wait([
      for (var index = 0; index < 2 && index < queue.length; index += 1)
        worker(),
    ]);
  }

  Future<void> clearPrivateCache() async {
    _cache.clear();
    _inFlight.clear();
    await _clearCachedFiles();
  }
}
