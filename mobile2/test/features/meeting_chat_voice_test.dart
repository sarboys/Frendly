import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/features/chats/presentation/meeting_chat_screen.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

void main() {
  testWidgets('voice attachments do not render the audio file name as text',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWithValue(_VoiceChatRepository()),
          appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const MeetingChatScreen(meetingId: 'coffee'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('dateasy-voice-1779186240895879.m4a'), findsNothing);
    expect(find.text('0:03'), findsOneWidget);
  });
}

class _VoiceChatRepository extends BackendRepository {
  _VoiceChatRepository() : super(Dio());

  @override
  Future<BackendPage<BackendChatSummary>> fetchMeetupChats({
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendChatSummary(
          id: 'coffee',
          title: 'Speciality coffee tasting',
          kind: 'meetup',
          raw: {
            'id': 'coffee',
            'title': 'Speciality coffee tasting',
            'kind': 'meetup',
            'eventId': 'coffee',
            'status': 'Сегодня',
            'time': '19:30',
            'contextLine': 'Brew Lab, Патрики',
            'memberProfiles': [
              {'userId': 'u-lia', 'name': 'Лия', 'online': true},
              {'userId': 'user-1', 'name': 'Вы', 'online': true},
            ],
          },
        ),
      ],
    );
  }

  @override
  Future<BackendPage<BackendChatSummary>> fetchPersonalChats({
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(items: []);
  }

  @override
  Future<BackendPage<BackendChatMessage>> fetchChatMessages(
    String chatId, {
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    return BackendPage(
      items: [
        BackendChatMessage(
          id: 'voice-message-1',
          chatId: chatId,
          text: '',
          senderId: 'user-1',
          senderName: 'Вы',
          createdAt: DateTime(2026, 5, 19, 17, 24),
          raw: {
            'mine': true,
            'attachments': [
              {
                'id': 'voice-1',
                'kind': 'chat_voice',
                'fileName': 'dateasy-voice-1779186240895879.m4a',
                'mimeType': 'audio/mp4',
                'durationMs': 3000,
                'waveform': [0.18, 0.46, 0.82, 0.35],
                'url': 'https://example.com/voice.m4a',
              },
            ],
          },
        ),
      ],
    );
  }
}
