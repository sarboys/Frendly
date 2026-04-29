import 'dart:io';

import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/communities/data/mock_communities.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/communities_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/community_chat_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/community_detail_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/create_community_screen.dart';
import 'package:big_break_mobile/features/communities/presentation/create_community_post_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../../test_overrides.dart';

void main() {
  test('community feed and chat use lazy scrollables for long lists', () {
    final feedSource = File(
      'lib/features/communities/presentation/communities_screen.dart',
    ).readAsStringSync();
    final chatSource = File(
      'lib/features/communities/presentation/community_chat_screen.dart',
    ).readAsStringSync();
    final sharedChatSource = File(
      'lib/features/chats/presentation/chat_thread_screen.dart',
    ).readAsStringSync();

    expect(feedSource, contains('ListView.builder'));
    expect(feedSource, isNot(contains('for (final community in communities)')));
    expect(chatSource, contains('ChatThreadScreen('));
    expect(chatSource, isNot(contains('class _CommunityMessageBubble')));
    expect(sharedChatSource, contains('ListView.separated'));
    expect(chatSource, isNot(contains('for (final message in messages)')));
  });

  test('community media uses slivers instead of shrink wrapped nested grid',
      () {
    final source = File(
      'lib/features/communities/presentation/community_media_screen.dart',
    ).readAsStringSync();

    expect(source, contains('CustomScrollView'));
    expect(source, contains('SliverGrid'));
    expect(source, isNot(contains('shrinkWrap: true')));
    expect(source, isNot(contains('NeverScrollableScrollPhysics')));
  });

  test('community post composer has a dedicated Flutter screen', () {
    final source = File(
      'lib/features/communities/presentation/create_community_post_screen.dart',
    );

    expect(source.existsSync(), isTrue);
  });

  testWidgets('communities list renders front content', (tester) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: buildTestOverrides(),
        initialLocation: AppRoute.communities.path,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Сообщества'), findsOneWidget);
    expect(find.text('Клубы, чаты и встречи в одном месте'), findsOneWidget);
    expect(find.text('City Rituals'), findsOneWidget);
    expect(find.text('Private Table'), findsOneWidget);
  });

  testWidgets('create community opens paywall without Frendly+', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: [
          ...buildTestOverrides(),
          subscriptionStateProvider.overrideWith(
            (ref) async => const SubscriptionStateData(
              plan: null,
              status: 'inactive',
              startedAt: null,
              renewsAt: null,
              trialEndsAt: null,
            ),
          ),
        ],
        initialLocation: AppRoute.communities.path,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.plus).first);
    await tester.pumpAndSettle();

    expect(find.text('paywall-opened'), findsOneWidget);
  });

  testWidgets('create community opens form with Frendly+', (tester) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: buildTestOverrides(),
        initialLocation: AppRoute.communities.path,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.plus).first);
    await tester.pumpAndSettle();

    expect(find.text('Новое сообщество'), findsWidgets);
    expect(find.text('Название сообщества'), findsOneWidget);
    expect(find.text('Тип доступа'), findsOneWidget);
  });

  testWidgets('created community detail can return to communities list', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: [
          ..._communityDetailOverrides(
            _communityJson(joined: true, isOwner: true),
          ),
          backendRepositoryProvider.overrideWith(
            (ref) => _FakeCommunityCreateRepository(ref: ref, dio: Dio()),
          ),
        ],
        initialLocation: AppRoute.communities.path,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.plus).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Создать'));
    await tester.pumpAndSettle();

    expect(find.text('Owner Club'), findsWidgets);

    await tester.tap(find.byIcon(LucideIcons.chevron_left).first);
    await tester.pumpAndSettle();

    expect(find.text('Сообщества'), findsOneWidget);
    expect(find.text('Клубы, чаты и встречи в одном месте'), findsOneWidget);
  });

  testWidgets('private community detail shows request-only status', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: buildTestOverrides(),
        initialLocation: '/community/c2',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Private Table'), findsWidgets);
    expect(find.text('Закрытое'), findsOneWidget);
    expect(find.text('Вступление по заявке'), findsOneWidget);
    expect(find.text('Вступить в сообщество'), findsNothing);
  });

  testWidgets('owned community detail hides the join button', (tester) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: _communityDetailOverrides(
          _communityJson(joined: true, isOwner: true),
        ),
        initialLocation: '/community/c-owned',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Owner Club'), findsWidgets);
    expect(find.text('Вступить в сообщество'), findsNothing);
    expect(find.text('Ты в сообществе'), findsNothing);
  });

  testWidgets('owned community detail exposes the news publish action', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: _communityDetailOverrides(
          _communityJson(joined: true, isOwner: true),
        ),
        initialLocation: '/community/c-owned',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Новости'), findsOneWidget);
    expect(find.text('Опубликовать'), findsOneWidget);
  });

  testWidgets('owned community publish action opens the post composer', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: _communityDetailOverrides(
          _communityJson(joined: true, isOwner: true),
        ),
        initialLocation: '/community/c-owned',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const Key('community-detail-publish-post-button')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Новая публикация'), findsOneWidget);
    expect(find.text('Публикация от имени сообщества'), findsOneWidget);
    expect(find.text('ТИП'), findsOneWidget);
    expect(find.text('Опубликовать в сообществе'), findsOneWidget);
  });

  testWidgets('community meetups tab is a plain clickable event list', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: _communityDetailOverrides(
          _communityJson(
            joined: true,
            isOwner: true,
            meetups: const [
              {
                'id': 'event-community-1',
                'title': 'Тест встреча',
                'emoji': '🍷',
                'time': 'Сегодня · 09:00',
                'place': 'Brix Wine, Покровка 12',
                'format': 'Открытая встреча',
                'going': 1,
              },
            ],
          ),
        ),
        initialLocation: '/community/c-owned',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ближайшие встречи'));
    await tester.pumpAndSettle();

    expect(find.text('Встречи внутри сообщества'.toUpperCase()), findsNothing);
    expect(find.text('Отдельная вкладка для ближайших событий'), findsNothing);
    expect(find.text('Тест встреча'), findsOneWidget);

    await tester.tap(find.text('Тест встреча'));
    await tester.pumpAndSettle();

    expect(find.text('event-opened-event-community-1'), findsOneWidget);
  });

  testWidgets('community post composer updates preview from text fields', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: buildTestOverrides(),
        child: const MaterialApp(
          home: CreateCommunityPostScreen(communityId: 'c1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Заголовок новости'),
      'Новый бранч',
    );
    await tester.enterText(
      find.widgetWithText(
        TextField,
        'Расскажите участникам, что произошло, или что вы планируете...',
      ),
      'Открыли запись на воскресную встречу.',
    );
    await tester.pump();

    await tester.drag(find.byType(ListView).first, const Offset(0, -700));
    await tester.pumpAndSettle();

    expect(find.text('Новый бранч'), findsWidgets);
    expect(find.text('Открыли запись на воскресную встречу.'), findsWidgets);
    expect(find.text('Закреплено'), findsOneWidget);
    expect(find.text('Push'), findsOneWidget);
  });

  testWidgets('community post composer publishes through the repository', (
    tester,
  ) async {
    _FakeCommunityPostRepository? repository;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          backendRepositoryProvider.overrideWith((ref) {
            return repository ??= _FakeCommunityPostRepository(
              ref: ref,
              dio: Dio(),
            );
          }),
        ],
        child: const MaterialApp(
          home: CreateCommunityPostScreen(communityId: 'c1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Заголовок новости'),
      'Я',
    );
    await tester.enterText(
      find.widgetWithText(
        TextField,
        'Расскажите участникам, что произошло, или что вы планируете...',
      ),
      'Ок',
    );
    await tester.pump();

    await tester.tap(find.text('Опубликовать в сообществе'));
    await tester.pumpAndSettle();

    expect(repository?.createdNews, hasLength(1));
    expect(repository?.createdNews.single, {
      'communityId': 'c1',
      'title': 'Я',
      'body': 'Ок',
      'category': 'news',
      'audience': 'all',
      'pin': true,
      'push': true,
    });
  });

  testWidgets('joined community detail hides join and chat buttons', (
    tester,
  ) async {
    await tester.pumpWidget(
      _routerApp(
        overrides: _communityDetailOverrides(
          _communityJson(joined: true, isOwner: false),
        ),
        initialLocation: '/community/c-owned',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Owner Club'), findsWidgets);
    expect(find.text('Вступить в сообщество'), findsNothing);
    expect(find.text('Ты в сообществе'), findsNothing);
    expect(find.text('Опубликовать'), findsNothing);
    expect(find.byIcon(LucideIcons.message_circle), findsNothing);
  });

  testWidgets('community chat sends a local message', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          backendRepositoryProvider.overrideWith(
            (ref) => _FakeCommunityChatRepository(ref: ref, dio: Dio()),
          ),
          chatSocketClientProvider.overrideWith(
            (ref) => _FakeCommunityChatSocketClient(),
          ),
        ],
        child: const MaterialApp(
          home: CommunityChatScreen(communityId: 'c1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'Буду к 12');
    await tester.pump();
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();

    expect(find.text('Буду к 12'), findsOneWidget);
  });

  testWidgets('community chat exposes the shared attachment and voice controls',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          backendRepositoryProvider.overrideWith(
            (ref) => _FakeCommunityChatRepository(ref: ref, dio: Dio()),
          ),
          chatSocketClientProvider.overrideWith(
            (ref) => _FakeCommunityChatSocketClient(),
          ),
        ],
        child: const MaterialApp(
          home: CommunityChatScreen(communityId: 'c1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('bb-composer-mic-button')), findsOneWidget);

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Что прикрепить'), findsOneWidget);
    expect(find.text('Фото'), findsOneWidget);
    expect(find.text('Файл'), findsOneWidget);
    expect(find.text('Локацию'), findsOneWidget);
  });
}

Widget _routerApp({
  required List<Override> overrides,
  required String initialLocation,
}) {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: AppRoute.communities.path,
        name: AppRoute.communities.name,
        builder: (context, state) => const CommunitiesScreen(),
      ),
      GoRoute(
        path: AppRoute.createCommunity.path,
        name: AppRoute.createCommunity.name,
        builder: (context, state) => const CreateCommunityScreen(),
      ),
      GoRoute(
        path: AppRoute.paywall.path,
        name: AppRoute.paywall.name,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('paywall-opened')),
        ),
      ),
      GoRoute(
        path: AppRoute.communityDetail.path,
        name: AppRoute.communityDetail.name,
        builder: (context, state) => CommunityDetailScreen(
          communityId: state.pathParameters['communityId']!,
        ),
      ),
      GoRoute(
        path: AppRoute.createCommunityPost.path,
        name: AppRoute.createCommunityPost.name,
        builder: (context, state) => CreateCommunityPostScreen(
          communityId: state.pathParameters['communityId']!,
        ),
      ),
      GoRoute(
        path: AppRoute.communityChat.path,
        name: AppRoute.communityChat.name,
        builder: (context, state) => CommunityChatScreen(
          communityId: state.pathParameters['communityId']!,
        ),
      ),
      GoRoute(
        path: AppRoute.communityMedia.path,
        name: AppRoute.communityMedia.name,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('media-opened')),
        ),
      ),
      GoRoute(
        path: AppRoute.eventDetail.path,
        name: AppRoute.eventDetail.name,
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text(
              'event-opened-${state.pathParameters['eventId']!}',
            ),
          ),
        ),
      ),
    ],
  );

  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(routerConfig: router),
  );
}

List<Override> _communityDetailOverrides(Map<String, dynamic> communityJson) {
  final community = Community.fromJson(communityJson);
  return [
    ...buildTestOverrides(),
    communitiesFeedProvider.overrideWith(
      (ref) => CommunitiesFeedController(
        ref,
        initialState: CommunitiesFeedState(
          items: [community],
          nextCursor: null,
        ),
      ),
    ),
    communitiesProvider.overrideWith((ref) async => [community]),
  ];
}

Map<String, dynamic> _communityJson({
  required bool joined,
  required bool isOwner,
  List<Map<String, Object?>> meetups = const [],
}) {
  return {
    'id': 'c-owned',
    'chatId': 'community-c-owned-chat',
    'name': 'Owner Club',
    'avatar': '🌿',
    'description': 'Короткое описание сообщества.',
    'privacy': 'public',
    'members': 3,
    'online': 1,
    'tags': ['ужины'],
    'joinRule': 'Открытое вступление',
    'premiumOnly': true,
    'unread': 0,
    'mood': 'Городской клуб',
    'sharedMediaLabel': '0 медиа',
    'joined': joined,
    'isOwner': isOwner,
    'news': [
      {
        'id': 'news-1',
        'title': 'Новость',
        'blurb': 'Текст новости.',
        'time': 'сейчас',
      },
    ],
    'meetups': meetups,
    'media': const [],
    'chatPreview': const [],
    'chatMessages': const [],
    'socialLinks': [
      {'id': 's1', 'label': 'Telegram', 'handle': '@ownerclub'},
      {'id': 's2', 'label': 'Instagram', 'handle': '@owner.club'},
      {'id': 's3', 'label': 'TikTok', 'handle': '@owner.club.live'},
    ],
    'memberNames': ['Никита', 'Аня', 'Марк'],
  };
}

class _FakeCommunityChatRepository extends BackendRepository {
  _FakeCommunityChatRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<PaginatedResponse<Message>> fetchMessages(
    String chatId, {
    String? cursor,
    int limit = 100,
  }) async {
    return PaginatedResponse(
      items: [
        Message(
          id: 'community-message-1',
          chatId: chatId,
          clientMessageId: 'community-message-1',
          authorId: 'user-anya',
          author: 'Аня К',
          text: 'Кто идет на бранч?',
          time: '11:40',
          attachments: const [],
          showAuthor: true,
          showAvatar: true,
        ),
      ],
      nextCursor: null,
    );
  }
}

class _FakeCommunityPostRepository extends BackendRepository {
  _FakeCommunityPostRepository({
    required super.ref,
    required super.dio,
  });

  final createdNews = <Map<String, Object?>>[];

  @override
  Future<Community> createCommunityNews({
    required String communityId,
    required String title,
    required String body,
    required String category,
    required String audience,
    required bool pin,
    required bool push,
  }) async {
    createdNews.add({
      'communityId': communityId,
      'title': title,
      'body': body,
      'category': category,
      'audience': audience,
      'pin': pin,
      'push': push,
    });
    return mockCommunities.firstWhere((community) => community.id == 'c1');
  }

  @override
  Future<Community> fetchCommunity(String communityId) async {
    return mockCommunities.firstWhere((community) => community.id == 'c1');
  }

  @override
  Future<PaginatedResponse<Community>> fetchCommunities({
    String? cursor,
    int limit = 20,
  }) async {
    return const PaginatedResponse(
      items: mockCommunities,
      nextCursor: null,
    );
  }
}

class _FakeCommunityCreateRepository extends BackendRepository {
  _FakeCommunityCreateRepository({
    required super.ref,
    required super.dio,
  });

  final community = Community.fromJson(
    _communityJson(joined: true, isOwner: true),
  );

  @override
  Future<Community> createCommunity({
    required String name,
    required String avatar,
    required String description,
    required CommunityPrivacy privacy,
    required String purpose,
    required List<CommunitySocialLink> socialLinks,
    String? idempotencyKey,
  }) async {
    return community;
  }

  @override
  Future<Community> fetchCommunity(String communityId) async {
    return community;
  }

  @override
  Future<PaginatedResponse<Community>> fetchCommunities({
    String? cursor,
    int limit = 20,
  }) async {
    return PaginatedResponse(
      items: [community],
      nextCursor: null,
    );
  }
}

class _FakeCommunityChatSocketClient extends ChatSocketClient {
  _FakeCommunityChatSocketClient()
      : _events = const Stream<Map<String, dynamic>>.empty(),
        super(accessTokenProvider: _token);

  final Stream<Map<String, dynamic>> _events;

  static Future<String> _token() async => 'token';

  @override
  Stream<Map<String, dynamic>> get events => _events;

  @override
  Future<void> connect() async {}

  @override
  void subscribe(String chatId) {}

  @override
  void unsubscribe(String chatId) {}

  @override
  void requestSync({required String chatId, String? sinceEventId}) {}

  @override
  Future<void> sendMessage({
    required String chatId,
    required String text,
    required String clientMessageId,
    List<String> attachmentIds = const [],
    String? replyToMessageId,
  }) async {}

  @override
  void markRead({required String chatId, required String messageId}) {}

  @override
  Future<void> dispose() async {}
}
