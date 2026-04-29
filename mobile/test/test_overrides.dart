import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/features/communities/data/mock_communities.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

List<Override> buildTestOverrides() {
  return [
    authBootstrapProvider.overrideWith((ref) async {}),
    currentUserIdProvider.overrideWith((ref) => 'user-me'),
    profileProvider.overrideWith(
      (ref) async => const ProfileData(
        id: 'user-me',
        displayName: 'Никита М',
        verified: true,
        online: true,
        age: 28,
        city: 'Москва',
        area: 'Чистые пруды',
        bio:
            'Дизайнер. Люблю долгие прогулки и тихие бары. Ищу людей, с которыми можно собраться без долгого планирования.',
        vibe: 'Спокойно',
        rating: 4.8,
        meetupCount: 12,
        avatarUrl: null,
        interests: ['Кофе', 'Бары', 'Настолки', 'Кино', 'Книги', 'Велик'],
        intent: ['Свидания', 'Друзья'],
      ),
    ),
    onboardingProvider.overrideWith(
      (ref) async => const OnboardingData(
        intent: 'both',
        gender: 'male',
        birthDate: '2000-04-24',
        city: 'Москва',
        area: 'Чистые пруды',
        interests: ['Кофе', 'Бары', 'Настолки'],
        vibe: 'calm',
      ),
    ),
    eventDetailProvider.overrideWith((ref, eventId) async {
      if (eventId == 'e5') {
        return const EventDetail(
          id: 'e5',
          title: 'Камерный ужин по заявкам',
          emoji: '🍝',
          time: 'Сегодня · 18:30',
          place: 'Солянка 5',
          distance: '0.7 км',
          vibe: 'Уютно',
          description:
              'Ужин в маленькой компании. Сначала заявка, потом подтверждение хостом.',
          hostNote: 'Хочу собрать маленькую спокойную компанию.',
          joined: false,
          partnerName: null,
          partnerOffer: null,
          capacity: 6,
          going: 1,
          chatId: 'mc5',
          host: EventHost(
            id: 'user-me',
            displayName: 'Никита М',
            verified: true,
            rating: 4.9,
            meetupCount: 12,
            avatarUrl: null,
          ),
          attendees: [
            EventAttendee(
              id: 'user-me',
              displayName: 'Никита М',
              avatarUrl: null,
            ),
          ],
        );
      }

      return const EventDetail(
        id: 'e1',
        title: 'Винный вечер на крыше',
        emoji: '🍷',
        time: 'Сегодня · 20:00',
        place: 'Brix Wine, Покровка 12',
        distance: '1.2 км',
        vibe: 'Спокойно',
        description: 'Камерный вечер на крыше.',
        hostNote: 'Знакомимся за бокалом, без спешки.',
        joined: true,
        partnerName: 'Brix Wine',
        partnerOffer: '−15% на бокалы для участников',
        capacity: 10,
        going: 6,
        chatId: 'mc1',
        host: EventHost(
          id: 'user-anya',
          displayName: 'Аня К',
          verified: true,
          rating: 4.9,
          meetupCount: 23,
          avatarUrl: null,
        ),
        attendees: [
          EventAttendee(
            id: 'user-me',
            displayName: 'Никита М',
            avatarUrl: null,
          ),
          EventAttendee(
            id: 'user-anya',
            displayName: 'Аня К',
            avatarUrl: null,
          ),
        ],
      );
    }),
    eventsProvider.overrideWith((ref, filter) async => mockEvents),
    mapEventsProvider.overrideWith((ref, query) async => mockEvents),
    checkInProvider.overrideWith((ref, eventId) async => mockCheckInData),
    liveMeetupProvider.overrideWith((ref, eventId) async => mockLiveMeetupData),
    afterPartyProvider.overrideWith((ref, eventId) async => mockAfterPartyData),
    hostDashboardProvider.overrideWith((ref) async => mockHostDashboardData),
    hostEventProvider.overrideWith((ref, eventId) async => mockHostEventData),
    settingsProvider.overrideWith((ref) async => mockUserSettingsData),
    verificationProvider.overrideWith((ref) async => mockVerificationState),
    safetyHubProvider.overrideWith((ref) async => mockSafetyHubData),
    storiesProvider.overrideWith((ref, eventId) async => mockStories),
    featuredPostersProvider.overrideWith((ref) async => mockPosters),
    posterFeedProvider.overrideWith((ref, query) async => mockPosters),
    posterDetailProvider.overrideWith((ref, posterId) async {
      return mockPosters.firstWhere(
        (poster) => poster.id == posterId,
        orElse: () => mockPosters.first,
      );
    }),
    matchesProvider.overrideWith((ref) async => mockMatches),
    subscriptionPlansProvider.overrideWith(
      (ref) async => mockSubscriptionPlans,
    ),
    subscriptionStateProvider.overrideWith(
      (ref) async => mockSubscriptionState,
    ),
    afterDarkAccessProvider.overrideWith((ref) async => mockAfterDarkAccess),
    afterDarkEventsProvider.overrideWith((ref) async => mockAfterDarkEvents),
    afterDarkEventDetailProvider.overrideWith((ref, eventId) async {
      return mockAfterDarkEventDetails[eventId] ??
          mockAfterDarkEventDetails.values.first;
    }),
    communitiesFeedProvider.overrideWith(
      (ref) => CommunitiesFeedController(
        ref,
        initialState: const CommunitiesFeedState(
          items: mockCommunities,
          nextCursor: null,
        ),
      ),
    ),
    communitiesProvider.overrideWith((ref) async => mockCommunities),
    meetupChatsProvider.overrideWith((ref) async => mockMeetupChats),
    eveningSessionsProvider.overrideWith(
      (ref) async => mockMeetupChats
          .where(
              (chat) => chat.routeId != null && chat.phase != MeetupPhase.done)
          .map(
            (chat) => EveningSessionSummary(
              id: 'session-${chat.id}',
              routeId: chat.routeId!,
              chatId: chat.id,
              phase: chat.phase == MeetupPhase.live
                  ? EveningSessionPhase.live
                  : EveningSessionPhase.scheduled,
              chatPhase: chat.phase,
              privacy: chat.privacy,
              title: chat.title,
              vibe: chat.lastMessage,
              emoji: chat.emoji,
              area: chat.area,
              hostUserId: chat.hostUserId,
              hostName: chat.hostName,
              joinedCount: chat.joinedCount,
              maxGuests: chat.maxGuests,
              currentStep: chat.currentStep,
              totalSteps: chat.totalSteps,
              currentPlace: chat.currentPlace,
              endTime: chat.endTime,
            ),
          )
          .toList(growable: false),
    ),
    personalChatsProvider.overrideWith((ref) async => mockPersonalChats),
    peopleProvider.overrideWith(
      (ref) async => mockPeople
          .map(
            (item) => PersonSummary(
              id: item.name,
              name: item.name,
              age: item.age,
              area: item.area,
              common: item.common,
              online: item.online,
              verified: item.verified,
              vibe: item.vibe,
              avatarUrl: null,
            ),
          )
          .toList(growable: false),
    ),
    personProfileProvider.overrideWith(
      (ref, userId) async => const ProfileData(
        id: 'user-anya',
        displayName: 'Аня К',
        verified: true,
        online: true,
        age: 27,
        city: 'Москва',
        area: 'Чистые пруды',
        bio: 'Люблю камерные вечера и хорошие бары.',
        vibe: 'Спокойно',
        rating: 4.9,
        meetupCount: 23,
        avatarUrl: null,
        interests: ['Кофе', 'Настолки', 'Бары'],
        intent: ['Свидания'],
      ),
    ),
    notificationsProvider.overrideWith(
      (ref) async => [
        NotificationItem(
          id: 'n1',
          kind: 'message',
          title: 'Новое сообщение',
          body: 'Аня К: Тогда до восьми у входа?',
          payload: const {'chatId': 'p1'},
          readAt: null,
          createdAt: DateTime(2026, 4, 18, 21, 9),
        ),
      ],
    ),
    notificationUnreadCountProvider.overrideWith((ref) async => 1),
  ];
}
