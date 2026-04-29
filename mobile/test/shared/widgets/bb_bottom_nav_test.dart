import 'package:big_break_mobile/app/navigation/app_shell.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/widgets/bb_bottom_nav.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../test_overrides.dart';

void main() {
  testWidgets('bottom nav shows unread badge total on chats tab',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: buildTestOverrides(),
        child: const MaterialApp(
          home: Scaffold(
            body: SizedBox.shrink(),
            bottomNavigationBar: BbBottomNav(
              location: '/chats',
              onTap: _noop,
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Вечер'), findsOneWidget);
    expect(find.text('Клубы'), findsOneWidget);
    expect(find.text('Чаты'), findsOneWidget);
  });

  testWidgets('bottom nav stays idle on profile without chat providers',
      (tester) async {
    var meetupReads = 0;
    var personalReads = 0;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          meetupChatsProvider.overrideWith(
            (ref) async {
              meetupReads += 1;
              return const [];
            },
          ),
          personalChatsProvider.overrideWith(
            (ref) async {
              personalReads += 1;
              return const [];
            },
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SizedBox.shrink(),
            bottomNavigationBar: BbBottomNav(
              location: '/profile',
              onTap: _noop,
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Профиль'), findsOneWidget);
    expect(meetupReads, 0);
    expect(personalReads, 0);
  });
}

void _noop(AppTab _) {}
