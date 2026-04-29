import 'package:big_break_mobile/features/edit_profile/presentation/edit_profile_screen.dart';
import 'package:big_break_mobile/features/search/presentation/search_screen.dart';
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
  testWidgets('search screen shows richer suggested people subtitles',
      (tester) async {
    await tester.pumpWidget(_wrap(const SearchScreen()));
    await tester.pumpAndSettle();

    expect(find.text('2 общих интереса'), findsWidgets);
  });

  testWidgets('edit profile keeps age numeric and updates bio counter',
      (tester) async {
    await tester.pumpWidget(_wrap(const EditProfileScreen()));
    await tester.pumpAndSettle();

    final ageField = find.byKey(const Key('edit-profile-age-field'));
    await tester.scrollUntilVisible(
      ageField,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.enterText(ageField, '2a8');
    await tester.pumpAndSettle();

    expect(find.text('28'), findsWidgets);

    final bioField = find.byKey(const Key('edit-profile-bio-field'));
    await tester.scrollUntilVisible(
      bioField,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.enterText(bioField, 'Привет');
    await tester.pumpAndSettle();

    expect(find.text('6/300'), findsOneWidget);
  });

  testWidgets('edit profile chips keep phone width on wide screens',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(2000, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(_wrap(const EditProfileScreen()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Интересы · 6'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    final interestsWrap = find.byWidgetPredicate(
      (widget) => widget is Wrap && widget.children.length == 14,
    );

    expect(tester.getSize(interestsWrap).width, lessThanOrEqualTo(350));
  });
}
