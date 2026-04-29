import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_filters.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SearchResultsData {
  const SearchResultsData({
    required this.events,
    required this.evenings,
    required this.people,
  });

  final List<Event> events;
  final List<EveningSessionSummary> evenings;
  final List<PersonSummary> people;
}

class SearchResultsQuery {
  const SearchResultsQuery({
    required this.query,
    required this.activeFilters,
    required this.sheetFilters,
  });

  final String query;
  final List<String> activeFilters;
  final EventFilters sheetFilters;

  @override
  bool operator ==(Object other) {
    return other is SearchResultsQuery &&
        other.query == query &&
        listEquals(other.activeFilters, activeFilters) &&
        other.sheetFilters == sheetFilters;
  }

  @override
  int get hashCode => Object.hash(
        query,
        Object.hashAll(activeFilters),
        sheetFilters,
      );
}

final searchResultsProvider =
    FutureProvider.family<SearchResultsData, SearchResultsQuery>((
  ref,
  query,
) async {
  final repository = ref.read(backendRepositoryProvider);
  final eventsFuture = repository.fetchEvents(
    filter: 'nearby',
    q: query.query,
    lifestyle: query.sheetFilters.lifestyle,
    price: query.sheetFilters.price,
    gender: query.sheetFilters.gender,
    access: query.sheetFilters.access,
  );
  final peopleFuture = repository.fetchPeople(q: query.query);
  final eveningsFuture = repository.fetchEveningSessions(limit: 20);

  final events = await eventsFuture;
  final people = await peopleFuture;
  final evenings = await eveningsFuture;

  return SearchResultsData(
    events: filterSearchEvents(
      events: events.items,
      query: query.query,
      activeFilters: query.activeFilters,
      sheetFilters: query.sheetFilters,
    ),
    evenings: filterSearchEvenings(
      sessions: evenings.items,
      query: query.query,
      activeFilters: query.activeFilters,
    ),
    people: people.items,
  );
});

List<Event> filterSearchEvents({
  required List<Event> events,
  required String query,
  required List<String> activeFilters,
  required EventFilters sheetFilters,
}) {
  final normalizedQuery = query.trim().toLowerCase();

  return events.where((event) {
    if (!_matchesSheetFilters(event, sheetFilters)) {
      return false;
    }
    if (!_matchesQuickFilters(event, activeFilters)) {
      return false;
    }
    if (normalizedQuery.isEmpty) {
      return true;
    }

    final haystack = [
      event.title,
      event.place,
      event.vibe,
      event.hostNote ?? '',
    ].join(' ').toLowerCase();

    return haystack.contains(normalizedQuery);
  }).toList(growable: false);
}

List<EveningSessionSummary> filterSearchEvenings({
  required List<EveningSessionSummary> sessions,
  required String query,
  required List<String> activeFilters,
}) {
  final normalizedQuery = query.trim().toLowerCase();

  return sessions.where((session) {
    if (!_matchesEveningQuickFilters(session, activeFilters)) {
      return false;
    }
    if (normalizedQuery.isEmpty) {
      return true;
    }

    final haystack = [
      session.title,
      session.vibe,
      session.area ?? '',
      session.hostName ?? '',
      session.currentPlace ?? '',
    ].join(' ').toLowerCase();

    return haystack.contains(normalizedQuery);
  }).toList(growable: false);
}

List<PersonSummary> filterSearchPeople({
  required List<PersonSummary> people,
  required String query,
  required List<String> activeFilters,
}) {
  final normalized = query.trim().toLowerCase();
  if (normalized.isEmpty) {
    return const [];
  }

  final nearbyOnly = activeFilters.contains('Рядом');
  return people.where((person) {
    final haystack = [
      person.name,
      person.area ?? '',
      person.vibe ?? '',
      ...person.common,
    ].join(' ').toLowerCase();
    if (!haystack.contains(normalized)) {
      return false;
    }
    if (nearbyOnly && (person.area ?? '').isEmpty) {
      return false;
    }
    return true;
  }).toList(growable: false);
}

bool _matchesSheetFilters(Event event, EventFilters filters) {
  if (filters.lifestyle != 'any' && event.lifestyle != filters.lifestyle) {
    return false;
  }
  if (filters.gender != 'any' && event.genderMode != filters.gender) {
    return false;
  }
  if (filters.access != 'any' && event.accessMode != filters.access) {
    return false;
  }
  if (filters.price != 'any' && !_matchesPrice(event, filters.price)) {
    return false;
  }
  return true;
}

bool _matchesQuickFilters(Event event, List<String> activeFilters) {
  for (final filter in activeFilters) {
    if (filter == 'Сегодня' && !event.time.startsWith('Сегодня')) {
      return false;
    }
    if (filter == 'Завтра' && !event.time.startsWith('Завтра')) {
      return false;
    }
    if (filter == 'Бесплатно' && event.priceMode != 'free') {
      return false;
    }
    if (filter == 'Рядом') {
      final distance = _distanceKm(event.distance);
      if (distance == null || distance > 1.5) {
        return false;
      }
    }
    if (filter == 'Спокойно' && !event.vibe.toLowerCase().contains('спокой')) {
      return false;
    }
    if (filter == 'Активно' && !event.vibe.toLowerCase().contains('актив')) {
      return false;
    }
  }

  return true;
}

bool _matchesEveningQuickFilters(
  EveningSessionSummary session,
  List<String> activeFilters,
) {
  final wantsLive = activeFilters.contains('Live');
  final wantsGathering = activeFilters.contains('Собираются');
  if ((wantsLive || wantsGathering) &&
      !((wantsLive && session.phase == EveningSessionPhase.live) ||
          (wantsGathering &&
              (session.phase == EveningSessionPhase.scheduled ||
                  session.chatPhase == MeetupPhase.soon ||
                  session.chatPhase == MeetupPhase.upcoming)))) {
    return false;
  }

  for (final filter in activeFilters) {
    if (filter == 'Завтра' || filter == 'Бесплатно') {
      return false;
    }
    if (filter == 'Рядом' && (session.area ?? '').isEmpty) {
      return false;
    }
    final vibe = '${session.title} ${session.vibe}'.toLowerCase();
    if (filter == 'Спокойно' && !vibe.contains('спокой')) {
      return false;
    }
    if (filter == 'Активно' && !vibe.contains('актив')) {
      return false;
    }
  }

  return true;
}

bool _matchesPrice(Event event, String price) {
  if (price == 'free') {
    return event.priceMode == 'free';
  }

  final amount = event.priceAmountTo ?? event.priceAmountFrom;
  if (amount == null) {
    return false;
  }

  switch (price) {
    case 'cheap':
      return amount <= 1000;
    case 'mid':
      return amount > 1000 && amount <= 3000;
    case 'premium':
      return amount > 3000;
    default:
      return true;
  }
}

double? _distanceKm(String distanceLabel) {
  final normalized = distanceLabel.replaceAll(',', '.');
  final match = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(normalized);
  return match == null ? null : double.tryParse(match.group(1)!);
}
