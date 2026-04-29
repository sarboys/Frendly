import 'package:big_break_mobile/features/settings/presentation/settings_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:async';

import '../../test_overrides.dart';

class _RecordingBackendRepository extends BackendRepository {
  _RecordingBackendRepository({
    required super.ref,
    this.onUpdate,
    this.onTestingAccessUpdate,
  }) : super(dio: Dio());

  final void Function(UserSettingsData settings)? onUpdate;
  final void Function(bool frendlyPlusEnabled, bool afterDarkEnabled)?
      onTestingAccessUpdate;

  @override
  Future<UserSettingsData> updateSettings(UserSettingsData settings) async {
    onUpdate?.call(settings);
    return settings;
  }

  @override
  Future<Map<String, dynamic>> updateTestingAccess({
    required bool frendlyPlusEnabled,
    required bool afterDarkEnabled,
  }) async {
    onTestingAccessUpdate?.call(frendlyPlusEnabled, afterDarkEnabled);
    return {
      'frendlyPlusEnabled': frendlyPlusEnabled,
      'afterDarkEnabled': afterDarkEnabled,
    };
  }
}

Widget _wrap() {
  return ProviderScope(
    overrides: buildTestOverrides(),
    child: const MaterialApp(
      home: SettingsScreen(),
    ),
  );
}

void main() {
  testWidgets('settings support group matches front', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Frendly+'),
      400,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Безопасность'), findsOneWidget);
    expect(find.text('Frendly+'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Помощь'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Поддержка'), findsOneWidget);
    expect(find.text('Помощь'), findsOneWidget);
    expect(find.text('Условия и приватность'), findsOneWidget);
  });

  testWidgets('settings screen keeps content visible while request is loading',
      (tester) async {
    final completer = Completer<UserSettingsData>();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          settingsProvider.overrideWith((ref) => completer.future),
        ],
        child: const MaterialApp(
          home: SettingsScreen(),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Настройки'), findsOneWidget);
    expect(find.text('Push-уведомления'), findsOneWidget);
  });

  testWidgets('settings language row opens selector sheet', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Язык'));
    await tester.pumpAndSettle();

    expect(find.text('Выбери язык'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);

    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();

    expect(find.text('Выбери язык'), findsNothing);
    expect(find.text('English'), findsOneWidget);
  });

  testWidgets('settings notification row can save from row tap',
      (tester) async {
    UserSettingsData? capturedSettings;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          backendRepositoryProvider.overrideWith(
            (ref) => _RecordingBackendRepository(
              ref: ref,
              onUpdate: (settings) {
                capturedSettings = settings;
              },
            ),
          ),
        ],
        child: const MaterialApp(
          home: SettingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Push-уведомления'));
    await tester.pump();

    expect(capturedSettings, isNotNull);
    expect(capturedSettings!.allowPush, isFalse);
  });

  testWidgets('settings shows testing access toggles and sends update',
      (tester) async {
    bool? capturedFrendlyPlus;
    bool? capturedAfterDark;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          backendRepositoryProvider.overrideWith(
            (ref) => _RecordingBackendRepository(
              ref: ref,
              onTestingAccessUpdate: (frendlyPlusEnabled, afterDarkEnabled) {
                capturedFrendlyPlus = frendlyPlusEnabled;
                capturedAfterDark = afterDarkEnabled;
              },
            ),
          ),
        ],
        child: const MaterialApp(
          home: SettingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Frendly+ доступ'),
      400,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('After Dark доступ'), findsOneWidget);

    await tester.ensureVisible(find.text('After Dark доступ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('After Dark доступ'));
    await tester.pump();

    expect(capturedFrendlyPlus, true);
    expect(capturedAfterDark, true);
  });
}
