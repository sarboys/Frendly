import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/shared/widgets/dateasy_keyboard_dismiss.dart';

void main() {
  testWidgets('dismisses focused input on any screen tap', (tester) async {
    final focusNode = FocusNode();
    addTearDown(focusNode.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: DateasyKeyboardDismiss(
          child: Scaffold(
            body: Column(
              children: [
                TextField(focusNode: focusNode),
                const SizedBox(height: 80, child: Text('Пустое место')),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.byType(TextField));
    await tester.pump();
    expect(focusNode.hasFocus, isTrue);

    await tester.tap(find.text('Пустое место'));
    await tester.pump();
    expect(focusNode.hasFocus, isFalse);
  });
}
