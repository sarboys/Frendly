import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:big_break_mobile/app/core/device/app_permission_service.dart';

final appLocationServiceProvider = Provider<AppLocationService>(
  (ref) => NativeAppLocationService(
    permissionService: ref.watch(appPermissionServiceProvider),
  ),
);

abstract class AppLocationService {
  Future<Position?> getCurrentPosition();
  double distanceBetween({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  });
}

class NativeAppLocationService implements AppLocationService {
  const NativeAppLocationService({
    required AppPermissionService permissionService,
  }) : _permissionService = permissionService;

  final AppPermissionService _permissionService;

  @override
  Future<Position?> getCurrentPosition() async {
    final granted = await _permissionService.requestLocation();
    if (!granted) {
      return null;
    }

    return Geolocator.getCurrentPosition();
  }

  @override
  double distanceBetween({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  }) {
    return Geolocator.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }
}
