import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('requests phone code with backend challenge contract', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'challengeId': 'challenge-1',
            'maskedPhone': '+7******4567',
            'resendAfterSeconds': 60,
          });
        }),
    );

    final challenge = await repository.requestPhoneCode('+79991234567');

    expect(seen.method, 'POST');
    expect(seen.path, '/auth/phone/request');
    expect(seen.data, {'phoneNumber': '+79991234567'});
    expect(challenge.challengeId, 'challenge-1');
    expect(challenge.maskedPhone, '+7******4567');
    expect(challenge.resendAfterSeconds, 60);
  });

  test('verifies phone code with challenge id', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'accessToken': 'access',
            'refreshToken': 'refresh',
          });
        }),
    );

    final session = await repository.verifyPhone(
      challengeId: 'challenge-1',
      code: '1234',
    );

    expect(seen.path, '/auth/phone/verify');
    expect(seen.data, {'challengeId': 'challenge-1', 'code': '1234'});
    expect(session.tokens.accessToken, 'access');
    expect(session.tokens.refreshToken, 'refresh');
    expect(session.userId, '');
    expect(session.isNewUser, false);
  });

  test('logs in seeded phone through test shortcut endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'accessToken': 'access',
            'refreshToken': 'refresh',
            'userId': 'user-1',
            'isNewUser': false,
          });
        }),
    );

    final session = await repository.loginWithTestPhoneShortcut('+71111111111');

    expect(seen.method, 'POST');
    expect(seen.path, '/auth/phone/test-login');
    expect(seen.data, {'phoneNumber': '+71111111111'});
    expect(session.tokens.accessToken, 'access');
    expect(session.tokens.refreshToken, 'refresh');
    expect(session.userId, 'user-1');
    expect(session.isNewUser, false);
  });

  test('starts and verifies telegram auth with backend contract', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path.endsWith('/start')) {
            return _jsonResponse(options, {
              'loginSessionId': 'login-1',
              'botUrl': 'https://t.me/frendly?start=abc',
              'codeLength': 4,
            });
          }
          return _jsonResponse(options, {
            'accessToken': 'access',
            'refreshToken': 'refresh',
          });
        }),
    );

    final start = await repository.startTelegramAuth();
    final session = await repository.verifyTelegramAuth(
      loginSessionId: start.loginSessionId,
      code: '1234',
    );

    expect(requests.first.path, '/auth/telegram/start');
    expect(start.loginSessionId, 'login-1');
    expect(start.botUrl, 'https://t.me/frendly?start=abc');
    expect(requests.last.path, '/auth/telegram/verify');
    expect(requests.last.data, {'loginSessionId': 'login-1', 'code': '1234'});
    expect(session.tokens.accessToken, 'access');
    expect(session.isNewUser, false);
  });

  test('loads, checks contact and saves onboarding through backend contract',
      () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.method == 'GET') {
            return _jsonResponse(options, {
              'intent': 'Знакомиться',
              'gender': 'female',
              'birthDate': '1998-05-01',
              'city': 'Алматы',
              'interests': ['Кофе'],
              'vibe': 'Чилл',
              'email': 'user@test.dev',
              'requiredContact': null,
            });
          }
          return _jsonResponse(options, {
            'intent': 'Ходить на встречи',
            'gender': 'male',
            'birthDate': '1995-02-03',
            'city': 'Тбилиси',
            'interests': ['Арт', 'Кино'],
            'vibe': 'Движ',
            'email': 'next@test.dev',
          });
        }),
    );

    final loaded = await repository.fetchOnboarding();
    await repository.checkOnboardingContact(email: 'next@test.dev');
    final saved = await repository.saveOnboarding(
      const OnboardingData(
        intent: 'Ходить на встречи',
        gender: 'male',
        birthDate: '1995-02-03',
        city: 'Тбилиси',
        interests: ['Арт', 'Кино'],
        vibe: 'Движ',
        email: 'next@test.dev',
      ),
    );

    expect(loaded.city, 'Алматы');
    expect(loaded.interests, ['Кофе']);
    expect(saved.gender, 'male');
    expect(requests[0].method, 'GET');
    expect(requests[0].path, '/onboarding/me');
    expect(requests[1].method, 'POST');
    expect(requests[1].path, '/onboarding/contact/check');
    expect(requests[1].data, {'email': 'next@test.dev'});
    expect(requests[2].method, 'PUT');
    expect(requests[2].path, '/onboarding/me');
    expect(requests[2].data, {
      'intent': 'Ходить на встречи',
      'gender': 'male',
      'birthDate': '1995-02-03',
      'city': 'Тбилиси',
      'interests': ['Арт', 'Кино'],
      'vibe': 'Движ',
      'email': 'next@test.dev',
    });
  });

  test('fetches public user profile through people endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'id': 'u1',
            'name': 'Nina',
          });
        }),
    );

    final profile = await repository.fetchPublicUser('u1');

    expect(seen.path, '/people/u1');
    expect(profile.id, 'u1');
    expect(profile.title, 'Nina');
  });

  test('loads following people for event invites', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'u2',
                'displayName': 'Нина',
                'avatarUrl': 'https://cdn.test/nina.jpg',
                'inviteState': 'available',
              },
            ],
            'nextCursor': 'next-1',
          });
        }),
    );

    final page = await repository.fetchFollowingPeople(
      eventId: 'event-1',
      q: 'ни',
      cursor: 'cursor-1',
      limit: 20,
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/people/following');
    expect(seen.queryParameters, {
      'eventId': 'event-1',
      'q': 'ни',
      'cursor': 'cursor-1',
      'limit': 20,
    });
    expect(page.nextCursor, 'next-1');
    expect(page.items.single.id, 'u2');
    expect(page.items.single.title, 'Нина');
    expect(page.items.single.raw['inviteState'], 'available');
  });

  test('sends event invite to followed user', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'eventId': 'event-1',
            'userId': 'u2',
            'inviteState': 'pending_invite',
          });
        }),
    );

    final result = await repository.inviteUserToEvent('event-1', 'u2');

    expect(seen.method, 'POST');
    expect(seen.path, '/events/event-1/invites');
    expect(seen.data, {'userId': 'u2'});
    expect(result['inviteState'], 'pending_invite');
  });

  test('maps people cards from nested profile payload', () async {
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {
                'userId': 'u42',
                'profile': {
                  'displayName': 'Nina',
                  'photoUrl': 'https://cdn.test/nina.jpg',
                  'city': 'Москва',
                },
              },
            ],
          });
        }),
    );

    final page = await repository.fetchDatingDiscover();
    final card = page.items.single;

    expect(card.id, 'u42');
    expect(card.title, 'Nina');
    expect(card.imageUrl, 'https://cdn.test/nina.jpg');
    expect(card.city, 'Москва');
  });

  test('normalizes backend media proxy paths before exposing image urls',
      () async {
    final user = BackendUser.fromJson({
      'id': 'u1',
      'displayName': 'Alex',
      'avatarUrl': '/media/avatar-1',
    });
    final card = BackendCardItem.fromJson({
      'id': 'event-1',
      'title': 'Coffee',
      'imageUrl': '/media/image-1',
    });
    final chat = BackendChatSummary.fromJson({
      'id': 'chat-1',
      'title': 'Coffee chat',
      'avatarUrl': '/media/chat-1',
    });
    final message = BackendChatMessage.fromJson('chat-1', {
      'id': 'm1',
      'text': 'Hi',
      'senderAvatarUrl': '/media/sender-1',
    });

    expect(user.avatarUrl, 'https://api.frendly.tech/media/avatar-1');
    expect(card.imageUrl, 'https://api.frendly.tech/media/image-1');
    expect(chat.imageUrl, 'https://api.frendly.tech/media/chat-1');
    expect(
      message.senderAvatarUrl,
      'https://api.frendly.tech/media/sender-1',
    );
  });

  test('uses dating profile photos for backend card image url', () async {
    final primaryPhotoCard = BackendCardItem.fromJson({
      'userId': 'u42',
      'name': 'Nina',
      'primaryPhoto': {
        'url': '/media/profile-photo-1',
      },
    });
    final photosCard = BackendCardItem.fromJson({
      'userId': 'u43',
      'name': 'Masha',
      'photos': [
        {
          'url': '/media/profile-photo-2',
        },
      ],
    });

    expect(
      primaryPhotoCard.imageUrl,
      'https://api.frendly.tech/media/profile-photo-1',
    );
    expect(
      photosCard.imageUrl,
      'https://api.frendly.tech/media/profile-photo-2',
    );
  });

  test('prefers card image variant for backend card image url', () async {
    final card = BackendCardItem.fromJson({
      'id': 'event-1',
      'title': 'Standup',
      'imageUrl': '/affiche/images?key=original',
      'imageVariants': {
        'card': {
          'url': '/affiche/images?key=card',
        },
      },
    });

    expect(card.imageUrl, 'https://api.frendly.tech/affiche/images?key=card');
  });

  test('passes dating discover filters to backend query', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );

    await repository.fetchDatingDiscover(
      ageMin: 24,
      ageMax: 35,
      radiusKm: 12,
      interests: ['Кино', 'Кофе'],
      gender: 'female',
      verifiedOnly: true,
      onlineOnly: true,
      newThisWeekOnly: true,
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/dating/discover');
    expect(seen.queryParameters, {
      'limit': 10,
      'ageMin': 24,
      'ageMax': 35,
      'radiusKm': 12,
      'interests': ['Кино', 'Кофе'],
      'gender': 'female',
      'verifiedOnly': true,
      'onlineOnly': true,
      'newThisWeekOnly': true,
    });
  });

  test('records dating action through backend endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {'ok': true, 'matched': false});
        }),
    );

    final result = await repository.recordDatingAction(
      targetUserId: 'u42',
      action: 'like',
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/dating/actions');
    expect(seen.data, {
      'targetUserId': 'u42',
      'action': 'like',
    });
    expect(result['ok'], true);
  });

  test('loads matches through backend endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {
                'userId': 'u42',
                'displayName': 'Nina',
                'avatarUrl': 'https://cdn.test/nina.jpg',
              },
            ],
            'nextCursor': 'next',
          });
        }),
    );

    final page = await repository.fetchMatches(limit: 5, cursor: 'cursor-1');

    expect(seen.method, 'GET');
    expect(seen.path, '/matches');
    expect(seen.queryParameters, {'limit': 5, 'cursor': 'cursor-1'});
    expect(page.items.single.id, 'u42');
    expect(page.items.single.title, 'Nina');
    expect(page.items.single.imageUrl, 'https://cdn.test/nina.jpg');
    expect(page.nextCursor, 'next');
  });

  test('creates event with idempotency key', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'id': 'event-1',
            'title': 'Coffee',
          });
        }),
    );

    final event = await repository.createEvent(
      data: {
        'title': 'Coffee',
        'description': 'Meetup',
        'place': 'Brew Lab',
      },
      idempotencyKey: 'create-1',
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/events');
    expect(seen.headers['idempotency-key'], 'create-1');
    expect(seen.data, {
      'title': 'Coffee',
      'description': 'Meetup',
      'place': 'Brew Lab',
    });
    expect(event.id, 'event-1');
    expect(event.title, 'Coffee');
  });

  test('fetches events with backend filters', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );

    await repository.fetchEvents(
      filter: 'now',
      query: 'кофе',
      lifestyle: 'neutral',
      price: 'free',
      gender: 'all',
      access: 'public',
      date: '2026-05-19',
      limit: 12,
      cursor: 'cursor-1',
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/events');
    expect(seen.queryParameters, {
      'filter': 'now',
      'q': 'кофе',
      'lifestyle': 'neutral',
      'price': 'free',
      'gender': 'all',
      'access': 'public',
      'date': '2026-05-19',
      'limit': 12,
      'cursor': 'cursor-1',
    });
  });

  test('joins and leaves event through backend endpoints', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'id': 'event-1',
            'title': 'Coffee',
            'participantState': options.method == 'POST' ? 'joined' : 'none',
          });
        }),
    );

    final joined = await repository.joinEvent('event-1');
    final left = await repository.leaveEvent('event-1');

    expect(requests.first.method, 'POST');
    expect(requests.first.path, '/events/event-1/join');
    expect(joined.raw['participantState'], 'joined');
    expect(requests.last.method, 'DELETE');
    expect(requests.last.path, '/events/event-1/join');
    expect(left.raw['participantState'], 'none');
  });

  test('creates and cancels event join request through backend endpoints',
      () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'id': 'event-1',
            'title': 'Coffee',
            'accessMode': 'request',
            'joinRequestStatus': options.method == 'POST' ? 'pending' : null,
          });
        }),
    );

    final requested = await repository.createJoinRequest(
      'event-1',
      note: 'Буду к 19:00',
    );
    final cancelled = await repository.cancelJoinRequest('event-1');

    expect(requests.first.method, 'POST');
    expect(requests.first.path, '/events/event-1/join-request');
    expect(requests.first.data, {'note': 'Буду к 19:00'});
    expect(requested.raw['joinRequestStatus'], 'pending');
    expect(requests.last.method, 'DELETE');
    expect(requests.last.path, '/events/event-1/join-request');
    expect(cancelled.raw['joinRequestStatus'], isNull);
  });

  test('fetches map events with rounded viewport query', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {'id': 'e1', 'title': 'Coffee'},
            ],
          });
        }),
    );

    final page = await repository.fetchMapEvents(
      north: 55.7558123,
      south: 55.7001999,
      east: 37.6501555,
      west: 37.5902888,
    );

    expect(page.items.single.id, 'e1');
    expect(seen.path, '/events');
    expect(seen.queryParameters, {
      'north': 55.756,
      'south': 55.7,
      'east': 37.65,
      'west': 37.59,
      'limit': 80,
    });
  });

  test('fetches affiche with backend query, date, price and category filters',
      () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {'id': 'p1', 'title': 'Concert'},
            ],
          });
        }),
    );

    final page = await repository.fetchAffiche(
      query: 'джаз',
      dateFrom: '2026-05-19',
      dateTo: '2026-05-26',
      priceMode: 'free',
      category: 'concert',
    );

    expect(page.items.single.id, 'p1');
    expect(seen.path, '/affiche/events');
    expect(seen.queryParameters, {
      'q': 'джаз',
      'dateFrom': '2026-05-19',
      'dateTo': '2026-05-26',
      'priceMode': 'free',
      'category': 'concert',
      'limit': 20,
    });
  });

  test('fetches affiche event detail by id', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'id': 'p1',
            'title': 'Jazz Night',
            'description': 'Live set',
            'venue': 'Rooftop 17',
            'actionUrl': 'https://tickets.test/p1',
          });
        }),
    );

    final event = await repository.fetchAfficheDetail('p1');

    expect(seen.method, 'GET');
    expect(seen.path, '/affiche/events/p1');
    expect(event.id, 'p1');
    expect(event.title, 'Jazz Night');
    expect(event.raw['actionUrl'], 'https://tickets.test/p1');
  });

  test('searches places through backend search endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponseList(options, [
            {
              'id': 'place-1',
              'title': 'Brew Lab',
              'address': 'Main street',
              'city': 'Тбилиси',
            },
          ]);
        }),
    );

    final page = await repository.searchPlaces(
      query: 'brew',
      city: 'Тбилиси',
      limit: 5,
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/places/search');
    expect(seen.queryParameters, {
      'q': 'brew',
      'city': 'Тбилиси',
      'limit': 5,
    });
    expect(page.items.single.id, 'place-1');
    expect(page.items.single.title, 'Brew Lab');
    expect(page.items.single.subtitle, 'Main street');
  });

  test('fetches meetup chats through compact backend path', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'chat-1',
                'title': 'Coffee meetup',
                'unreadCount': 2,
              },
            ],
          });
        }),
    );

    final page = await repository.fetchMeetupChats();

    expect(seen.method, 'GET');
    expect(seen.path, '/chats/meetups');
    expect(seen.queryParameters, {
      'includeSocial': false,
    });
    expect(page.items.single.id, 'chat-1');
    expect(page.items.single.unreadCount, 2);
  });

  test('maps grouped search results with city scope', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'meetups': [
              {'id': 'event-1', 'title': 'Coffee meetup'},
            ],
            'evenings': [
              {'id': 'evening-1', 'title': 'Evening route'},
            ],
            'routes': [
              {'id': 'route-1', 'title': 'Vinyl walk'},
            ],
            'affiche': [
              {'id': 'poster-1', 'title': 'Poster'},
            ],
          });
        }),
    );

    final page = await repository.search('coffee', city: 'Тбилиси');

    expect(seen.method, 'GET');
    expect(seen.path, '/search');
    expect(seen.queryParameters['q'], 'coffee');
    expect(seen.queryParameters['city'], 'Тбилиси');
    expect(page.items.map((item) => item.id), [
      'event-1',
      'evening-1',
      'route-1',
      'poster-1',
    ]);
  });

  test('fetches perks with backend category filter', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'promo-1',
                'title': 'Dessert',
                'description': 'Gift dessert',
                'placeCategory': 'cafe',
              },
            ],
          });
        }),
    );

    final page = await repository.fetchPerks(
      city: 'Тбилиси',
      category: 'cafe',
      limit: 7,
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/places/promos');
    expect(seen.queryParameters, {
      'city': 'Тбилиси',
      'category': 'cafe',
      'limit': 7,
    });
    expect(page.items.single.id, 'promo-1');
  });

  test('fetches payments catalog and initializes token payment', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/payments/catalog') {
            return _jsonResponse(options, {
              'tbankEnabled': true,
              'subscriptions': [
                {
                  'id': 'month',
                  'label': 'Месячный',
                  'tokenCost': 799,
                },
              ],
              'tokenPacks': [
                {
                  'id': 'p1',
                  'label': 'Базовый',
                  'tokens': 100,
                  'priceRub': 199,
                },
              ],
            });
          }
          return _jsonResponse(options, {
            'orderId': 'order-1',
            'paymentUrl': 'https://pay.test/order-1',
            'status': 'pending',
            'productKind': 'tokens',
            'productId': 'p1',
          });
        }),
    );

    final catalog = await repository.fetchPaymentsCatalog();
    final order = await repository.initTokenPayment(productId: 'p1');

    expect(requests.first.method, 'GET');
    expect(requests.first.path, '/payments/catalog');
    expect(catalog.tokenPacks.single.id, 'p1');
    expect(catalog.subscriptions.single.tokenCost, 799);
    expect(requests.last.method, 'POST');
    expect(requests.last.path, '/payments/init');
    expect(requests.last.data, {
      'productKind': 'tokens',
      'productId': 'p1',
    });
    expect(order.paymentUrl, 'https://pay.test/order-1');
  });

  test('fetches subscription plans from subscription endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'plans': [
              {
                'id': 'month',
                'label': 'Месячный',
                'tokenCost': 799,
                'tokenMonthlyCost': 799,
                'badge': null,
              },
              {
                'id': 'year',
                'label': 'Годовой',
                'tokenCost': 4788,
                'tokenMonthlyCost': 399,
                'badge': '-50%',
              },
            ],
          });
        }),
    );

    final plans = await repository.fetchSubscriptionPlans();

    expect(seen.method, 'GET');
    expect(seen.path, '/subscription/plans');
    expect(plans.first.id, 'month');
    expect(plans.first.tokenCost, 799);
    expect(plans.last.badge, '-50%');
  });

  test('subscribes with tokens through subscription endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'plan': 'month',
            'status': 'active',
            'renewsAt': '2026-06-18T00:00:00.000Z',
          });
        }),
    );

    final subscription = await repository.subscribeWithTokens(plan: 'month');

    expect(seen.method, 'POST');
    expect(seen.path, '/subscription/subscribe');
    expect(seen.data, {'plan': 'month'});
    expect(subscription.status, 'active');
    expect(subscription.plan, 'month');
  });

  test('loads and submits verification state', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'status':
                options.method == 'POST' ? 'selfie_submitted' : 'not_started',
            'selfieDone': options.method == 'POST',
            'documentDone': false,
          });
        }),
    );

    final initial = await repository.fetchVerification();
    final submitted = await repository.submitVerification(step: 'selfie');

    expect(requests.first.method, 'GET');
    expect(requests.first.path, '/verification/me');
    expect(initial.status, 'not_started');
    expect(requests.last.method, 'POST');
    expect(requests.last.path, '/verification/submit');
    expect(requests.last.data, {'step': 'selfie'});
    expect(submitted.selfieDone, true);
  });

  test('loads and updates app settings through backend contract', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'allowPush': options.method == 'PUT',
            'discoverable': false,
            'showAge': true,
            'quietHours': options.method == 'PUT',
            'hideExactLocation': true,
            'darkMode': options.method == 'PUT',
          });
        }),
    );

    final loaded = await repository.fetchSettings();
    final updated = await repository.updateSettings({
      'allowPush': true,
      'darkMode': true,
      'discoverable': false,
      'showAge': true,
      'quietHours': true,
    });

    expect(requests.first.method, 'GET');
    expect(requests.first.path, '/settings/me');
    expect(loaded.discoverable, false);
    expect(loaded.hideExactLocation, true);
    expect(requests.last.method, 'PUT');
    expect(requests.last.path, '/settings/me');
    expect(requests.last.data, {
      'allowPush': true,
      'darkMode': true,
      'discoverable': false,
      'showAge': true,
      'quietHours': true,
    });
    expect(updated.allowPush, true);
    expect(updated.darkMode, true);
    expect(updated.quietHours, true);
  });

  test('loads and updates safety state through backend contract', () async {
    final requests = <RequestOptions>[];
    var safetyUpdated = false;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.method == 'PUT') {
            safetyUpdated = true;
          }
          return _jsonResponse(options, {
            'trustScore': safetyUpdated ? 72 : 61,
            'settings': {
              'autoSharePlans': safetyUpdated,
              'hideExactLocation': true,
            },
            'trustedContacts': [
              {'id': 'contact-1', 'name': 'Nina'},
            ],
            'blockedUsersCount': 2,
            'reportsCount': 1,
          });
        }),
    );

    final loaded = await repository.fetchSafety();
    final updated = await repository.updateSafety({
      'autoSharePlans': true,
    });

    expect(requests[0].method, 'GET');
    expect(requests[0].path, '/safety/me');
    expect(loaded.trustScore, 61);
    expect(loaded.settings.hideExactLocation, true);
    expect(loaded.trustedContacts.single.title, 'Nina');
    expect(requests[1].method, 'PUT');
    expect(requests[1].path, '/safety/me');
    expect(requests[1].data, {'autoSharePlans': true});
    expect(requests[2].method, 'GET');
    expect(requests[2].path, '/safety/me');
    expect(updated.trustScore, 72);
    expect(updated.settings.autoSharePlans, true);
  });

  test('loads and updates own profile', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'id': 'u1',
            'displayName': 'Alex',
            'bio': 'Coffee',
          });
        }),
    );

    final profile = await repository.fetchOwnProfile();
    final updated = await repository.updateOwnProfile(
      data: {'displayName': 'Alex', 'bio': 'Coffee'},
    );

    expect(requests.first.method, 'GET');
    expect(requests.first.path, '/profile/me');
    expect(profile.id, 'u1');
    expect(requests.last.method, 'PATCH');
    expect(requests.last.path, '/profile/me');
    expect(requests.last.data, {'displayName': 'Alex', 'bio': 'Coffee'});
    expect(updated.title, 'Alex');
  });

  test('loads and claims frendly season rewards', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.method == 'POST') {
            return _jsonResponse(options, {
              'claimed': true,
              'reward': {'key': 'checkin-1'},
            });
          }
          return _jsonResponse(options, {
            'seasonKey': '2026-05',
            'seasonLabel': 'Май',
            'checkedInCount': 1,
            'calendarDays': [2],
            'rewards': [
              {
                'key': 'checkin-1',
                'threshold': 1,
                'title': 'Первая искра',
                'description': '50 токенов',
                'rewardKind': 'tokens',
                'rewardAmount': 50,
                'unlocked': true,
                'claimed': false,
              },
            ],
          });
        }),
    );

    final season = await repository.fetchFrendlySeason();
    final claim = await repository.claimFrendlySeasonReward('checkin-1');

    expect(requests.first.method, 'GET');
    expect(requests.first.path, '/profile/me/frendly-season');
    expect(season.checkedInCount, 1);
    expect(season.rewards.single.key, 'checkin-1');
    expect(requests.last.method, 'POST');
    expect(
      requests.last.path,
      '/profile/me/frendly-season/rewards/checkin-1/claim',
    );
    expect(claim['claimed'], true);
  });

  test(
      'loads trusted contacts, creates contact, deletes contact and creates sos',
      () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/safety/trusted-contacts') {
            if (options.method == 'POST') {
              return _jsonResponse(options, {
                'id': 'c2',
                'name': 'Nina',
                'value': '+7999',
              });
            }
            return _jsonResponseList(options, [
              {
                'id': 'c1',
                'name': 'Nina',
                'phoneNumber': '+7999',
              },
            ]);
          }
          return _jsonResponse(options, {
            'id': 'sos-1',
            'status': 'queued',
            'notifiedContactsCount': 1,
          });
        }),
    );

    final contacts = await repository.fetchTrustedContacts();
    final created = await repository.createTrustedContact(
      name: 'Nina',
      value: '+7999',
      channel: 'phone',
      mode: 'sos_only',
    );
    await repository.deleteTrustedContact('c1');
    final sos = await repository.createSos(eventId: 'event-1');

    expect(requests[0].method, 'GET');
    expect(requests[0].path, '/safety/trusted-contacts');
    expect(contacts.items.single.id, 'c1');
    expect(requests[1].method, 'POST');
    expect(requests[1].path, '/safety/trusted-contacts');
    expect(requests[1].data, {
      'name': 'Nina',
      'channel': 'phone',
      'value': '+7999',
      'mode': 'sos_only',
    });
    expect(created.id, 'c2');
    expect(requests[2].method, 'DELETE');
    expect(requests[2].path, '/safety/trusted-contacts/c1');
    expect(requests[3].method, 'POST');
    expect(requests[3].path, '/safety/sos');
    expect(requests[3].data, {'eventId': 'event-1'});
    expect(sos['status'], 'queued');
  });

  test('loads reports and blocks and creates report/block', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/reports/me') {
            return _jsonResponseList(options, [
              {
                'id': 'r0',
                'targetUserId': 'u3',
                'reason': 'spam',
                'status': 'open',
                'blockRequested': false,
                'createdAt': '2026-05-19T08:00:00.000Z',
              },
            ]);
          }
          if (options.path == '/blocks' && options.method == 'GET') {
            return _jsonResponseList(options, [
              {
                'id': 'b0',
                'blockedUserId': 'u3',
                'blockedUser': {'id': 'u3', 'displayName': 'Nina'},
                'createdAt': '2026-05-19T08:01:00.000Z',
              },
            ]);
          }
          if (options.path == '/blocks') {
            return _jsonResponse(options, {
              'id': 'b1',
              'blockedUserId': 'u2',
              'createdAt': '2026-05-19T08:02:00.000Z',
            });
          }
          return _jsonResponse(options, {
            'id': 'r1',
            'status': 'open',
            'blockRequested': true,
          });
        }),
    );

    final reports = await repository.fetchReports();
    final blocks = await repository.fetchBlocks();
    final report = await repository.createReport(
      targetUserId: 'u2',
      reason: 'spam',
      details: 'links',
      blockRequested: true,
    );
    final block = await repository.createBlock(targetUserId: 'u2');

    expect(requests[0].method, 'GET');
    expect(requests[0].path, '/reports/me');
    expect(reports.items.single.targetUserId, 'u3');
    expect(requests[1].method, 'GET');
    expect(requests[1].path, '/blocks');
    expect(blocks.items.single.displayName, 'Nina');
    expect(requests[2].method, 'POST');
    expect(requests[2].path, '/reports');
    expect(requests[2].data, {
      'targetUserId': 'u2',
      'reason': 'spam',
      'details': 'links',
      'blockRequested': true,
    });
    expect(report['status'], 'open');
    expect(requests[3].method, 'POST');
    expect(requests[3].path, '/blocks');
    expect(requests[3].data, {'targetUserId': 'u2'});
    expect(block.blockedUserId, 'u2');
  });

  test('creates share and fetches event stories', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/shares') {
            return _jsonResponse(options, {
              'slug': 'abc',
              'url': 'https://frendly.test/abc',
              'targetType': 'event',
              'targetId': 'event-1',
            });
          }
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'story-1',
                'caption': 'Afterparty',
                'media': {'url': 'https://cdn.test/story.jpg'},
                'createdAt': '2026-05-19T10:00:00.000Z',
              },
            ],
          });
        }),
    );

    final share = await repository.createShare(
      targetType: 'event',
      targetId: 'event-1',
    );
    final stories = await repository.fetchEventStories('event-1');

    expect(requests.first.method, 'POST');
    expect(requests.first.path, '/shares');
    expect(requests.first.data, {
      'targetType': 'event',
      'targetId': 'event-1',
    });
    expect(share['url'], 'https://frendly.test/abc');
    expect(requests.last.method, 'GET');
    expect(requests.last.path, '/events/event-1/stories');
    expect(stories.items.single.id, 'story-1');
    expect(stories.items.single.title, 'Afterparty');
    expect(stories.items.single.imageUrl, 'https://cdn.test/story.jpg');
  });

  test('loads notification unread count and marks notifications read',
      () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/notifications/unread-count') {
            return _jsonResponse(options, {'unreadCount': 3});
          }
          if (options.path == '/notifications/read-all') {
            return _jsonResponse(options, {'ok': true, 'updatedCount': 2});
          }
          return _jsonResponse(options, {
            'ok': true,
            'notificationId': 'n1',
            'alreadyRead': false,
          });
        }),
    );

    final unread = await repository.fetchNotificationUnreadCount();
    final read = await repository.markNotificationRead('n1');
    final readAll = await repository.markAllNotificationsRead();

    expect(requests[0].method, 'GET');
    expect(requests[0].path, '/notifications/unread-count');
    expect(unread, 3);
    expect(requests[1].method, 'POST');
    expect(requests[1].path, '/notifications/n1/read');
    expect(read['notificationId'], 'n1');
    expect(requests[2].method, 'POST');
    expect(requests[2].path, '/notifications/read-all');
    expect(readAll['updatedCount'], 2);
  });

  test('accepts and declines event invites', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'id': 'event-1',
            'title': 'Invite event',
          });
        }),
    );

    final accepted = await repository.acceptEventInvite(
      eventId: 'event-1',
      requestId: 'request-1',
    );
    final declined = await repository.declineEventInvite(
      eventId: 'event-2',
      requestId: 'request-2',
    );

    expect(requests[0].method, 'POST');
    expect(requests[0].path, '/events/event-1/invites/request-1/accept');
    expect(accepted.id, 'event-1');
    expect(requests[1].method, 'POST');
    expect(requests[1].path, '/events/event-2/invites/request-2/decline');
    expect(declined['id'], 'event-1');
  });

  test('marks chat read with last message id', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {'ok': true});
        }),
    );

    final result = await repository.markChatRead(
      'chat-1',
      messageId: 'message-9',
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/chats/chat-1/read');
    expect(seen.data, {'messageId': 'message-9'});
    expect(result['ok'], true);
  });

  test('maps chat message sender avatar and own message flag', () async {
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'currentUserId': 'u1',
            'items': [
              {
                'id': 'm1',
                'chatId': 'chat-1',
                'senderId': 'u1',
                'senderName': 'Alex',
                'senderAvatarUrl': 'https://cdn.test/alex.jpg',
                'text': 'Hi',
              },
            ],
          });
        }),
    );

    final page = await repository.fetchChatMessages('chat-1');
    final message = page.items.single;

    expect(message.senderName, 'Alex');
    expect(message.senderAvatarUrl, 'https://cdn.test/alex.jpg');
    expect(message.raw['mine'], true);
  });

  test('loads latest chat messages with bounded default page', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'currentUserId': 'u1',
            'items': <Object?>[],
          });
        }),
    );

    await repository.fetchChatMessages('chat-1');

    expect(seen.path, '/chats/chat-1/messages');
    expect(seen.queryParameters['limit'], 20);
    expect(seen.queryParameters['cursor'], isNull);
  });

  test('pins and deletes chat through backend endpoints', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.method == 'DELETE') {
            return _jsonResponse(options, {
              'id': 'chat-1',
              'kind': 'direct',
            });
          }
          return _jsonResponse(options, {
            'id': 'chat-1',
            'isPinned': true,
          });
        }),
    );

    final pinned = await repository.setChatPinned(
      'chat-1',
      isPinned: true,
    );
    final deleted = await repository.deleteChat('chat-1');

    expect(requests.first.method, 'POST');
    expect(requests.first.path, '/chats/chat-1/pin');
    expect(requests.first.data, {'isPinned': true});
    expect(pinned['isPinned'], true);
    expect(requests.last.method, 'DELETE');
    expect(requests.last.path, '/chats/chat-1');
    expect(deleted['kind'], 'direct');
  });

  test('uploads chat attachment through presigned URL and complete', () async {
    final tempDir = await Directory.systemTemp.createTemp('mobile2-chat-file');
    addTearDown(() => tempDir.delete(recursive: true));
    final file = File('${tempDir.path}/voice.m4a');
    await file.writeAsString('hello');
    final apiRequests = <RequestOptions>[];
    final uploadRequests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'PUT') {
            uploadRequests.add(options);
            return _jsonResponse(options, {});
          }
          apiRequests.add(options);
          if (options.path == '/uploads/chat-attachment/upload-url') {
            return _jsonResponse(options, {
              'uploadUrl': 'https://storage.test/upload/voice',
              'objectKey': 'chat-attachments/u1/voice.m4a',
              'headers': {'content-type': 'audio/mp4'},
            });
          }
          return _jsonResponse(options, {
            'assetId': 'asset-1',
            'status': 'ready',
          });
        }),
    );

    final result = await repository.uploadChatAttachmentFile(
      chatId: 'chat-1',
      filePath: file.path,
      fileName: 'voice.m4a',
      mimeType: 'audio/mp4',
      kind: 'chat_voice',
      durationMs: 1200,
      waveform: const [0.2, 0.4],
    );

    expect(apiRequests, hasLength(2));
    expect(apiRequests.first.method, 'POST');
    expect(apiRequests.first.path, '/uploads/chat-attachment/upload-url');
    expect(apiRequests.first.data, {
      'chatId': 'chat-1',
      'kind': 'chat_voice',
      'fileName': 'voice.m4a',
      'contentType': 'audio/mp4',
      'durationMs': 1200,
      'waveform': [0.2, 0.4],
    });
    expect(uploadRequests, hasLength(1));
    expect(uploadRequests.single.method, 'PUT');
    expect(uploadRequests.single.uri.toString(),
        'https://storage.test/upload/voice');
    expect(uploadRequests.single.headers[Headers.contentLengthHeader], 5);
    expect(uploadRequests.single.headers['content-type'], 'audio/mp4');
    expect(apiRequests.last.method, 'POST');
    expect(apiRequests.last.path, '/uploads/chat-attachment/complete');
    expect(apiRequests.last.data, {
      'chatId': 'chat-1',
      'kind': 'chat_voice',
      'objectKey': 'chat-attachments/u1/voice.m4a',
      'mimeType': 'audio/mp4',
      'byteSize': 5,
      'fileName': 'voice.m4a',
      'durationMs': 1200,
      'waveform': [0.2, 0.4],
    });
    expect(result['assetId'], 'asset-1');
  });

  test('registers push token with device metadata', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'id': 'token-1',
            'provider': 'fcm',
          });
        }),
    );

    final result = await repository.registerPushToken(
      token: 'push-token',
      provider: 'fcm',
      deviceId: 'device-1',
      platform: 'android',
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/push-tokens');
    expect(seen.data, {
      'token': 'push-token',
      'provider': 'fcm',
      'deviceId': 'device-1',
      'platform': 'android',
    });
    expect(result['id'], 'token-1');
  });

  test('deletes push token by device id and logs out', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {'ok': true});
        }),
    );

    await repository.deletePushTokenByDeviceId('device-1');
    await repository.logout();

    expect(requests[0].method, 'DELETE');
    expect(requests[0].path, '/push-tokens/device/device-1');
    expect(requests[1].method, 'POST');
    expect(requests[1].path, '/auth/logout');
  });

  test('creates community with idempotency key', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'id': 'community-1',
            'name': 'Wine Club',
            'description': 'Friday tastings',
          });
        }),
    );

    final community = await repository.createCommunity(
      data: {
        'name': 'Wine Club',
        'avatar': '🍷',
        'description': 'Friday tastings',
        'privacy': 'public',
        'purpose': 'Вино',
        'tags': ['Вино'],
      },
      idempotencyKey: 'community-create-1',
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/communities');
    expect(seen.headers['idempotency-key'], 'community-create-1');
    expect(seen.data, {
      'name': 'Wine Club',
      'avatar': '🍷',
      'description': 'Friday tastings',
      'privacy': 'public',
      'purpose': 'Вино',
      'tags': ['Вино'],
    });
    expect(community.id, 'community-1');
    expect(community.title, 'Wine Club');
  });

  test('fetches communities with cursor pagination', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {'id': 'community-2', 'name': 'Book Club'},
            ],
            'nextCursor': 'cursor-2',
          });
        }),
    );

    final page = await repository.fetchCommunities(
      limit: 12,
      cursor: 'cursor-1',
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/communities');
    expect(seen.queryParameters, {
      'limit': 12,
      'cursor': 'cursor-1',
    });
    expect(page.items.single.id, 'community-2');
    expect(page.nextCursor, 'cursor-2');
  });

  test('joins, leaves and loads community media and news', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/communities/community-1/media') {
            return _jsonResponse(options, {
              'items': [
                {
                  'id': 'media-1',
                  'label': 'Фото вечера',
                  'kind': 'photo',
                },
              ],
            });
          }
          return _jsonResponse(options, {
            'id': 'community-1',
            'name': 'Wine Club',
            'joined': options.method != 'DELETE',
            'news': [
              {
                'id': 'news-1',
                'title': 'Пятничный сбор',
                'blurb': 'Начинаем в 20:00',
              },
            ],
          });
        }),
    );

    final joined = await repository.joinCommunity('community-1');
    final media = await repository.fetchCommunityMedia('community-1');
    final news = await repository.createCommunityNews(
      communityId: 'community-1',
      title: 'Пятничный сбор',
      body: 'Начинаем в 20:00',
    );
    final left = await repository.leaveCommunity('community-1');

    expect(requests[0].method, 'POST');
    expect(requests[0].path, '/communities/community-1/join');
    expect(joined.raw['joined'], true);
    expect(requests[1].method, 'GET');
    expect(requests[1].path, '/communities/community-1/media');
    expect(media.items.single.id, 'media-1');
    expect(media.items.single.title, 'Фото вечера');
    expect(requests[2].method, 'POST');
    expect(requests[2].path, '/communities/community-1/news');
    expect(requests[2].data, {
      'title': 'Пятничный сбор',
      'body': 'Начинаем в 20:00',
      'pin': true,
    });
    expect(news.raw['news'], isA<List>());
    expect(requests[3].method, 'DELETE');
    expect(requests[3].path, '/communities/community-1/join');
    expect(left.raw['joined'], false);
  });

  test('creates route template session and maps chat id', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'sessionId': 'session-1',
            'routeId': 'route-1',
            'routeTemplateId': 'template-1',
            'chatId': 'chat-1',
            'phase': 'scheduled',
            'startsAt': '2026-05-20T18:00:00.000Z',
            'joinedCount': 1,
            'maxGuests': 6,
          });
        }),
    );

    final session = await repository.createRouteTemplateSession(
      templateId: 'template-1',
      startsAt: DateTime.parse('2026-05-20T18:00:00.000Z'),
      privacy: 'open',
      capacity: 6,
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/evening/route-templates/template-1/sessions');
    expect(seen.data, {
      'startsAt': '2026-05-20T18:00:00.000Z',
      'privacy': 'open',
      'capacity': 6,
    });
    expect(session.sessionId, 'session-1');
    expect(session.chatId, 'chat-1');
    expect(session.maxGuests, 6);
  });

  test('omits route template session capacity when backend should default it',
      () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'sessionId': 'session-1',
            'chatId': 'chat-1',
            'maxGuests': 8,
          });
        }),
    );

    final session = await repository.createRouteTemplateSession(
      templateId: 'template-1',
      startsAt: DateTime.parse('2026-05-20T18:00:00.000Z'),
      privacy: 'open',
    );

    expect(seen.data, {
      'startsAt': '2026-05-20T18:00:00.000Z',
      'privacy': 'open',
    });
    expect(session.maxGuests, 8);
  });

  test('fetches route templates through evening backend endpoint', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'route-1',
                'title': 'Бар и винил',
                'area': 'Центр',
                'durationLabel': '2 часа',
              },
            ],
          });
        }),
    );

    final page = await repository.fetchRoutes(
      city: 'Тбилиси',
      query: 'романтика',
      limit: 6,
    );

    expect(seen.method, 'GET');
    expect(seen.path, '/evening/route-templates');
    expect(seen.queryParameters, {
      'city': 'Тбилиси',
      'q': 'романтика',
      'limit': 6,
    });
    expect(page.items.single.id, 'route-1');
    expect(page.items.single.title, 'Бар и винил');
    expect(page.items.single.raw['durationLabel'], '2 часа');
  });

  test('drives partner offer code endpoints', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'id': options.method == 'POST' ? 'code-1' : 'code-2',
            'codeUrl': 'https://frendly.tech/offer/code-1',
            'status': options.method == 'POST' ? 'issued' : 'activated',
            'expiresAt': '2026-05-21T03:00:00.000Z',
            'activatedAt':
                options.method == 'POST' ? null : '2026-05-20T19:30:00.000Z',
            'offerTitle': '-20% по Frendly',
            'venueName': 'Brew Lab',
            'partnerName': 'Brew Lab',
          });
        }),
    );

    final issued = await repository.issuePartnerOfferCode(
      sessionId: 'session-1',
      stepId: 'step-1',
      offerId: 'offer-1',
    );
    final status = await repository.fetchPartnerOfferCode('code-2');

    expect(requests.first.method, 'POST');
    expect(
      requests.first.path,
      '/evening/sessions/session-1/steps/step-1/offers/offer-1/code',
    );
    expect(requests.last.method, 'GET');
    expect(requests.last.path, '/evening/offer-codes/code-2');
    expect(issued.id, 'code-1');
    expect(issued.status, 'issued');
    expect(issued.codeUrl, 'https://frendly.tech/offer/code-1');
    expect(issued.activatedAt, isNull);
    expect(status.id, 'code-2');
    expect(status.status, 'activated');
    expect(status.activatedAt, DateTime.parse('2026-05-20T19:30:00.000Z'));
    expect(status.offerTitle, '-20% по Frendly');
    expect(status.venueName, 'Brew Lab');
    expect(status.partnerName, 'Brew Lab');
  });

  test('drives evening live session control endpoints', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'sessionId': 'session-1',
            'routeId': 'route-1',
            'chatId': 'chat-1',
            'phase': options.path.endsWith('/finish') ? 'done' : 'live',
            'status': options.path.contains('/check-in') ? 'checked_in' : 'ok',
            'currentStep': options.path.contains('/advance') ||
                    options.path.contains('/skip')
                ? 2
                : 1,
            'totalSteps': 3,
            'currentPlace': 'Brew Lab',
            'checkedIn': options.path.contains('/check-in'),
            'checkedInAt': '2026-05-20T18:20:00.000Z',
            'finishedAt': options.path.endsWith('/finish')
                ? '2026-05-20T21:00:00.000Z'
                : null,
          });
        }),
    );

    final started = await repository.startEveningSession('session-1');
    final joined = await repository.joinEveningSession(
      'session-1',
      inviteToken: 'invite-1',
    );
    final checkedIn = await repository.checkInEveningStep(
      sessionId: 'session-1',
      stepId: 'step-1',
    );
    final advanced = await repository.advanceEveningStep(
      sessionId: 'session-1',
      stepId: 'step-1',
    );
    final skipped = await repository.skipEveningStep(
      sessionId: 'session-1',
      stepId: 'step-2',
    );
    final finished = await repository.finishEveningSession('session-1');

    expect(requests.map((request) => request.path), [
      '/evening/sessions/session-1/start',
      '/evening/sessions/session-1/join',
      '/evening/sessions/session-1/steps/step-1/check-in',
      '/evening/sessions/session-1/steps/step-1/advance',
      '/evening/sessions/session-1/steps/step-2/skip',
      '/evening/sessions/session-1/finish',
    ]);
    expect(requests[1].data, {'inviteToken': 'invite-1'});
    expect(started['phase'], 'live');
    expect(joined['chatId'], 'chat-1');
    expect(checkedIn['checkedIn'], true);
    expect(advanced['currentStep'], 2);
    expect(skipped['currentStep'], 2);
    expect(finished['phase'], 'done');
  });

  test('drives evening after party endpoints', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path.endsWith('/feedback')) {
            return _jsonResponse(options, {
              'sessionId': 'session-1',
              'feedbackId': 'feedback-1',
              'rating': 5,
              'reaction': 'fire',
              'comment': 'Классный вечер',
            });
          }
          if (options.path.endsWith('/photos')) {
            return _jsonResponse(options, {
              'sessionId': 'session-1',
              'photoId': 'photo-1',
              'mediaAssetId': 'asset-1',
              'url': 'https://cdn.test/after-party.jpg',
            });
          }
          return _jsonResponse(options, {
            'sessionId': 'session-1',
            'routeId': 'route-1',
            'title': 'Бар и стендап',
            'phase': 'done',
            'participantsCount': 4,
            'ratingAverage': 4.5,
            'ratingsCount': 2,
            'myFeedback': {
              'rating': 5,
              'reaction': 'fire',
              'comment': 'Классный вечер',
            },
            'photos': [
              {
                'id': 'photo-1',
                'userId': 'user-1',
                'mediaAssetId': 'asset-1',
                'url': 'https://cdn.test/after-party.jpg',
                'createdAt': '2026-05-20T21:10:00.000Z',
              },
            ],
          });
        }),
    );

    final afterParty = await repository.fetchEveningAfterParty('session-1');
    final feedback = await repository.saveEveningAfterPartyFeedback(
      sessionId: 'session-1',
      rating: 5,
      reaction: 'fire',
      comment: 'Классный вечер',
    );
    final photo = await repository.addEveningAfterPartyPhoto(
      sessionId: 'session-1',
      assetId: 'asset-1',
    );

    expect(requests.map((request) => request.path), [
      '/evening/sessions/session-1/after-party',
      '/evening/sessions/session-1/after-party/feedback',
      '/evening/sessions/session-1/after-party/photos',
    ]);
    expect(requests[1].data, {
      'rating': 5,
      'reaction': 'fire',
      'comment': 'Классный вечер',
    });
    expect(requests[2].data, {'assetId': 'asset-1'});
    expect(afterParty['participantsCount'], 4);
    expect((afterParty['photos'] as List).single, isA<Map>());
    expect(feedback['feedbackId'], 'feedback-1');
    expect(photo['mediaAssetId'], 'asset-1');
  });

  test('drives evening ai draft review endpoints', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'draftId': 'draft-1',
            'acceptedStepIndexes': options.path.contains('/accept')
                ? [0]
                : options.path.contains('/confirm')
                    ? [0, 1]
                    : <int>[],
            'currentStepIndex': options.path.contains('/confirm') ? null : 0,
            'canConfirm': options.path.contains('/confirm'),
            'expiresAt': '2026-05-20T10:00:00.000Z',
            'route': {
              'id': options.path.contains('/confirm') ? 'route-1' : null,
              'title': 'Бар и стендап',
              'durationLabel': '3 часа',
              'totalPriceFrom': 2500,
              'steps': [
                {
                  'title': 'Brix',
                  'place': 'Патрики',
                  'time': '19:00',
                  'ticketUrl': 'https://booking.test/brix',
                },
                {
                  'title': 'Стендап',
                  'place': 'Центр',
                  'time': '21:00',
                },
              ],
            },
          });
        }),
    );

    final created = await repository.createEveningAiDraft(
      prompt: 'Бар и стендап в центре',
      city: 'Москва',
    );
    final fetched = await repository.fetchEveningAiDraft('draft-1');
    final accepted = await repository.acceptEveningAiDraftStep(
      draftId: 'draft-1',
      stepIndex: 0,
    );
    final regenerated = await repository.regenerateEveningAiDraft('draft-1');
    final confirmed = await repository.confirmEveningAiDraft('draft-1');

    expect(requests[0].method, 'POST');
    expect(requests[0].path, '/evening/routes/ai-drafts');
    expect(requests[0].data, {
      'prompt': 'Бар и стендап в центре',
      'city': 'Москва',
    });
    expect(requests[1].method, 'GET');
    expect(requests[1].path, '/evening/routes/ai-drafts/draft-1');
    expect(requests[2].method, 'POST');
    expect(
        requests[2].path, '/evening/routes/ai-drafts/draft-1/steps/0/accept');
    expect(requests[3].method, 'POST');
    expect(requests[3].path, '/evening/routes/ai-drafts/draft-1/regenerate');
    expect(requests[4].method, 'POST');
    expect(requests[4].path, '/evening/routes/ai-drafts/draft-1/confirm');
    expect(created.draftId, 'draft-1');
    expect(fetched.route.title, 'Бар и стендап');
    expect(accepted.acceptedStepIndexes, [0]);
    expect(regenerated.route.steps.length, 2);
    expect(confirmed.canConfirm, true);
    expect(confirmed.route.id, 'route-1');
  });

  test('loads after dark access and events', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          if (options.path == '/after-dark/access') {
            return _jsonResponse(options, {
              'unlocked': true,
              'subscriptionStatus': 'active',
              'ageConfirmed': true,
              'codeAccepted': true,
              'previewCount': 2,
            });
          }
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'ad-1',
                'title': 'Secret dinner',
                'district': 'Патрики',
                'time': '22:00',
                'going': 8,
              },
            ],
          });
        }),
    );

    final access = await repository.fetchAfterDarkAccess();
    final events = await repository.fetchAfterDarkEvents(limit: 10);

    expect(requests.first.path, '/after-dark/access');
    expect(access.unlocked, true);
    expect(access.previewCount, 2);
    expect(requests.last.path, '/after-dark/events');
    expect(requests.last.queryParameters, {'limit': 10});
    expect(events.items.single.id, 'ad-1');
    expect(events.items.single.title, 'Secret dinner');
  });

  test('unlocks after dark with explicit consent', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'unlocked': true,
            'subscriptionStatus': 'active',
            'plan': 'month',
            'ageConfirmed': true,
            'codeAccepted': true,
            'previewCount': 3,
          });
        }),
    );

    final access = await repository.unlockAfterDark(
      plan: 'month',
      ageConfirmed: true,
      codeAccepted: true,
    );

    expect(seen.method, 'POST');
    expect(seen.path, '/after-dark/unlock');
    expect(seen.data, {
      'plan': 'month',
      'ageConfirmed': true,
      'codeAccepted': true,
    });
    expect(access.unlocked, true);
    expect(access.plan, 'month');
  });

  test('loads after dark event detail and joins with rules consent', () async {
    final requests = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          requests.add(options);
          return _jsonResponse(options, {
            'id': 'ad-1',
            'title': 'Secret dinner',
            'description': 'Closed table',
            'district': 'Патрики',
            'time': '22:00',
            'consentRequired': true,
            'joined': options.method == 'POST',
            'chatId': options.method == 'POST' ? 'chat-ad-1' : null,
            'rules': ['18+', 'Без фото'],
            'host': {'displayName': 'Nina'},
          });
        }),
    );

    final detail = await repository.fetchAfterDarkEvent('ad-1');
    final joined = await repository.joinAfterDarkEvent(
      'ad-1',
      acceptedRules: true,
      note: 'Буду к 22:00',
    );

    expect(requests.first.method, 'GET');
    expect(requests.first.path, '/after-dark/events/ad-1');
    expect(detail.id, 'ad-1');
    expect(detail.title, 'Secret dinner');
    expect(requests.last.method, 'POST');
    expect(requests.last.path, '/after-dark/events/ad-1/join');
    expect(requests.last.data, {
      'acceptedRules': true,
      'note': 'Буду к 22:00',
    });
    expect(joined.raw['joined'], true);
    expect(joined.raw['chatId'], 'chat-ad-1');
  });
}

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handle);

  final Future<ResponseBody> Function(RequestOptions options) handle;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    return handle(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonResponse(
  RequestOptions options,
  Map<String, Object?> body,
) {
  return ResponseBody.fromString(
    jsonEncode(body),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

ResponseBody _jsonResponseList(
  RequestOptions options,
  List<Map<String, Object?>> body,
) {
  return ResponseBody.fromString(
    jsonEncode(body),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}
