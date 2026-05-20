import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/dateasy_router.dart';

void main() {
  test('maps legacy auth routes to current auth routes', () {
    expect(legacyDateasyRouteRedirect(Uri.parse('/phone')), '/auth/phone');
    expect(legacyDateasyRouteRedirect(Uri.parse('/phone-auth')), '/auth/phone');
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/telegram-auth')),
      '/auth/telegram',
    );
  });

  test('maps legacy content routes to current mobile2 routes', () {
    expect(legacyDateasyRouteRedirect(Uri.parse('/tonight')), '/');
    expect(legacyDateasyRouteRedirect(Uri.parse('/meetups')), '/meetings');
    expect(legacyDateasyRouteRedirect(Uri.parse('/affiche')), '/posters');
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/affiche/event/poster-1')),
      '/posters/poster-1',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/event/event-1')),
      '/meetings/event-1',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/meetup/chat-1')),
      '/chats/chat-1',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/personal/chat-1')),
      '/chats/chat-1',
    );
  });

  test('maps legacy account and payment routes to current routes', () {
    expect(legacyDateasyRouteRedirect(Uri.parse('/verification')), '/verify');
    expect(legacyDateasyRouteRedirect(Uri.parse('/tokens/focus')), '/wallet');
    expect(legacyDateasyRouteRedirect(Uri.parse('/tokens/balance')), '/wallet');
    expect(legacyDateasyRouteRedirect(Uri.parse('/tokens/top-up')), '/wallet');
    expect(legacyDateasyRouteRedirect(Uri.parse('/tokens/boost')), '/wallet');
    expect(
      legacyDateasyRouteRedirect(
        Uri.parse('/payment/success?orderId=o1&productKind=tokens'),
      ),
      '/wallet?paymentResult=success&orderId=o1&productKind=tokens',
    );
  });

  test('maps legacy builder routes to current AI builder route', () {
    expect(legacyDateasyRouteRedirect(Uri.parse('/evening-builder')),
        '/ai-builder');
    expect(legacyDateasyRouteRedirect(Uri.parse('/ai-create')), '/ai-builder');
    expect(legacyDateasyRouteRedirect(Uri.parse('/ai-voice')), '/ai-builder');
  });

  test('maps legacy route create links to current route detail flow', () {
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/routes/patriki/create')),
      '/routes/patriki',
    );
  });

  test('maps legacy profile and report links to current routes', () {
    expect(legacyDateasyRouteRedirect(Uri.parse('/edit-profile')),
        '/profile/edit');
    expect(legacyDateasyRouteRedirect(Uri.parse('/user/u1')), '/u/u1');
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/report/u1')),
      '/report?targetUserId=u1',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/share/event-1')),
      '/share?targetType=event&targetId=event-1',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/stories/event-1')),
      '/stories?eventId=event-1',
    );
    expect(legacyDateasyRouteRedirect(Uri.parse('/safety')), '/sos');
    expect(legacyDateasyRouteRedirect(Uri.parse('/match/u1')), '/match');
  });

  test('maps legacy meeting creation and request routes to current flows', () {
    expect(legacyDateasyRouteRedirect(Uri.parse('/create')), '/meetings/new');
    expect(
      legacyDateasyRouteRedirect(
        Uri.parse('/create?inviteeUserId=u1&communityId=c1'),
      ),
      '/meetings/new?inviteeUserId=u1&communityId=c1',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/join-request/event-1')),
      '/meetings/event-1',
    );
  });

  test('maps legacy singular community links to current routes', () {
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/community/create')),
      '/communities/new',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/community/wine')),
      '/communities/wine',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/community/wine/edit')),
      '/communities/wine',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/community/wine/media')),
      '/communities/wine',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/community/wine/chat')),
      '/communities/wine',
    );
    expect(
      legacyDateasyRouteRedirect(Uri.parse('/community/wine/post/create')),
      '/communities/wine',
    );
  });
}
