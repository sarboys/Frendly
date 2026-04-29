import 'package:big_break_mobile/features/search/presentation/search_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../test_overrides.dart';

class _FakeSearchRepository extends BackendRepository {
  _FakeSearchRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<PaginatedResponse<Event>> fetchEvents({
    String filter = 'nearby',
    String? q,
    String? lifestyle,
    String? price,
    String? gender,
    String? access,
    String? cursor,
    int limit = 20,
    double? latitude,
    double? longitude,
    double? radiusKm,
    double? southWestLatitude,
    double? southWestLongitude,
    double? northEastLatitude,
    double? northEastLongitude,
  }) async {
    return PaginatedResponse(
      items: mockEvents,
      nextCursor: null,
    );
  }

  @override
  Future<PaginatedResponse<PersonSummary>> fetchPeople({
    String? q,
    String? cursor,
    int limit = 20,
  }) async {
    final normalized = q?.trim().toLowerCase() ?? '';
    final items = mockPeople
        .map(
      (item) => PersonSummary(
        id: item.name,
        name: item.name,
        age: item.age,
        area: item.area,
        common: item.common,
        online: item.online,
        verified: item.verified,
        vibe: item.vibe,
        avatarUrl: null,
      ),
    )
        .where((person) {
      if (normalized.isEmpty) {
        return true;
      }
      final haystack = [
        person.name,
        person.area ?? '',
        person.vibe ?? '',
        ...person.common,
      ].join(' ').toLowerCase();
      return haystack.contains(normalized);
    }).toList(growable: false);

    return PaginatedResponse(
      items: items,
      nextCursor: null,
    );
  }

  @override
  Future<PaginatedResponse<EveningSessionSummary>> fetchEveningSessions({
    int limit = 20,
  }) async {
    return const PaginatedResponse(
      items: [
        EveningSessionSummary(
          id: 'session-cozy',
          routeId: 'r-cozy-circle',
          chatId: 'chat-cozy',
          phase: EveningSessionPhase.scheduled,
          chatPhase: MeetupPhase.soon,
          privacy: EveningPrivacy.open,
          title: 'Теплый круг на Покровке',
          vibe: 'Спокойный маршрут с вином',
          emoji: '🍇',
          area: 'Покровка',
          hostName: 'Аня К',
          joinedCount: 4,
          maxGuests: 10,
        ),
      ],
      nextCursor: null,
    );
  }
}

Widget _wrap({
  List<Override> extraOverrides = const [],
  SearchPreset? preset,
}) {
  return ProviderScope(
    overrides: [
      ...buildTestOverrides(),
      backendRepositoryProvider.overrideWith(
        (ref) => _FakeSearchRepository(ref: ref, dio: Dio()),
      ),
      ...extraOverrides,
    ],
    child: MaterialApp(
      home: SearchScreen(preset: preset),
    ),
  );
}

void main() {
  testWidgets('removing one recent item does not apply that search', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    expect(find.text('настолки'), findsOneWidget);
    expect(find.text('Встречи · 5'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('recent-remove-настолки')));
    await tester.pumpAndSettle();

    expect(find.text('настолки'), findsNothing);
    expect(find.text('Встречи · 5'), findsNothing);
  });

  testWidgets('clear removes all recent items', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    expect(find.text('пробежка'), findsOneWidget);
    expect(find.text('винный вечер'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('search-recents-clear')));
    await tester.pumpAndSettle();

    expect(find.text('настолки'), findsNothing);
    expect(find.text('пробежка'), findsNothing);
    expect(find.text('винный вечер'), findsNothing);
  });

  testWidgets('free quick filter shows filtered results without text query', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Бесплатно'));
    await tester.pumpAndSettle();

    expect(find.text('Встречи · 1'), findsOneWidget);
    expect(find.text('Вечерняя пробежка по бульварам'), findsOneWidget);
    expect(find.text('Винный вечер на крыше'), findsNothing);
  });

  testWidgets('search shows people results when query matches person name', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'Аня');
    await tester.pump(const Duration(milliseconds: 150));

    expect(find.text('Люди · 1'), findsNothing);

    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();

    expect(find.text('Люди · 1'), findsOneWidget);
    expect(find.text('Аня К'), findsOneWidget);
    expect(find.textContaining('общих интереса'), findsOneWidget);
    expect(find.text('Был на 3 общих встречах'), findsNothing);
  });

  testWidgets('search shows published evening sessions', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'покровке');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Frendly Evenings · 1'), findsOneWidget);
    expect(find.text('Теплый круг на Покровке'), findsOneWidget);
    expect(find.text('Собираются'), findsOneWidget);
  });

  testWidgets('evenings preset opens results with active preset chips', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(preset: SearchPreset.evenings));
    await tester.pumpAndSettle();

    expect(find.text('Frendly Evenings'), findsWidgets);
    expect(find.text('Сегодня'), findsOneWidget);
    expect(find.text('Live'), findsWidgets);
    expect(find.text('Собираются'), findsWidgets);
    expect(find.text('Недавнее'), findsNothing);
  });

  testWidgets('nearby preset opens results and keeps map entry', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(preset: SearchPreset.nearby));
    await tester.pumpAndSettle();

    expect(find.text('Рядом с тобой'), findsOneWidget);
    expect(find.text('Сегодня'), findsOneWidget);
    expect(find.text('Рядом'), findsOneWidget);
    expect(find.byIcon(Icons.map_outlined), findsOneWidget);
    expect(find.textContaining('Встречи ·'), findsOneWidget);
    expect(find.text('Недавнее'), findsNothing);
  });

  testWidgets('search results use a lazy scroll view', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'вечер');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.textContaining('Встречи ·'), findsOneWidget);
    expect(find.byType(SingleChildScrollView), findsNothing);
  });
}
