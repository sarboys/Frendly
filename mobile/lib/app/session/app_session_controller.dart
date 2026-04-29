import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/device/app_permission_preferences.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_shell.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_providers.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_voice_playback_controller.dart';
import 'package:big_break_mobile/features/chats/presentation/chats_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/dating/presentation/dating_providers.dart';
import 'package:big_break_mobile/features/search/presentation/search_providers.dart';
import 'package:big_break_mobile/features/tonight/presentation/tonight_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appSessionControllerProvider = Provider<AppSessionController>(
  (ref) => AppSessionController(ref),
);

class AppSessionController {
  AppSessionController(this.ref);

  final Ref ref;

  Future<void> replaceAuthenticatedSession({
    required AuthTokens tokens,
    required String userId,
  }) async {
    final previousUserId = ref.read(currentUserIdProvider);
    if (previousUserId != null && previousUserId != userId) {
      ref.read(currentUserIdProvider.notifier).state = null;
      ref.read(authTokensProvider.notifier).setTokens(tokens);
      await clearSessionRuntime(clearPersistedChatState: true);
    } else {
      ref.read(authTokensProvider.notifier).setTokens(tokens);
    }

    ref.read(currentUserIdProvider.notifier).state = userId;
    ref.invalidate(authBootstrapProvider);
  }

  Future<void> clearSessionRuntime({
    required bool clearPersistedChatState,
  }) async {
    if (clearPersistedChatState) {
      await SharedPreferencesChatOutboxStorage.clearStoredCommands(
        ref.read(sharedPreferencesProvider),
      );
    }

    await ref.read(appAttachmentServiceProvider).clearPrivateCache();
    await ref.read(appPermissionPreferencesProvider).clear();

    ref.read(profilePhotoDraftProvider.notifier).state = const [];
    ref.read(profilePhotoPreviewProvider.notifier).state = const {};
    ref.read(onboardingLocalStateProvider.notifier).state = null;
    ref.read(meetupChatsLocalStateProvider.notifier).state = null;
    ref.read(personalChatsLocalStateProvider.notifier).state = null;
    ref.read(notificationsLocalStateProvider.notifier).state = null;
    ref.read(notificationUnreadCountOverrideProvider.notifier).state = null;
    ref.read(tonightFilterProvider.notifier).state = TonightFilter.nearby;
    ref.read(chatSegmentProvider.notifier).state = ChatSegment.meetup;
    ref.read(shellBottomBarVisibleProvider.notifier).state = true;

    ref.invalidate(chatRealtimeSyncProvider);
    ref.invalidate(chatThreadProvider);
    ref.invalidate(chatVoicePlaybackControllerProvider);
    ref.invalidate(chatSocketClientProvider);

    ref.invalidate(authBootstrapProvider);
    ref.invalidate(profileProvider);
    ref.invalidate(onboardingProvider);
    ref.invalidate(eventsProvider);
    ref.invalidate(mapEventsProvider);
    ref.invalidate(eventDetailProvider);
    ref.invalidate(featuredPostersProvider);
    ref.invalidate(posterFeedProvider);
    ref.invalidate(posterDetailProvider);
    ref.invalidate(checkInProvider);
    ref.invalidate(liveMeetupProvider);
    ref.invalidate(afterPartyProvider);
    ref.invalidate(hostDashboardProvider);
    ref.invalidate(hostEventProvider);
    ref.invalidate(settingsProvider);
    ref.invalidate(verificationProvider);
    ref.invalidate(safetyHubProvider);
    ref.invalidate(storiesProvider);
    ref.invalidate(matchesProvider);
    ref.invalidate(subscriptionPlansProvider);
    ref.invalidate(subscriptionStateProvider);
    ref.invalidate(peopleProvider);
    ref.invalidate(personProfileProvider);
    ref.invalidate(meetupChatsProvider);
    ref.invalidate(personalChatsProvider);
    ref.invalidate(notificationsProvider);
    ref.invalidate(notificationUnreadCountProvider);
    ref.invalidate(afterDarkAccessProvider);
    ref.invalidate(afterDarkEventsProvider);
    ref.invalidate(afterDarkEventDetailProvider);
    ref.invalidate(datingDiscoverProvider);
    ref.invalidate(datingLikesProvider);
    ref.invalidate(searchResultsProvider);
    ref.invalidate(communitiesFeedProvider);
    ref.invalidate(communitiesProvider);
    ref.invalidate(communityProvider);
  }
}
