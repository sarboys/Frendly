import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/phone_auth/presentation/phone_auth_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../../test_overrides.dart';

class _FakeBackendRepository extends BackendRepository {
  _FakeBackendRepository({
    required super.ref,
    required super.dio,
    required this.onVerify,
    required this.isNewUser,
  });

  final void Function() onVerify;
  final bool isNewUser;
  String? requestedPhoneNumber;
  String? shortcutPhoneNumber;

  @override
  Future<PhoneAuthChallenge> requestPhoneCode(String phoneNumber) async {
    requestedPhoneNumber = phoneNumber;
    return PhoneAuthChallenge(
      challengeId: 'challenge-1',
      maskedPhone: phoneNumber,
      resendAfterSeconds: 42,
      localCodeHint: '1111',
    );
  }

  @override
  Future<PhoneAuthSession> verifyPhoneCode({
    required String challengeId,
    required String code,
  }) async {
    onVerify();
    return PhoneAuthSession(
      userId: 'user-me',
      isNewUser: isNewUser,
      tokens: const AuthTokens(
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      ),
    );
  }

  @override
  Future<PhoneAuthSession> loginWithTestPhoneShortcut(
      String phoneNumber) async {
    const supportedShortcuts = <String>{
      '+71111111111',
      '+72222222222',
      '+73333333333',
      '+74444444444',
      '+75555555555',
      '+76666666666',
      '+77777777777',
    };
    shortcutPhoneNumber = phoneNumber;
    if (!supportedShortcuts.contains(phoneNumber)) {
      throw DioException.badResponse(
        statusCode: 404,
        requestOptions: RequestOptions(path: '/auth/phone/test-login'),
        response: Response(
          requestOptions: RequestOptions(path: '/auth/phone/test-login'),
          statusCode: 404,
          data: const {
            'code': 'test_phone_shortcut_not_found',
          },
        ),
      );
    }
    return const PhoneAuthSession(
      userId: 'user-me',
      isNewUser: false,
      tokens: AuthTokens(
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      ),
    );
  }
}

Widget _wrap({
  required void Function() onVerify,
  bool isNewUser = true,
  void Function(_FakeBackendRepository repository)? onReady,
}) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => ProviderScope(
          overrides: [
            ...buildTestOverrides(),
            backendRepositoryProvider.overrideWith(
              (ref) {
                final repository = _FakeBackendRepository(
                  ref: ref,
                  dio: Dio(),
                  onVerify: onVerify,
                  isNewUser: isNewUser,
                );
                onReady?.call(repository);
                return repository;
              },
            ),
          ],
          child: const PhoneAuthScreen(),
        ),
      ),
      GoRoute(
        path: AppRoute.permissions.path,
        name: AppRoute.permissions.name,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('permissions-opened')),
        ),
      ),
      GoRoute(
        path: AppRoute.tonight.path,
        name: AppRoute.tonight.name,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('tonight-opened')),
        ),
      ),
    ],
  );

  return MaterialApp.router(routerConfig: router);
}

void main() {
  testWidgets(
    'phone step supports Belarus code and sends normalized full number',
    (tester) async {
      _FakeBackendRepository? repository;

      await tester.pumpWidget(
        _wrap(
          onVerify: () {},
          onReady: (value) => repository = value,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('🇷🇺 +7'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Беларусь'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '29 123 45 67');
      await tester.tap(find.text('Получить код'));
      await tester.pumpAndSettle();

      expect(repository?.requestedPhoneNumber, '+375291234567');
      expect(find.textContaining('+375291234567'), findsOneWidget);
    },
  );

  testWidgets(
    'otp step keeps a single input and submits after 4 digits',
    (tester) async {
      var verifyCalls = 0;

      await tester.pumpWidget(
        _wrap(
          onVerify: () {
            verifyCalls += 1;
          },
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Получить код'));
      await tester.pumpAndSettle();

      final fields = find.byType(TextField);
      expect(fields, findsOneWidget);

      await tester.tap(fields);
      await tester.pump();

      tester.testTextInput.enterText('1111');
      await tester.pumpAndSettle();

      expect(verifyCalls, 1);
      expect(find.text('permissions-opened'), findsOneWidget);
    },
  );

  testWidgets(
    'existing user skips registration flow and opens tonight',
    (tester) async {
      var verifyCalls = 0;

      await tester.pumpWidget(
        _wrap(
          onVerify: () {
            verifyCalls += 1;
          },
          isNewUser: false,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Получить код'));
      await tester.pumpAndSettle();

      final fields = find.byType(TextField);
      expect(fields, findsOneWidget);

      await tester.tap(fields);
      await tester.pump();

      tester.testTextInput.enterText('1111');
      await tester.pumpAndSettle();

      expect(verifyCalls, 1);
      expect(find.text('tonight-opened'), findsOneWidget);
    },
  );

  testWidgets(
    'test phone shortcut skips otp plus opens tonight',
    (tester) async {
      _FakeBackendRepository? repository;
      var verifyCalls = 0;

      await tester.pumpWidget(
        _wrap(
          onVerify: () {
            verifyCalls += 1;
          },
          isNewUser: false,
          onReady: (value) => repository = value,
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '111 111 11 11');
      await tester.tap(find.text('Получить код'));
      await tester.pumpAndSettle();

      expect(verifyCalls, 0);
      expect(repository?.shortcutPhoneNumber, '+71111111111');
      expect(find.text('tonight-opened'), findsOneWidget);
    },
  );

  testWidgets(
    'seeded oleg test phone shortcut skips otp plus opens tonight',
    (tester) async {
      _FakeBackendRepository? repository;

      await tester.pumpWidget(
        _wrap(
          onVerify: () {},
          isNewUser: false,
          onReady: (value) => repository = value,
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '777 777 77 77');
      await tester.tap(find.text('Получить код'));
      await tester.pumpAndSettle();

      expect(repository?.shortcutPhoneNumber, '+77777777777');
      expect(find.text('tonight-opened'), findsOneWidget);
    },
  );
}
