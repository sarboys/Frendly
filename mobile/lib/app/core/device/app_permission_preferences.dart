import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final appPermissionPreferencesProvider = Provider<AppPermissionPreferences>(
  (ref) => AppPermissionPreferences(ref.watch(sharedPreferencesProvider)),
);

class AppPermissionPreferences {
  const AppPermissionPreferences(this._preferences);

  static const locationKey = 'permissions.allow_location';
  static const contactsKey = 'permissions.allow_contacts';
  static const pushKey = 'permissions.allow_push';

  final SharedPreferences? _preferences;

  bool get allowLocation => _preferences?.getBool(locationKey) ?? false;
  bool get allowContacts => _preferences?.getBool(contactsKey) ?? false;
  bool get allowPush => _preferences?.getBool(pushKey) ?? false;

  Future<void> syncFromSettings(UserSettingsData settings) async {
    await Future.wait([
      setAllowLocation(settings.allowLocation),
      setAllowContacts(settings.allowContacts),
      setAllowPush(settings.allowPush),
    ]);
  }

  Future<void> setAllowLocation(bool value) async {
    await _preferences?.setBool(locationKey, value);
  }

  Future<void> setAllowContacts(bool value) async {
    await _preferences?.setBool(contactsKey, value);
  }

  Future<void> setAllowPush(bool value) async {
    await _preferences?.setBool(pushKey, value);
  }

  Future<void> clear() async {
    await Future.wait([
      _preferences?.remove(locationKey) ?? Future<void>.value(),
      _preferences?.remove(contactsKey) ?? Future<void>.value(),
      _preferences?.remove(pushKey) ?? Future<void>.value(),
    ]);
  }
}
