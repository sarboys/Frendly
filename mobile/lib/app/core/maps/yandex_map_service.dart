import 'dart:async';

import 'package:big_break_mobile/app/core/maps/mapkit_bootstrap.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart';

final yandexMapServiceProvider = Provider<YandexMapService>(
  (ref) => YandexMapService(
    bootstrap: ref.read(mapkitBootstrapProvider),
  ),
);

class ResolvedAddress {
  const ResolvedAddress({
    required this.name,
    required this.address,
    required this.point,
    this.category,
  });

  final String name;
  final String address;
  final Point point;
  final String? category;
}

class YandexMapService {
  YandexMapService({
    required MapkitBootstrap bootstrap,
    YandexGeosearchCache? cache,
  })  : _bootstrap = bootstrap,
        _cache = cache ?? YandexGeosearchCache();

  final MapkitBootstrap _bootstrap;
  final YandexGeosearchCache _cache;

  Future<ResolvedAddress?> searchAddress(
    String query, {
    Point? near,
  }) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      return null;
    }

    final cacheKey = YandexGeosearchCacheKey(
      kind: 'address',
      query: trimmed,
      near: near,
    );
    final cached = _cache.get(cacheKey);
    if (cached != null) {
      return cached.firstOrNull;
    }

    final geoResults = await _searchByText(
      trimmed,
      near: near,
      searchType: SearchType.geo,
      resultPageSize: 1,
    );
    if (geoResults.isNotEmpty) {
      _cache.put(cacheKey, geoResults.take(1).toList(growable: false));
      return geoResults.first;
    }

    final businessResults = await _searchByText(
      trimmed,
      near: near,
      searchType: SearchType.biz,
      resultPageSize: 1,
    );
    if (businessResults.isNotEmpty) {
      _cache.put(cacheKey, businessResults.take(1).toList(growable: false));
      return businessResults.first;
    }

    _cache.put(cacheKey, const []);
    return null;
  }

  Future<List<ResolvedAddress>> searchPlaces(
    String query, {
    Point? near,
  }) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      return const [];
    }

    final cacheKey = YandexGeosearchCacheKey(
      kind: 'places',
      query: trimmed,
      near: near,
    );
    final cached = _cache.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    final businessResults = await _searchByText(
      trimmed,
      near: near,
      searchType: SearchType.biz,
      resultPageSize: 8,
    );
    if (businessResults.isNotEmpty) {
      _cache.put(cacheKey, businessResults);
      return businessResults;
    }

    final geoResults = await _searchByText(
      trimmed,
      near: near,
      searchType: SearchType.geo,
      resultPageSize: 6,
    );
    _cache.put(cacheKey, geoResults);
    return geoResults;
  }

  Future<List<ResolvedAddress>> _searchByText(
    String query, {
    Point? near,
    required SearchType searchType,
    required int resultPageSize,
  }) async {
    await _bootstrap.ensureInitialized();

    final (session, resultFuture) = await YandexSearch.searchByText(
      searchText: query,
      geometry: near != null
          ? Geometry.fromPoint(near)
          : Geometry.fromBoundingBox(
              const BoundingBox(
                southWest: Point(latitude: 55.55, longitude: 37.35),
                northEast: Point(latitude: 55.95, longitude: 37.90),
              ),
            ),
      searchOptions: SearchOptions(
        searchType: searchType,
        resultPageSize: resultPageSize,
        geometry: true,
        userPosition: near,
      ),
    );

    try {
      final response = await resultFuture.timeout(
        const Duration(seconds: 8),
      );
      return _extractResolvedAddresses(response);
    } catch (_) {
      return const [];
    } finally {
      unawaited(session.close());
    }
  }

  Future<ResolvedAddress?> reverseGeocode(Point point) async {
    final cacheKey = YandexGeosearchCacheKey(
      kind: 'reverse',
      query: '',
      near: point,
    );
    final cached = _cache.get(cacheKey);
    if (cached != null) {
      return cached.firstOrNull;
    }

    await _bootstrap.ensureInitialized();

    final (session, resultFuture) = await YandexSearch.searchByPoint(
      point: point,
      zoom: 16,
      searchOptions: SearchOptions(
        searchType: SearchType.geo,
        resultPageSize: 1,
        geometry: true,
        userPosition: point,
      ),
    );

    try {
      final response = await resultFuture.timeout(
        const Duration(seconds: 8),
      );
      final resolved = _extractResolvedAddresses(response);
      _cache.put(cacheKey, resolved.take(1).toList(growable: false));
      return resolved.isEmpty ? null : resolved.first;
    } catch (_) {
      _cache.put(cacheKey, const []);
      return null;
    } finally {
      unawaited(session.close());
    }
  }

  List<ResolvedAddress> _extractResolvedAddresses(
      SearchSessionResult response) {
    final items = response.items ?? const <SearchItem>[];
    final deduped = <String>{};
    final results = <ResolvedAddress>[];

    for (final item in items) {
      final resolved = _extractResolvedAddress(item);
      if (resolved == null) {
        continue;
      }
      final dedupeKey = '${resolved.name}|${resolved.address}';
      if (deduped.add(dedupeKey)) {
        results.add(resolved);
      }
    }

    return results;
  }

  ResolvedAddress? _extractResolvedAddress(SearchItem item) {
    final toponym = item.toponymMetadata;
    final business = item.businessMetadata;
    final address = business?.address.formattedAddress ??
        toponym?.address.formattedAddress ??
        item.name.trim();
    final point = toponym?.balloonPoint ?? item.geometry.firstOrNull?.point;
    final rawName = business?.shortName?.trim() ??
        business?.name.trim() ??
        item.name.trim();
    final name = rawName.isEmpty ? _nameFromAddress(address) : rawName;

    if (address.isEmpty || point == null) {
      return null;
    }

    return ResolvedAddress(
      name: name,
      address: address,
      point: point,
      category: business == null ? null : 'Место',
    );
  }

  String _nameFromAddress(String address) {
    final parts = address.split(',');
    return parts.first.trim().isEmpty ? address : parts.first.trim();
  }
}

@visibleForTesting
class YandexGeosearchCacheKey {
  const YandexGeosearchCacheKey({
    required this.kind,
    required this.query,
    this.near,
  });

  final String kind;
  final String query;
  final Point? near;

  String get value {
    final normalizedQuery = query.trim().toLowerCase();
    final point = near;
    final pointKey = point == null
        ? 'none'
        : '${point.latitude.toStringAsFixed(4)},${point.longitude.toStringAsFixed(4)}';
    return '$kind|$normalizedQuery|$pointKey';
  }
}

@visibleForTesting
class YandexGeosearchCache {
  YandexGeosearchCache({
    this.ttl = const Duration(minutes: 10),
    this.maxEntries = 80,
    DateTime Function()? now,
  }) : now = now ?? DateTime.now;

  final Duration ttl;
  final int maxEntries;
  DateTime Function() now;
  final _entries = <String, _YandexGeosearchCacheEntry>{};

  List<ResolvedAddress>? get(YandexGeosearchCacheKey key) {
    final entry = _entries[key.value];
    if (entry == null) {
      return null;
    }

    if (now().difference(entry.createdAt) > ttl) {
      _entries.remove(key.value);
      return null;
    }

    return entry.items;
  }

  void put(YandexGeosearchCacheKey key, List<ResolvedAddress> items) {
    if (_entries.length >= maxEntries && !_entries.containsKey(key.value)) {
      _entries.remove(_entries.keys.first);
    }

    _entries[key.value] = _YandexGeosearchCacheEntry(
      createdAt: now(),
      items: List<ResolvedAddress>.unmodifiable(items),
    );
  }
}

class _YandexGeosearchCacheEntry {
  const _YandexGeosearchCacheEntry({
    required this.createdAt,
    required this.items,
  });

  final DateTime createdAt;
  final List<ResolvedAddress> items;
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
