import 'dart:async';
import 'package:big_break_mobile/app/core/device/app_voice_recorder_service.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/recorded_voice_draft.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_theme.dart';
import 'package:big_break_mobile/shared/widgets/bb_composer.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class _FakeVoiceRecorderService implements AppVoiceRecorderService {
  var startCalls = 0;
  var stopCalls = 0;
  var cancelCalls = 0;
  List<double> returnedWaveform = const [0.24, 0.52, 0.71, 0.39];

  @override
  Stream<double> get amplitudeStream => const Stream<double>.empty();

  @override
  Future<void> cancel() async {
    cancelCalls += 1;
  }

  @override
  Future<void> dispose() async {}

  @override
  Future<void> start() async {
    startCalls += 1;
  }

  @override
  Future<RecordedVoiceDraft> stop() async {
    stopCalls += 1;
    return RecordedVoiceDraft(
      file: PlatformFile(
        name: 'voice.m4a',
        size: 16,
        path: '/tmp/voice.m4a',
      ),
      duration: const Duration(seconds: 7),
      waveform: returnedWaveform,
    );
  }
}

class _FlakyVoiceRecorderService implements AppVoiceRecorderService {
  var startCalls = 0;

  @override
  Stream<double> get amplitudeStream => const Stream<double>.empty();

  @override
  Future<void> cancel() async {}

  @override
  Future<void> dispose() async {}

  @override
  Future<void> start() async {
    startCalls += 1;
    if (startCalls == 1) {
      throw StateError('temporary start failure');
    }
  }

  @override
  Future<RecordedVoiceDraft> stop() async {
    return RecordedVoiceDraft(
      file: PlatformFile(
        name: 'voice.m4a',
        size: 16,
        path: '/tmp/voice.m4a',
      ),
      duration: const Duration(seconds: 3),
      waveform: const [0.2, 0.4, 0.6],
    );
  }
}

class _StreamingVoiceRecorderService implements AppVoiceRecorderService {
  _StreamingVoiceRecorderService();

  final _controller = StreamController<double>.broadcast();
  var startCalls = 0;

  @override
  Stream<double> get amplitudeStream => _controller.stream;

  void emit(double value) {
    _controller.add(value);
  }

  @override
  Future<void> cancel() async {}

  @override
  Future<void> dispose() async {
    await _controller.close();
  }

  @override
  Future<void> start() async {
    startCalls += 1;
  }

  @override
  Future<RecordedVoiceDraft> stop() async {
    return RecordedVoiceDraft(
      file: PlatformFile(
        name: 'voice.m4a',
        size: 16,
        path: '/tmp/voice.m4a',
      ),
      duration: const Duration(minutes: 12, seconds: 5),
      waveform: List<double>.filled(48, 0.8, growable: false),
    );
  }
}

void main() {
  testWidgets('composer renders custom hint text and actions', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              hintText: 'Напиши или пригласи на встречу',
              onSend: _noopSend,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Напиши или пригласи на встречу'), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
    expect(find.byIcon(Icons.send_rounded), findsOneWidget);
  });

  testWidgets('composer starts voice recording and sends recorded clip', (
    tester,
  ) async {
    final recorder = _FakeVoiceRecorderService();
    RecordedVoiceDraft? sentVoice;
    var permissionRequests = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              onSendVoice: (voice) async {
                sentVoice = voice;
              },
              onRequestMicrophonePermission: () async {
                permissionRequests += 1;
                return true;
              },
              voiceRecorderService: recorder,
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('bb-composer-mic-button')), findsOneWidget);

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump();

    expect(permissionRequests, 1);
    expect(recorder.startCalls, 1);
    expect(find.byKey(const Key('bb-composer-voice-cancel')), findsOneWidget);
    expect(find.byKey(const Key('bb-composer-voice-send')), findsOneWidget);
    expect(find.byIcon(LucideIcons.trash_2), findsOneWidget);
    expect(find.byIcon(LucideIcons.send), findsOneWidget);
    expect(find.text('запись'), findsOneWidget);
    expect(find.text('0:00'), findsOneWidget);
    expect(
      tester
          .getSize(find.byKey(const Key('bb-composer-voice-recording-pill')))
          .height,
      44,
    );

    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.byKey(const Key('bb-composer-voice-send')));
    await tester.pumpAndSettle();

    expect(recorder.stopCalls, 1);
    expect(sentVoice, isNotNull);
    expect(sentVoice!.file.name, 'voice.m4a');
    expect(sentVoice!.duration, const Duration(seconds: 7));
    expect(sentVoice!.waveform, isNotEmpty);
  });

  testWidgets('composer preserves waveform returned by recorder service', (
    tester,
  ) async {
    final recorder = _FakeVoiceRecorderService()
      ..returnedWaveform = const [0.14, 0.31, 0.62, 0.27];
    RecordedVoiceDraft? sentVoice;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              onSendVoice: (voice) async {
                sentVoice = voice;
              },
              onRequestMicrophonePermission: () async => true,
              voiceRecorderService: recorder,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('bb-composer-voice-send')));
    await tester.pumpAndSettle();

    expect(sentVoice, isNotNull);
    expect(sentVoice!.waveform, const [0.14, 0.31, 0.62, 0.27]);
  });

  testWidgets('composer resets recording UI before voice upload finishes', (
    tester,
  ) async {
    final recorder = _FakeVoiceRecorderService();
    final completer = Completer<void>();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              onSendVoice: (_) => completer.future,
              onRequestMicrophonePermission: () async => true,
              voiceRecorderService: recorder,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump();
    expect(find.byKey(const Key('bb-composer-voice-send')), findsOneWidget);

    await tester.tap(find.byKey(const Key('bb-composer-voice-send')));
    await tester.pump();

    expect(find.byKey(const Key('bb-composer-voice-send')), findsNothing);
    expect(find.byKey(const Key('bb-composer-mic-button')), findsOneWidget);

    completer.complete();
    await tester.pumpAndSettle();
  });

  testWidgets(
      'composer allows starting a new voice recording while previous upload is still running',
      (tester) async {
    final recorder = _FakeVoiceRecorderService();
    final completer = Completer<void>();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              onSendVoice: (_) => completer.future,
              onRequestMicrophonePermission: () async => true,
              voiceRecorderService: recorder,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('bb-composer-voice-send')));
    await tester.pump();

    expect(find.byKey(const Key('bb-composer-mic-button')), findsOneWidget);

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump();

    expect(recorder.startCalls, 2);

    completer.complete();
    await tester.pumpAndSettle();
  });

  testWidgets(
      'composer recording row keeps long duration and waveform without overflow',
      (tester) async {
    final recorder = _StreamingVoiceRecorderService();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(
              width: 280,
              child: BbComposer(
                onSend: _noopSend,
                onSendVoice: (_) async {},
                onRequestMicrophonePermission: () async => true,
                voiceRecorderService: recorder,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump();

    for (var index = 0; index < 60; index++) {
      recorder.emit(0.9);
    }
    await tester.pump();
    await tester.pump(const Duration(minutes: 12, seconds: 5));

    expect(find.text('запись'), findsOneWidget);
    expect(find.text('0:00'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await recorder.dispose();
  });

  testWidgets('composer opens attachment actions from plus button', (
    tester,
  ) async {
    BbComposerAttachmentAction? selectedAction;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              onAttachmentActionSelected: (action) async {
                selectedAction = action;
              },
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Что прикрепить'), findsOneWidget);
    expect(find.text('Фото'), findsOneWidget);
    expect(find.text('Файл'), findsOneWidget);
    expect(find.text('Локацию'), findsOneWidget);

    await tester.tap(find.text('Локацию'));
    await tester.pumpAndSettle();

    expect(selectedAction, BbComposerAttachmentAction.location);
  });

  testWidgets('composer uses dark shell surface in dark theme', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: const Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              hintText: 'Напиши или пригласи на встречу',
              onSend: _noopSend,
            ),
          ),
        ),
      ),
    );

    final decoratedBox = tester.widget<DecoratedBox>(
      find.byType(DecoratedBox).first,
    );
    final decoration = decoratedBox.decoration as BoxDecoration;
    expect(decoration.color, AppColors.darkTheme.background);
  });

  testWidgets('composer uses themed foreground color for input text',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: const Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              hintText: 'Напиши или пригласи на встречу',
              onSend: _noopSend,
            ),
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'Тест');
    await tester.pumpAndSettle();

    final textField = tester.widget<TextField>(find.byType(TextField));
    expect(textField.style?.color, AppColors.darkTheme.foreground);
  });

  testWidgets('composer shows reply preview and lets cancel it',
      (tester) async {
    var cancelled = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              replyTo: const MessageReplyPreview(
                id: 'm1',
                author: 'Аня К',
                text: 'Исходное сообщение',
                isVoice: false,
              ),
              onCancelReply: () {
                cancelled = true;
              },
            ),
          ),
        ),
      ),
    );

    expect(find.text('Ответ Аня К'), findsOneWidget);
    expect(find.text('Исходное сообщение'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    expect(cancelled, true);
  });

  testWidgets('composer puts edited message text into input and submits it',
      (tester) async {
    String? sentText;
    var cancelled = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: (text) async {
                sentText = text;
              },
              editingMessage: const MessageEditDraft(
                id: 'm1',
                text: 'Старый текст',
              ),
              onCancelEdit: () {
                cancelled = true;
              },
            ),
          ),
        ),
      ),
    );

    expect(find.text('Редактирование'), findsOneWidget);
    expect(find.text('Старый текст'), findsWidgets);

    final textField = tester.widget<TextField>(find.byType(TextField));
    expect(textField.controller?.text, 'Старый текст');

    await tester.enterText(find.byType(TextField), 'Исправленный текст');
    await tester.tap(find.byIcon(Icons.send_rounded));
    await tester.pumpAndSettle();

    expect(sentText, 'Исправленный текст');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              editingMessage: const MessageEditDraft(
                id: 'm2',
                text: 'Другой текст',
              ),
              onCancelEdit: () {
                cancelled = true;
              },
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    expect(cancelled, true);
  });

  testWidgets('composer does not retry start in widget layer', (
    tester,
  ) async {
    final recorder = _FlakyVoiceRecorderService();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
              onSendVoice: (_) async {},
              onRequestMicrophonePermission: () async => true,
              voiceRecorderService: recorder,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('bb-composer-mic-button')));
    await tester.pump(const Duration(milliseconds: 250));

    expect(recorder.startCalls, 1);
    expect(find.byKey(const Key('bb-composer-voice-send')), findsNothing);
  });

  testWidgets('composer keeps keyboard after sending text', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: BbComposer(
              onSend: _noopSend,
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byType(TextField));
    await tester.pump();
    expect(tester.testTextInput.isVisible, true);

    await tester.enterText(find.byType(TextField), 'Привет');
    await tester.tap(find.byIcon(Icons.send_rounded));
    await tester.pumpAndSettle();

    expect(tester.testTextInput.isVisible, true);
  });

  testWidgets('composer dismisses keyboard on tap outside', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              SizedBox(height: 40, width: double.infinity),
              Spacer(),
              BbComposer(
                onSend: _noopSend,
              ),
            ],
          ),
        ),
      ),
    );

    await tester.tap(find.byType(TextField));
    await tester.pump();
    expect(tester.testTextInput.isVisible, true);

    await tester.tapAt(const Offset(20, 20));
    await tester.pumpAndSettle();

    expect(tester.testTextInput.isVisible, false);
  });
}

Future<void> _noopSend(String _) async {}
