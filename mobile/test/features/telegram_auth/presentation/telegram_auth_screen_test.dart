import 'dart:async';

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/telegram_auth/presentation/telegram_auth_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../../test_overrides.dart';

class _FakeTelegramAuthRepository extends BackendRepository {
  _FakeTelegramAuthRepository({
    required super.ref,
    required super.dio,
    required this.isNewUser,
    required this.onVerify,
    Object? startError,
    this.startCompleter,
  }) : _startError = startError;

  final bool isNewUser;
  final void Function() onVerify;
  Object? _startError;
  final Completer<TelegramAuthStart>? startCompleter;
  String? startedLoginSessionId;
  final List<String?> requestedStartTokens = [];
  String? verifiedLoginSessionId;
  String? verifiedCode;

  set startError(Object? value) => _startError = value;

  @override
  Future<TelegramAuthStart> startTelegramAuth({String? startToken}) async {
    requestedStartTokens.add(startToken);
    if (startCompleter != null) {
      return startCompleter!.future;
    }
    if (_startError != null) {
      throw _startError!;
    }
    const session = TelegramAuthStart(
      loginSessionId: 'tg-login-1',
      botUrl: 'https://t.me/frendly_auth_test_bot?start=login_start-token',
      expiresAt: '2026-04-22T12:00:00.000Z',
      codeLength: 4,
    );
    startedLoginSessionId = session.loginSessionId;
    return session;
  }

  @override
  Future<PhoneAuthSession> verifyTelegramAuth({
    required String loginSessionId,
    required String code,
  }) async {
    verifiedLoginSessionId = loginSessionId;
    verifiedCode = code;
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
}

Widget _wrapTelegramAuth({
  required bool isNewUser,
  required Future<bool> Function(Uri uri) onOpenTelegram,
  required void Function() onVerify,
  Object? startError,
  Completer<TelegramAuthStart>? startCompleter,
  void Function(_FakeTelegramAuthRepository repository)? onReady,
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
                final repository = _FakeTelegramAuthRepository(
                  ref: ref,
                  dio: Dio(),
                  isNewUser: isNewUser,
                  onVerify: onVerify,
                  startError: startError,
                  startCompleter: startCompleter,
                );
                onReady?.call(repository);
                return repository;
              },
            ),
          ],
          child: TelegramAuthScreen(
            openTelegramUrl: onOpenTelegram,
            startTokenFactory: () => 'local-start-token',
          ),
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
  testWidgets('launches telegram before backend start request completes',
      (tester) async {
    Uri? openedUri;
    _FakeTelegramAuthRepository? repository;
    final startCompleter = Completer<TelegramAuthStart>();

    await tester.pumpWidget(
      _wrapTelegramAuth(
        isNewUser: true,
        onVerify: () {},
        startCompleter: startCompleter,
        onReady: (value) => repository = value,
        onOpenTelegram: (uri) async {
          openedUri = uri;
          return true;
        },
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть Telegram'));
    await tester.pump();

    expect(openedUri?.toString(),
        'https://t.me/frendly_code_bot?start=login_local-start-token');
    expect(repository?.requestedStartTokens, ['local-start-token']);
    expect(find.text('Введи код из бота'), findsOneWidget);

    startCompleter.complete(
      const TelegramAuthStart(
        loginSessionId: 'tg-login-1',
        botUrl: 'https://t.me/frendly_code_bot?start=login_local-start-token',
        expiresAt: '2026-04-22T12:00:00.000Z',
        codeLength: 4,
      ),
    );
    await tester.pumpAndSettle();
  });

  testWidgets(
      'verifies four-digit telegram code and opens permissions for new user',
      (tester) async {
    var verifyCalls = 0;
    _FakeTelegramAuthRepository? repository;

    await tester.pumpWidget(
      _wrapTelegramAuth(
        isNewUser: true,
        onVerify: () {
          verifyCalls += 1;
        },
        onReady: (value) => repository = value,
        onOpenTelegram: (_) async => true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть Telegram'));
    await tester.pumpAndSettle();

    final fields = find.byType(TextField);
    expect(fields, findsOneWidget);

    await tester.tap(fields);
    await tester.pump();
    tester.testTextInput.enterText('6543');
    await tester.pumpAndSettle();

    expect(verifyCalls, 1);
    expect(repository?.verifiedCode, '6543');
    expect(repository?.requestedStartTokens, ['local-start-token']);
    expect(find.text('permissions-opened'), findsOneWidget);
  });

  testWidgets('existing user skips setup after telegram auth', (tester) async {
    var verifyCalls = 0;

    await tester.pumpWidget(
      _wrapTelegramAuth(
        isNewUser: false,
        onVerify: () {
          verifyCalls += 1;
        },
        onOpenTelegram: (_) async => true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть Telegram'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(TextField));
    await tester.pump();
    tester.testTextInput.enterText('1234');
    await tester.pumpAndSettle();

    expect(verifyCalls, 1);
    expect(find.text('tonight-opened'), findsOneWidget);
  });

  testWidgets(
      'allows entering an existing bot code without waiting for start session',
      (tester) async {
    var verifyCalls = 0;
    _FakeTelegramAuthRepository? repository;

    await tester.pumpWidget(
      _wrapTelegramAuth(
        isNewUser: false,
        onVerify: () {
          verifyCalls += 1;
        },
        onReady: (value) => repository = value,
        onOpenTelegram: (_) async => true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('У меня уже есть код'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(TextField));
    await tester.pump();
    tester.testTextInput.enterText('4321');
    await tester.pumpAndSettle();

    expect(verifyCalls, 1);
    expect(repository?.verifiedCode, '4321');
    expect(find.text('tonight-opened'), findsOneWidget);
  });

  testWidgets('telegram code cells match front input sizing and typography',
      (tester) async {
    await tester.pumpWidget(
      _wrapTelegramAuth(
        isNewUser: false,
        onVerify: () {},
        onOpenTelegram: (_) async => true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('У меня уже есть код'));
    await tester.pumpAndSettle();

    for (var index = 0; index < 4; index++) {
      final cell = find.byKey(ValueKey('telegram-code-cell-$index'));
      expect(cell, findsOneWidget);
      expect(tester.getSize(cell), const Size(56, 64));

      final container = tester.widget<Container>(cell);
      final decoration = container.decoration! as BoxDecoration;
      expect(decoration.borderRadius, BorderRadius.circular(16));
      expect(decoration.border!.top.width, 2);
    }

    tester.testTextInput.enterText('7');
    await tester.pump();

    final digit = tester.widget<Text>(
      find.descendant(
        of: find.byKey(const ValueKey('telegram-code-cell-0')),
        matching: find.text('7'),
      ),
    );
    expect(digit.style?.fontFamily, 'Sora');
    expect(digit.style?.fontSize, 28);
    expect(digit.style?.fontWeight, FontWeight.w600);
  });

  testWidgets(
      'shows retry state and reuses the same start token after backend start failure',
      (tester) async {
    final requestOptions = RequestOptions(path: '/auth/telegram/start');
    _FakeTelegramAuthRepository? repository;

    await tester.pumpWidget(
      _wrapTelegramAuth(
        isNewUser: true,
        onVerify: () {},
        startError: DioException.badResponse(
          statusCode: 503,
          requestOptions: requestOptions,
          response: Response<Map<String, dynamic>>(
            requestOptions: requestOptions,
            statusCode: 503,
            data: const {
              'code': 'telegram_auth_unavailable',
            },
          ),
        ),
        onReady: (value) => repository = value,
        onOpenTelegram: (_) async => true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть Telegram'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(
        find.text('Telegram вход пока не настроен на сервере'), findsOneWidget);
    expect(find.text('Повторить'), findsOneWidget);
    expect(repository?.requestedStartTokens, ['local-start-token']);

    repository!.startError = null;
    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(repository?.requestedStartTokens,
        ['local-start-token', 'local-start-token']);
  });
}
