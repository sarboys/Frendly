import 'package:big_break_mobile/app/core/device/app_permission_service.dart';
import 'package:big_break_mobile/features/permissions/presentation/permissions_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:dio/dio.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../test_overrides.dart';

class _FakePermissionService implements AppPermissionService {
  var locationCalls = 0;
  var notificationCalls = 0;
  var contactsCalls = 0;
  var cameraCalls = 0;
  var photosCalls = 0;
  var microphoneCalls = 0;

  @override
  Future<bool> requestContacts() async {
    contactsCalls += 1;
    return true;
  }

  @override
  Future<bool> requestCamera() async {
    cameraCalls += 1;
    return true;
  }

  @override
  Future<bool> requestLocation() async {
    locationCalls += 1;
    return true;
  }

  @override
  Future<bool> requestNotifications() async {
    notificationCalls += 1;
    return true;
  }

  @override
  Future<bool> requestPhotos() async {
    photosCalls += 1;
    return true;
  }

  @override
  Future<bool> requestMicrophone() async {
    microphoneCalls += 1;
    return true;
  }
}

class _FakeSettingsRepository extends BackendRepository {
  _FakeSettingsRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<UserSettingsData> updateSettings(UserSettingsData settings) async {
    return settings;
  }
}

Widget _wrap(_FakePermissionService permissionService) {
  return ProviderScope(
    overrides: [
      ...buildTestOverrides(),
      appPermissionServiceProvider.overrideWithValue(permissionService),
      backendRepositoryProvider.overrideWith(
        (ref) => _FakeSettingsRepository(ref: ref, dio: Dio()),
      ),
      settingsProvider.overrideWith(
        (ref) async => const UserSettingsData(
          allowLocation: false,
          allowPush: false,
          allowContacts: false,
          autoSharePlans: true,
          hideExactLocation: false,
          quietHours: false,
          showAge: true,
          discoverable: true,
          darkMode: false,
        ),
      ),
    ],
    child: const MaterialApp(
      home: PermissionsScreen(),
    ),
  );
}

void main() {
  testWidgets('permissions screen matches front copy', (tester) async {
    await tester.pumpWidget(_wrap(_FakePermissionService()));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(
      find.text(
        'Без этого Frendly работает скучнее. Можно поменять в настройках в любой момент.',
      ),
      findsOneWidget,
    );
    expect(
      find.text('Приглашения, лайки и напоминания о вечере'),
      findsOneWidget,
    );
    expect(
      find.text('Найдём друзей, которые уже здесь. Никому не покажем'),
      findsOneWidget,
    );
    expect(
      find.textContaining(
          'Frendly никогда не публикует твоё точное местоположение'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.check_rounded), findsNothing);
  });

  testWidgets('permissions screen requests system permissions on tap',
      (tester) async {
    final permissionService = _FakePermissionService();

    await tester.pumpWidget(_wrap(permissionService));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.text('Геолокация'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Уведомления'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Контакты'));
    await tester.pumpAndSettle();

    expect(permissionService.locationCalls, 1);
    expect(permissionService.notificationCalls, 1);
    expect(permissionService.contactsCalls, 1);
  });
}
