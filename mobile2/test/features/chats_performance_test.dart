import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile2/features/chats/presentation/chats_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

void main() {
  test('chats prewarm uses only the first ten preview images', () {
    final chats = List.generate(
      12,
      (index) => BackendChatSummary(
        id: 'chat-$index',
        title: 'Chat $index',
        imageUrl: 'https://cdn.test/chat-$index.jpg',
      ),
    );

    expect(chatPrewarmImageUrls(chats).toList(growable: false), [
      'https://cdn.test/chat-0.jpg',
      'https://cdn.test/chat-1.jpg',
      'https://cdn.test/chat-2.jpg',
      'https://cdn.test/chat-3.jpg',
      'https://cdn.test/chat-4.jpg',
      'https://cdn.test/chat-5.jpg',
      'https://cdn.test/chat-6.jpg',
      'https://cdn.test/chat-7.jpg',
      'https://cdn.test/chat-8.jpg',
      'https://cdn.test/chat-9.jpg',
    ]);
  });

  testWidgets('chats screen builds chat rows lazily', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final chats = List.generate(
      80,
      (index) => BackendChatSummary(
        id: 'chat-$index',
        title: 'Chat $index',
        subtitle: 'Message $index',
        raw: {
          'id': 'chat-$index',
          'title': 'Chat $index',
          'lastMessage': 'Message $index',
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          notificationUnreadCountProvider.overrideWith((ref) async => 0),
          ownProfileProvider.overrideWith(
            (ref) async => const BackendCardItem(id: 'me', title: 'Me'),
          ),
          matchesProvider.overrideWith(
            (ref) => Stream.value(
              const BackendPage<BackendCardItem>(items: []),
            ),
          ),
          chatListRealtimeProvider(ChatListKind.all).overrideWith(
            (ref) => null,
          ),
          chatListProvider(ChatListKind.all).overrideWith(
            (ref) => Stream.value(BackendPage(items: chats)),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const ChatsScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Chat 0'), findsOneWidget);
    expect(find.text('Chat 79'), findsNothing);
  });

  testWidgets('chats screen renders backend chat preview metadata',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const chats = [
      BackendChatSummary(
        id: 'chat-1',
        title: 'Лия',
        subtitle: 'Окей, тогда в 19:30 у Brew Lab',
        unreadCount: 2,
        kind: 'personal',
        imageUrl: '/media/lia',
        raw: {
          'id': 'chat-1',
          'title': 'Лия',
          'lastMessage': 'Окей, тогда в 19:30 у Brew Lab',
          'lastTime': 'только что',
          'kind': 'personal',
          'fromMeetup': 'Speciality coffee',
        },
      ),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          notificationUnreadCountProvider.overrideWith((ref) async => 0),
          ownProfileProvider.overrideWith(
            (ref) async => const BackendCardItem(id: 'me', title: 'Me'),
          ),
          matchesProvider.overrideWith(
            (ref) => Stream.value(
              const BackendPage<BackendCardItem>(items: []),
            ),
          ),
          chatListRealtimeProvider(ChatListKind.all).overrideWith(
            (ref) => null,
          ),
          chatListProvider(ChatListKind.all).overrideWith(
            (ref) => Stream.value(const BackendPage(items: chats)),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const ChatsScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Лия'), findsOneWidget);
    expect(find.text('только что'), findsOneWidget);
    expect(find.text('SPECIALITY COFFEE'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets('chats screen renders meeting and personal preview images',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const chats = [
      BackendChatSummary(
        id: 'meetup-1',
        title: 'Кофе на Патриках',
        subtitle: 'До встречи',
        kind: 'meetup',
        raw: {
          'id': 'meetup-1',
          'title': 'Кофе на Патриках',
          'kind': 'meetup',
          'coverImageUrl': 'https://cdn.example.com/meeting-cover.jpg',
        },
      ),
      BackendChatSummary(
        id: 'personal-1',
        title: 'Лия',
        subtitle: 'Я уже рядом',
        kind: 'personal',
        raw: {
          'id': 'personal-1',
          'title': 'Лия',
          'kind': 'personal',
          'memberProfiles': [
            {
              'userId': 'u-lia',
              'name': 'Лия',
              'avatarUrl': 'https://cdn.example.com/lia-avatar.jpg',
            },
          ],
        },
      ),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          notificationUnreadCountProvider.overrideWith((ref) async => 0),
          ownProfileProvider.overrideWith(
            (ref) async => const BackendCardItem(id: 'me', title: 'Me'),
          ),
          matchesProvider.overrideWith(
            (ref) => Stream.value(
              const BackendPage<BackendCardItem>(items: []),
            ),
          ),
          chatListRealtimeProvider(ChatListKind.all).overrideWith(
            (ref) => null,
          ),
          chatListProvider(ChatListKind.all).overrideWith(
            (ref) => Stream.value(const BackendPage(items: chats)),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const ChatsScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    final imageUrls = tester
        .widgetList<DateasyRemoteImage>(find.byType(DateasyRemoteImage))
        .map((widget) => widget.imageUrl)
        .toSet();

    expect(imageUrls, contains('https://cdn.example.com/meeting-cover.jpg'));
    expect(imageUrls, contains('https://cdn.example.com/lia-avatar.jpg'));
  });
}
