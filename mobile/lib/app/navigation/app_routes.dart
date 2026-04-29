import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

enum AppRoute {
  splash('/splash'),
  welcome('/welcome'),
  phoneAuth('/phone-auth'),
  telegramAuth('/telegram-auth'),
  permissions('/permissions'),
  addPhoto('/add-photo'),
  tonight('/tonight'),
  communities('/communities'),
  chats('/chats'),
  dating('/dating'),
  profile('/profile'),
  onboarding('/onboarding'),
  search('/search'),
  map('/map'),
  notifications('/notifications'),
  afterDark('/after-dark'),
  afterDarkPaywall('/after-dark/paywall'),
  afterDarkEvent('/after-dark/event/:eventId'),
  afterDarkVerify('/after-dark/verify'),
  eveningBuilder('/evening-builder'),
  eveningPlan('/evening-plan/:routeId'),
  eveningEdit('/evening-edit/:routeId'),
  eveningPreview('/evening-preview/:sessionId'),
  eveningShareCard('/evening-share/:sessionId'),
  eveningLive('/evening-live/:routeId'),
  eveningAfterParty('/evening-after-party/:routeId'),
  offerCode('/offer-code/:codeId'),
  eveningRoutes('/routes'),
  eveningRouteDetail('/routes/:templateId'),
  createEveningSession('/routes/:templateId/create'),
  posters('/posters'),
  poster('/poster/:posterId'),
  createMeetup('/create'),
  joinRequest('/join-request/:eventId'),
  checkIn('/check-in/:eventId'),
  liveMeetup('/live/:eventId'),
  afterParty('/after-party/:eventId'),
  hostDashboard('/host'),
  hostEvent('/host/event/:eventId'),
  verification('/verification'),
  safetyHub('/safety'),
  report('/report/:userId'),
  stories('/stories/:eventId'),
  shareCard('/share/:eventId'),
  match('/match/:userId'),
  paywall('/paywall'),
  createCommunity('/community/create'),
  createCommunityPost('/community/:communityId/post/create'),
  communityDetail('/community/:communityId'),
  communityChat('/community/:communityId/chat'),
  communityMedia('/community/:communityId/media'),
  userProfile('/user/:userId'),
  editProfile('/edit-profile'),
  settings('/settings'),
  eventDetail('/event/:eventId'),
  meetupChat('/meetup/:chatId'),
  personalChat('/personal/:chatId'),
  chatLocation('/chat-location');

  const AppRoute(this.path);

  final String path;
}

extension AppRouteNavigation on BuildContext {
  Future<T?> pushRoute<T>(
    AppRoute route, {
    Map<String, String> pathParameters = const {},
    Map<String, String> queryParameters = const {},
  }) {
    return pushNamed<T>(
      route.name,
      pathParameters: pathParameters,
      queryParameters: queryParameters,
    );
  }

  void goRoute(
    AppRoute route, {
    Map<String, String> pathParameters = const {},
    Map<String, String> queryParameters = const {},
  }) {
    goNamed(
      route.name,
      pathParameters: pathParameters,
      queryParameters: queryParameters,
    );
  }
}
