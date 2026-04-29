import 'dart:async';

import 'package:big_break_mobile/features/chats/presentation/chat_voice_playback_controller.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_theme.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_chat_attachment_image.dart';
import 'package:big_break_mobile/shared/widgets/bb_chat_bubble.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

class _FakeChatVoicePlaybackEngine implements ChatVoicePlaybackEngine {
  final positionController = StreamController<Duration>.broadcast();
  final durationController = StreamController<Duration?>.broadcast();
  final playbackStateController =
      StreamController<ChatVoiceEngineState>.broadcast();

  @override
  Stream<Duration?> get durationStream => durationController.stream;

  @override
  Stream<ChatVoiceEngineState> get playbackStateStream =>
      playbackStateController.stream;

  @override
  Stream<Duration> get positionStream => positionController.stream;

  @override
  Future<void> dispose() async {
    await positionController.close();
    await durationController.close();
    await playbackStateController.close();
  }

  @override
  Future<void> pause() async {}

  @override
  Future<void> play() async {}

  @override
  Future<void> seek(Duration position) async {}

  @override
  Future<void> setFilePath(String path) async {}

  @override
  Future<void> setUrl(String url, {Map<String, String>? headers}) async {
    durationController.add(const Duration(seconds: 7));
    playbackStateController.add(
      const ChatVoiceEngineState(
        playing: false,
        processingState: ProcessingState.ready,
      ),
    );
  }

  @override
  Future<void> stop() async {}
}

void main() {
  testWidgets('incoming bubble can show author photo and open profile', (
    tester,
  ) async {
    String? tappedUserId;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            authorId: 'user-anya',
            author: 'Аня К',
            authorAvatarUrl: 'https://cdn.example.com/anya.jpg',
            text: 'Привет',
            time: '21:02',
            showAuthor: true,
            showAvatar: true,
            onAuthorAvatarTap: (userId) {
              tappedUserId = userId;
            },
          ),
        ),
      ),
    );

    expect(find.text('Аня К'), findsOneWidget);
    expect(find.text('Привет'), findsOneWidget);
    expect(find.byType(BbAvatar), findsOneWidget);

    final avatar = tester.widget<BbAvatar>(find.byType(BbAvatar));
    expect(avatar.imageUrl, 'https://cdn.example.com/anya.jpg');

    await tester.tap(find.byType(BbAvatar));
    expect(tappedUserId, 'user-anya');
  });

  testWidgets('bubble renders uploading attachment tile', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Ты',
            text: 'scan.pdf',
            time: '12:33',
            isMine: true,
            isPending: true,
            attachments: [
              MessageAttachment(
                id: 'a1',
                kind: 'chat_attachment',
                status: 'uploading',
                url: null,
                mimeType: 'application/pdf',
                byteSize: 42,
                fileName: 'scan.pdf',
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('scan.pdf'), findsOneWidget);
    expect(find.text('Загрузка файла...'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('bubble renders compact location card for shared point', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Ты',
            text: '',
            time: '12:33',
            isMine: true,
            attachments: [
              MessageAttachment(
                id: 'loc1',
                kind: 'chat_location',
                status: 'ready',
                url: null,
                mimeType: 'application/vnd.bigbreak.location',
                byteSize: 0,
                fileName: 'Ты здесь',
                title: 'Ты здесь',
                subtitle: 'Покровка 12, Москва',
                latitude: 55.7579,
                longitude: 37.6486,
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.place_outlined), findsOneWidget);
    expect(find.text('Ты здесь'), findsOneWidget);
    expect(find.text('Покровка 12, Москва'), findsOneWidget);
    expect(find.text('Открыть карту'), findsOneWidget);
  });

  testWidgets('bubble shows ended location broadcast after five minutes', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Ты',
            text: '',
            time: '12:33',
            isMine: true,
            attachments: [
              MessageAttachment(
                id: 'loc-expired',
                kind: 'chat_location',
                status: 'ready',
                url: null,
                mimeType: 'application/vnd.bigbreak.location',
                byteSize: 0,
                fileName: 'Ты здесь',
                title: 'Ты здесь',
                subtitle: 'Покровка 12, Москва',
                latitude: 55.7579,
                longitude: 37.6486,
                expiresAt: DateTime.now().subtract(const Duration(minutes: 1)),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Трансляция окончена'), findsOneWidget);
  });

  testWidgets('bubble renders image attachment preview for photo', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Ты',
            text: '',
            time: '12:33',
            isMine: true,
            attachments: [
              MessageAttachment(
                id: 'img1',
                kind: 'chat_attachment',
                status: 'ready',
                url: 'https://example.com/photo.jpg',
                mimeType: 'image/jpeg',
                byteSize: 128,
                fileName: 'photo.jpg',
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.byType(BbChatAttachmentImage), findsOneWidget);
    expect(find.byIcon(Icons.download_rounded), findsNothing);
  });

  testWidgets('image attachment preview resolves signed url before loading', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Ты',
            text: '',
            time: '12:33',
            isMine: true,
            onImageResolveRemoteUrl: (_) async =>
                'https://storage.example.com/signed-photo.jpg',
            attachments: const [
              MessageAttachment(
                id: 'img-signed',
                kind: 'chat_attachment',
                status: 'ready',
                url: 'https://api.example.com/media/img-signed',
                mimeType: 'image/jpeg',
                byteSize: 128,
                fileName: 'photo.jpg',
              ),
            ],
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump();

    final image = tester.widget<CachedNetworkImage>(
      find.byType(CachedNetworkImage),
    );
    expect(image.imageUrl, 'https://storage.example.com/signed-photo.jpg');
  });

  testWidgets('bubble renders voice message controls for chat voice', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chatVoicePlaybackEngineFactoryProvider.overrideWithValue(
            () => _FakeChatVoicePlaybackEngine(),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: BbChatBubble(
              messageClientId: 'voice-client-1',
              author: 'Ты',
              text: '',
              time: '12:33',
              isMine: true,
              attachments: [
                MessageAttachment(
                  id: 'voice1',
                  kind: 'chat_voice',
                  status: 'ready',
                  url: 'https://example.com/voice.m4a',
                  mimeType: 'audio/mp4',
                  byteSize: 512,
                  fileName: 'voice.m4a',
                  durationMs: 7000,
                  waveform: [0.3, 0.6, 0.8, 0.4],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('bb-chat-voice-message')), findsOneWidget);
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget);
    expect(find.text('0:07'), findsOneWidget);
  });

  testWidgets('bubble renders reply quote before message body', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Ты',
            text: 'Ответ на сообщение',
            time: '12:33',
            isMine: true,
            replyTo: MessageReplyPreview(
              id: 'p1',
              author: 'Аня К',
              text: 'Исходное сообщение',
              isVoice: false,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Аня К'), findsOneWidget);
    expect(find.text('Исходное сообщение'), findsOneWidget);
    expect(find.text('Ответ на сообщение'), findsOneWidget);
  });

  testWidgets('bubble keeps reply quote compact inside message',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 390,
              child: BbChatBubble(
                author: 'Ты',
                text: 'Ок',
                time: '12:33',
                isMine: true,
                replyTo: MessageReplyPreview(
                  id: 'p1',
                  author: 'Ты',
                  text: 'Голосовое сообщение',
                  isVoice: true,
                  mine: true,
                ),
              ),
            ),
          ),
        ),
      ),
    );

    expect(
      tester.getSize(find.byKey(const Key('bb-chat-reply-quote-mine'))).width,
      lessThanOrEqualTo(236),
    );
  });

  testWidgets('short reply quote does not force a wide message bubble',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 390,
              child: BbChatBubble(
                author: 'Ты',
                text: 'Ок',
                time: '12:33',
                isMine: true,
                replyTo: MessageReplyPreview(
                  id: 'p1',
                  author: 'Аня',
                  text: 'Да',
                  isVoice: false,
                ),
              ),
            ),
          ),
        ),
      ),
    );

    expect(
      tester.getSize(find.byKey(const Key('bb-chat-reply-quote-other'))).width,
      lessThanOrEqualTo(120),
    );
  });

  testWidgets('reply quote does not expand incoming bubble to full width',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 390,
              child: BbChatBubble(
                author: 'Дарья',
                text: 'Оке',
                time: '11:53',
                replyTo: MessageReplyPreview(
                  id: 'p1',
                  author: 'Ты',
                  text: 'Голосовое сообщение',
                  isVoice: true,
                  mine: true,
                ),
              ),
            ),
          ),
        ),
      ),
    );

    final bubble = tester
        .widgetList<DecoratedBox>(
          find.byType(DecoratedBox),
        )
        .first;
    final bubbleBox = tester.renderObject<RenderBox>(
      find.byWidget(bubble),
    );

    expect(bubbleBox.size.width, lessThan(260));
  });

  testWidgets(
      'incoming bubble styles quoted current user message as mine inside reply',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BbChatBubble(
            author: 'Лиза П',
            text: 'Оке',
            time: '10:53',
            replyTo: MessageReplyPreview(
              id: 'p1',
              authorId: 'user-me',
              author: 'Дима Р',
              text: 'Голосовое сообщение',
              isVoice: true,
              mine: true,
            ),
          ),
        ),
      ),
    );

    final quoteContainer = tester.widget<Container>(
      find.byKey(const Key('bb-chat-reply-quote-mine')),
    );
    final decoration = quoteContainer.decoration as BoxDecoration;
    final border = decoration.border as Border;

    expect(border.right.color, AppColors.lightTheme.bubbleMe);
    expect(border.left.width, 0);
  });

  testWidgets('incoming bubble uses dark incoming surface in dark theme', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: const Scaffold(
          body: BbChatBubble(
            author: 'Аня К',
            text: 'Привет',
            time: '21:02',
          ),
        ),
      ),
    );

    final bubble = tester.widget<DecoratedBox>(find.byType(DecoratedBox).first);
    final decoration = bubble.decoration as BoxDecoration;
    expect(decoration.color, AppColors.darkTheme.bubbleThem);
  });
}
