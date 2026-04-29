import 'package:big_break_mobile/features/welcome/application/social_auth_controller.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/welcome/presentation/welcome_screen.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakeSocialAuthService implements SocialAuthService {
  _FakeSocialAuthService({
    required this.googleSession,
    required this.yandexSession,
  });

  final PhoneAuthSession googleSession;
  final PhoneAuthSession yandexSession;
  int googleCalls = 0;
  int yandexCalls = 0;

  @override
  Future<PhoneAuthSession> signInWithGoogle() async {
    googleCalls += 1;
    return googleSession;
  }

  @override
  Future<PhoneAuthSession> signInWithYandex() async {
    yandexCalls += 1;
    return yandexSession;
  }
}

_FakeSocialAuthService _fakeSocialAuth() {
  return _FakeSocialAuthService(
    googleSession: const PhoneAuthSession(
      userId: 'user-google',
      isNewUser: true,
      tokens: AuthTokens(
        accessToken: 'google-access',
        refreshToken: 'google-refresh',
      ),
    ),
    yandexSession: const PhoneAuthSession(
      userId: 'user-yandex',
      isNewUser: false,
      tokens: AuthTokens(
        accessToken: 'yandex-access',
        refreshToken: 'yandex-refresh',
      ),
    ),
  );
}

Widget _withSocialAuth(Widget child, _FakeSocialAuthService fakeAuth) {
  return ProviderScope(
    overrides: [
      socialAuthServiceProvider.overrideWithValue(fakeAuth),
    ],
    child: child,
  );
}

void main() {
  testWidgets('welcome screen keeps background behind status bar', (
    tester,
  ) async {
    await tester.pumpWidget(
      _withSocialAuth(
        const MediaQuery(
          data: MediaQueryData(
            padding: EdgeInsets.only(top: 24),
          ),
          child: MaterialApp(
            home: WelcomeScreen(),
          ),
        ),
        _fakeSocialAuth(),
      ),
    );
    await tester.pumpAndSettle();

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));

    expect(scaffold.body, isNot(isA<SafeArea>()));
    expect(find.byType(SafeArea), findsOneWidget);
  });

  testWidgets('welcome screen shows equal icon auth entries', (tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const WelcomeScreen(),
        ),
        GoRoute(
          path: AppRoute.telegramAuth.path,
          name: AppRoute.telegramAuth.name,
          builder: (context, state) => const Scaffold(
            body: Center(child: Text('telegram-auth-opened')),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      _withSocialAuth(
        MaterialApp.router(
          routerConfig: router,
        ),
        _fakeSocialAuth(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('auth-provider-google')), findsOneWidget);
    expect(find.byKey(const Key('auth-provider-yandex')), findsOneWidget);
    expect(find.byKey(const Key('auth-provider-telegram')), findsOneWidget);
    expect(find.text('Войти через Telegram'), findsNothing);

    await tester.tap(find.byKey(const Key('auth-provider-telegram')));
    await tester.pumpAndSettle();

    expect(find.text('telegram-auth-opened'), findsOneWidget);
  });

  testWidgets('google auth stores session and opens setup for new user', (
    tester,
  ) async {
    final fakeAuth = _fakeSocialAuth();
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const WelcomeScreen(),
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

    await tester.pumpWidget(
      _withSocialAuth(
        MaterialApp.router(routerConfig: router),
        fakeAuth,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('auth-provider-google')));
    await tester.pumpAndSettle();

    expect(fakeAuth.googleCalls, 1);
    expect(find.text('permissions-opened'), findsOneWidget);
  });

  testWidgets('yandex auth stores session and opens tonight for existing user',
      (
    tester,
  ) async {
    final fakeAuth = _fakeSocialAuth();
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const WelcomeScreen(),
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

    await tester.pumpWidget(
      _withSocialAuth(
        MaterialApp.router(routerConfig: router),
        fakeAuth,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('auth-provider-yandex')));
    await tester.pumpAndSettle();

    expect(fakeAuth.yandexCalls, 1);
    expect(find.text('tonight-opened'), findsOneWidget);
  });
}
