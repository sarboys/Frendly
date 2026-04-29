import 'package:big_break_mobile/features/after_party/presentation/after_party_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_event_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_paywall_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_verify_screen.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/navigation/app_shell.dart';
import 'package:big_break_mobile/features/add_photo/presentation/add_photo_screen.dart';
import 'package:big_break_mobile/features/check_in/presentation/check_in_screen.dart';
import 'package:big_break_mobile/features/chats/presentation/chats_screen.dart';
import 'package:big_break_mobile/features/chat_location/presentation/chat_location_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/communities_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/community_chat_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/community_detail_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/community_media_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/create_community_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/create_community_post_screen.dart';
import 'package:big_break_mobile/features/create_meetup/presentation/create_meetup_screen.dart';
import 'package:big_break_mobile/features/dating/presentation/dating_screen.dart';
import 'package:big_break_mobile/features/edit_profile/presentation/edit_profile_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_builder_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_after_party_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_edit_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_live_meetup_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_preview_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_share_card_screen.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/create_evening_session_screen.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/evening_route_detail_screen.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/evening_routes_screen.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/partner_offer_qr_screen.dart';
import 'package:big_break_mobile/features/event_detail/presentation/event_detail_screen.dart';
import 'package:big_break_mobile/features/host_dashboard/presentation/host_dashboard_screen.dart';
import 'package:big_break_mobile/features/join_request/presentation/join_request_screen.dart';
import 'package:big_break_mobile/features/live_meetup/presentation/live_meetup_screen.dart';
import 'package:big_break_mobile/features/match/presentation/match_screen.dart';
import 'package:big_break_mobile/features/map/presentation/map_screen.dart';
import 'package:big_break_mobile/features/meetup_chat/presentation/meetup_chat_screen.dart';
import 'package:big_break_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:big_break_mobile/features/onboarding/presentation/onboarding_screen.dart';
import 'package:big_break_mobile/features/personal_chat/presentation/personal_chat_screen.dart';
import 'package:big_break_mobile/features/paywall/presentation/paywall_screen.dart';
import 'package:big_break_mobile/features/permissions/presentation/permissions_screen.dart';
import 'package:big_break_mobile/features/phone_auth/presentation/phone_auth_screen.dart';
import 'package:big_break_mobile/features/posters/presentation/poster_detail_screen.dart';
import 'package:big_break_mobile/features/posters/presentation/posters_screen.dart';
import 'package:big_break_mobile/features/profile/presentation/profile_screen.dart';
import 'package:big_break_mobile/features/report/presentation/report_screen.dart';
import 'package:big_break_mobile/features/search/presentation/search_screen.dart';
import 'package:big_break_mobile/features/safety/presentation/safety_hub_screen.dart';
import 'package:big_break_mobile/features/share_card/presentation/share_card_screen.dart';
import 'package:big_break_mobile/features/settings/presentation/settings_screen.dart';
import 'package:big_break_mobile/features/stories/presentation/stories_screen.dart';
import 'package:big_break_mobile/features/telegram_auth/presentation/telegram_auth_screen.dart';
import 'package:big_break_mobile/features/tonight/presentation/tonight_screen.dart';
import 'package:big_break_mobile/features/user_profile/presentation/user_profile_screen.dart';
import 'package:big_break_mobile/features/verification/presentation/verification_screen.dart';
import 'package:big_break_mobile/features/welcome/presentation/welcome_screen.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/features/splash/presentation/splash_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';

class AppRouter {
  const AppRouter._();

  static const initialLocation = '/splash';
}

final _rootNavigatorKey = GlobalKey<NavigatorState>();
const _publicRoutePaths = <String>{
  '/splash',
  '/welcome',
  '/phone-auth',
  '/telegram-auth',
};
const _setupRoutePaths = <String>{
  '/permissions',
  '/add-photo',
  '/onboarding',
};

bool isOnboardingComplete(OnboardingData? onboarding) {
  if (onboarding == null) {
    return false;
  }

  return onboarding.intent != null &&
      onboarding.requiredContact == null &&
      (onboarding.gender?.isNotEmpty ?? false) &&
      (onboarding.birthDate?.isNotEmpty ?? false) &&
      (onboarding.city?.isNotEmpty ?? false) &&
      onboarding.interests.length >= 2 &&
      (onboarding.vibe?.isNotEmpty ?? false);
}

String? resolvePendingSetupRoute(OnboardingData? onboarding) {
  return isOnboardingComplete(onboarding) ? null : AppRoute.onboarding.path;
}

CustomTransitionPage<void> _slidePage(Widget child) {
  return CustomTransitionPage<void>(
    child: _BackSwipePage(
      child: child,
    ),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curve = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 1),
          end: Offset.zero,
        ).animate(curve),
        child: child,
      );
    },
  );
}

class _BackSwipePage extends StatefulWidget {
  const _BackSwipePage({
    required this.child,
  });

  final Widget child;

  @override
  State<_BackSwipePage> createState() => _BackSwipePageState();
}

class _BackSwipePageState extends State<_BackSwipePage> {
  double _dragOffset = 0;

  void _onHorizontalDragUpdate(DragUpdateDetails details) {
    if (details.globalPosition.dx > 28) {
      return;
    }

    if (details.delta.dx <= 0) {
      return;
    }

    _dragOffset += details.delta.dx;
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    final shouldPop = _dragOffset > 72 ||
        details.primaryVelocity != null && details.primaryVelocity! > 350;
    _dragOffset = 0;

    if (!shouldPop) {
      return;
    }

    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(child: widget.child),
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          width: 24,
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onHorizontalDragUpdate: _onHorizontalDragUpdate,
            onHorizontalDragEnd: _onHorizontalDragEnd,
            onHorizontalDragCancel: () {
              _dragOffset = 0;
            },
          ),
        ),
      ],
    );
  }
}

GoRouter buildAppRouter({
  required bool authenticated,
  Listenable? refreshListenable,
  bool Function()? isAuthenticated,
  String? Function()? pendingSetupPath,
}) {
  final authCheck = isAuthenticated ?? () => authenticated;

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRouter.initialLocation,
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final path = state.uri.path;
      final isPublic = _publicRoutePaths.contains(path);
      final authenticated = authCheck();
      final pendingSetup = authenticated ? pendingSetupPath?.call() : null;

      if (path == AppRoute.splash.path) {
        return null;
      }

      if (!authenticated && !isPublic) {
        return AppRoute.welcome.path;
      }

      if (authenticated && pendingSetup != null) {
        if (isPublic) {
          return pendingSetup;
        }

        if (!_setupRoutePaths.contains(path) && path != pendingSetup) {
          return pendingSetup;
        }
      }

      if (authenticated && isPublic) {
        return AppRoute.tonight.path;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoute.splash.path,
        name: AppRoute.splash.name,
        pageBuilder: (context, state) => _slidePage(const SplashScreen()),
      ),
      GoRoute(
        path: AppRoute.welcome.path,
        name: AppRoute.welcome.name,
        pageBuilder: (context, state) => _slidePage(const WelcomeScreen()),
      ),
      GoRoute(
        path: AppRoute.phoneAuth.path,
        name: AppRoute.phoneAuth.name,
        pageBuilder: (context, state) => _slidePage(const PhoneAuthScreen()),
      ),
      GoRoute(
        path: AppRoute.telegramAuth.path,
        name: AppRoute.telegramAuth.name,
        pageBuilder: (context, state) => _slidePage(const TelegramAuthScreen()),
      ),
      GoRoute(
        path: AppRoute.permissions.path,
        name: AppRoute.permissions.name,
        pageBuilder: (context, state) => _slidePage(const PermissionsScreen()),
      ),
      GoRoute(
        path: AppRoute.addPhoto.path,
        name: AppRoute.addPhoto.name,
        pageBuilder: (context, state) => _slidePage(const AddPhotoScreen()),
      ),
      ShellRoute(
        builder: (context, state, child) => AppShell(
          location: state.uri.path,
          child: child,
        ),
        routes: [
          GoRoute(
            path: AppRoute.tonight.path,
            name: AppRoute.tonight.name,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: TonightScreen(),
            ),
          ),
          GoRoute(
            path: AppRoute.chats.path,
            name: AppRoute.chats.name,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ChatsScreen(),
            ),
          ),
          GoRoute(
            path: AppRoute.communities.path,
            name: AppRoute.communities.name,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CommunitiesScreen(),
            ),
          ),
          GoRoute(
            path: AppRoute.dating.path,
            name: AppRoute.dating.name,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DatingScreen(),
            ),
          ),
          GoRoute(
            path: AppRoute.profile.path,
            name: AppRoute.profile.name,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: AppRoute.onboarding.path,
        name: AppRoute.onboarding.name,
        pageBuilder: (context, state) => _slidePage(const OnboardingScreen()),
      ),
      GoRoute(
        path: AppRoute.search.path,
        name: AppRoute.search.name,
        pageBuilder: (context, state) => _slidePage(
          SearchScreen(
            preset: SearchPreset.parse(state.uri.queryParameters['preset']),
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.map.path,
        name: AppRoute.map.name,
        pageBuilder: (context, state) => _slidePage(
          MapScreen(
            initialEventId: state.uri.queryParameters['eventId'],
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.notifications.path,
        name: AppRoute.notifications.name,
        pageBuilder: (context, state) =>
            _slidePage(const NotificationsScreen()),
      ),
      GoRoute(
        path: AppRoute.afterDark.path,
        name: AppRoute.afterDark.name,
        pageBuilder: (context, state) => _slidePage(const AfterDarkScreen()),
      ),
      GoRoute(
        path: AppRoute.afterDarkPaywall.path,
        name: AppRoute.afterDarkPaywall.name,
        pageBuilder: (context, state) =>
            _slidePage(const AfterDarkPaywallScreen()),
      ),
      GoRoute(
        path: AppRoute.afterDarkEvent.path,
        name: AppRoute.afterDarkEvent.name,
        pageBuilder: (context, state) => _slidePage(
          AfterDarkEventScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.afterDarkVerify.path,
        name: AppRoute.afterDarkVerify.name,
        pageBuilder: (context, state) =>
            _slidePage(const AfterDarkVerifyScreen()),
      ),
      GoRoute(
        path: AppRoute.eveningBuilder.path,
        name: AppRoute.eveningBuilder.name,
        pageBuilder: (context, state) =>
            _slidePage(const EveningBuilderScreen()),
      ),
      GoRoute(
        path: AppRoute.eveningPlan.path,
        name: AppRoute.eveningPlan.name,
        pageBuilder: (context, state) => _slidePage(
          EveningPlanScreen(
            routeId: state.pathParameters['routeId']!,
            autoOpenLaunch: state.uri.queryParameters['launch'] == '1',
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.eveningEdit.path,
        name: AppRoute.eveningEdit.name,
        pageBuilder: (context, state) => _slidePage(
          EveningEditScreen(
            routeId: state.pathParameters['routeId']!,
            chatId: state.uri.queryParameters['chatId'],
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.eveningPreview.path,
        name: AppRoute.eveningPreview.name,
        pageBuilder: (context, state) => _slidePage(
          EveningPreviewScreen(
            sessionId: state.pathParameters['sessionId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.eveningShareCard.path,
        name: AppRoute.eveningShareCard.name,
        pageBuilder: (context, state) => _slidePage(
          EveningShareCardScreen(
            sessionId: state.pathParameters['sessionId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.eveningLive.path,
        name: AppRoute.eveningLive.name,
        pageBuilder: (context, state) => _slidePage(
          EveningLiveMeetupScreen(
            routeId: state.pathParameters['routeId']!,
            mode: parseEveningLaunchMode(state.uri.queryParameters['mode']),
            sessionId: state.uri.queryParameters['sessionId'],
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.eveningAfterParty.path,
        name: AppRoute.eveningAfterParty.name,
        pageBuilder: (context, state) => _slidePage(
          EveningAfterPartyScreen(
            routeId: state.pathParameters['routeId']!,
            sessionId: state.uri.queryParameters['sessionId'],
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.offerCode.path,
        name: AppRoute.offerCode.name,
        pageBuilder: (context, state) => _slidePage(
          PartnerOfferQrScreen(
            codeId: state.pathParameters['codeId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.eveningRoutes.path,
        name: AppRoute.eveningRoutes.name,
        pageBuilder: (context, state) =>
            _slidePage(const EveningRoutesScreen()),
      ),
      GoRoute(
        path: AppRoute.eveningRouteDetail.path,
        name: AppRoute.eveningRouteDetail.name,
        pageBuilder: (context, state) => _slidePage(
          EveningRouteDetailScreen(
            templateId: state.pathParameters['templateId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.createEveningSession.path,
        name: AppRoute.createEveningSession.name,
        pageBuilder: (context, state) => _slidePage(
          CreateEveningSessionScreen(
            templateId: state.pathParameters['templateId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.posters.path,
        name: AppRoute.posters.name,
        pageBuilder: (context, state) => _slidePage(const PostersScreen()),
      ),
      GoRoute(
        path: AppRoute.poster.path,
        name: AppRoute.poster.name,
        pageBuilder: (context, state) => _slidePage(
          PosterDetailScreen(
            posterId: state.pathParameters['posterId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.createMeetup.path,
        name: AppRoute.createMeetup.name,
        pageBuilder: (context, state) => _slidePage(
          CreateMeetupScreen(
            inviteeUserId: state.uri.queryParameters['inviteeUserId'],
            posterId: state.uri.queryParameters['posterId'],
            communityId: state.uri.queryParameters['communityId'],
            initialMode: parseCreateMeetupMode(
              state.uri.queryParameters['mode'],
            ),
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.joinRequest.path,
        name: AppRoute.joinRequest.name,
        pageBuilder: (context, state) => _slidePage(
          JoinRequestScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.checkIn.path,
        name: AppRoute.checkIn.name,
        pageBuilder: (context, state) => _slidePage(
          CheckInScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.liveMeetup.path,
        name: AppRoute.liveMeetup.name,
        pageBuilder: (context, state) => _slidePage(
          LiveMeetupScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.afterParty.path,
        name: AppRoute.afterParty.name,
        pageBuilder: (context, state) => _slidePage(
          AfterPartyScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.hostDashboard.path,
        name: AppRoute.hostDashboard.name,
        pageBuilder: (context, state) =>
            _slidePage(const HostDashboardScreen()),
      ),
      GoRoute(
        path: AppRoute.hostEvent.path,
        name: AppRoute.hostEvent.name,
        pageBuilder: (context, state) => _slidePage(
          HostDashboardScreen(
            initialEventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.verification.path,
        name: AppRoute.verification.name,
        pageBuilder: (context, state) => _slidePage(const VerificationScreen()),
      ),
      GoRoute(
        path: AppRoute.safetyHub.path,
        name: AppRoute.safetyHub.name,
        pageBuilder: (context, state) => _slidePage(const SafetyHubScreen()),
      ),
      GoRoute(
        path: AppRoute.report.path,
        name: AppRoute.report.name,
        pageBuilder: (context, state) => _slidePage(
          ReportScreen(
            userId: state.pathParameters['userId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.stories.path,
        name: AppRoute.stories.name,
        pageBuilder: (context, state) => _slidePage(
          StoriesScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.shareCard.path,
        name: AppRoute.shareCard.name,
        pageBuilder: (context, state) => _slidePage(
          ShareCardScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.match.path,
        name: AppRoute.match.name,
        pageBuilder: (context, state) => _slidePage(
          MatchScreen(
            userId: state.pathParameters['userId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.paywall.path,
        name: AppRoute.paywall.name,
        pageBuilder: (context, state) => _slidePage(const PaywallScreen()),
      ),
      GoRoute(
        path: AppRoute.createCommunity.path,
        name: AppRoute.createCommunity.name,
        pageBuilder: (context, state) =>
            _slidePage(const CreateCommunityScreen()),
      ),
      GoRoute(
        path: AppRoute.createCommunityPost.path,
        name: AppRoute.createCommunityPost.name,
        pageBuilder: (context, state) => _slidePage(
          CreateCommunityPostScreen(
            communityId: state.pathParameters['communityId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.communityChat.path,
        name: AppRoute.communityChat.name,
        pageBuilder: (context, state) => _slidePage(
          CommunityChatScreen(
            communityId: state.pathParameters['communityId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.communityMedia.path,
        name: AppRoute.communityMedia.name,
        pageBuilder: (context, state) => _slidePage(
          CommunityMediaScreen(
            communityId: state.pathParameters['communityId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.communityDetail.path,
        name: AppRoute.communityDetail.name,
        pageBuilder: (context, state) => _slidePage(
          CommunityDetailScreen(
            communityId: state.pathParameters['communityId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.userProfile.path,
        name: AppRoute.userProfile.name,
        pageBuilder: (context, state) => _slidePage(
          UserProfileScreen(
            userId: state.pathParameters['userId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.editProfile.path,
        name: AppRoute.editProfile.name,
        pageBuilder: (context, state) => _slidePage(const EditProfileScreen()),
      ),
      GoRoute(
        path: AppRoute.settings.path,
        name: AppRoute.settings.name,
        pageBuilder: (context, state) => _slidePage(const SettingsScreen()),
      ),
      GoRoute(
        path: AppRoute.eventDetail.path,
        name: AppRoute.eventDetail.name,
        pageBuilder: (context, state) => _slidePage(
          EventDetailScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.meetupChat.path,
        name: AppRoute.meetupChat.name,
        pageBuilder: (context, state) => _slidePage(
          MeetupChatScreen(
            chatId: state.pathParameters['chatId']!,
            afterDarkGlow: state.uri.queryParameters['theme'] == 'after-dark'
                ? state.uri.queryParameters['glow']
                : null,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.personalChat.path,
        name: AppRoute.personalChat.name,
        pageBuilder: (context, state) => _slidePage(
          PersonalChatScreen(
            chatId: state.pathParameters['chatId']!,
          ),
        ),
      ),
      GoRoute(
        path: AppRoute.chatLocation.path,
        name: AppRoute.chatLocation.name,
        pageBuilder: (context, state) => _slidePage(
          ChatLocationScreen(
            latitude:
                double.tryParse(state.uri.queryParameters['latitude'] ?? '') ??
                    0,
            longitude:
                double.tryParse(state.uri.queryParameters['longitude'] ?? '') ??
                    0,
            title: state.uri.queryParameters['title'] ?? 'Ты здесь',
            subtitle: state.uri.queryParameters['subtitle'] ?? '',
          ),
        ),
      ),
    ],
  );
}

final appRouter = buildAppRouter(authenticated: true);
