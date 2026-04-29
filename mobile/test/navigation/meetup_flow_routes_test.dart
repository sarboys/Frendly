import 'package:big_break_mobile/app/navigation/app_router.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('router builds meetup flow routes', () {
    expect(
      appRouter.namedLocation(
        AppRoute.joinRequest.name,
        pathParameters: const {'eventId': 'e5'},
      ),
      '/join-request/e5',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.checkIn.name,
        pathParameters: const {'eventId': 'e1'},
      ),
      '/check-in/e1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.liveMeetup.name,
        pathParameters: const {'eventId': 'e1'},
      ),
      '/live/e1',
    );

    expect(
      appRouter.namedLocation(
        AppRoute.afterParty.name,
        pathParameters: const {'eventId': 'e1'},
      ),
      '/after-party/e1',
    );

    expect(appRouter.namedLocation(AppRoute.hostDashboard.name), '/host');
    expect(
      appRouter.namedLocation(
        AppRoute.hostEvent.name,
        pathParameters: const {'eventId': 'e5'},
      ),
      '/host/event/e5',
    );
  });
}
