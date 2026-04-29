import 'package:big_break_mobile/app/app.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../test_overrides.dart';

void main() {
  testWidgets('root uses dark theme when settings darkMode is true', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({'ui.dark_mode': true});
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          sharedPreferencesProvider.overrideWithValue(preferences),
          settingsProvider.overrideWith(
            (ref) async => const UserSettingsData(
              allowLocation: true,
              allowPush: true,
              allowContacts: false,
              autoSharePlans: true,
              hideExactLocation: false,
              quietHours: false,
              showAge: true,
              discoverable: true,
              darkMode: true,
            ),
          ),
        ],
      ),
    );

    await tester.pumpAndSettle();

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
  });
}
