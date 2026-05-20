import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';

void main() {
  testWidgets('bottom nav uses the front2 Dateasy item set', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: DateasyTheme.theme,
        home: const Scaffold(
          body: Stack(
            children: [
              DateasyBottomNav(),
            ],
          ),
        ),
      ),
    );

    expect(find.byIcon(LucideIcons.calendarHeart), findsOneWidget);
    expect(find.byIcon(LucideIcons.compass), findsOneWidget);
    expect(find.byIcon(LucideIcons.plus), findsOneWidget);
    expect(find.byIcon(LucideIcons.messageCircle), findsOneWidget);
    expect(find.byIcon(LucideIcons.heart), findsOneWidget);
    expect(find.byIcon(LucideIcons.house), findsNothing);
    expect(find.byIcon(LucideIcons.map), findsNothing);
    expect(find.byIcon(LucideIcons.user), findsNothing);
  });

  testWidgets('bottom nav keeps the larger front2 surface', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: DateasyTheme.theme,
        home: const Scaffold(
          body: Stack(
            children: [
              DateasyBottomNav(),
            ],
          ),
        ),
      ),
    );

    final nav = find.byKey(const ValueKey('dateasy-bottom-nav-surface'));
    final size = tester.getSize(nav);
    expect(size.width, moreOrLessEquals(395.6, epsilon: 0.1));
    expect(size.height, 64);

    final container = tester.widget<Container>(nav);
    final decoration = container.decoration! as BoxDecoration;
    expect(decoration.color, DateasyColors.navSurface);
  });

  testWidgets('bottom nav keeps the front2 bottom offset with safe area',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: DateasyTheme.theme,
        home: const MediaQuery(
          data: MediaQueryData(
            size: Size(430, 812),
            padding: EdgeInsets.only(bottom: 34),
          ),
          child: Scaffold(
            body: Stack(
              children: [
                DateasyBottomNav(),
              ],
            ),
          ),
        ),
      ),
    );

    final nav = find.byKey(const ValueKey('dateasy-bottom-nav-surface'));
    final navBottom = tester.getBottomLeft(nav).dy;

    expect(812 - navBottom, moreOrLessEquals(16, epsilon: 0.1));
  });

  testWidgets('bottom nav highlights current route', (tester) async {
    final router = GoRouter(
      initialLocation: '/chats',
      routes: [
        GoRoute(
          path: '/chats',
          builder: (_, __) => const Scaffold(
            body: Stack(children: [DateasyBottomNav()]),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(
        theme: DateasyTheme.theme,
        routerConfig: router,
      ),
    );

    final chatIcon =
        tester.widget<Icon>(find.byIcon(LucideIcons.messageCircle));

    expect(chatIcon.color, DateasyColors.backgroundDeep);
  });
}
