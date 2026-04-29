import 'package:big_break_mobile/features/create_meetup/presentation/create_meetup_screen.dart';
import 'package:big_break_mobile/features/posters/presentation/poster_detail_screen.dart';
import 'package:big_break_mobile/features/posters/presentation/widgets/poster_picker_sheet.dart';
import 'package:big_break_mobile/features/posters/presentation/widgets/poster_card.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../test_overrides.dart';

Widget _wrap(Widget child) {
  return ProviderScope(
    overrides: buildTestOverrides(),
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets('create meetup renders poster link field', (tester) async {
    await tester.pumpWidget(_wrap(const CreateMeetupScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Привязать к событию из афиши'), findsOneWidget);
  });

  testWidgets('create meetup opens partner venue picker from partner field',
      (tester) async {
    await tester.pumpWidget(_wrap(const CreateMeetupScreen()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Партнёрские места'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Партнёрские места'));
    await tester.pumpAndSettle();

    expect(find.text('Партнёры Frendly'), findsOneWidget);
    expect(find.text('Лучшие перки сейчас'), findsOneWidget);
    expect(find.text('Brix Wine'), findsWidgets);
    expect(find.text('Все партнёры'), findsOneWidget);
  });

  testWidgets('create meetup prefills fields from posterId', (tester) async {
    await tester.pumpWidget(_wrap(const CreateMeetupScreen(posterId: 'ps1')));
    await tester.pumpAndSettle();

    expect(
      find.text('Идём на «Молчат Дома · большой концерт»'),
      findsOneWidget,
    );
    expect(
        find.text('Adrenaline Stadium, Ленинградское ш. 80'), findsOneWidget);
    expect(find.text('Идём на событие'), findsOneWidget);
  });

  testWidgets('poster detail keeps hero buy button visible', (tester) async {
    await tester.pumpWidget(_wrap(const PosterDetailScreen(posterId: 'ps1')));
    await tester.pumpAndSettle();

    expect(find.text('Купить'), findsOneWidget);
    expect(find.textContaining('Купить билет'), findsOneWidget);
  });

  testWidgets('poster detail cta buttons use the same height', (tester) async {
    await tester.pumpWidget(_wrap(const PosterDetailScreen(posterId: 'ps3')));
    await tester.pumpAndSettle();

    final meetupButton = find.widgetWithText(FilledButton, 'Собрать компанию');
    final ticketsButton = find.widgetWithText(
      FilledButton,
      'Купить билет · от 800 ₽',
    );

    expect(
      tester.getSize(meetupButton).height,
      tester.getSize(ticketsButton).height,
    );
  });

  testWidgets('poster picker sheet ignores bottom safe area inset',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    tester.view.viewPadding = const FakeViewPadding(bottom: 34);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetViewPadding);

    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () {
                  showPosterPickerSheet(context);
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

    final safeArea = find.ancestor(
      of: find.text('Выбрать из афиши'),
      matching: find.byType(SafeArea),
    );

    expect(safeArea, findsOneWidget);
    expect(tester.widget<SafeArea>(safeArea).bottom, false);
  });

  testWidgets('compact poster card shows short tag on the cover',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        Scaffold(
          body: Center(
            child: PosterCard(
              poster: mockPosters.first,
              variant: PosterCardVariant.compact,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('пост-панк'), findsOneWidget);
  });
}
