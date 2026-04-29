import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/widgets/bb_message_actions_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('message actions sheet shows reply and copy for text message',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {
                  showBbMessageActionsSheet(
                    context,
                    message: const Message(
                      id: 'm1',
                      chatId: 'c1',
                      clientMessageId: 'm1',
                      authorId: 'u1',
                      author: 'Аня К',
                      text: 'Привет',
                      time: '12:00',
                      attachments: [],
                    ),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Ответить'), findsOneWidget);
    expect(find.text('Скопировать'), findsOneWidget);
  });

  testWidgets('message actions sheet hides copy for voice message',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {
                  showBbMessageActionsSheet(
                    context,
                    message: const Message(
                      id: 'm1',
                      chatId: 'c1',
                      clientMessageId: 'm1',
                      authorId: 'u1',
                      author: 'Аня К',
                      text: '',
                      time: '12:00',
                      attachments: [
                        MessageAttachment(
                          id: 'a1',
                          kind: 'chat_voice',
                          status: 'ready',
                          url: 'https://example.com/voice.m4a',
                          mimeType: 'audio/mp4',
                          byteSize: 1234,
                          fileName: 'voice.m4a',
                          durationMs: 7000,
                        ),
                      ],
                    ),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Ответить'), findsOneWidget);
    expect(find.text('Скопировать'), findsNothing);
  });

  testWidgets('message actions sheet shows edit and delete for my text message',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {
                  showBbMessageActionsSheet(
                    context,
                    message: const Message(
                      id: 'm1',
                      chatId: 'c1',
                      clientMessageId: 'm1',
                      authorId: 'u1',
                      author: 'Ты',
                      text: 'Привет',
                      time: '12:00',
                      mine: true,
                      attachments: [],
                    ),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Редактировать'), findsOneWidget);
    expect(find.text('Удалить'), findsOneWidget);
  });

  testWidgets('message actions sheet hides edit and delete for other message',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {
                  showBbMessageActionsSheet(
                    context,
                    message: const Message(
                      id: 'm1',
                      chatId: 'c1',
                      clientMessageId: 'm1',
                      authorId: 'u1',
                      author: 'Аня К',
                      text: 'Привет',
                      time: '12:00',
                      attachments: [],
                    ),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Редактировать'), findsNothing);
    expect(find.text('Удалить'), findsNothing);
  });
}
