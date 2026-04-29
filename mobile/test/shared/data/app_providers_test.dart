import 'dart:async';

import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:big_break_mobile/shared/models/personal_chat.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';

class _ChatsShouldNotLoadWithoutAuthRepository extends BackendRepository {
  _ChatsShouldNotLoadWithoutAuthRepository({
    required super.ref,
    required super.dio,
  });

  var meetupCalls = 0;
  var personalCalls = 0;

  @override
  Future<PaginatedResponse<MeetupChat>> fetchMeetupChats({
    String? cursor,
    int limit = 20,
  }) async {
    meetupCalls += 1;
    throw StateError('meetup chats should stay idle without auth');
  }

  @override
  Future<PaginatedResponse<PersonalChat>> fetchPersonalChats({
    String? cursor,
    int limit = 20,
  }) async {
    personalCalls += 1;
    throw StateError('personal chats should stay idle without auth');
  }
}

class _OnboardingShouldNotLoadWithoutNetworkRepository
    extends BackendRepository {
  _OnboardingShouldNotLoadWithoutNetworkRepository({
    required super.ref,
    required super.dio,
  });

  var onboardingCalls = 0;

  @override
  Future<OnboardingData> fetchOnboarding() async {
    onboardingCalls += 1;
    throw StateError('onboarding should stay local in this test');
  }
}

class _MapEventsRepository extends BackendRepository {
  _MapEventsRepository({
    required super.ref,
    required super.dio,
  });

  String? lastFilter;
  int? lastLimit;
  double? lastLatitude;
  double? lastLongitude;
  double? lastRadiusKm;
  double? lastSouthWestLatitude;
  double? lastSouthWestLongitude;
  double? lastNorthEastLatitude;
  double? lastNorthEastLongitude;

  @override
  Future<PaginatedResponse<Event>> fetchEvents({
    String filter = 'nearby',
    String? q,
    String? lifestyle,
    String? price,
    String? gender,
    String? access,
    String? cursor,
    int limit = 20,
    double? latitude,
    double? longitude,
    double? radiusKm,
    double? southWestLatitude,
    double? southWestLongitude,
    double? northEastLatitude,
    double? northEastLongitude,
  }) async {
    lastFilter = filter;
    lastLimit = limit;
    lastLatitude = latitude;
    lastLongitude = longitude;
    lastRadiusKm = radiusKm;
    lastSouthWestLatitude = southWestLatitude;
    lastSouthWestLongitude = southWestLongitude;
    lastNorthEastLatitude = northEastLatitude;
    lastNorthEastLongitude = northEastLongitude;
    return const PaginatedResponse<Event>(
      items: [],
      nextCursor: null,
    );
  }
}

class _EmptyChatListsRepository extends BackendRepository {
  _EmptyChatListsRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<PaginatedResponse<MeetupChat>> fetchMeetupChats({
    String? cursor,
    int limit = 20,
  }) async {
    return const PaginatedResponse<MeetupChat>(
      items: [],
      nextCursor: null,
    );
  }

  @override
  Future<PaginatedResponse<PersonalChat>> fetchPersonalChats({
    String? cursor,
    int limit = 20,
  }) async {
    return const PaginatedResponse<PersonalChat>(
      items: [],
      nextCursor: null,
    );
  }
}

class _StaticLocationService implements AppLocationService {
  const _StaticLocationService();

  @override
  Future<Position?> getCurrentPosition() async {
    return Position(
      longitude: 37.61,
      latitude: 55.75,
      timestamp: DateTime(2026, 4, 29, 12),
      accuracy: 1,
      altitude: 0,
      altitudeAccuracy: 1,
      heading: 0,
      headingAccuracy: 1,
      speed: 0,
      speedAccuracy: 0,
    );
  }

  @override
  double distanceBetween({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  }) {
    return 0;
  }
}

void main() {
  test('mergeProfileDraftPhotos refreshes avatar from the first merged photo',
      () {
    const profile = ProfileData(
      id: 'user-me',
      displayName: 'Никита М',
      verified: true,
      online: true,
      age: 28,
      city: 'Москва',
      area: 'Чистые пруды',
      bio: 'bio',
      vibe: 'Спокойно',
      rating: 4.8,
      meetupCount: 12,
      avatarUrl: 'https://cdn.example.com/stale.jpg',
      interests: ['Кофе'],
      intent: ['Друзья'],
    );

    const merged = [
      ProfilePhoto(
        id: 'ph1',
        url: 'https://cdn.example.com/ph1.jpg',
        order: 0,
      ),
      ProfilePhoto(
        id: 'ph2',
        url: 'https://cdn.example.com/ph2.jpg',
        order: 1,
      ),
    ];

    final result = mergeProfileDraftPhotos(profile, merged);

    expect(result.photos, merged);
    expect(result.avatarUrl, 'https://cdn.example.com/ph1.jpg');
  });

  test('upsertMeetupChatSummary updates chat preview and moves it to top', () {
    const chats = [
      MeetupChat(
        id: 'mc1',
        eventId: 'e1',
        title: 'Первый чат',
        emoji: '🍷',
        time: '20:00',
        lastMessage: 'Старое сообщение',
        lastAuthor: 'Аня',
        lastTime: '1 ч',
        unread: 2,
        members: ['Аня', 'Ты'],
        status: 'Сегодня',
      ),
      MeetupChat(
        id: 'mc2',
        eventId: 'e2',
        title: 'Второй чат',
        emoji: '♟️',
        time: '19:00',
        lastMessage: 'Привет',
        lastAuthor: 'Паша',
        lastTime: '5 мин',
        unread: 1,
        members: ['Паша', 'Ты'],
        status: 'Сегодня',
      ),
    ];

    final result = upsertMeetupChatSummary(
      chats,
      chatId: 'mc2',
      lastMessage: 'Новое сообщение',
      lastAuthor: 'Ты',
      lastTime: 'сейчас',
      unread: 0,
    );

    expect(result.first.id, 'mc2');
    expect(result.first.lastMessage, 'Новое сообщение');
    expect(result.first.lastAuthor, 'Ты');
    expect(result.first.lastTime, 'сейчас');
    expect(result.first.unread, 0);
  });

  test('upsertMeetupChat inserts new chat and keeps existing chats', () {
    const chats = [
      MeetupChat(
        id: 'mc1',
        eventId: 'e1',
        title: 'Первый чат',
        emoji: '🍷',
        time: '20:00',
        lastMessage: 'Старое сообщение',
        lastAuthor: 'Аня',
        lastTime: '1 ч',
        unread: 2,
        members: ['Аня', 'Ты'],
        status: 'Сегодня',
      ),
    ];
    const eveningChat = MeetupChat(
      id: 'evening-chat-new',
      eventId: null,
      title: 'Теплый круг',
      emoji: '🍇',
      time: '19:00',
      lastMessage: 'Вечер опубликован',
      lastAuthor: 'Frendly',
      lastTime: 'сейчас',
      unread: 0,
      members: ['Ты'],
      phase: MeetupPhase.soon,
      routeId: 'r-cozy-circle',
      sessionId: 'session-new',
      hostUserId: 'user-me',
    );

    final result = upsertMeetupChat(chats, eveningChat);

    expect(result, hasLength(2));
    expect(result.first.id, 'evening-chat-new');
    expect(result.last.id, 'mc1');
  });

  test('upsertPersonalChatSummary updates preview and moves chat to top', () {
    const chats = [
      PersonalChat(
        id: 'p1',
        name: 'Аня',
        lastMessage: 'Старое',
        lastTime: 'вчера',
        unread: 3,
        online: true,
      ),
      PersonalChat(
        id: 'p2',
        name: 'Соня',
        lastMessage: 'Привет',
        lastTime: '5 мин',
        unread: 1,
        online: false,
      ),
    ];

    final result = upsertPersonalChatSummary(
      chats,
      chatId: 'p1',
      lastMessage: 'Голосовое сообщение',
      lastTime: 'сейчас',
      unread: 0,
    );

    expect(result.first.id, 'p1');
    expect(result.first.lastMessage, 'Голосовое сообщение');
    expect(result.first.lastTime, 'сейчас');
    expect(result.first.unread, 0);
  });

  test('mapEventsProvider requests a bounded map page', () async {
    _MapEventsRepository? repository;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        backendRepositoryProvider.overrideWith((ref) {
          repository = _MapEventsRepository(ref: ref, dio: Dio());
          return repository!;
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(
      mapEventsProvider(
        const MapEventsQuery(
          centerLatitude: 55.75,
          centerLongitude: 37.61,
          radiusKm: 4,
          southWestLatitude: 55.70,
          southWestLongitude: 37.50,
          northEastLatitude: 55.80,
          northEastLongitude: 37.70,
        ),
      ).future,
    );

    expect(repository, isNotNull);
    expect(repository!.lastFilter, 'nearby');
    expect(repository!.lastLimit, 50);
    expect(repository!.lastLatitude, 55.75);
    expect(repository!.lastLongitude, 37.61);
    expect(repository!.lastRadiusKm, 4);
    expect(repository!.lastSouthWestLatitude, 55.70);
    expect(repository!.lastSouthWestLongitude, 37.50);
    expect(repository!.lastNorthEastLatitude, 55.80);
    expect(repository!.lastNorthEastLongitude, 37.70);
  });

  test('eventsProvider sends current location for nearby feed', () async {
    _MapEventsRepository? repository;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        appLocationServiceProvider.overrideWith(
          (ref) => const _StaticLocationService(),
        ),
        backendRepositoryProvider.overrideWith((ref) {
          repository = _MapEventsRepository(ref: ref, dio: Dio());
          return repository!;
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(eventsProvider('nearby').future);

    expect(repository, isNotNull);
    expect(repository!.lastFilter, 'nearby');
    expect(repository!.lastLatitude, 55.75);
    expect(repository!.lastLongitude, 37.61);
  });

  test(
      'chatRealtimeSyncProvider subscribes chat ids and applies typing and unread updates',
      () async {
    final socket = _FakeGlobalChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        authTokensProvider.overrideWith(
          (ref) => _StaticAuthTokensController(),
        ),
        chatSocketClientProvider.overrideWith((ref) => socket),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const [
            MeetupChat(
              id: 'mc1',
              eventId: 'e1',
              title: 'Встреча',
              emoji: '🍷',
              time: '20:00',
              lastMessage: 'Привет',
              lastAuthor: 'Аня',
              lastTime: '1 мин',
              unread: 1,
              members: ['Аня', 'Ты'],
              status: 'Сегодня',
            ),
          ],
        ),
        personalChatsLocalStateProvider.overrideWith(
          (ref) => const [
            PersonalChat(
              id: 'p1',
              name: 'Соня',
              lastMessage: 'Привет',
              lastTime: '2 мин',
              unread: 1,
              online: true,
            ),
          ],
        ),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    container.read(chatRealtimeSyncProvider);
    await container.read(meetupChatsProvider.future);
    await container.read(personalChatsProvider.future);
    await _drain();

    expect(socket.subscribedChatIds, containsAll(<String>['mc1', 'p1']));

    socket.emit({
      'type': 'typing.changed',
      'payload': {
        'chatId': 'mc1',
        'isTyping': true,
      },
    });
    socket.emit({
      'type': 'unread.updated',
      'payload': {
        'chatId': 'p1',
        'unreadCount': 4,
      },
    });
    await _drain();

    final meetupChats = container.read(meetupChatsProvider).valueOrNull;
    final personalChats = container.read(personalChatsProvider).valueOrNull;

    expect(meetupChats?.single.typing, true);
    expect(personalChats?.single.unread, 4);
  });

  test('chatRealtimeSyncProvider applies evening chat phase updates', () async {
    final socket = _FakeGlobalChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        authTokensProvider.overrideWith(
          (ref) => _StaticAuthTokensController(),
        ),
        chatSocketClientProvider.overrideWith((ref) => socket),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const [
            MeetupChat(
              id: 'evening-chat-1',
              eventId: null,
              title: 'Теплый круг',
              emoji: '🍷',
              time: '19:00',
              lastMessage: 'Собираемся',
              lastAuthor: 'Frendly',
              lastTime: 'сейчас',
              unread: 0,
              members: ['Ты', 'Аня'],
              phase: MeetupPhase.soon,
              routeId: 'r-cozy-circle',
              sessionId: 'session-1',
              totalSteps: 2,
            ),
          ],
        ),
        personalChatsLocalStateProvider.overrideWith(
          (ref) => const <PersonalChat>[],
        ),
        eveningSessionsProvider.overrideWith((ref) async => const []),
        eveningSessionProvider('session-1').overrideWith(
          (ref) async => const EveningSessionDetail(
            id: 'session-1',
            routeId: 'r-cozy-circle',
            chatId: 'evening-chat-1',
            phase: EveningSessionPhase.live,
            chatPhase: MeetupPhase.live,
            privacy: EveningPrivacy.open,
            title: 'Теплый круг',
            vibe: 'Камерно',
            emoji: '🍷',
            participants: [],
            steps: [],
          ),
        ),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    container.read(chatRealtimeSyncProvider);
    await container.read(meetupChatsProvider.future);
    await _drain();

    socket.emit({
      'type': 'chat.updated',
      'payload': {
        'chatId': 'evening-chat-1',
        'sessionId': 'session-1',
        'phase': 'live',
        'currentStep': 1,
        'totalSteps': 2,
        'currentPlace': 'Brix Wine',
        'endTime': '20:15',
      },
    });
    await _drain();

    final chat = container.read(meetupChatsProvider).valueOrNull?.single;
    expect(chat?.phase, MeetupPhase.live);
    expect(chat?.currentStep, 1);
    expect(chat?.currentPlace, 'Brix Wine');
    expect(chat?.endTime, '20:15');
  });

  test('chatRealtimeSyncProvider clears stale meetup override for unknown chat',
      () async {
    final socket = _FakeGlobalChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        authTokensProvider.overrideWith(
          (ref) => _StaticAuthTokensController(),
        ),
        chatSocketClientProvider.overrideWith((ref) => socket),
        backendRepositoryProvider.overrideWith(
          (ref) => _EmptyChatListsRepository(ref: ref, dio: Dio()),
        ),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const <MeetupChat>[],
        ),
        personalChatsLocalStateProvider.overrideWith(
          (ref) => const <PersonalChat>[],
        ),
        eveningSessionsProvider.overrideWith((ref) async => const []),
        eveningSessionProvider('session-new').overrideWith(
          (ref) async => const EveningSessionDetail(
            id: 'session-new',
            routeId: 'r-cozy-circle',
            chatId: 'evening-chat-new',
            phase: EveningSessionPhase.scheduled,
            chatPhase: MeetupPhase.soon,
            privacy: EveningPrivacy.open,
            title: 'Теплый круг',
            vibe: 'Камерно',
            emoji: '🍷',
            participants: [],
            steps: [],
          ),
        ),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    container.read(chatRealtimeSyncProvider);
    await container.read(meetupChatsProvider.future);
    await _drain();

    socket.emit({
      'type': 'chat.updated',
      'payload': {
        'chatId': 'evening-chat-new',
        'sessionId': 'session-new',
        'phase': 'soon',
      },
    });
    await _drain();

    expect(container.read(meetupChatsLocalStateProvider), isNull);
  });

  test(
      'chatRealtimeSyncProvider invalidates evening detail from notification payload',
      () async {
    final socket = _FakeGlobalChatSocketClient();
    var detailLoads = 0;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        authTokensProvider.overrideWith(
          (ref) => _StaticAuthTokensController(),
        ),
        chatSocketClientProvider.overrideWith((ref) => socket),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const [
            MeetupChat(
              id: 'evening-chat-1',
              eventId: null,
              title: 'Теплый круг',
              emoji: '🍷',
              time: '19:00',
              lastMessage: 'Собираемся',
              lastAuthor: 'Frendly',
              lastTime: 'сейчас',
              unread: 0,
              members: ['Ты'],
              phase: MeetupPhase.soon,
              routeId: 'r-cozy-circle',
              sessionId: 'session-1',
            ),
          ],
        ),
        personalChatsLocalStateProvider.overrideWith(
          (ref) => const <PersonalChat>[],
        ),
        notificationsLocalStateProvider.overrideWith(
          (ref) => const <NotificationItem>[],
        ),
        notificationUnreadCountProvider.overrideWith((ref) async => 0),
        eveningSessionsProvider.overrideWith((ref) async => const []),
        eveningSessionProvider('session-1').overrideWith((ref) async {
          detailLoads += 1;
          return const EveningSessionDetail(
            id: 'session-1',
            routeId: 'r-cozy-circle',
            chatId: 'evening-chat-1',
            phase: EveningSessionPhase.scheduled,
            chatPhase: MeetupPhase.soon,
            privacy: EveningPrivacy.request,
            title: 'Теплый круг',
            vibe: 'Камерно',
            emoji: '🍷',
            participants: [],
            steps: [],
          );
        }),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    container.read(chatRealtimeSyncProvider);
    await container.read(meetupChatsProvider.future);
    await container.read(eveningSessionProvider('session-1').future);
    expect(detailLoads, 1);

    socket.emit({
      'type': 'notification.created',
      'payload': {
        'notificationId': 'n-evening-request',
        'kind': 'event_joined',
        'title': 'Новая заявка',
        'body': 'Новая заявка на вечер',
        'createdAt': '2026-04-26T12:00:00Z',
        'payload': {
          'sessionId': 'session-1',
          'requestId': 'request-1',
        },
      },
    });
    await _drain();
    await container.read(eveningSessionProvider('session-1').future);

    expect(detailLoads, 2);
  });

  test(
      'chatRealtimeSyncProvider updates personal preview, badge and local notifications from realtime event',
      () async {
    final socket = _FakeGlobalChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        authTokensProvider.overrideWith(
          (ref) => _StaticAuthTokensController(),
        ),
        chatSocketClientProvider.overrideWith((ref) => socket),
        personalChatsLocalStateProvider.overrideWith(
          (ref) => const [
            PersonalChat(
              id: 'p1',
              name: 'Соня',
              lastMessage: 'Старое',
              lastTime: 'вчера',
              unread: 1,
              online: true,
            ),
            PersonalChat(
              id: 'p2',
              name: 'Аня',
              lastMessage: 'Текст',
              lastTime: '5 мин',
              unread: 0,
              online: false,
            ),
          ],
        ),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const <MeetupChat>[],
        ),
        notificationsLocalStateProvider.overrideWith(
          (ref) => [
            NotificationItem(
              id: 'n1',
              kind: 'message',
              title: 'Новое сообщение',
              body: 'Старое уведомление',
              payload: {'chatId': 'p1'},
              readAt: null,
              createdAt: DateTime(2026, 4, 21, 11, 0),
            ),
          ],
        ),
        notificationUnreadCountProvider.overrideWith((ref) async => 2),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    container.read(chatRealtimeSyncProvider);
    await container.read(personalChatsProvider.future);
    await container.read(notificationUnreadCountProvider.future);
    await _drain();

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'm-voice',
        'chatId': 'p2',
        'clientMessageId': 'client-m-voice',
        'senderId': 'user-anya',
        'senderName': 'Аня',
        'text': '',
        'createdAt': '2026-04-21T12:20:00Z',
        'attachments': [
          {
            'id': 'a-voice',
            'kind': 'chat_voice',
            'status': 'ready',
            'url': 'https://example.com/voice.m4a',
            'mimeType': 'audio/mp4',
            'byteSize': 1234,
            'fileName': 'voice.m4a',
            'durationMs': 7000,
          },
        ],
      },
    });
    socket.emit({
      'type': 'notification.created',
      'payload': {
        'userId': 'user-me',
        'notificationId': 'n100',
        'kind': 'message',
        'title': 'Новое сообщение',
        'body': 'Аня: Голосовое сообщение',
        'payload': {
          'chatId': 'p2',
          'messageId': 'm-voice',
        },
        'createdAt': '2026-04-21T12:20:00Z',
        'readAt': null,
      },
    });
    await _drain();

    final personalChats = container.read(personalChatsProvider).valueOrNull;
    expect(personalChats?.first.id, 'p2');
    expect(personalChats?.first.lastMessage, 'Голосовое сообщение');
    expect(
      container.read(notificationUnreadCountOverrideProvider),
      3,
    );
    final notifications = container.read(notificationsLocalStateProvider);
    expect(notifications?.first.id, 'n100');
    expect(notifications?.first.body, 'Аня: Голосовое сообщение');
    expect(notifications?.first.payload['chatId'], 'p2');
  });

  test('chat lists stay empty without auth instead of calling backend',
      () async {
    var repositoryBuilt = false;
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWith(
          (ref) {
            repositoryBuilt = true;
            return _ChatsShouldNotLoadWithoutAuthRepository(
              ref: ref,
              dio: Dio(),
            );
          },
        ),
      ],
    );
    addTearDown(container.dispose);

    final meetupChats = await container.read(meetupChatsProvider.future);
    final personalChats = await container.read(personalChatsProvider.future);

    expect(meetupChats, isEmpty);
    expect(personalChats, isEmpty);
    expect(repositoryBuilt, isFalse);
  });

  test('onboarding provider prefers local state before backend fetch',
      () async {
    late _OnboardingShouldNotLoadWithoutNetworkRepository repository;
    var repositoryBuilt = false;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        authTokensProvider.overrideWith(
          (ref) => _StaticAuthTokensController(),
        ),
        backendRepositoryProvider.overrideWith((ref) {
          repositoryBuilt = true;
          repository = _OnboardingShouldNotLoadWithoutNetworkRepository(
            ref: ref,
            dio: Dio(),
          );
          return repository;
        }),
        onboardingLocalStateProvider.overrideWith(
          (ref) => const OnboardingData(
            intent: 'both',
            gender: 'male',
            city: 'Москва',
            area: 'Патрики',
            interests: ['Кофе', 'Кино'],
            vibe: 'calm',
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

    final onboarding = await container.read(onboardingProvider.future);

    expect(onboarding.city, 'Москва');
    expect(onboarding.area, 'Патрики');
    expect(repositoryBuilt, isFalse);
  });
}

Future<void> _drain() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

class _FakeGlobalChatSocketClient extends ChatSocketClient {
  _FakeGlobalChatSocketClient()
      : _events = StreamController<Map<String, dynamic>>.broadcast(),
        super(accessTokenProvider: _token);

  final StreamController<Map<String, dynamic>> _events;
  final List<String> subscribedChatIds = <String>[];
  final List<String> unsubscribedChatIds = <String>[];

  static Future<String> _token() async => 'token';

  @override
  Stream<Map<String, dynamic>> get events => _events.stream;

  @override
  Future<void> connect() async {}

  @override
  void subscribe(String chatId) {
    subscribedChatIds.add(chatId);
  }

  @override
  void unsubscribe(String chatId) {
    unsubscribedChatIds.add(chatId);
  }

  void emit(Map<String, dynamic> envelope) {
    _events.add(envelope);
  }

  @override
  Future<void> dispose() async {
    await _events.close();
  }
}

class _StaticAuthTokensController extends AuthTokensController {
  _StaticAuthTokensController()
      : super(
          null,
          tokenStorage: null,
        ) {
    state = const AuthTokens(
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    );
  }
}
