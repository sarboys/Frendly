import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _darkModeKey = 'ui.dark_mode';

final appThemeModeProvider =
    StateNotifierProvider<AppThemeModeController, ThemeMode>((ref) {
  final preferences = ref.watch(sharedPreferencesProvider);
  final initialMode = preferences?.getBool(_darkModeKey) == true
      ? ThemeMode.dark
      : ThemeMode.light;
  final controller = AppThemeModeController(
    preferences: preferences,
    initialMode: initialMode,
  );

  ref.listen<AsyncValue<UserSettingsData>>(settingsProvider, (_, next) {
    next.whenData(controller.syncFromSettings);
  });

  return controller;
});

class AppThemeModeController extends StateNotifier<ThemeMode> {
  AppThemeModeController({
    required SharedPreferences? preferences,
    required ThemeMode initialMode,
  })  : _preferences = preferences,
        super(initialMode);

  final SharedPreferences? _preferences;

  Future<void> setDarkMode(bool isDark) async {
    state = isDark ? ThemeMode.dark : ThemeMode.light;
    await _preferences?.setBool(_darkModeKey, isDark);
  }

  void syncFromSettings(UserSettingsData settings) {
    state = settings.darkMode ? ThemeMode.dark : ThemeMode.light;
    _preferences?.setBool(_darkModeKey, settings.darkMode);
  }
}
