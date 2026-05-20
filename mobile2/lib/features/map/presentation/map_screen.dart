import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/config/backend_config.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' as ym;

const _defaultViewport = MapViewportQuery(
  north: 55.85,
  south: 55.65,
  east: 37.75,
  west: 37.45,
);

final radarNativeMapEnabledProvider = Provider<bool>((_) => true);

bool radarShouldRenderNativeMap({
  required bool nativeMapEnabled,
  required bool hasDartMapKitKey,
}) {
  return nativeMapEnabled || hasDartMapKitKey;
}

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  MapViewportQuery? _viewport;
  ym.YandexMapController? _controller;
  Timer? _viewportDebounce;
  final DateasyMapObjectCache _mapObjectCache = DateasyMapObjectCache();
  bool _nearbyOpen = true;

  @override
  void dispose() {
    _viewportDebounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final viewport = _viewport ??
        _viewportForCity(
          ref.watch(currentUserProvider)?.city,
        );
    final eventsState = ref.watch(mapEventsProvider(viewport));
    final events = eventsState.valueOrNull?.items ?? const <BackendCardItem>[];
    final pins = events
        .where((item) => item.latitude != null && item.longitude != null)
        .toList(growable: false);
    final nearby = events.map(_NearbyItem.fromBackend).toList(growable: false);
    final mapObjects = _mapObjectCache.objectsFor(
      pins: pins,
      onPinTap: (eventId) => context.go('/meetings/$eventId'),
    );

    return DateasyPhoneFrame(
      child: Stack(
        children: [
          Positioned.fill(
            child: _NativeMap(
              mapObjects: mapObjects,
              loading: eventsState.isLoading && events.isEmpty,
              renderNativeMap: radarShouldRenderNativeMap(
                nativeMapEnabled: ref.watch(radarNativeMapEnabledProvider),
                hasDartMapKitKey: BackendConfig.hasMapKitKey,
              ),
              onCreated: _handleMapCreated,
              onCameraFinished: _handleCameraFinished,
            ),
          ),
          const SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _TopControls(),
                  _FilterChips(),
                ],
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: MediaQuery.paddingOf(context).bottom + 104,
            child: _NearbyCard(
              items: nearby,
              loading: eventsState.isLoading && events.isEmpty,
              hasError: eventsState.hasError,
              open: _nearbyOpen,
              onToggle: () => setState(() => _nearbyOpen = !_nearbyOpen),
              onSwipe: (open) => setState(() => _nearbyOpen = open),
            ),
          ),
          const _BottomNav(),
        ],
      ),
    );
  }

  Future<void> _handleMapCreated(ym.YandexMapController controller) async {
    _controller = controller;
    await controller.moveCamera(
      ym.CameraUpdate.newCameraPosition(
        _cameraForViewport(_viewport ??
            _viewportForCity(
              ref.read(currentUserProvider)?.city,
            )),
      ),
    );
    unawaited(controller.toggleUserLayer(visible: true));
    await _updateViewportFromNative();
  }

  void _handleCameraFinished() {
    _viewportDebounce?.cancel();
    _viewportDebounce = Timer(
      const Duration(milliseconds: 350),
      _updateViewportFromNative,
    );
  }

  Future<void> _updateViewportFromNative() async {
    final controller = _controller;
    if (controller == null || !mounted) {
      return;
    }
    final region = await controller.getVisibleRegion();
    final next = _viewportFromRegion(region);
    if ((_viewport ?? _defaultViewport).cacheValue == next.cacheValue) {
      return;
    }
    setState(() => _viewport = next);
  }
}

class _NativeMap extends StatelessWidget {
  const _NativeMap({
    required this.mapObjects,
    required this.loading,
    required this.renderNativeMap,
    required this.onCreated,
    required this.onCameraFinished,
  });

  final List<ym.MapObject> mapObjects;
  final bool loading;
  final bool renderNativeMap;
  final ValueChanged<ym.YandexMapController> onCreated;
  final VoidCallback onCameraFinished;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        if (renderNativeMap)
          ym.YandexMap(
            nightModeEnabled: true,
            rotateGesturesEnabled: false,
            tiltGesturesEnabled: false,
            mode2DEnabled: true,
            mapObjects: mapObjects,
            onMapCreated: onCreated,
            onCameraPositionChanged: (_, __, finished) {
              if (finished) {
                onCameraFinished();
              }
            },
          )
        else
          const _MapkitUnavailableState(),
        if (loading)
          const Center(
            child: CircularProgressIndicator(color: DateasyColors.lime),
          ),
      ],
    );
  }
}

class _MapkitUnavailableState extends StatelessWidget {
  const _MapkitUnavailableState();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(gradient: dateasyHeroGradient),
      child: Center(
        child: Icon(
          LucideIcons.map,
          size: 40,
          color: DateasyColors.muted,
        ),
      ),
    );
  }
}

class DateasyMapObjectCache {
  String _key = '';
  List<ym.MapObject> _objects = const [];

  List<ym.MapObject> objectsFor({
    required List<BackendCardItem> pins,
    required ValueChanged<String> onPinTap,
  }) {
    final nextKey = _mapObjectsCacheKey(pins);
    if (nextKey == _key) {
      return _objects;
    }
    if (pins.isEmpty) {
      _key = nextKey;
      _objects = const [];
      return const [];
    }
    final objects = <ym.MapObject>[
      ym.ClusterizedPlacemarkCollection(
        mapId: const ym.MapObjectId('event-pins'),
        radius: 48,
        minZoom: 15,
        placemarks: pins
            .map((item) => _placemark(item, onPinTap: onPinTap))
            .toList(growable: false),
        onClusterAdded: (_, cluster) async {
          return cluster.copyWith(
            appearance: cluster.appearance.copyWith(
              opacity: 0.92,
              icon: ym.PlacemarkIcon.single(
                ym.PlacemarkIconStyle(
                  image: ym.BitmapDescriptor.fromAssetImage(
                    'assets/map/pins/radar_pin_cluster.png',
                  ),
                  scale: 1,
                ),
              ),
            ),
          );
        },
      ),
    ];
    _key = nextKey;
    _objects = List<ym.MapObject>.unmodifiable(objects);
    return _objects;
  }
}

String _mapObjectsCacheKey(List<BackendCardItem> pins) {
  return pins
      .map((item) => [
            item.id,
            item.latitude?.toStringAsFixed(6) ?? '',
            item.longitude?.toStringAsFixed(6) ?? '',
            item.raw['source'] ?? '',
            item.raw['afficheEventId'] ?? '',
            item.raw['isAfterDark'] == true ? 'after-dark' : '',
          ].join(':'))
      .join('|');
}

ym.PlacemarkMapObject _placemark(
  BackendCardItem item, {
  required ValueChanged<String> onPinTap,
}) {
  return ym.PlacemarkMapObject(
    mapId: ym.MapObjectId('event-${item.id}'),
    point: ym.Point(
      latitude: item.latitude!,
      longitude: item.longitude!,
    ),
    consumeTapEvents: true,
    opacity: 1,
    onTap: (_, __) => onPinTap(item.id),
    icon: ym.PlacemarkIcon.single(
      ym.PlacemarkIconStyle(
        image: ym.BitmapDescriptor.fromAssetImage(_pinAsset(item)),
        anchor: const Offset(0.5, 1),
        scale: 1,
      ),
    ),
  );
}

String _pinAsset(BackendCardItem item) {
  final raw = item.raw;
  if (raw['isAfterDark'] == true) {
    return 'assets/map/pins/v5_pin_flame.png';
  }
  if (raw['source'] == 'affiche' || raw['afficheEventId'] != null) {
    return 'assets/map/pins/radar_pin_affiche.png';
  }
  return 'assets/map/pins/radar_pin_live.png';
}

class _TopControls extends StatelessWidget {
  const _TopControls();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        GestureDetector(
          onTap: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
          child: const _GlassPanel(
            borderRadius: 16,
            padding: EdgeInsets.zero,
            child: SizedBox(
              width: 48,
              height: 48,
              child: Icon(LucideIcons.arrowLeft, size: 20),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: GestureDetector(
            onTap: () => context.go('/search'),
            child: const _GlassPanel(
              borderRadius: 16,
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Icon(
                    LucideIcons.search,
                    size: 16,
                    color: DateasyColors.muted,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Места, события, люди',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: DateasyColors.muted,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        const _GlassPanel(
          borderRadius: 16,
          padding: EdgeInsets.zero,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(LucideIcons.slidersHorizontal, size: 20),
          ),
        ),
      ],
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(top: 12, bottom: 2),
      child: Row(
        children: [
          for (var index = 0; index < _filters.length; index++) ...[
            _FilterChip(label: _filters[index], active: index == 0),
            if (index != _filters.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
  });

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: active ? DateasyColors.foreground : DateasyColors.glass,
        borderRadius: BorderRadius.circular(999),
        border: active
            ? null
            : Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.visible,
        softWrap: false,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: active
                  ? DateasyColors.backgroundDeep
                  : DateasyColors.foreground,
              fontSize: 12,
              height: 1.15,
              fontWeight: active ? FontWeight.w600 : null,
            ),
      ),
    );
  }
}

class _NearbyCard extends StatelessWidget {
  const _NearbyCard({
    required this.items,
    required this.loading,
    required this.hasError,
    required this.open,
    required this.onToggle,
    required this.onSwipe,
  });

  final List<_NearbyItem> items;
  final bool loading;
  final bool hasError;
  final bool open;
  final VoidCallback onToggle;
  final ValueChanged<bool> onSwipe;

  @override
  Widget build(BuildContext context) {
    final visibleCount = math.min(items.length, 8);
    final body = loading
        ? const _NearbyStatus(text: 'Загружаем события')
        : items.isEmpty
            ? _NearbyStatus(
                text: hasError
                    ? 'Не удалось загрузить события'
                    : 'В этом viewport ничего не найдено',
              )
            : PageView.builder(
                controller: PageController(viewportFraction: 0.82),
                padEnds: false,
                itemCount: visibleCount,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: EdgeInsets.only(
                      right: index == visibleCount - 1 ? 0 : 8,
                    ),
                    child: _NearbyRow(item: items[index]),
                  );
                },
              );

    return GestureDetector(
      onVerticalDragEnd: (details) {
        final velocity = details.primaryVelocity ?? 0;
        if (velocity > 120) {
          onSwipe(false);
        } else if (velocity < -120) {
          onSwipe(true);
        }
      },
      child: _GlassPanel(
        borderRadius: 24,
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            GestureDetector(
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Рядом сейчас · ${items.length}'.toUpperCase(),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 12,
                              letterSpacing: 1.1,
                            ),
                      ),
                    ),
                    AnimatedRotation(
                      turns: open ? 0 : 0.5,
                      duration: const Duration(milliseconds: 180),
                      child: const Icon(
                        LucideIcons.chevronDown,
                        size: 16,
                        color: DateasyColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              child: open
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      child: SizedBox(
                        height: loading || items.isEmpty ? 72 : 76,
                        child: body,
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

class _NearbyStatus extends StatelessWidget {
  const _NearbyStatus({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _NearbyRow extends StatelessWidget {
  const _NearbyRow({required this.item});

  final _NearbyItem item;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/meetings/${item.id}'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: dateasyLimeGradient,
              ),
              child: Icon(
                item.icon,
                color: DateasyColors.backgroundDeep,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: dateasyLimeGradient,
              ),
              child: Text(
                '+Я',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return const DateasyBottomNav();
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: child,
      ),
    );
  }
}

class _NearbyItem {
  const _NearbyItem({
    required this.id,
    required this.title,
    required this.meta,
    required this.icon,
  });

  final String id;
  final String title;
  final String meta;
  final IconData icon;

  factory _NearbyItem.fromBackend(BackendCardItem item) {
    return _NearbyItem(
      id: item.id,
      title: item.title.isEmpty ? 'Встреча' : item.title,
      meta: [
        if (item.city != null) item.city,
        if (item.subtitle != null) item.subtitle,
      ].whereType<String>().join(' · '),
      icon: item.raw['isAfterDark'] == true
          ? LucideIcons.flame
          : LucideIcons.mapPin,
    );
  }
}

MapViewportQuery _viewportForCity(String? city) {
  return switch (city?.trim().toLowerCase()) {
    'спб' || 'санкт-петербург' => const MapViewportQuery(
        north: 60.05,
        south: 59.83,
        east: 30.48,
        west: 30.14,
      ),
    'казань' => const MapViewportQuery(
        north: 55.87,
        south: 55.72,
        east: 49.25,
        west: 49.02,
      ),
    'сочи' => const MapViewportQuery(
        north: 43.66,
        south: 43.49,
        east: 39.86,
        west: 39.63,
      ),
    'алматы' => const MapViewportQuery(
        north: 43.32,
        south: 43.17,
        east: 76.99,
        west: 76.82,
      ),
    'тбилиси' => const MapViewportQuery(
        north: 41.82,
        south: 41.62,
        east: 45.00,
        west: 44.65,
      ),
    _ => _defaultViewport,
  };
}

ym.CameraPosition _cameraForViewport(MapViewportQuery viewport) {
  final latitude = (viewport.north + viewport.south) / 2;
  final longitude = (viewport.east + viewport.west) / 2;
  return ym.CameraPosition(
    target: ym.Point(latitude: latitude, longitude: longitude),
    zoom: 11,
  );
}

MapViewportQuery _viewportFromRegion(ym.VisibleRegion region) {
  final north = math.max(
    region.topLeft.latitude,
    region.topRight.latitude,
  );
  final south = math.min(
    region.bottomLeft.latitude,
    region.bottomRight.latitude,
  );
  final east = math.max(
    region.topRight.longitude,
    region.bottomRight.longitude,
  );
  final west = math.min(
    region.topLeft.longitude,
    region.bottomLeft.longitude,
  );
  return MapViewportQuery(
    north: north,
    south: south,
    east: east,
    west: west,
  );
}

const _filters = ['Все', 'Встречи', 'Места', 'Люди', 'Афиша', 'Сейчас'];
