import 'dart:async';
import 'dart:typed_data';

import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/device/app_permission_preferences.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/models/match.dart';
import 'package:big_break_mobile/shared/models/after_party_state.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/story.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_check_in.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/host_dashboard.dart';
import 'package:big_break_mobile/shared/models/live_meetup.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:big_break_mobile/shared/models/personal_chat.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/models/safety_hub.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:big_break_mobile/shared/models/verification_state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final profilePhotoDraftProvider =
    StateProvider<List<ProfilePhoto>>((ref) => const []);

final profilePhotoPreviewProvider =
    StateProvider<Map<String, Uint8List>>((ref) => const {});

final profileProvider = FutureProvider<ProfileData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  final draftPhotos = ref.watch(profilePhotoDraftProvider);
  final profile = await ref.read(backendRepositoryProvider).fetchProfile();
  return mergeProfileDraftPhotos(profile, draftPhotos);
});

final onboardingLocalStateProvider =
    StateProvider<OnboardingData?>((ref) => null);

final onboardingProvider = FutureProvider<OnboardingData>((ref) async {
  final localValue = ref.watch(onboardingLocalStateProvider);
  if (localValue != null) {
    return localValue;
  }
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchOnboarding();
});

final eventsProvider =
    FutureProvider.family<List<Event>, String>((ref, filter) async {
  await ref.watch(authBootstrapProvider.future);
  final location = await _eventFeedLocation(ref, filter);
  return ref
      .read(backendRepositoryProvider)
      .fetchEvents(
        filter: filter,
        latitude: location?.latitude,
        longitude: location?.longitude,
      )
      .then((value) => value.items);
});

Future<({double latitude, double longitude})?> _eventFeedLocation(
  Ref ref,
  String filter,
) async {
  if (filter != 'nearby') {
    return null;
  }

  try {
    final position =
        await ref.read(appLocationServiceProvider).getCurrentPosition();
    if (position == null) {
      return null;
    }
    return (
      latitude: position.latitude,
      longitude: position.longitude,
    );
  } catch (_) {
    return null;
  }
}

class MapEventsQuery {
  const MapEventsQuery({
    this.centerLatitude,
    this.centerLongitude,
    this.radiusKm,
    this.southWestLatitude,
    this.southWestLongitude,
    this.northEastLatitude,
    this.northEastLongitude,
    this.limit = 50,
  });

  final double? centerLatitude;
  final double? centerLongitude;
  final double? radiusKm;
  final double? southWestLatitude;
  final double? southWestLongitude;
  final double? northEastLatitude;
  final double? northEastLongitude;
  final int limit;

  @override
  bool operator ==(Object other) {
    return other is MapEventsQuery &&
        other.centerLatitude == centerLatitude &&
        other.centerLongitude == centerLongitude &&
        other.radiusKm == radiusKm &&
        other.southWestLatitude == southWestLatitude &&
        other.southWestLongitude == southWestLongitude &&
        other.northEastLatitude == northEastLatitude &&
        other.northEastLongitude == northEastLongitude &&
        other.limit == limit;
  }

  @override
  int get hashCode => Object.hash(
        centerLatitude,
        centerLongitude,
        radiusKm,
        southWestLatitude,
        southWestLongitude,
        northEastLatitude,
        northEastLongitude,
        limit,
      );
}

final mapEventsProvider =
    FutureProvider.family<List<Event>, MapEventsQuery>((ref, query) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchEvents(
        filter: 'nearby',
        limit: query.limit,
        latitude: query.centerLatitude,
        longitude: query.centerLongitude,
        radiusKm: query.radiusKm,
        southWestLatitude: query.southWestLatitude,
        southWestLongitude: query.southWestLongitude,
        northEastLatitude: query.northEastLatitude,
        northEastLongitude: query.northEastLongitude,
      )
      .then((value) => value.items);
});

final eventDetailProvider =
    FutureProvider.family<EventDetail, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchEventDetail(eventId);
});

class PostersQuery {
  const PostersQuery({
    required this.query,
    required this.category,
    required this.featuredOnly,
  });

  final String query;
  final PosterCategory? category;
  final bool featuredOnly;

  @override
  bool operator ==(Object other) {
    return other is PostersQuery &&
        other.query == query &&
        other.category == category &&
        other.featuredOnly == featuredOnly;
  }

  @override
  int get hashCode => Object.hash(query, category, featuredOnly);
}

final featuredPostersProvider = FutureProvider<List<Poster>>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchPosters(
        featured: true,
        limit: 6,
      )
      .then((value) => value.items);
});

final posterFeedProvider =
    FutureProvider.family<List<Poster>, PostersQuery>((ref, query) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchPosters(
        q: query.query.isEmpty ? null : query.query,
        category: query.category?.name,
        featured: query.featuredOnly ? true : null,
      )
      .then((value) => value.items);
});

final posterDetailProvider =
    FutureProvider.family<Poster, String>((ref, posterId) async {
  final cached = ref.watch(featuredPostersProvider).valueOrNull;
  if (cached != null) {
    for (final poster in cached) {
      if (poster.id == posterId) {
        return poster;
      }
    }
  }

  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchPosterDetail(posterId);
});

final checkInProvider =
    FutureProvider.family<EventCheckInData, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchCheckIn(eventId);
});

final liveMeetupProvider =
    FutureProvider.family<LiveMeetupData, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchLiveMeetup(eventId);
});

final afterPartyProvider =
    FutureProvider.family<AfterPartyData, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchAfterParty(eventId);
});

final hostDashboardProvider = FutureProvider<HostDashboardData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchHostDashboard();
});

final hostEventProvider =
    FutureProvider.family<HostEventData, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchHostEvent(eventId);
});

final settingsProvider = FutureProvider<UserSettingsData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  if (ref.read(authTokensProvider) == null) {
    return UserSettingsData.fallback;
  }
  final settings = await ref.read(backendRepositoryProvider).fetchSettings();
  await ref.read(appPermissionPreferencesProvider).syncFromSettings(settings);
  return settings;
});

final verificationProvider = FutureProvider<VerificationStateData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchVerification();
});

final safetyHubProvider = FutureProvider<SafetyHubData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchSafetyHub();
});

final storiesProvider =
    FutureProvider.family<List<StoryData>, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchStories(eventId);
});

final matchesProvider = FutureProvider<List<MatchData>>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchMatches();
});

final subscriptionPlansProvider =
    FutureProvider<List<SubscriptionPlanData>>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchSubscriptionPlans();
});

final subscriptionStateProvider =
    FutureProvider<SubscriptionStateData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchSubscriptionState();
});

final peopleProvider = FutureProvider<List<PersonSummary>>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchPeople()
      .then((value) => value.items);
});

final personProfileProvider =
    FutureProvider.family<ProfileData, String>((ref, userId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchPersonProfile(userId);
});

final meetupChatsLocalStateProvider =
    StateProvider<List<MeetupChat>?>((ref) => null);

final meetupChatsProvider = FutureProvider<List<MeetupChat>>((ref) async {
  final authTokens = ref.watch(authTokensProvider);
  if (authTokens == null) {
    return const [];
  }
  final localItems = ref.watch(meetupChatsLocalStateProvider);
  if (localItems != null) {
    return localItems;
  }
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchMeetupChats()
      .then((value) => value.items);
});

final meetupChatSummaryProvider =
    Provider.family<MeetupChat?, String>((ref, chatId) {
  return ref.watch(meetupChatsProvider.select((value) {
    final items = value.valueOrNull;
    if (items == null) {
      return null;
    }

    for (final chat in items) {
      if (chat.id == chatId) {
        return chat;
      }
    }

    return null;
  }));
});

final eveningSessionsProvider =
    FutureProvider<List<EveningSessionSummary>>((ref) async {
  final authTokens = ref.watch(authTokensProvider);
  if (authTokens == null) {
    return const [];
  }
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchEveningSessions()
      .then((value) => value.items);
});

final eveningSessionProvider =
    FutureProvider.family<EveningSessionDetail, String>((ref, sessionId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchEveningSession(sessionId);
});

final eveningRouteTemplatesProvider = FutureProvider.family<
    List<EveningRouteTemplateSummary>, String>((ref, city) async {
  final authTokens = ref.watch(authTokensProvider);
  if (authTokens == null) {
    return const [];
  }
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchEveningRouteTemplates(city: city)
      .then((value) => value.items);
});

final eveningRouteTemplateProvider =
    FutureProvider.family<EveningRouteTemplateDetail, String>(
        (ref, templateId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchEveningRouteTemplate(
        templateId,
      );
});

final eveningRouteTemplateSessionsProvider = FutureProvider.family<
    List<EveningRouteTemplateSession>, String>((ref, templateId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchEveningRouteTemplateSessions(templateId)
      .then((value) => value.items);
});

final personalChatsLocalStateProvider =
    StateProvider<List<PersonalChat>?>((ref) => null);

final personalChatsProvider = FutureProvider<List<PersonalChat>>((ref) async {
  final authTokens = ref.watch(authTokensProvider);
  if (authTokens == null) {
    return const [];
  }
  final localItems = ref.watch(personalChatsLocalStateProvider);
  if (localItems != null) {
    return localItems;
  }
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchPersonalChats()
      .then((value) => value.items);
});

final personalChatSummaryProvider =
    Provider.family<PersonalChat?, String>((ref, chatId) {
  return ref.watch(personalChatsProvider.select((value) {
    final items = value.valueOrNull;
    if (items == null) {
      return null;
    }

    for (final chat in items) {
      if (chat.id == chatId) {
        return chat;
      }
    }

    return null;
  }));
});

final notificationsLocalStateProvider =
    StateProvider<List<NotificationItem>?>((ref) => null);

final notificationsProvider =
    FutureProvider<List<NotificationItem>>((ref) async {
  final localItems = ref.watch(notificationsLocalStateProvider);
  if (localItems != null) {
    return localItems;
  }
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchNotifications()
      .then((value) => value.items);
});

final notificationUnreadCountOverrideProvider =
    StateProvider<int?>((ref) => null);

final notificationUnreadCountProvider = FutureProvider<int>((ref) async {
  final overrideCount = ref.watch(notificationUnreadCountOverrideProvider);
  if (overrideCount != null) {
    return overrideCount;
  }

  final localItems = ref.watch(notificationsLocalStateProvider);
  if (localItems != null) {
    return localItems.where((item) => item.unread).length;
  }

  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchUnreadNotificationCount();
});

final chatUnreadBadgeProvider = Provider<int>((ref) {
  final meetupUnread = ref.watch(meetupChatsProvider.select((value) {
    final items = value.valueOrNull;
    if (items == null) {
      return 0;
    }

    return items.fold<int>(0, (sum, item) => sum + item.unread);
  }));
  final personalUnread = ref.watch(personalChatsProvider.select((value) {
    final items = value.valueOrNull;
    if (items == null) {
      return 0;
    }

    return items.fold<int>(0, (sum, item) => sum + item.unread);
  }));

  return meetupUnread + personalUnread;
});

final hasLiveMeetupChatProvider = Provider<bool>((ref) {
  return ref.watch(meetupChatsProvider.select((value) {
    final items = value.valueOrNull;
    if (items == null) {
      return false;
    }

    return items.any((item) => item.phase == MeetupPhase.live);
  }));
});

final chatRealtimeSyncProvider = Provider<void>((ref) {
  final authTokens = ref.watch(authTokensProvider);
  if (authTokens == null) {
    return;
  }

  final coordinator = _ChatRealtimeSyncCoordinator(ref);
  ref.onDispose(coordinator.dispose);
});

ProfileData mergeProfileDraftPhotos(
  ProfileData profile,
  List<ProfilePhoto> draftPhotos,
) {
  if (draftPhotos.isEmpty) {
    return profile;
  }

  final existingIds = profile.photos.map((photo) => photo.id).toSet();
  final mergedPhotos = [
    ...profile.photos,
    ...draftPhotos.where((photo) => !existingIds.contains(photo.id)),
  ];

  if (mergedPhotos.isEmpty) {
    return profile;
  }

  return profile.copyWith(
    avatarUrl: mergedPhotos.first.url,
    photos: mergedPhotos,
  );
}

List<MeetupChat> upsertMeetupChatSummary(
  List<MeetupChat> chats, {
  required String chatId,
  required String lastMessage,
  required String lastAuthor,
  required String lastTime,
  required int unread,
}) {
  final updated = chats
      .map(
        (chat) => chat.id == chatId
            ? chat.copyWith(
                lastMessage: lastMessage,
                lastAuthor: lastAuthor,
                lastTime: lastTime,
                unread: unread,
                typing: false,
              )
            : chat,
      )
      .toList(growable: false);

  final index = updated.indexWhere((chat) => chat.id == chatId);
  if (index <= 0) {
    return updated;
  }

  return [
    updated[index],
    ...updated.take(index),
    ...updated.skip(index + 1),
  ];
}

List<MeetupChat> upsertMeetupChat(
  List<MeetupChat> chats,
  MeetupChat nextChat,
) {
  return [
    nextChat,
    ...chats.where((chat) => chat.id != nextChat.id),
  ];
}

void clearChatListLocalStateForRefetch(Ref ref) {
  ref.read(meetupChatsLocalStateProvider.notifier).state = null;
  ref.read(personalChatsLocalStateProvider.notifier).state = null;
}

List<PersonalChat> upsertPersonalChatSummary(
  List<PersonalChat> chats, {
  required String chatId,
  required String lastMessage,
  required String lastTime,
  required int unread,
}) {
  final updated = chats
      .map(
        (chat) => chat.id == chatId
            ? chat.copyWith(
                lastMessage: lastMessage,
                lastTime: lastTime,
                unread: unread,
              )
            : chat,
      )
      .toList(growable: false);

  final index = updated.indexWhere((chat) => chat.id == chatId);
  if (index <= 0) {
    return updated;
  }

  return [
    updated[index],
    ...updated.take(index),
    ...updated.skip(index + 1),
  ];
}

List<MeetupChat> setMeetupChatTyping(
  List<MeetupChat> chats, {
  required String chatId,
  required bool isTyping,
}) {
  return chats
      .map(
        (chat) => chat.id == chatId ? chat.copyWith(typing: isTyping) : chat,
      )
      .toList(growable: false);
}

List<MeetupChat> setMeetupChatUnread(
  List<MeetupChat> chats, {
  required String chatId,
  required int unread,
}) {
  return chats
      .map(
        (chat) => chat.id == chatId ? chat.copyWith(unread: unread) : chat,
      )
      .toList(growable: false);
}

List<PersonalChat> setPersonalChatUnread(
  List<PersonalChat> chats, {
  required String chatId,
  required int unread,
}) {
  return chats
      .map(
        (chat) => chat.id == chatId ? chat.copyWith(unread: unread) : chat,
      )
      .toList(growable: false);
}

List<MeetupChat> updateMeetupChatFromRealtime(
  List<MeetupChat> chats, {
  required String chatId,
  MeetupPhase? phase,
  bool hasCurrentStep = false,
  int? currentStep,
  bool hasTotalSteps = false,
  int? totalSteps,
  bool hasCurrentPlace = false,
  String? currentPlace,
  bool hasEndTime = false,
  String? endTime,
  String? startsInLabel,
}) {
  return chats
      .map(
        (chat) => chat.id == chatId
            ? MeetupChat(
                id: chat.id,
                eventId: chat.eventId,
                title: chat.title,
                emoji: chat.emoji,
                time: chat.time,
                lastMessage: chat.lastMessage,
                lastAuthor: chat.lastAuthor,
                lastTime: chat.lastTime,
                unread: chat.unread,
                members: chat.members,
                status: chat.status,
                typing: chat.typing,
                isAfterDark: chat.isAfterDark,
                afterDarkGlow: chat.afterDarkGlow,
                phase: phase ?? chat.phase,
                currentStep: hasCurrentStep ? currentStep : chat.currentStep,
                totalSteps: hasTotalSteps ? totalSteps : chat.totalSteps,
                currentPlace:
                    hasCurrentPlace ? currentPlace : chat.currentPlace,
                endTime: hasEndTime ? endTime : chat.endTime,
                startsInLabel: startsInLabel ?? chat.startsInLabel,
                routeId: chat.routeId,
                sessionId: chat.sessionId,
                mode: chat.mode,
                privacy: chat.privacy,
                joinedCount: chat.joinedCount,
                maxGuests: chat.maxGuests,
                hostUserId: chat.hostUserId,
                hostName: chat.hostName,
                area: chat.area,
              )
            : chat,
      )
      .toList(growable: false);
}

List<NotificationItem> prependNotificationItem(
  List<NotificationItem> items,
  NotificationItem notification,
) {
  return [
    notification,
    ...items.where((item) => item.id != notification.id),
  ];
}

class _ChatRealtimeSyncCoordinator {
  _ChatRealtimeSyncCoordinator(this.ref)
      : _socket = ref.read(chatSocketClientProvider) {
    _eventsSubscription = _socket.events.listen(_handleSocketEvent);

    ref.listen<AsyncValue<List<MeetupChat>>>(meetupChatsProvider, (_, __) {
      _syncSubscriptions();
    });
    ref.listen<AsyncValue<List<PersonalChat>>>(personalChatsProvider, (_, __) {
      _syncSubscriptions();
    });

    unawaited(_connectAndSync());
  }

  final Ref ref;
  final ChatSocketClient _socket;
  final _subscribedChatIds = <String>{};
  late final StreamSubscription<Map<String, dynamic>> _eventsSubscription;

  Future<void> dispose() async {
    for (final chatId in _subscribedChatIds) {
      _socket.unsubscribe(chatId);
    }
    _subscribedChatIds.clear();
    await _eventsSubscription.cancel();
  }

  Future<void> _connectAndSync() async {
    try {
      await _socket.connect();
      _syncSubscriptions();
    } catch (_) {}
  }

  void _syncSubscriptions() {
    final nextChatIds = <String>{
      ...(ref.read(meetupChatsProvider).valueOrNull ?? const <MeetupChat>[])
          .map((chat) => chat.id),
      ...(ref.read(personalChatsProvider).valueOrNull ?? const <PersonalChat>[])
          .map((chat) => chat.id),
    };

    final removedChatIds = _subscribedChatIds.difference(nextChatIds);
    for (final chatId in removedChatIds) {
      _socket.unsubscribe(chatId);
    }

    final addedChatIds = nextChatIds.difference(_subscribedChatIds);
    for (final chatId in addedChatIds) {
      _socket.subscribe(chatId);
    }

    _subscribedChatIds
      ..clear()
      ..addAll(nextChatIds);
  }

  void _handleSocketEvent(Map<String, dynamic> envelope) {
    final type = envelope['type'] as String?;
    final payload = envelope['payload'];

    if (payload is! Map<String, dynamic>) {
      return;
    }

    switch (type) {
      case 'message.created':
        _applyMessageCreated(payload);
        return;
      case 'typing.changed':
        _applyTypingChanged(payload);
        return;
      case 'unread.updated':
        _applyUnreadUpdated(payload);
        return;
      case 'chat.updated':
        _applyChatUpdated(payload);
        return;
      case 'notification.created':
        _applyNotificationCreated(payload);
        return;
    }
  }

  void _applyMessageCreated(Map<String, dynamic> payload) {
    final chatId = payload['chatId'] as String?;
    if (chatId == null) {
      return;
    }

    final currentUserId = ref.read(currentUserIdProvider) ?? 'user-me';
    final message = Message.fromJson(payload, currentUserId: currentUserId);
    final preview = _buildMessagePreview(message);

    final meetupChats = ref.read(meetupChatsProvider).valueOrNull ?? const [];
    final meetupChat =
        meetupChats.where((chat) => chat.id == chatId).firstOrNull;
    if (meetupChat != null) {
      ref.read(meetupChatsLocalStateProvider.notifier).state =
          upsertMeetupChatSummary(
        meetupChats,
        chatId: chatId,
        lastMessage: preview,
        lastAuthor: message.author,
        lastTime: message.time,
        unread: meetupChat.unread,
      );
      return;
    }

    final personalChats =
        ref.read(personalChatsProvider).valueOrNull ?? const [];
    final personalChat =
        personalChats.where((chat) => chat.id == chatId).firstOrNull;
    if (personalChat != null) {
      ref.read(personalChatsLocalStateProvider.notifier).state =
          upsertPersonalChatSummary(
        personalChats,
        chatId: chatId,
        lastMessage: preview,
        lastTime: message.time,
        unread: personalChat.unread,
      );
      return;
    }

    clearChatListLocalStateForRefetch(ref);
    ref.invalidate(meetupChatsProvider);
    ref.invalidate(personalChatsProvider);
  }

  void _applyTypingChanged(Map<String, dynamic> payload) {
    final chatId = payload['chatId'] as String?;
    final isTyping = payload['isTyping'] as bool?;
    if (chatId == null || isTyping == null) {
      return;
    }

    final meetupChats = ref.read(meetupChatsProvider).valueOrNull ?? const [];
    if (meetupChats.any((chat) => chat.id == chatId)) {
      ref.read(meetupChatsLocalStateProvider.notifier).state =
          setMeetupChatTyping(
        meetupChats,
        chatId: chatId,
        isTyping: isTyping,
      );
    }
  }

  void _applyUnreadUpdated(Map<String, dynamic> payload) {
    final chatId = payload['chatId'] as String?;
    final unread = (payload['unreadCount'] as num?)?.toInt();
    if (chatId == null || unread == null) {
      return;
    }

    final meetupChats = ref.read(meetupChatsProvider).valueOrNull ?? const [];
    if (meetupChats.any((chat) => chat.id == chatId)) {
      ref.read(meetupChatsLocalStateProvider.notifier).state =
          setMeetupChatUnread(
        meetupChats,
        chatId: chatId,
        unread: unread,
      );
      return;
    }

    final personalChats =
        ref.read(personalChatsProvider).valueOrNull ?? const [];
    if (personalChats.any((chat) => chat.id == chatId)) {
      ref.read(personalChatsLocalStateProvider.notifier).state =
          setPersonalChatUnread(
        personalChats,
        chatId: chatId,
        unread: unread,
      );
    }
  }

  void _applyChatUpdated(Map<String, dynamic> payload) {
    final chatId = payload['chatId'] as String?;
    if (chatId == null) {
      return;
    }

    final sessionId = payload['sessionId'] as String?;
    final phaseRaw = payload['phase'] as String?;
    final currentStep = (payload['currentStep'] as num?)?.toInt();
    final totalSteps = (payload['totalSteps'] as num?)?.toInt();
    final currentPlace = payload['currentPlace'] as String?;
    final endTime = payload['endTime'] as String?;

    final meetupChats = ref.read(meetupChatsProvider).valueOrNull ?? const [];
    if (meetupChats.any((chat) => chat.id == chatId)) {
      ref.read(meetupChatsLocalStateProvider.notifier).state =
          updateMeetupChatFromRealtime(
        meetupChats,
        chatId: chatId,
        phase: phaseRaw == null ? null : parseMeetupPhase(phaseRaw),
        hasCurrentStep: payload.containsKey('currentStep'),
        currentStep: currentStep,
        hasTotalSteps: payload.containsKey('totalSteps'),
        totalSteps: totalSteps,
        hasCurrentPlace: payload.containsKey('currentPlace'),
        currentPlace: currentPlace,
        hasEndTime: payload.containsKey('endTime'),
        endTime: endTime,
        startsInLabel: payload['startsInLabel'] as String?,
      );
    } else {
      ref.read(meetupChatsLocalStateProvider.notifier).state = null;
      ref.invalidate(meetupChatsProvider);
    }

    ref.invalidate(eveningSessionsProvider);
    if (sessionId != null) {
      ref.invalidate(eveningSessionProvider(sessionId));
    }
  }

  void _applyNotificationCreated(Map<String, dynamic> payload) {
    final nextNotification = _mapRealtimeNotification(payload);

    final currentOverride = ref.read(notificationUnreadCountOverrideProvider);
    if (currentOverride != null) {
      ref.read(notificationUnreadCountOverrideProvider.notifier).state =
          currentOverride + 1;
    } else {
      final currentCount =
          ref.read(notificationUnreadCountProvider).valueOrNull;
      if (currentCount != null) {
        ref.read(notificationUnreadCountOverrideProvider.notifier).state =
            currentCount + 1;
      } else {
        ref.invalidate(notificationUnreadCountProvider);
      }
    }

    if (nextNotification == null) {
      ref.read(notificationsLocalStateProvider.notifier).state = null;
      ref.invalidate(notificationsProvider);
      return;
    }
    _invalidateEveningFromNotification(nextNotification.payload);

    final localItems = ref.read(notificationsLocalStateProvider);
    if (localItems != null) {
      ref.read(notificationsLocalStateProvider.notifier).state =
          prependNotificationItem(localItems, nextNotification);
      return;
    }

    final fetchedItems = ref.read(notificationsProvider).valueOrNull;
    if (fetchedItems != null) {
      ref.read(notificationsLocalStateProvider.notifier).state =
          prependNotificationItem(fetchedItems, nextNotification);
      return;
    }

    ref.invalidate(notificationsProvider);
  }

  void _invalidateEveningFromNotification(Map<String, dynamic> payload) {
    final sessionId = payload['sessionId'] as String?;
    if (sessionId == null || sessionId.isEmpty) {
      return;
    }
    ref.invalidate(eveningSessionsProvider);
    ref.invalidate(eveningSessionProvider(sessionId));
  }

  NotificationItem? _mapRealtimeNotification(Map<String, dynamic> payload) {
    final notificationId = payload['notificationId'] as String?;
    final kind = payload['kind'] as String?;
    final title = payload['title'] as String?;
    final body = payload['body'] as String?;
    final createdAtRaw = payload['createdAt'] as String?;

    if (notificationId == null ||
        kind == null ||
        title == null ||
        body == null ||
        createdAtRaw == null) {
      return null;
    }

    final rawPayload = payload['payload'];
    return NotificationItem(
      id: notificationId,
      kind: kind,
      title: title,
      body: body,
      payload: rawPayload is Map
          ? Map<String, dynamic>.from(rawPayload)
          : const <String, dynamic>{},
      readAt: payload['readAt'] == null
          ? null
          : DateTime.parse(payload['readAt'] as String),
      createdAt: DateTime.parse(createdAtRaw),
    );
  }

  String _buildMessagePreview(Message message) {
    final text = message.text.trim();
    if (text.isNotEmpty) {
      return text;
    }

    if (message.attachments.any((attachment) => attachment.isVoice)) {
      return 'Голосовое сообщение';
    }

    if (message.attachments.any((attachment) => attachment.isLocation)) {
      return 'Локация';
    }

    if (message.attachments.isNotEmpty) {
      return 'Вложение';
    }

    return '';
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
