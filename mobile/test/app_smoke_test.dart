import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/app.dart';
import 'package:big_break_mobile/app/theme/app_theme_mode.dart';
import 'dart:async';

import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'test_overrides.dart';

void main() {
  testWidgets('root opens Splash screen by default', (tester) async {
    await tester.pumpWidget(BigBreakRoot(overrides: buildTestOverrides()));
    await tester.pump();

    expect(find.textContaining('Вечер начинается мягко'), findsOneWidget);
  });

  testWidgets('root opens Tonight when saved auth tokens exist', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Что сегодня вечером?'), findsOneWidget);
  });

  testWidgets('root leaves splash quickly when auth and onboarding are ready',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();
    await tester.pump();

    expect(find.text('Что сегодня вечером?'), findsOneWidget);
  });

  testWidgets('root keeps startup screen while auth bootstrap is running', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();
    final completer = Completer<void>();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
          authBootstrapProvider.overrideWith((ref) => completer.future),
        ],
      ),
    );
    await tester.pump();

    expect(find.textContaining('Вечер начинается мягко'), findsOneWidget);

    completer.complete();
    await tester.pumpAndSettle();

    expect(find.text('Что сегодня вечером?'), findsOneWidget);
  });

  testWidgets('root boots splash without reading remote settings', (
    tester,
  ) async {
    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          settingsProvider.overrideWith(
            (ref) async => throw StateError('settings should stay idle here'),
          ),
        ],
      ),
    );
    await tester.pump();

    expect(find.textContaining('Вечер начинается мягко'), findsOneWidget);
  });

  testWidgets('theme switch keeps current settings route open', (tester) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    final router = app.routerConfig! as GoRouter;
    router.go('/settings');
    await tester.pumpAndSettle();

    expect(find.text('Настройки'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Тёмная тема'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(MaterialApp)),
    );
    container.read(appThemeModeProvider.notifier).syncFromSettings(
          mockUserSettingsData.copyWith(darkMode: true),
        );
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, '/settings');
    expect(find.text('Тёмная тема'), findsOneWidget);
    expect(find.text('Что сегодня вечером?'), findsNothing);
  });
}
