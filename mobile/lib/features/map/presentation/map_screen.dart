import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/app/core/maps/mapkit_bootstrap.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' as ym;

@visibleForTesting
const mapAutoNativeUserLayerEnabled = false;

const _initialNearbyRadiusKm = 25.0;

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({
    this.initialEventId,
    super.key,
  });

  final String? initialEventId;

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  late final Future<void> _mapBootstrapFuture;
  late final PageController _eventPageController;
  ym.YandexMapController? _mapController;
  Timer? _viewportQueryDebounce;
  int _mapControllerGeneration = 0;
  MapEventsQuery _mapQuery = const MapEventsQuery();
  ym.Point? _searchPoint;
  ym.Point? _userPoint;
  String selected = '';
  String filter = 'all';
  bool _locating = false;
  bool _primingInitialLocation = false;
  bool _didPrimeInitialLocation = false;
  bool _triedInitialLocation = false;
  bool _autoFitPending = false;
  String _lastViewportFitKey = '';

  bool get _supportsNativeMap =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android);

  @override
  void initState() {
    super.initState();
    _eventPageController = PageController(viewportFraction: 0.92);
    final initialEventId = widget.initialEventId;
    if (initialEventId != null && initialEventId.isNotEmpty) {
      selected = initialEventId;
    }
    _mapBootstrapFuture = _supportsNativeMap
        ? ref.read(mapkitBootstrapProvider).ensureInitialized()
        : Future<void>.value();
    if ((initialEventId ?? '').isEmpty) {
      unawaited(_primeInitialUserLocation(animated: false));
    }
  }

  @override
  void dispose() {
    _mapControllerGeneration += 1;
    _mapController = null;
    _viewportQueryDebounce?.cancel();
    _eventPageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final rawEvents =
        ref.watch(mapEventsProvider(_mapQuery)).valueOrNull ?? const <Event>[];
    final hasInitialEvent = (widget.initialEventId ?? '').isNotEmpty;
    final events = hasInitialEvent
        ? rawEvents
        : filterMapEventsByDistanceFromPoint(
            events: rawEvents,
            userPoint: _userPoint,
            radiusKm: _initialNearbyRadiusKm,
          );
    final filteredEvents = _filteredEvents(events, filter);
    final liveEvenings =
        (ref.watch(eveningSessionsProvider).valueOrNull ?? const [])
            .where((session) => session.phase == EveningSessionPhase.live)
            .take(4)
            .toList(growable: false);
    final activeEvent = filteredEvents
            .where((item) => item.id == selected)
            .cast<Event?>()
            .firstOrNull ??
        (filteredEvents.isNotEmpty ? filteredEvents.first : null);
    final selectedId = activeEvent?.id ?? selected;
    final mapObjects = _buildMapObjects(
      filteredEvents,
      selectedId,
      liveEvenings,
    );
    _syncPagerToSelected(filteredEvents, selectedId);
    _scheduleViewportFit(filteredEvents);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Positioned.fill(
              child: _buildMapSurface(
                filteredEvents,
                mapObjects,
                selectedId,
              ),
            ),
            if (!_supportsNativeMap)
              for (final entry in liveEvenings.asMap().entries)
                _LiveEveningMapPin(
                  session: entry.value,
                  index: entry.key,
                ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                children: [
                  Row(
                    children: [
                      _MapTopButton(
                        icon: Icons.chevron_left_rounded,
                        onTap: () => context.pop(),
                      ),
                      const Spacer(),
                      Container(
                        height: 40,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: colors.background.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: AppShadows.soft,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              size: 14,
                              color: colors.primary,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Text(
                              '${filteredEvents.length} встреч рядом',
                              style: AppTextStyles.meta.copyWith(
                                color: colors.foreground,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      _MapTopButton(
                        icon: Icons.layers_outlined,
                        onTap: () => _selectFilter(
                          filter == 'all' ? 'calm' : 'all',
                          events,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    height: 44,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _mapFilterChip('all', 'Все', events),
                        const SizedBox(width: AppSpacing.xs),
                        _mapFilterChip('now', 'Сейчас', events),
                        const SizedBox(width: AppSpacing.xs),
                        _mapFilterChip('popular', 'Популярные', events),
                        const SizedBox(width: AppSpacing.xs),
                        _mapFilterChip('calm', 'Спокойно', events),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              right: 16,
              bottom: 132,
              child: _MapTopButton(
                icon: _locating
                    ? Icons.more_horiz_rounded
                    : Icons.my_location_rounded,
                onTap: _locating ? null : _moveToCurrentLocation,
              ),
            ),
            if (filteredEvents.isNotEmpty)
              Positioned(
                left: 0,
                right: 0,
                bottom: 8,
                child: SizedBox(
                  height: 112,
                  child: PageView.builder(
                    key: const Key('map-event-card-pager'),
                    controller: _eventPageController,
                    itemCount: filteredEvents.length,
                    onPageChanged: (index) {
                      if (index < filteredEvents.length) {
                        _selectEvent(
                          filteredEvents[index],
                          filteredEvents,
                          animatePager: false,
                        );
                      }
                    },
                    itemBuilder: (context, index) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: _MapEventCard(
                        event: filteredEvents[index],
                        onTap: () => context.pushRoute(
                          AppRoute.eventDetail,
                          pathParameters: {'eventId': filteredEvents[index].id},
                        ),
                        decoration: _eventToneDecoration(
                          colors,
                          filteredEvents[index].tone,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapSurface(
    List<Event> filteredEvents,
    List<ym.MapObject> mapObjects,
    String selectedId,
  ) {
    if (!_supportsNativeMap) {
      return _FallbackMapSurface(
        events: filteredEvents,
        selectedId: selectedId,
        onTap: (eventId) => _handleEventTap(eventId, filteredEvents),
      );
    }

    return FutureBuilder<void>(
      future: _mapBootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return _FallbackMapSurface(
            key: const Key('map-bootstrap-error-surface'),
            events: filteredEvents,
            selectedId: selectedId,
            onTap: (eventId) => _handleEventTap(eventId, filteredEvents),
            footer: const _NativeMapErrorBadge(),
          );
        }

        if (snapshot.connectionState != ConnectionState.done) {
          return const _NativeMapLoadingSurface(
            key: Key('map-native-loading'),
          );
        }

        return Container(
          key: const Key('map-native-surface'),
          color: const Color(0xFFF1ECE2),
          child: ym.YandexMap(
            mapObjects: mapObjects,
            onMapCreated: (controller) =>
                _onMapCreated(controller, filteredEvents),
            onCameraPositionChanged: _onCameraPositionChanged,
            onMapTap: _onMapTap,
          ),
        );
      },
    );
  }

  BoxDecoration _eventToneDecoration(
    BigBreakThemeColors colors,
    EventTone tone,
  ) {
    switch (tone) {
      case EventTone.evening:
        return BoxDecoration(
          gradient: LinearGradient(
            colors: [colors.eveningStart, colors.eveningEnd],
          ),
          borderRadius: BorderRadius.circular(18),
        );
      case EventTone.sage:
        return BoxDecoration(
          color: colors.secondarySoft,
          borderRadius: BorderRadius.circular(18),
        );
      case EventTone.warm:
        return BoxDecoration(
          gradient: LinearGradient(
            colors: [colors.warmStart, colors.warmEnd],
          ),
          borderRadius: BorderRadius.circular(18),
        );
    }
  }

  List<ym.MapObject> _buildMapObjects(
    List<Event> filteredEvents,
    String selectedId,
    List<EveningSessionSummary> liveEvenings,
  ) {
    final eventPlacemarks = buildEventPlacemarks(
      events: filteredEvents,
      selectedId: selectedId,
      onEventTap: (eventId) => _handleEventTap(eventId, filteredEvents),
    );
    final eveningPlacemarks = buildLiveEveningPlacemarks(
      sessions: liveEvenings,
      onSessionTap: _openEveningPreview,
    );
    final objects = <ym.MapObject>[
      ...eventPlacemarks,
      ...eveningPlacemarks,
    ];

    if (_searchPoint != null) {
      objects.add(
        ym.PlacemarkMapObject(
          mapId: const ym.MapObjectId('search_point'),
          point: _searchPoint!,
          zIndex: 3,
          text: const ym.PlacemarkText(
            text: '📍',
            style: ym.PlacemarkTextStyle(
              size: 18,
              placement: ym.TextStylePlacement.center,
              offsetFromIcon: false,
            ),
          ),
        ),
      );
    }

    if (_userPoint != null) {
      objects.add(
        ym.PlacemarkMapObject(
          mapId: const ym.MapObjectId('user_point'),
          point: _userPoint!,
          zIndex: 4,
          text: const ym.PlacemarkText(
            text: '📍',
            style: ym.PlacemarkTextStyle(
              size: 18,
              placement: ym.TextStylePlacement.center,
              offsetFromIcon: false,
            ),
          ),
        ),
      );
    }

    return objects;
  }

  void _openEveningPreview(String sessionId) {
    context.pushRoute(
      AppRoute.eveningPreview,
      pathParameters: {'sessionId': sessionId},
    );
  }

  void _onMapCreated(
    ym.YandexMapController controller,
    List<Event> filteredEvents,
  ) {
    _mapControllerGeneration += 1;
    _mapController = controller;
    if (mapAutoNativeUserLayerEnabled) {
      unawaited(controller.toggleUserLayer(visible: true));
    }
    final initialEventId = widget.initialEventId;
    if (initialEventId != null && initialEventId.isNotEmpty) {
      final activeEvent = filteredEvents
          .where((item) => item.id == initialEventId)
          .cast<Event?>()
          .firstOrNull;
      final point = activeEvent == null ? null : _pointForEvent(activeEvent);
      if (point == null) {
        return;
      }
      unawaited(
        _moveToPoint(
          point,
          zoom: 15,
          animated: false,
        ),
      );
      return;
    }

    final fitKey = buildMapViewportFitKey(filteredEvents, filter);
    if (shouldScheduleMapViewportFit(
      supportsNativeMap: _supportsNativeMap,
      hasMapController: _mapController != null,
      hasInitialEvent: false,
      autoFitPending: _autoFitPending,
      fitKey: fitKey,
      lastFitKey: _lastViewportFitKey,
    )) {
      _autoFitPending = false;
      _lastViewportFitKey = fitKey;
      unawaited(_fitViewportForEvents(filteredEvents, animated: false));
      return;
    }
    if (_userPoint != null) {
      unawaited(_moveToUserPreview(_userPoint!, animated: false));
    } else {
      unawaited(_primeInitialUserLocation(animated: false));
    }
  }

  void _onCameraPositionChanged(
    ym.CameraPosition cameraPosition,
    ym.CameraUpdateReason reason,
    bool finished,
  ) {
    if (!shouldRefreshMapViewportQuery(reason: reason, finished: finished)) {
      return;
    }

    _viewportQueryDebounce?.cancel();
    _viewportQueryDebounce = Timer(
      const Duration(milliseconds: 250),
      () {
        if (!mounted || _mapController == null) {
          return;
        }
        unawaited(_refreshViewportQuery(center: cameraPosition.target));
      },
    );
  }

  Future<void> _refreshViewportQuery({ym.Point? center}) async {
    final controller = _mapController;
    final generation = _mapControllerGeneration;
    if (controller == null) {
      return;
    }

    try {
      final visibleRegion = await controller.getVisibleRegion();
      if (!_isActiveMapController(controller, generation)) {
        return;
      }
      final cameraCenter =
          center ?? (await controller.getCameraPosition()).target;
      if (!_isActiveMapController(controller, generation)) {
        return;
      }

      final nextQuery = buildMapEventsQuery(
        bounds: boundingBoxFromVisibleRegion(visibleRegion),
        center: cameraCenter,
      );
      if (nextQuery == _mapQuery) {
        return;
      }

      setState(() {
        _mapQuery = nextQuery;
      });
    } catch (_) {
      return;
    }
  }

  bool _isActiveMapController(
    ym.YandexMapController controller,
    int generation,
  ) {
    return mounted &&
        identical(_mapController, controller) &&
        _mapControllerGeneration == generation;
  }

  Future<void> _primeInitialUserLocation({required bool animated}) async {
    if (_didPrimeInitialLocation || _primingInitialLocation) {
      return;
    }

    _didPrimeInitialLocation = true;
    _primingInitialLocation = true;
    _triedInitialLocation = true;
    try {
      final position = await _resolveCurrentPosition();
      if (position == null || !mounted) {
        return;
      }

      final point = ym.Point(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      setState(() {
        _autoFitPending = true;
        _userPoint = point;
        _mapQuery = buildInitialMapEventsQuery(point);
      });

      unawaited(_moveToUserPreview(point, animated: animated));
    } finally {
      _primingInitialLocation = false;
    }
  }

  Future<void> _moveToCurrentLocation() async {
    setState(() {
      _locating = true;
    });

    try {
      final position = await _resolveCurrentPosition();
      if (position == null) {
        return;
      }

      final point = ym.Point(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _autoFitPending = true;
        _lastViewportFitKey = '';
        _searchPoint = point;
        _userPoint = point;
        _mapQuery = buildInitialMapEventsQuery(point);
      });
      unawaited(_moveToUserPreview(point));
    } finally {
      if (mounted) {
        setState(() {
          _locating = false;
        });
      }
    }
  }

  Future<Position?> _resolveCurrentPosition() async {
    return ref.read(appLocationServiceProvider).getCurrentPosition();
  }

  Future<void> _moveToUserPreview(
    ym.Point point, {
    bool animated = true,
  }) {
    return _moveToPoint(point, zoom: 13.5, animated: animated);
  }

  Future<void> _moveToPoint(
    ym.Point point, {
    double zoom = 14,
    bool animated = true,
  }) async {
    final controller = _mapController;
    if (controller == null) {
      return;
    }

    try {
      await controller.moveCamera(
        ym.CameraUpdate.newCameraPosition(
          ym.CameraPosition(
            target: point,
            zoom: zoom,
            azimuth: 0,
            tilt: 0,
          ),
        ),
        animation: animated
            ? const ym.MapAnimation(
                type: ym.MapAnimationType.smooth,
                duration: 0.35,
              )
            : null,
      );
    } catch (_) {
      return;
    }
  }

  Future<void> _moveToBounds(
    ym.BoundingBox bounds, {
    bool animated = true,
  }) async {
    final controller = _mapController;
    if (controller == null) {
      return;
    }

    try {
      await controller.moveCamera(
        ym.CameraUpdate.newGeometry(
          ym.Geometry.fromBoundingBox(bounds),
          focusRect: _mapFocusRect(),
        ),
        animation: animated
            ? const ym.MapAnimation(
                type: ym.MapAnimationType.smooth,
                duration: 0.35,
              )
            : null,
      );
    } catch (_) {
      return;
    }
  }

  ym.ScreenRect? _mapFocusRect() {
    final size = MediaQuery.sizeOf(context);
    if (size.width <= 0 || size.height <= 0) {
      return null;
    }

    return ym.ScreenRect(
      topLeft: const ym.ScreenPoint(x: 0, y: 0),
      bottomRight: ym.ScreenPoint(
        x: size.width,
        y: (size.height - 145).clamp(240, size.height).toDouble(),
      ),
    );
  }

  Future<void> _fitViewportForEvents(
    List<Event> events, {
    bool animated = true,
  }) async {
    final eventPoints = events
        .map(_pointForEvent)
        .whereType<ym.Point>()
        .toList(growable: false);
    if (eventPoints.isEmpty) {
      return;
    }

    final userPoint = await _resolveViewportUserPoint();
    if (!mounted) {
      return;
    }

    final bounds = buildMapViewportBounds(
      userPoint: userPoint,
      eventPoints: eventPoints,
    );
    if (bounds == null) {
      return;
    }

    await _moveToBounds(bounds, animated: animated);
  }

  Future<ym.Point?> _resolveViewportUserPoint() async {
    if (_userPoint != null) {
      return _userPoint;
    }
    if (_triedInitialLocation) {
      return null;
    }

    _triedInitialLocation = true;
    final position = await _resolveCurrentPosition();
    if (position == null) {
      return null;
    }

    final point = ym.Point(
      latitude: position.latitude,
      longitude: position.longitude,
    );
    if (mounted) {
      setState(() {
        _userPoint = point;
      });
    }
    return point;
  }

  void _onMapTap(ym.Point point) {
    setState(() {
      _searchPoint = point;
    });
    unawaited(_moveToPoint(point, zoom: 15));
  }

  void _handleEventTap(String eventId, List<Event> events) {
    final event = events.where((item) => item.id == eventId).firstOrNull;
    if (event == null) {
      return;
    }
    _selectEvent(event, events, animatePager: true);
  }

  void _selectEvent(
    Event event,
    List<Event> events, {
    required bool animatePager,
  }) {
    setState(() {
      selected = event.id;
    });

    if (animatePager) {
      final index = events.indexWhere((item) => item.id == event.id);
      if (index >= 0 && _eventPageController.hasClients) {
        unawaited(
          _eventPageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          ),
        );
      }
    }
  }

  void _syncPagerToSelected(List<Event> events, String selectedId) {
    if (selectedId.isEmpty) {
      return;
    }
    final index = events.indexWhere((item) => item.id == selectedId);
    if (index < 0) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_eventPageController.hasClients) {
        return;
      }
      final currentPage = _eventPageController.page?.round() ?? 0;
      if (currentPage == index) {
        return;
      }
      _eventPageController.jumpToPage(index);
    });
  }

  void _scheduleViewportFit(List<Event> events) {
    final fitKey = buildMapViewportFitKey(events, filter);
    if (!shouldScheduleMapViewportFit(
      supportsNativeMap: _supportsNativeMap,
      hasMapController: _mapController != null,
      hasInitialEvent: (widget.initialEventId ?? '').isNotEmpty,
      autoFitPending: _autoFitPending,
      fitKey: fitKey,
      lastFitKey: _lastViewportFitKey,
    )) {
      return;
    }
    _autoFitPending = false;
    _lastViewportFitKey = fitKey;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _mapController == null) {
        return;
      }
      unawaited(_fitViewportForEvents(events));
    });
  }

  Widget _mapFilterChip(String key, String label, List<Event> events) {
    final colors = AppColors.of(context);
    final active = filter == key;
    return InkWell(
      onTap: () => _selectFilter(key, events),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? colors.foreground : colors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? colors.foreground : colors.border,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.meta.copyWith(
            color: active ? colors.primaryForeground : colors.inkSoft,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  void _selectFilter(String nextFilter, List<Event> events) {
    final filtered = _filteredEvents(events, nextFilter);
    setState(() {
      filter = nextFilter;
      if (filtered.isEmpty) {
        return;
      }
      if (!filtered.any((item) => item.id == selected)) {
        selected = filtered.first.id;
      }
    });

    if (filtered.isNotEmpty) {
      final activeEvent = filtered
              .where((item) => item.id == selected)
              .cast<Event?>()
              .firstOrNull ??
          filtered.first;
      final index = filtered.indexWhere((item) => item.id == activeEvent.id);
      if (index >= 0 && _eventPageController.hasClients) {
        unawaited(
          _eventPageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          ),
        );
      }
      unawaited(_fitViewportForEvents(filtered));
    }
  }

  ym.Point? _pointForEvent(Event event) {
    return _pointForEventModel(event);
  }

  List<Event> _filteredEvents(List<Event> events, String currentFilter) {
    switch (currentFilter) {
      case 'now':
        return events
            .where((item) => item.time.toLowerCase().contains('сегодня'))
            .toList(growable: false);
      case 'popular':
        return events.where((item) => item.going >= 8).toList(growable: false);
      case 'calm':
        return events
            .where((item) => item.vibe.toLowerCase() == 'спокойно')
            .toList(growable: false);
      case 'all':
      default:
        return events;
    }
  }
}

@visibleForTesting
ym.BoundingBox? buildMapViewportBounds({
  required ym.Point? userPoint,
  required List<ym.Point> eventPoints,
}) {
  final points = [
    if (userPoint != null) userPoint,
    ...eventPoints,
  ];
  if (points.isEmpty) {
    return null;
  }

  var minLatitude = points.first.latitude;
  var maxLatitude = points.first.latitude;
  var minLongitude = points.first.longitude;
  var maxLongitude = points.first.longitude;

  for (final point in points.skip(1)) {
    minLatitude = point.latitude < minLatitude ? point.latitude : minLatitude;
    maxLatitude = point.latitude > maxLatitude ? point.latitude : maxLatitude;
    minLongitude =
        point.longitude < minLongitude ? point.longitude : minLongitude;
    maxLongitude =
        point.longitude > maxLongitude ? point.longitude : maxLongitude;
  }

  final latitudeSpan = maxLatitude - minLatitude;
  final longitudeSpan = maxLongitude - minLongitude;
  final latitudePadding = (latitudeSpan * 0.18).clamp(0.006, 0.12).toDouble();
  final longitudePadding = (longitudeSpan * 0.18).clamp(0.006, 0.12).toDouble();

  return ym.BoundingBox(
    southWest: ym.Point(
      latitude: minLatitude - latitudePadding,
      longitude: minLongitude - longitudePadding,
    ),
    northEast: ym.Point(
      latitude: maxLatitude + latitudePadding,
      longitude: maxLongitude + longitudePadding,
    ),
  );
}

@visibleForTesting
bool shouldScheduleMapViewportFit({
  required bool supportsNativeMap,
  required bool hasMapController,
  required bool hasInitialEvent,
  required bool autoFitPending,
  required String fitKey,
  required String lastFitKey,
}) {
  return supportsNativeMap &&
      hasMapController &&
      !hasInitialEvent &&
      autoFitPending &&
      fitKey.isNotEmpty &&
      fitKey != lastFitKey;
}

@visibleForTesting
bool shouldRefreshMapViewportQuery({
  required ym.CameraUpdateReason reason,
  required bool finished,
}) {
  return finished && reason == ym.CameraUpdateReason.gestures;
}

@visibleForTesting
List<Event> filterMapEventsByDistanceFromPoint({
  required List<Event> events,
  required ym.Point? userPoint,
  required double radiusKm,
}) {
  if (userPoint == null) {
    return events;
  }

  return events.where((event) {
    final point = _pointForEventModel(event);
    if (point == null) {
      return false;
    }
    return _distanceKm(userPoint, point) <= radiusKm;
  }).toList(growable: false);
}

@visibleForTesting
String buildMapViewportFitKey(List<Event> events, String filter) {
  final parts = events
      .where((event) => event.latitude != null && event.longitude != null)
      .map(
        (event) =>
            '${event.id}:${event.latitude!.toStringAsFixed(5)},${event.longitude!.toStringAsFixed(5)}',
      )
      .toList(growable: false);
  if (parts.isEmpty) {
    return '';
  }

  return '$filter|${parts.join('|')}';
}

@visibleForTesting
List<ym.PlacemarkMapObject> buildEventPlacemarks({
  required List<Event> events,
  required String selectedId,
  required void Function(String eventId) onEventTap,
}) {
  return [
    for (final event in events)
      if (event.latitude != null && event.longitude != null)
        ym.PlacemarkMapObject(
          mapId: ym.MapObjectId('event_${event.id}'),
          point: ym.Point(
            latitude: event.latitude!,
            longitude: event.longitude!,
          ),
          zIndex: event.id == selectedId ? 2 : 1,
          consumeTapEvents: true,
          opacity: 1,
          icon: ym.PlacemarkIcon.single(
            ym.PlacemarkIconStyle(
              image: ym.BitmapDescriptor.fromBytes(
                _eventPinBytes(),
              ),
              scale: event.id == selectedId ? 0.68 : 0.5,
              anchor: const Offset(0.5, 0.5),
            ),
          ),
          onTap: (_, __) => onEventTap(event.id),
          text: ym.PlacemarkText(
            text: event.emoji,
            style: ym.PlacemarkTextStyle(
              size: event.id == selectedId ? 15 : 12,
              color: const Color(0xFF2A2A2A),
              outlineColor: Colors.white,
              placement: ym.TextStylePlacement.center,
              offsetFromIcon: false,
            ),
          ),
        ),
  ];
}

@visibleForTesting
List<ym.PlacemarkMapObject> buildLiveEveningPlacemarks({
  required List<EveningSessionSummary> sessions,
  required void Function(String sessionId) onSessionTap,
}) {
  return [
    for (final session in sessions)
      if (session.lat != null && session.lng != null)
        ym.PlacemarkMapObject(
          mapId: ym.MapObjectId('evening_session_${session.id}'),
          point: ym.Point(
            latitude: session.lat!,
            longitude: session.lng!,
          ),
          zIndex: 5,
          consumeTapEvents: true,
          opacity: 1,
          icon: ym.PlacemarkIcon.single(
            ym.PlacemarkIconStyle(
              image: ym.BitmapDescriptor.fromBytes(
                _eventPinBytes(),
              ),
              scale: 0.62,
              anchor: const Offset(0.5, 0.5),
            ),
          ),
          onTap: (_, __) => onSessionTap(session.id),
          text: ym.PlacemarkText(
            text: session.emoji,
            style: const ym.PlacemarkTextStyle(
              size: 14,
              color: Color(0xFF2A2A2A),
              outlineColor: Colors.white,
              placement: ym.TextStylePlacement.center,
              offsetFromIcon: false,
            ),
          ),
        ),
  ];
}

ym.Point? _pointForEventModel(Event event) {
  final latitude = event.latitude;
  final longitude = event.longitude;
  if (latitude == null || longitude == null) {
    return null;
  }

  return ym.Point(
    latitude: latitude,
    longitude: longitude,
  );
}

@visibleForTesting
MapEventsQuery buildMapEventsQuery({
  required ym.BoundingBox bounds,
  required ym.Point center,
}) {
  final radiusKm = [
    _distanceKm(center, bounds.southWest),
    _distanceKm(center, bounds.northEast),
  ].reduce((value, item) => value > item ? value : item);

  return MapEventsQuery(
    centerLatitude: _roundGeo(center.latitude),
    centerLongitude: _roundGeo(center.longitude),
    radiusKm: _roundDistanceKm(radiusKm.clamp(0.5, 100).toDouble()),
    southWestLatitude: _roundGeo(bounds.southWest.latitude),
    southWestLongitude: _roundGeo(bounds.southWest.longitude),
    northEastLatitude: _roundGeo(bounds.northEast.latitude),
    northEastLongitude: _roundGeo(bounds.northEast.longitude),
  );
}

@visibleForTesting
ym.BoundingBox boundingBoxFromVisibleRegion(ym.VisibleRegion region) {
  final points = [
    region.topLeft,
    region.topRight,
    region.bottomLeft,
    region.bottomRight,
  ];
  var minLatitude = points.first.latitude;
  var maxLatitude = points.first.latitude;
  var minLongitude = points.first.longitude;
  var maxLongitude = points.first.longitude;

  for (final point in points.skip(1)) {
    minLatitude = point.latitude < minLatitude ? point.latitude : minLatitude;
    maxLatitude = point.latitude > maxLatitude ? point.latitude : maxLatitude;
    minLongitude =
        point.longitude < minLongitude ? point.longitude : minLongitude;
    maxLongitude =
        point.longitude > maxLongitude ? point.longitude : maxLongitude;
  }

  return ym.BoundingBox(
    southWest: ym.Point(
      latitude: minLatitude,
      longitude: minLongitude,
    ),
    northEast: ym.Point(
      latitude: maxLatitude,
      longitude: maxLongitude,
    ),
  );
}

@visibleForTesting
MapEventsQuery buildInitialMapEventsQuery(ym.Point point) {
  return MapEventsQuery(
    centerLatitude: _roundGeo(point.latitude),
    centerLongitude: _roundGeo(point.longitude),
    radiusKm: _initialNearbyRadiusKm,
  );
}

final _eventPinCache = <String, Uint8List>{};

Uint8List _eventPinBytes() {
  const key = 'event-pin-circle-v1';
  final cached = _eventPinCache[key];
  if (cached != null) {
    return cached;
  }

  final bytes = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAACx0lEQVR42u2cr3LCQBDGKxAIRGV9BRJRiaioqMMVyQMgKxDIiDwAAolERCIqIniAvgAPgOhMDdNhppbuznwyuT/NBZLLdzOfYUhy+c3e7t3eXu7u2NjYYmyXy6UnehANRU+isegZGuO3If7T6wKQgWgkmojmokS0Fm1FO1Eu2kM5ftviPwmumeAeg5isRC1hJkpFmehT9DV6e7n4SK/BtRnuNcO9e20Ecy96FS3xQgdfIA7ADrj3Es+6bwOYPjqbYJicQoMpAHXCsxI8u99UOGruC9GH6Fw3mAJQZzxb+/DUNOc7FW1ER5+X+v35dpInqCP6Mr25M5cOPIreNfKEBBICGKKh9u3xlkMqdXHAocD4goIjT68+5DCRW9nCdV1gfEBheqB9HV8TztoUoa4FxhUUIt26dkgYVqsmwnGEtKptuMEhp2XD6tZgXEBhuKXBHTdC+XuZQ24aHAukA95lEBLQtCyUNxWOBZJOAaYh/c6mjXAskDaV/RHWVouyGXLLAR3xbv0qgHTx99FmOBZIunZ7rZKySIoWnm2DUwYJC9zkX6kSWE8eg/VYrCj3tiJkApdFE8K2wjFY0Qnv2vONXFlM1mOxoswroiHfe4gNjsGKdPI485k1pzFaj8WKUqfZNbZVsljhGKxIh9nIBZDuPX12EJBuKU1cAM2LVuwdAKQr/blLeE9i9j8WP5QYwz32wdexwzFYkWYdH0yAtFhg22FAWgswtE0Qdx0GtDNOGJGQzzsMKDcm9lGbs+8wIM00PhNQBUAcYpYhRidtcdIM85Ywz4miZaLIpYYts8jFKtMdldMdTJgx5Voh5cqkPbd9gmz7cOOQW88Vtp5ZvMDyl+rlLyygYgneJlhJMIs4WQbMQvJaC8l5FIGHWXgc6mpweKCORzJ5qJfHwpt0LJwfFuCnKWoFxY+beDpzfh7H07r4gSU2tm63PwhRxsGm70hUAAAAAElFTkSuQmCC',
  );
  _eventPinCache[key] = bytes;
  return bytes;
}

double _roundGeo(double value) => double.parse(value.toStringAsFixed(5));

double _roundDistanceKm(double value) => double.parse(value.toStringAsFixed(1));

double _distanceKm(ym.Point from, ym.Point to) {
  const earthRadiusKm = 6371.0;
  final latitudeDelta = (to.latitude - from.latitude) * 0.017453292519943295;
  final longitudeDelta = (to.longitude - from.longitude) * 0.017453292519943295;
  final fromRad = from.latitude * 0.017453292519943295;
  final toRad = to.latitude * 0.017453292519943295;
  final a = math.sin(latitudeDelta / 2) * math.sin(latitudeDelta / 2) +
      math.cos(fromRad) *
          math.cos(toRad) *
          math.sin(longitudeDelta / 2) *
          math.sin(longitudeDelta / 2);
  return 2 * earthRadiusKm * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

class _MapEventCard extends StatelessWidget {
  const _MapEventCard({
    required this.event,
    required this.onTap,
    required this.decoration,
  });

  final Event event;
  final VoidCallback onTap;
  final BoxDecoration decoration;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardBorder,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: AppRadii.cardBorder,
          border: Border.all(color: colors.border),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: decoration,
              alignment: Alignment.center,
              child: Text(
                event.emoji,
                style: const TextStyle(fontSize: 22),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${event.vibe} · ${event.distance}',
                    style: AppTextStyles.caption,
                  ),
                  Text(
                    event.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.itemTitle.copyWith(fontSize: 15),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${event.time} · ${event.place}',
                    style: AppTextStyles.meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapTopButton extends StatelessWidget {
  const _MapTopButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.background.withValues(alpha: 0.9),
      shadowColor: colors.foreground.withValues(alpha: 0.08),
      elevation: 1,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, color: colors.foreground),
        ),
      ),
    );
  }
}

class _LiveEveningMapPin extends StatelessWidget {
  const _LiveEveningMapPin({
    required this.session,
    required this.index,
  });

  final EveningSessionSummary session;
  final int index;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final positions = const [
      Offset(0.32, 0.24),
      Offset(0.58, 0.31),
      Offset(0.42, 0.48),
      Offset(0.70, 0.42),
    ];
    final position = positions[index % positions.length];
    final size = MediaQuery.sizeOf(context);

    return Positioned(
      key: ValueKey('map-live-evening-pin-${session.id}'),
      left: size.width * position.dx - 26,
      top: size.height * position.dy - 26,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.pushRoute(
            AppRoute.eveningPreview,
            pathParameters: {'sessionId': session.id},
          ),
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 64,
            height: 72,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Positioned(
                  top: 0,
                  child: _MapLivePulse(
                    key: ValueKey('map-live-evening-pulse-${session.id}'),
                  ),
                ),
                Positioned(
                  top: 4,
                  child: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors.primary,
                      border: Border.all(color: colors.background, width: 4),
                      boxShadow: AppShadows.card,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      session.emoji,
                      style: const TextStyle(fontSize: 20),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: colors.primary,
                      borderRadius: AppRadii.pillBorder,
                    ),
                    child: Text(
                      'Live',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.primaryForeground,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.7,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MapLivePulse extends StatefulWidget {
  const _MapLivePulse({super.key});

  @override
  State<_MapLivePulse> createState() => _MapLivePulseState();
}

class _MapLivePulseState extends State<_MapLivePulse> {
  Timer? _pulseTimer;
  bool _wide = true;

  @override
  void initState() {
    super.initState();
    _pulseTimer = Timer.periodic(const Duration(milliseconds: 1300), (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _wide = !_wide;
      });
    });
  }

  @override
  void dispose() {
    _pulseTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeInOut,
      width: _wide ? 56 : 48,
      height: _wide ? 56 : 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.primary.withValues(alpha: _wide ? 0.22 : 0.34),
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x668B7D6B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final thinPaint = Paint()
      ..color = const Color(0x408B7D6B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    final mainPath = Path()
      ..moveTo(size.width * 0.1, size.height * 0.15)
      ..quadraticBezierTo(
        size.width * 0.3,
        size.height * 0.1,
        size.width * 0.48,
        size.height * 0.2,
      )
      ..quadraticBezierTo(
        size.width * 0.62,
        size.height * 0.28,
        size.width * 0.88,
        size.height * 0.18,
      );

    final middlePath = Path()
      ..moveTo(size.width * 0.12, size.height * 0.4)
      ..cubicTo(
        size.width * 0.24,
        size.height * 0.34,
        size.width * 0.46,
        size.height * 0.44,
        size.width * 0.66,
        size.height * 0.36,
      )
      ..quadraticBezierTo(
        size.width * 0.78,
        size.height * 0.33,
        size.width * 0.9,
        size.height * 0.42,
      );

    final lowerPath = Path()
      ..moveTo(size.width * 0.08, size.height * 0.72)
      ..cubicTo(
        size.width * 0.22,
        size.height * 0.6,
        size.width * 0.42,
        size.height * 0.8,
        size.width * 0.58,
        size.height * 0.7,
      )
      ..quadraticBezierTo(
        size.width * 0.72,
        size.height * 0.64,
        size.width * 0.92,
        size.height * 0.76,
      );

    final verticalPath = Path()
      ..moveTo(size.width * 0.28, size.height * 0.08)
      ..quadraticBezierTo(
        size.width * 0.36,
        size.height * 0.26,
        size.width * 0.34,
        size.height * 0.42,
      )
      ..quadraticBezierTo(
        size.width * 0.32,
        size.height * 0.56,
        size.width * 0.26,
        size.height * 0.84,
      );

    canvas.drawPath(mainPath, paint);
    canvas.drawPath(middlePath, paint);
    canvas.drawPath(lowerPath, paint);
    canvas.drawPath(verticalPath, thinPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _NativeMapLoadingSurface extends StatelessWidget {
  const _NativeMapLoadingSurface({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      color: const Color(0xFFF1ECE2),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 2.4,
              color: colors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Поднимаем карту',
            style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
          ),
        ],
      ),
    );
  }
}

class _NativeMapErrorBadge extends StatelessWidget {
  const _NativeMapErrorBadge();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Positioned(
      top: 132,
      left: 16,
      right: 16,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.background.withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.border),
          boxShadow: AppShadows.soft,
        ),
        child: Text(
          'Карта не успела подняться. Пока показываем облегчённый режим.',
          style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _FallbackMapSurface extends StatelessWidget {
  const _FallbackMapSurface({
    super.key,
    required this.events,
    required this.selectedId,
    required this.onTap,
    this.footer,
  });

  final List<Event> events;
  final String selectedId;
  final ValueChanged<String> onTap;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Stack(
      key: const Key('map-fallback-surface'),
      children: [
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFFF1ECE2), Color(0xFFE3D7C6)],
              ),
            ),
            child: CustomPaint(
              painter: _MapPainter(),
            ),
          ),
        ),
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final eventsWithCoordinates = events
                  .where((event) =>
                      event.latitude != null && event.longitude != null)
                  .toList(growable: false);
              return Stack(
                children: [
                  for (final entry in eventsWithCoordinates.asMap().entries)
                    Positioned(
                      left: constraints.maxWidth *
                              _fallbackPositionForEvent(
                                entry.value,
                                entry.key,
                                events.length,
                              ).left -
                          28,
                      top: constraints.maxHeight *
                              _fallbackPositionForEvent(
                                entry.value,
                                entry.key,
                                events.length,
                              ).top -
                          28,
                      child: GestureDetector(
                        onTap: () => onTap(entry.value.id),
                        child: _FallbackPin(
                          emoji: entry.value.emoji,
                          selected: entry.value.id == selectedId,
                          tone: entry.value.tone,
                          colors: colors,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        if (footer != null) footer!,
      ],
    );
  }
}

({double left, double top}) _fallbackPositionForEvent(
  Event event,
  int index,
  int total,
) {
  final left = ((event.longitude! - 37.5) / 0.2).clamp(0.14, 0.86);
  final top = (1 - ((event.latitude! - 55.70) / 0.1)).clamp(0.18, 0.82);
  return (left: left, top: top);
}

class _FallbackPin extends StatelessWidget {
  const _FallbackPin({
    required this.emoji,
    required this.selected,
    required this.tone,
    required this.colors,
  });

  final String emoji;
  final bool selected;
  final EventTone tone;
  final BigBreakThemeColors colors;

  @override
  Widget build(BuildContext context) {
    final size = selected ? 56.0 : 44.0;
    return Transform.scale(
      scale: selected ? 1.1 : 1,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: AppShadows.card,
              border: Border.all(color: colors.background, width: 4),
              gradient: tone == EventTone.evening || tone == EventTone.warm
                  ? LinearGradient(
                      colors: tone == EventTone.evening
                          ? [colors.eveningStart, colors.eveningEnd]
                          : [colors.warmStart, colors.warmEnd],
                    )
                  : null,
              color: tone == EventTone.sage ? colors.secondarySoft : null,
            ),
            alignment: Alignment.center,
            child: Text(
              emoji,
              style: TextStyle(fontSize: selected ? 24 : 20),
            ),
          ),
          if (selected)
            Positioned(
              left: size / 2 - 6,
              bottom: -5,
              child: Transform.rotate(
                angle: 0.785398,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: colors.background,
                    border: Border.all(color: colors.border),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
