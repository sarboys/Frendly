import 'dart:io';

import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/device/app_permission_preferences.dart';
import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_shell.dart';
import 'package:big_break_mobile/app/session/app_session_controller.dart';
import 'package:big_break_mobile/features/chats/presentation/chats_providers.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/dating/presentation/dating_providers.dart';
import 'package:big_break_mobile/features/tonight/presentation/tonight_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/personal_chat.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_overrides.dart';

void main() {
  test(
    'clearSessionRuntime drops persisted outbox, disposes chat runtime and resets user state',
    () async {
      SharedPreferences.setMockInitialValues({
        'chat.outbox.commands':
            '[{"type":"message.send","payload":{"chatId":"chat-1"},"dedupeKey":"m1"}]',
        'permissions.allow_location': true,
        'permissions.allow_contacts': true,
      });
      final preferences = await SharedPreferences.getInstance();
      final socket = _DisposeAwareChatSocketClient();
      final attachmentService = _RecordingAttachmentService();
      var profileReads = 0;
      var communityReads = 0;

      final container = ProviderContainer(
        overrides: [
          ...buildTestOverrides(),
          datingDiscoverProvider.overrideWith((ref) async => const []),
          datingLikesProvider.overrideWith((ref) async => const []),
          sharedPreferencesProvider.overrideWithValue(preferences),
          authTokensProvider
              .overrideWith((ref) => _StaticAuthTokensController()),
          chatSocketClientProvider.overrideWith((ref) {
            ref.onDispose(socket.dispose);
            return socket;
          }),
          appAttachmentServiceProvider.overrideWithValue(attachmentService),
          communitiesProvider.overrideWith((ref) async {
            communityReads += 1;
            return const [
              Community(
                id: 'c1',
                chatId: 'community-chat-1',
                name: 'City Rituals',
                avatar: '🌿',
                description: 'Community',
                privacy: CommunityPrivacy.public,
                members: 10,
                online: 1,
                tags: ['city'],
                joinRule: 'Open',
                premiumOnly: true,
                unread: 0,
                mood: 'Городской клуб',
                sharedMediaLabel: '0 медиа',
                news: [],
                meetups: [],
                media: [],
                chatPreview: [],
                chatMessages: [],
                socialLinks: [],
                memberNames: [],
              ),
            ];
          }),
          profileProvider.overrideWith((ref) async {
            profileReads += 1;
            return const ProfileData(
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
              avatarUrl: null,
              interests: ['Кофе'],
              intent: ['Друзья'],
            );
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
          notificationsLocalStateProvider.overrideWith(
            (ref) => [
              NotificationItem(
                id: 'n1',
                kind: 'message',
                title: 'Новое сообщение',
                body: 'Привет',
                payload: const {'chatId': 'p1'},
                readAt: null,
                createdAt: DateTime(2026, 4, 23, 12, 0),
              ),
            ],
          ),
          notificationUnreadCountOverrideProvider.overrideWith((ref) => 4),
          tonightFilterProvider.overrideWith((ref) => TonightFilter.date),
          chatSegmentProvider.overrideWith((ref) => ChatSegment.personal),
          shellBottomBarVisibleProvider.overrideWith((ref) => false),
        ],
      );
      addTearDown(container.dispose);

      await container.read(profileProvider.future);
      await container.read(communitiesProvider.future);
      container.read(chatSocketClientProvider);

      container.read(authTokensProvider.notifier).clear();
      await container
          .read(appSessionControllerProvider)
          .clearSessionRuntime(clearPersistedChatState: true);

      expect(socket.disposed, isTrue);
      expect(attachmentService.clearCalls, 1);
      expect(preferences.getString('chat.outbox.commands'), isNull);
      expect(preferences.getBool('permissions.allow_location'), isNull);
      expect(preferences.getBool('permissions.allow_contacts'), isNull);
      expect(container.read(onboardingLocalStateProvider), isNull);
      expect(container.read(meetupChatsLocalStateProvider), isNull);
      expect(container.read(personalChatsLocalStateProvider), isNull);
      expect(container.read(notificationsLocalStateProvider), isNull);
      expect(container.read(notificationUnreadCountOverrideProvider), isNull);
      expect(container.read(tonightFilterProvider), TonightFilter.nearby);
      expect(container.read(chatSegmentProvider), ChatSegment.meetup);
      expect(container.read(shellBottomBarVisibleProvider), isTrue);

      await container.read(profileProvider.future);
      expect(profileReads, 2);
      await container.read(communitiesProvider.future);
      expect(communityReads, 2);
    },
  );

  test('replaceAuthenticatedSession clears user scoped state on account switch',
      () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final attachmentService = _RecordingAttachmentService();
    final tokensController = _StaticAuthTokensController();

    final container = ProviderContainer(
      overrides: [
        ...buildTestOverrides(),
        datingDiscoverProvider.overrideWith((ref) async => const []),
        datingLikesProvider.overrideWith((ref) async => const []),
        sharedPreferencesProvider.overrideWithValue(preferences),
        authTokensProvider.overrideWith((ref) => tokensController),
        currentUserIdProvider.overrideWith((ref) => 'user-one'),
        appAttachmentServiceProvider.overrideWithValue(attachmentService),
        appPermissionPreferencesProvider.overrideWithValue(
          AppPermissionPreferences(preferences),
        ),
        onboardingLocalStateProvider.overrideWith(
          (ref) => const OnboardingData(
            intent: 'both',
            gender: 'male',
            birthDate: '2000-04-24',
            city: 'Москва',
            area: 'Патрики',
            interests: ['Кофе', 'Кино'],
            vibe: 'calm',
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container
        .read(appSessionControllerProvider)
        .replaceAuthenticatedSession(
          tokens: const AuthTokens(
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          ),
          userId: 'user-two',
        );

    expect(container.read(currentUserIdProvider), 'user-two');
    expect(container.read(authTokensProvider)?.accessToken, 'new-access-token');
    expect(container.read(onboardingLocalStateProvider), isNull);
    expect(attachmentService.clearCalls, 1);
  });
}

class _DisposeAwareChatSocketClient extends ChatSocketClient {
  _DisposeAwareChatSocketClient() : super(accessTokenProvider: _token);

  bool disposed = false;

  static Future<String> _token() async => 'token';

  @override
  Future<void> dispose() async {
    disposed = true;
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

class _RecordingAttachmentService implements AppAttachmentService {
  int clearCalls = 0;

  @override
  Future<void> clearPrivateCache() async {
    clearCalls += 1;
  }

  @override
  Future<String?> getDownloadUrl(MessageAttachment attachment) async => null;

  @override
  Future<File> getCachedFile(MessageAttachment attachment) {
    throw UnimplementedError();
  }

  @override
  Future<File?> getLocalFileIfAvailable(MessageAttachment attachment) async =>
      null;

  @override
  Future<void> openAttachment(MessageAttachment attachment) async {}

  @override
  Future<String> saveAttachmentToDevice(MessageAttachment attachment) {
    throw UnimplementedError();
  }

  @override
  Future<void> warmCache(MessageAttachment attachment) async {}
}
