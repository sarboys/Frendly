import 'package:flutter/material.dart';
import 'package:mobile2/app/dateasy_app.dart';
import 'package:mobile2/app/core/auth/auth_token_storage.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  final tokenStorage = SecureAuthTokenStorage(preferences: preferences);
  final initialTokens = await tokenStorage.read();
  runApp(
    DateasyApp(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(preferences),
        authTokenStorageProvider.overrideWithValue(tokenStorage),
        initialAuthTokensProvider.overrideWithValue(initialTokens),
      ],
    ),
  );
}
