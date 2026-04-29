import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('route template detail parses nullable offer fields', () {
    final detail = EveningRouteTemplateDetail.fromJson(const {
      'id': 'template-1',
      'routeId': 'route-1',
      'title': 'Вечер на Покровке',
      'blurb': 'Три спокойных места для знакомства',
      'city': 'Москва',
      'area': 'Покровка',
      'badgeLabel': null,
      'coverUrl': null,
      'vibe': 'Спокойно',
      'budget': '2500 ₽',
      'durationLabel': '3 часа',
      'totalPriceFrom': 2500,
      'totalSavings': 0,
      'goal': 'dating',
      'mood': 'cozy',
      'format': null,
      'recommendedFor': null,
      'stepsPreview': [
        {'title': 'Аперитив', 'venue': 'Brix', 'emoji': '🍷'}
      ],
      'partnerOffersPreview': [
        {'partnerId': 'partner-1', 'title': 'Десерт', 'shortLabel': null}
      ],
      'nearestSessions': [
        {
          'sessionId': 'session-1',
          'startsAt': '2026-04-29T16:00:00.000Z',
          'joinedCount': 3,
          'capacity': 8,
        }
      ],
      'steps': [
        {
          'id': 'step-1',
          'time': '19:00',
          'endTime': null,
          'kind': 'bar',
          'title': 'Аперитив',
          'venue': 'Brix',
          'address': 'Покровка 12',
          'emoji': '🍷',
          'distance': null,
          'walkMin': null,
          'perk': null,
          'perkShort': null,
          'ticketPrice': null,
          'ticketCommission': null,
          'sponsored': false,
          'premium': false,
          'partnerId': null,
          'description': null,
          'vibeTag': null,
          'lat': 55.7601,
          'lng': 37.6401,
          'venueId': null,
          'partnerOfferId': null,
          'offerTitle': null,
          'offerDescription': null,
          'offerTerms': null,
          'offerShortLabel': null,
        }
      ],
    });

    expect(detail.badgeLabel, isNull);
    expect(detail.recommendedFor, isNull);
    expect(detail.partnerOffersPreview.single.shortLabel, isNull);
    expect(detail.steps.single.offerTitle, isNull);
    expect(detail.steps.single.offerDescription, isNull);
    expect(detail.steps.single.offerTerms, isNull);
    expect(detail.steps.single.offerShortLabel, isNull);
    expect(detail.nearestSessions.single.capacity, 8);
  });
}
