import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

enum DateasyImageUsage { avatar, card, hero, fullscreen }

final dateasyRemoteImageCacheManager = CacheManager(
  Config(
    'dateasyRemoteImageCacheV2',
    stalePeriod: const Duration(days: 7),
    maxNrOfCacheObjects: 512,
  ),
);

class DateasyRemoteImage extends StatelessWidget {
  const DateasyRemoteImage({
    required this.imageUrl,
    required this.usage,
    this.fit = BoxFit.cover,
    this.cacheKey,
    super.key,
  });

  final String? imageUrl;
  final DateasyImageUsage usage;
  final BoxFit fit;
  final String? cacheKey;

  static String cacheKeyFor(String url, DateasyImageUsage usage) {
    return 'dateasy-image-v2-${usage.name}-${_stableImageUrlIdentity(url)}';
  }

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    if (url == null || url.isEmpty) {
      return _DateasyImageFallback(usage: usage);
    }
    final size = switch (usage) {
      DateasyImageUsage.avatar => 96,
      DateasyImageUsage.card => 720,
      DateasyImageUsage.hero => 1080,
      DateasyImageUsage.fullscreen => 1440,
    };
    return CachedNetworkImage(
      imageUrl: url,
      cacheKey: cacheKey ?? cacheKeyFor(url, usage),
      cacheManager: dateasyRemoteImageCacheManager,
      fit: fit,
      memCacheWidth: size,
      memCacheHeight: size,
      maxWidthDiskCache: size,
      maxHeightDiskCache: size,
      fadeInDuration: const Duration(milliseconds: 120),
      placeholder: (_, __) => const ColoredBox(color: DateasyColors.glass),
      errorWidget: (_, __, ___) => _DateasyImageFallback(usage: usage),
    );
  }
}

class _DateasyImageFallback extends StatelessWidget {
  const _DateasyImageFallback({required this.usage});

  final DateasyImageUsage usage;

  @override
  Widget build(BuildContext context) {
    final icon = usage == DateasyImageUsage.avatar
        ? Icons.person
        : Icons.broken_image_outlined;
    final size = usage == DateasyImageUsage.avatar ? 24.0 : 28.0;
    return ColoredBox(
      color: DateasyColors.glass,
      child: Center(
        child: Icon(
          icon,
          size: size,
          color: DateasyColors.muted,
        ),
      ),
    );
  }
}

String _stableImageUrlIdentity(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme || uri.queryParametersAll.isEmpty) {
    return url;
  }
  final stableQuery = <String, List<String>>{};
  for (final entry in uri.queryParametersAll.entries) {
    if (_isVolatileMediaQueryKey(entry.key)) {
      continue;
    }
    stableQuery[entry.key] = entry.value;
  }
  if (stableQuery.isEmpty) {
    final withoutQuery = uri.replace(query: '').toString();
    return withoutQuery.endsWith('?')
        ? withoutQuery.substring(0, withoutQuery.length - 1)
        : withoutQuery;
  }
  return uri.replace(query: _queryString(stableQuery)).toString();
}

String _queryString(Map<String, List<String>> query) {
  return query.entries
      .expand((entry) => entry.value.map(
            (value) =>
                '${Uri.encodeQueryComponent(entry.key)}=${Uri.encodeQueryComponent(value)}',
          ))
      .join('&');
}

bool _isVolatileMediaQueryKey(String key) {
  final lower = key.toLowerCase();
  return lower == 'token' ||
      lower == 'signature' ||
      lower == 'expires' ||
      lower == 'expiresat' ||
      lower == 'policy' ||
      lower.startsWith('x-amz-') ||
      lower.startsWith('x-goog-') ||
      lower.startsWith('response-');
}
