import 'package:big_break_mobile/shared/widgets/bb_swipeable_message.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('swipeable message triggers reply on left swipe', (tester) async {
    var replied = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BbSwipeableMessage(
            onReply: () {
              replied = true;
            },
            onLongPress: () {},
            child: const SizedBox(
              width: 200,
              height: 40,
              child: Text('Сообщение'),
            ),
          ),
        ),
      ),
    );

    await tester.drag(find.text('Сообщение'), const Offset(-90, 0));
    await tester.pumpAndSettle();

    expect(replied, true);
  });
}
