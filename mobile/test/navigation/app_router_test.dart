import 'package:big_break_mobile/app/navigation/app_router.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('router exposes splash route as default location', () {
    expect(AppRouter.initialLocation, '/splash');
  });

  test('router builds encoded user profile location for cyrillic names', () {
    expect(
      appRouter.namedLocation(
        AppRoute.userProfile.name,
        pathParameters: const {'userId': 'user-anya'},
      ),
      '/user/user-anya',
    );
  });

  test('router builds parameterized detail routes', () {
    expect(
      appRouter.namedLocation(AppRoute.splash.name),
      '/splash',
    );

    expect(
      appRouter.namedLocation(AppRoute.phoneAuth.name),
      '/phone-auth',
    );

    expect(
      appRouter.namedLocation(AppRoute.dating.name),
      '/dating',
    );

    expect(
      appRouter.namedLocation('communities'),
      '/communities',
    );

    expect(
      appRouter.namedLocation(
        'communityDetail',
        pathParameters: const {'communityId': 'c1'},
      ),
      '/community/c1',
    );

    expect(
      appRouter.namedLocation(
        'communityChat',
        pathParameters: const {'communityId': 'c1'},
      ),
      '/community/c1/chat',
    );

    expect(
      appRouter.namedLocation(
        'communityMedia',
        pathParameters: const {'communityId': 'c1'},
      ),
      '/community/c1/media',
    );

    expect(
      appRouter.namedLocation('createCommunity'),
      '/community/create',
    );

    expect(
      AppRoute.values.map((route) => route.name),
      contains('createCommunityPost'),
    );

    expect(
      appRouter.namedLocation(
        AppRoute.createCommunityPost.name,
        pathParameters: const {'communityId': 'c1'},
      ),
      '/community/c1/post/create',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.eventDetail.name,
        pathParameters: const {'eventId': 'e1'},
      ),
      '/event/e1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.posters.name,
      ),
      '/posters',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.poster.name,
        pathParameters: const {'posterId': 'ps1'},
      ),
      '/poster/ps1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.afterDark.name,
      ),
      '/after-dark',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.afterDarkPaywall.name,
      ),
      '/after-dark/paywall',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.afterDarkEvent.name,
        pathParameters: const {'eventId': 'ad1'},
      ),
      '/after-dark/event/ad1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.afterDarkVerify.name,
      ),
      '/after-dark/verify',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.eveningBuilder.name,
      ),
      '/evening-builder',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.eveningPlan.name,
        pathParameters: const {'routeId': 'r-cozy-circle'},
      ),
      '/evening-plan/r-cozy-circle',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.meetupChat.name,
        pathParameters: const {'chatId': 'mc1'},
      ),
      '/meetup/mc1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.personalChat.name,
        pathParameters: const {'chatId': 'p1'},
      ),
      '/personal/p1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.chatLocation.name,
        queryParameters: const {
          'latitude': '55.7579',
          'longitude': '37.6486',
          'title': 'Ты здесь',
        },
      ),
      '/chat-location?latitude=55.7579&longitude=37.6486&title=%D0%A2%D1%8B+%D0%B7%D0%B4%D0%B5%D1%81%D1%8C',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.report.name,
        pathParameters: const {'userId': 'user-anya'},
      ),
      '/report/user-anya',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.stories.name,
        pathParameters: const {'eventId': 'e1'},
      ),
      '/stories/e1',
    );
  });

  test(
      'router resolves onboarding as pending setup when onboarding is incomplete',
      () {
    expect(
      resolvePendingSetupRoute(
        const OnboardingData(
          intent: null,
          gender: null,
          city: 'Москва',
          area: 'Чистые пруды',
          interests: ['Кофе', 'Бары'],
          vibe: 'calm',
        ),
      ),
      AppRoute.onboarding.path,
    );
  });

  test('router does not require setup route for completed onboarding', () {
    expect(
      resolvePendingSetupRoute(
        const OnboardingData(
          intent: 'both',
          gender: 'male',
          birthDate: '2000-04-24',
          city: 'Москва',
          area: 'Чистые пруды',
          interests: ['Кофе', 'Бары'],
          vibe: 'calm',
        ),
      ),
      isNull,
    );
  });

  test('router keeps onboarding pending without birth date', () {
    expect(
      resolvePendingSetupRoute(
        const OnboardingData(
          intent: 'both',
          gender: 'male',
          city: 'Москва',
          area: 'Чистые пруды',
          interests: ['Кофе', 'Бары'],
          vibe: 'calm',
        ),
      ),
      AppRoute.onboarding.path,
    );
  });
}
