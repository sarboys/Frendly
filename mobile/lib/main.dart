import 'package:big_break_mobile/app/app.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  const tokenStorage = FlutterAuthTokenStorage(
    AuthTokensController.defaultSecureStorage,
  );
  final initialTokens = await restoreInitialAuthTokens(
    tokenStorage,
    preferences,
  );
  runApp(
    BigBreakRoot(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(preferences),
        authTokenStorageProvider.overrideWithValue(tokenStorage),
        initialAuthTokensProvider.overrideWithValue(initialTokens),
      ],
    ),
  );
}
