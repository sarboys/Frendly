import 'package:big_break_mobile/app/core/device/app_permission_preferences.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('syncFromSettings stores registration permission choices', () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final permissionPreferences = AppPermissionPreferences(preferences);

    await permissionPreferences.syncFromSettings(
      const UserSettingsData(
        allowLocation: true,
        allowPush: false,
        allowContacts: true,
        autoSharePlans: false,
        hideExactLocation: false,
        quietHours: false,
        showAge: true,
        discoverable: true,
        darkMode: false,
      ),
    );

    expect(permissionPreferences.allowLocation, isTrue);
    expect(permissionPreferences.allowContacts, isTrue);
    expect(permissionPreferences.allowPush, isFalse);
  });

  test('clear drops stored permission choices on session reset', () async {
    SharedPreferences.setMockInitialValues({
      'permissions.allow_location': true,
      'permissions.allow_contacts': true,
      'permissions.allow_push': true,
    });
    final preferences = await SharedPreferences.getInstance();
    final permissionPreferences = AppPermissionPreferences(preferences);

    await permissionPreferences.clear();

    expect(permissionPreferences.allowLocation, isFalse);
    expect(permissionPreferences.allowContacts, isFalse);
    expect(permissionPreferences.allowPush, isFalse);
  });
}
