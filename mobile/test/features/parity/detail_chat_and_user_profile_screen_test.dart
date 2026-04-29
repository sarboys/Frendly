import 'dart:async';
import 'dart:io';

import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/features/meetup_chat/presentation/meetup_chat_screen.dart';
import 'package:big_break_mobile/features/personal_chat/presentation/personal_chat_screen.dart';
import 'package:big_break_mobile/features/user_profile/presentation/user_profile_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../test_overrides.dart';

class _FakeChatBackendRepository extends BackendRepository {
  _FakeChatBackendRepository({
    required super.ref,
    required super.dio,
    this.messagesByChat = const {},
  });

  final Map<String, List<Message>> messagesByChat;

  @override
  Future<PaginatedResponse<Message>> fetchMessages(
    String chatId, {
    String? cursor,
    int limit = 100,
  }) async {
    final items = messagesByChat[chatId] ??
        (chatId == 'p1' ? mockPersonalMessages : mockMeetupMessages);
    return PaginatedResponse(items: items, nextCursor: null);
  }

  @override
  Future<void> markChatRead(String chatId, String messageId) async {}
}

class _FakeChatSocketClient extends ChatSocketClient {
  _FakeChatSocketClient()
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
  Future<void> dispose() async {}
}

class _SpyAttachmentService implements AppAttachmentService {
  var openCalls = 0;
  var saveCalls = 0;

  @override
  Future<File?> getLocalFileIfAvailable(MessageAttachment attachment) async {
    return null;
  }

  @override
  Future<String?> getDownloadUrl(MessageAttachment attachment) async {
    return attachment.url;
  }

  @override
  Future<File> getCachedFile(MessageAttachment attachment) async {
    throw UnimplementedError();
  }

  @override
  Future<void> openAttachment(MessageAttachment attachment) async {
    openCalls += 1;
  }

  @override
  Future<String> saveAttachmentToDevice(MessageAttachment attachment) async {
    saveCalls += 1;
    return '/tmp/${attachment.fileName}';
  }

  @override
  Future<void> clearPrivateCache() async {}

  @override
  Future<void> warmCache(MessageAttachment attachment) async {}
}

Widget _wrap(
  Widget child, {
  bool withChatOverrides = false,
  Map<String, List<Message>> messagesByChat = const {},
  List<Override> extraOverrides = const [],
}) {
  return ProviderScope(
    overrides: [
      ...buildTestOverrides(),
      if (withChatOverrides)
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatBackendRepository(
            ref: ref,
            dio: Dio(),
            messagesByChat: messagesByChat,
          ),
        ),
      if (withChatOverrides)
        chatSocketClientProvider.overrideWith((ref) => _FakeChatSocketClient()),
      ...extraOverrides,
    ],
    child: MaterialApp(home: child),
  );
}

Message _messageFromJson({
  required String id,
  required String chatId,
  required String text,
  required String createdAt,
  required String senderId,
  required String senderName,
  List<Map<String, dynamic>> attachments = const [],
}) {
  return Message.fromJson(
    {
      'id': id,
      'chatId': chatId,
      'clientMessageId': id,
      'senderId': senderId,
      'senderName': senderName,
      'text': text,
      'createdAt': createdAt,
      'attachments': attachments,
    },
    currentUserId: 'user-me',
  );
}

void main() {
  testWidgets('meetup chat renders typing indicator for active meetup',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'mc1'),
        withChatOverrides: true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.byKey(const Key('meetup-chat-typing-indicator')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
        find.byKey(const Key('meetup-chat-typing-indicator')), findsOneWidget);
  });

  testWidgets('live evening meetup chat renders status and timeline pin',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'evening-chat-live'),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-chat-live',
                eventId: null,
                title: 'Теплый круг на Покровке',
                emoji: '✨',
                time: 'сегодня',
                lastMessage: 'Переходим к шагу',
                lastAuthor: 'Frendly',
                lastTime: 'сейчас',
                unread: 0,
                members: ['Ты', 'Аня'],
                phase: MeetupPhase.live,
                currentStep: 2,
                totalSteps: 4,
                currentPlace: 'Brix Wine',
                routeId: 'r-cozy-circle',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('LIVE · Шаг 2/4 · Brix Wine'), findsOneWidget);
    expect(find.byKey(const Key('meetup-chat-evening-pin')), findsOneWidget);
    expect(find.text('Открыть таймлайн'), findsOneWidget);
  });

  testWidgets('soon evening meetup chat renders live start banner',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'evening-chat-soon'),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-chat-soon',
                eventId: null,
                title: 'Свидание Noir',
                emoji: '🎬',
                time: '20:00',
                lastMessage: 'Собираемся',
                lastAuthor: 'Frendly',
                lastTime: 'сейчас',
                unread: 0,
                members: ['Ты', 'Аня'],
                phase: MeetupPhase.soon,
                startsInLabel: 'Через 45 мин',
                routeId: 'r-date-noir',
                hostUserId: 'user-me',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Все на месте? Запусти live'), findsOneWidget);
    expect(
      find.text('Активирует таймлайн, чек-ины и перки для группы'),
      findsOneWidget,
    );
  });

  testWidgets('host evening meetup chat renders pending join requests',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'evening-chat-host'),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-chat-host',
                eventId: null,
                title: 'Теплый круг',
                emoji: '🍷',
                time: '20:00',
                lastMessage: 'Ждём гостей',
                lastAuthor: 'Frendly',
                lastTime: 'сейчас',
                unread: 0,
                members: ['Ты', 'Аня'],
                phase: MeetupPhase.soon,
                routeId: 'r-cozy-circle',
                sessionId: 'session-host',
                hostUserId: 'user-me',
              ),
            ],
          ),
          eveningSessionProvider('session-host').overrideWith(
            (ref) async => _eveningDetailWithRequest(),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Заявки на вечер'), findsOneWidget);
    expect(find.text('Ира'), findsOneWidget);
    expect(find.text('Хочу присоединиться'), findsOneWidget);
    expect(find.text('Принять'), findsOneWidget);
    expect(find.text('Отклонить'), findsOneWidget);
  });

  testWidgets('host invite-only meetup chat renders copy invite link',
      (tester) async {
    String? copiedText;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copiedText =
              (call.arguments as Map<Object?, Object?>?)?['text'] as String?;
        }
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });

    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'evening-chat-invite'),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-chat-invite',
                eventId: null,
                title: 'Закрытый круг',
                emoji: '🔒',
                time: '20:00',
                lastMessage: 'Ждём гостей',
                lastAuthor: 'Frendly',
                lastTime: 'сейчас',
                unread: 0,
                members: ['Ты'],
                phase: MeetupPhase.soon,
                routeId: 'r-cozy-circle',
                sessionId: 'session-invite',
                hostUserId: 'user-me',
                privacy: EveningPrivacy.invite,
              ),
            ],
          ),
          eveningSessionProvider('session-invite').overrideWith(
            (ref) async => _eveningDetailWithInvite(),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Инвайт-ссылка'), findsOneWidget);
    expect(
      find.text(
          'bigbreak://evening-preview/session-invite?inviteToken=secret-token'),
      findsOneWidget,
    );

    await tester.tap(find.text('Скопировать'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(
      copiedText,
      'bigbreak://evening-preview/session-invite?inviteToken=secret-token',
    );
    expect(find.text('Инвайт скопирован'), findsOneWidget);
  });

  testWidgets('soon evening meetup chat hides live start banner for guests',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'evening-chat-guest'),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-chat-guest',
                eventId: null,
                title: 'Свидание Noir',
                emoji: '🎬',
                time: '20:00',
                lastMessage: 'Собираемся',
                lastAuthor: 'Frendly',
                lastTime: 'сейчас',
                unread: 0,
                members: ['Ты', 'Аня'],
                phase: MeetupPhase.soon,
                startsInLabel: 'Через 45 мин',
                routeId: 'r-date-noir',
                hostUserId: 'user-host',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Все на месте? Запусти live'), findsNothing);
  });

  testWidgets(
      'soon evening meetup chat hides live start banner without host id',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'evening-chat-unknown-host'),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-chat-unknown-host',
                eventId: null,
                title: 'Свидание Noir',
                emoji: '🎬',
                time: '20:00',
                lastMessage: 'Собираемся',
                lastAuthor: 'Frendly',
                lastTime: 'сейчас',
                unread: 0,
                members: ['Ты', 'Аня'],
                phase: MeetupPhase.soon,
                startsInLabel: 'Через 45 мин',
                routeId: 'r-date-noir',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Все на месте? Запусти live'), findsNothing);
  });

  testWidgets('personal chat does not render fake invite CTA or read receipt',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const PersonalChatScreen(chatId: 'p1'),
        withChatOverrides: true,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Выбрать'), findsNothing);
    expect(find.textContaining('прочитано'), findsNothing);
  });

  testWidgets('personal chat opens attachment action sheet from plus button',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const PersonalChatScreen(chatId: 'p1'),
        withChatOverrides: true,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Что прикрепить'), findsOneWidget);
    expect(find.text('Фото'), findsOneWidget);
    expect(find.text('Файл'), findsOneWidget);
    expect(find.text('Локацию'), findsOneWidget);
  });

  testWidgets('meetup chat shows older messages above newer ones',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(chatId: 'mc-order'),
        withChatOverrides: true,
        messagesByChat: {
          'mc-order': [
            _messageFromJson(
              id: 'm-new',
              chatId: 'mc-order',
              text: 'Новый ответ',
              createdAt: '2026-04-20T21:09:00Z',
              senderId: 'u2',
              senderName: 'Аня К',
            ),
            _messageFromJson(
              id: 'm-old',
              chatId: 'mc-order',
              text: 'Старый ответ',
              createdAt: '2026-04-20T21:01:00Z',
              senderId: 'u1',
              senderName: 'Марк С',
            ),
          ],
        },
      ),
    );
    await tester.pumpAndSettle();

    final olderOffset = tester.getTopLeft(find.text('Старый ответ'));
    final newerOffset = tester.getTopLeft(find.text('Новый ответ'));

    expect(olderOffset.dy, lessThan(newerOffset.dy));
  });

  testWidgets('after dark meetup chat switches to after dark palette',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const MeetupChatScreen(
          chatId: 'mc-ad1',
          afterDarkGlow: 'magenta',
        ),
        withChatOverrides: true,
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'mc-ad1',
                eventId: 'ad1',
                title: 'After Dark Lounge',
                emoji: '🖤',
                time: '23:30',
                lastMessage: 'Список на входе обновили',
                lastAuthor: 'Хост',
                lastTime: 'сейчас',
                unread: 2,
                members: ['Хост', 'Ты'],
                status: 'Сегодня',
                isAfterDark: true,
                afterDarkGlow: 'magenta',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
    expect(scaffold.backgroundColor, AppColors.adBg);
  });

  testWidgets('personal chat tap on document saves it to device',
      (tester) async {
    final attachmentService = _SpyAttachmentService();

    await tester.pumpWidget(
      _wrap(
        const PersonalChatScreen(chatId: 'p-doc'),
        withChatOverrides: true,
        messagesByChat: {
          'p-doc': [
            _messageFromJson(
              id: 'doc-1',
              chatId: 'p-doc',
              text: 'contract.pdf',
              createdAt: '2026-04-20T21:09:00Z',
              senderId: 'u-doc',
              senderName: 'Аня К',
              attachments: const [
                {
                  'id': 'a-doc',
                  'kind': 'chat_attachment',
                  'status': 'ready',
                  'url': 'https://cdn.example.com/contract.pdf',
                  'mimeType': 'application/pdf',
                  'byteSize': 128,
                  'fileName': 'contract.pdf',
                },
              ],
            ),
          ],
        },
        extraOverrides: [
          appAttachmentServiceProvider.overrideWithValue(attachmentService),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('contract.pdf'));
    await tester.pumpAndSettle();

    expect(attachmentService.saveCalls, 1);
    expect(attachmentService.openCalls, 0);
  });

  testWidgets('user profile renders common interests count', (tester) async {
    await tester.pumpWidget(
      _wrap(const UserProfileScreen(userId: 'user-anya')),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('3 общих с тобой'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Вы вместе на встрече'), findsNothing);
    expect(find.text('3 общих с тобой'), findsOneWidget);
    expect(find.text('Позвать на встречу'), findsOneWidget);
    expect(
      tester.widget<Text>(find.text('Позвать на встречу')).style?.fontWeight,
      FontWeight.w600,
    );
  });

  testWidgets('user profile bottom actions match front button styles',
      (tester) async {
    await tester.pumpWidget(
      _wrap(const UserProfileScreen(userId: 'user-anya')),
    );
    await tester.pumpAndSettle();

    final colors = AppColors.of(tester.element(find.byType(UserProfileScreen)));
    const states = <WidgetState>{};

    final inviteButton = tester.widget<OutlinedButton>(
      find.ancestor(
        of: find.text('Позвать на встречу'),
        matching: find.byType(OutlinedButton),
      ),
    );
    expect(
      inviteButton.style?.backgroundColor?.resolve(states),
      colors.card,
    );
    expect(
      inviteButton.style?.foregroundColor?.resolve(states),
      colors.foreground,
    );
    expect(
      inviteButton.style?.side?.resolve(states),
      BorderSide(color: colors.border),
    );

    final messageButtonFinder = find.ancestor(
      of: find.text('Написать'),
      matching: find.byType(FilledButton),
    );
    expect(messageButtonFinder, findsOneWidget);

    final messageButton = tester.widget<FilledButton>(messageButtonFinder);
    expect(
      messageButton.style?.backgroundColor?.resolve(states),
      colors.foreground,
    );
    expect(
      messageButton.style?.foregroundColor?.resolve(states),
      colors.background,
    );
  });

  testWidgets(
      'user profile invite button label stays on one line on phone width',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      _wrap(const UserProfileScreen(userId: 'user-anya')),
    );
    await tester.pumpAndSettle();

    final inviteLabel = find.text('Позвать на встречу');
    expect(inviteLabel, findsOneWidget);
    expect(tester.getSize(inviteLabel).height, lessThan(28));
  });
}

EveningSessionDetail _eveningDetailWithInvite() {
  return const EveningSessionDetail(
    id: 'session-invite',
    routeId: 'r-cozy-circle',
    chatId: 'evening-chat-invite',
    phase: EveningSessionPhase.scheduled,
    chatPhase: MeetupPhase.soon,
    privacy: EveningPrivacy.invite,
    title: 'Закрытый круг',
    vibe: 'Камерный вечер',
    emoji: '🔒',
    hostUserId: 'user-me',
    hostName: 'Ты',
    inviteToken: 'secret-token',
    participants: [
      EveningSessionParticipant(
        userId: 'user-me',
        name: 'Ты',
        role: 'host',
        status: 'joined',
      ),
    ],
    steps: [
      EveningSessionStep(
        id: 's1',
        time: '19:00',
        kind: 'bar',
        title: 'Аперитив',
        venue: 'Brix Wine',
        address: 'Покровка 12',
        emoji: '🍷',
      ),
    ],
  );
}

EveningSessionDetail _eveningDetailWithRequest() {
  return const EveningSessionDetail(
    id: 'session-host',
    routeId: 'r-cozy-circle',
    chatId: 'evening-chat-host',
    phase: EveningSessionPhase.scheduled,
    chatPhase: MeetupPhase.soon,
    privacy: EveningPrivacy.request,
    title: 'Теплый круг',
    vibe: 'Камерный вечер',
    emoji: '🍷',
    hostUserId: 'user-me',
    hostName: 'Ты',
    participants: [
      EveningSessionParticipant(
        userId: 'user-me',
        name: 'Ты',
        role: 'host',
        status: 'joined',
      ),
    ],
    steps: [
      EveningSessionStep(
        id: 's1',
        time: '19:00',
        kind: 'bar',
        title: 'Аперитив',
        venue: 'Brix Wine',
        address: 'Покровка 12',
        emoji: '🍷',
      ),
    ],
    pendingRequests: [
      EveningSessionJoinRequest(
        id: 'request-1',
        userId: 'user-ira',
        name: 'Ира',
        status: 'requested',
        note: 'Хочу присоединиться',
      ),
    ],
  );
}
