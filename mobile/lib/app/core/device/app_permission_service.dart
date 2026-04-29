import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:big_break_mobile/app/core/device/app_permission_preferences.dart';

final appPermissionServiceProvider = Provider<AppPermissionService>(
  (ref) => NativeAppPermissionService(
    permissionPreferences: ref.watch(appPermissionPreferencesProvider),
  ),
);

abstract class AppPermissionService {
  Future<bool> requestLocation();
  Future<bool> requestNotifications();
  Future<bool> requestContacts();
  Future<bool> requestCamera();
  Future<bool> requestPhotos();
  Future<bool> requestMicrophone();
}

class NativeAppPermissionService implements AppPermissionService {
  const NativeAppPermissionService({
    required AppPermissionPreferences permissionPreferences,
  }) : _permissionPreferences = permissionPreferences;

  final AppPermissionPreferences _permissionPreferences;

  bool get _isMobilePlatform =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android);

  @override
  Future<bool> requestLocation() async {
    if (!_isMobilePlatform) {
      return true;
    }

    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    final granted = permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
    await _permissionPreferences.setAllowLocation(granted);
    return granted;
  }

  @override
  Future<bool> requestNotifications() async {
    if (!_isMobilePlatform) {
      return true;
    }

    final status = await Permission.notification.request();
    final granted =
        status.isGranted || status.isLimited || status.isProvisional;
    await _permissionPreferences.setAllowPush(granted);
    return granted;
  }

  @override
  Future<bool> requestContacts() async {
    if (!_isMobilePlatform) {
      return true;
    }

    final status = await Permission.contacts.request();
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    }
    final granted = status.isGranted || status.isLimited;
    await _permissionPreferences.setAllowContacts(granted);
    return granted;
  }

  @override
  Future<bool> requestCamera() async {
    if (!_isMobilePlatform) {
      return true;
    }

    final status = await Permission.camera.request();
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    }
    return status.isGranted;
  }

  @override
  Future<bool> requestPhotos() async {
    if (!_isMobilePlatform) {
      return true;
    }

    final status = await Permission.photos.request();
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    }
    return status.isGranted || status.isLimited;
  }

  @override
  Future<bool> requestMicrophone() async {
    if (!_isMobilePlatform) {
      return true;
    }

    final status = await Permission.microphone.request();
    if (status.isPermanentlyDenied) {
      await openAppSettings();
    }
    return status.isGranted;
  }
}
