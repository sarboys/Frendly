import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/device/app_attachment_service.dart';
import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_cache_store.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';
import 'package:mobile2/app/core/local_cache/chat_local_store.dart';
import 'package:mobile2/app/core/local_cache/local_first_repository.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/app/session/session_cleanup_controller.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  late AppLocalDatabase database;
  late AppLocalCacheStore cacheStore;
  late ChatLocalStore chatStore;

  setUp(() {
    database = AppLocalDatabase.forTesting(NativeDatabase.memory());
    cacheStore = AppLocalCacheStore(database);
    chatStore = ChatLocalStore(database);
  });

  tearDown(() async {
    await database.close();
  });

  test('keeps cache entries scoped by user', () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: '/events?limit=10',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': ['a']
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );

    final otherUserHit = await cacheStore.getFreshJson(
      key.copyWith(userScope: AppCacheUserScope.user('u2')),
      now: DateTime.now(),
    );
    final sameUserHit = await cacheStore.getFreshJson(key, now: DateTime.now());

    expect(otherUserHit, isNull);
    expect(sameUserHit, {
      'items': ['a']
    });
  });

  test('returns null for stale cache instead of pretending it is fresh',
      () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: '/events?limit=10',
      userScope: AppCacheUserScope.public(),
    );
    await cacheStore.putJson(
      key,
      {
        'items': ['stale']
      },
      expiresAt: DateTime.now().subtract(const Duration(seconds: 1)),
    );

    final result = await cacheStore.getFreshJson(key, now: DateTime.now());

    expect(result, isNull);
  });

  test('current cache scope follows current user changes', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    expect(container.read(currentCacheScopeProvider).value, 'public');

    container.read(currentUserProvider.notifier).state =
        const BackendUser(id: 'u1', name: 'Alex');

    expect(container.read(currentCacheScopeProvider).value, 'user:u1');
  });

  test('local-first returns warm data and refreshes cache in background',
      () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: 'home?limit=12',
      userScope: AppCacheUserScope.public(),
    );
    await cacheStore.putJson(
      key,
      {'title': 'Cached'},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    var networkCalls = 0;

    final result = await LocalFirstRepository(cacheStore).fetch<String>(
      key: key,
      ttl: const Duration(minutes: 5),
      network: () async {
        networkCalls += 1;
        return {'title': 'Fresh'};
      },
      decode: (json) => json['title']?.toString() ?? '',
    );

    expect(result, 'Cached');
    await Future<void>.delayed(Duration.zero);
    expect(networkCalls, 1);
    expect(
      await cacheStore.getFreshJson(key, now: DateTime.now()),
      {'title': 'Fresh'},
    );
  });

  test('local-first deduplicates repeated background refreshes', () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: 'home?limit=12',
      userScope: AppCacheUserScope.public(),
    );
    await cacheStore.putJson(
      key,
      {'title': 'Cached'},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    var networkCalls = 0;
    final releaseRefresh = Completer<void>();
    final repository = LocalFirstRepository(cacheStore);

    Future<String> fetch() {
      return repository.fetch<String>(
        key: key,
        ttl: const Duration(minutes: 5),
        network: () async {
          networkCalls += 1;
          await releaseRefresh.future;
          return {'title': 'Fresh'};
        },
        decode: (json) => json['title']?.toString() ?? '',
      );
    }

    final first = await fetch();
    final second = await fetch();

    expect(first, 'Cached');
    expect(second, 'Cached');
    expect(networkCalls, 1);

    releaseRefresh.complete();
    await Future<void>.delayed(Duration.zero);
  });

  test('local-first stream emits warm data and then refreshed cache', () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: 'home?limit=12',
      userScope: AppCacheUserScope.public(),
    );
    await cacheStore.putJson(
      key,
      {'title': 'Cached'},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = LocalFirstRepository(cacheStore);

    final stream = repository.watch<String>(
      key: key,
      ttl: const Duration(minutes: 5),
      network: () async => {'title': 'Fresh'},
      decode: (json) => json['title']?.toString() ?? '',
    );

    await expectLater(stream.take(2), emitsInOrder(['Cached', 'Fresh']));
  });

  test('matches provider emits warm cache and refreshed data', () async {
    final key = AppCacheKey(
      namespace: 'matches',
      value: 'list?limit=10',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'cached-match', 'title': 'Cached match'},
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {'id': 'fresh-match', 'title': 'Fresh match'},
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final titles = <String>[];
    final done = Completer<List<String>>();
    final subscription = container.listen(
      matchesProvider,
      (_, next) {
        final items = next.valueOrNull?.items;
        if (items == null || items.isEmpty) {
          return;
        }
        titles.add(items.first.title);
        if (titles.length == 2 && !done.isCompleted) {
          done.complete(List<String>.of(titles));
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await expectLater(
      done.future.timeout(const Duration(milliseconds: 300)),
      completion(['Cached match', 'Fresh match']),
    );
  });

  test('event stories provider emits warm cache and refreshed data', () async {
    final key = AppCacheKey(
      namespace: 'stories',
      value: 'event:event-1?limit=20',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'story-cached', 'caption': 'Cached story'},
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {'id': 'story-fresh', 'caption': 'Fresh story'},
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final titles = <String>[];
    final done = Completer<List<String>>();
    final subscription = container.listen(
      eventStoriesProvider('event-1'),
      (_, next) {
        final items = next.valueOrNull?.items;
        if (items == null || items.isEmpty) {
          return;
        }
        titles.add(items.first.title);
        if (titles.length == 2 && !done.isCompleted) {
          done.complete(List<String>.of(titles));
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await expectLater(
      done.future.timeout(const Duration(milliseconds: 300)),
      completion(['Cached story', 'Fresh story']),
    );
  });

  test('community media provider emits warm cache and refreshed data',
      () async {
    final key = AppCacheKey(
      namespace: 'communities',
      value: 'media:community-1?limit=20',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'media-cached', 'title': 'Cached media'},
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {'id': 'media-fresh', 'title': 'Fresh media'},
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final titles = <String>[];
    final done = Completer<List<String>>();
    final subscription = container.listen(
      communityMediaProvider('community-1'),
      (_, next) {
        final items = next.valueOrNull?.items;
        if (items == null || items.isEmpty) {
          return;
        }
        titles.add(items.first.title);
        if (titles.length == 2 && !done.isCompleted) {
          done.complete(List<String>.of(titles));
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await expectLater(
      done.future.timeout(const Duration(milliseconds: 300)),
      completion(['Cached media', 'Fresh media']),
    );
  });

  test('meeting detail provider returns warm cache and refreshes detail',
      () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: 'detail:event-1',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {'id': 'event-1', 'title': 'Cached meeting'},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'event-1',
            'title': 'Fresh meeting',
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      meetingDetailProvider('event-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);

    final first = await container.read(meetingDetailProvider('event-1').future);

    expect(first.title, 'Cached meeting');
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => json['title'] == 'Fresh meeting',
    );
    expect(refreshed?['title'], 'Fresh meeting');
  });

  test('poster detail provider returns warm cache and refreshes detail',
      () async {
    final key = AppCacheKey(
      namespace: 'affiche',
      value: 'detail:poster-1',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {'id': 'poster-1', 'title': 'Cached poster'},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'poster-1',
            'title': 'Fresh poster',
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      posterDetailProvider('poster-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);

    final first = await container.read(posterDetailProvider('poster-1').future);

    expect(first.title, 'Cached poster');
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => json['title'] == 'Fresh poster',
    );
    expect(refreshed?['title'], 'Fresh poster');
  });

  test('meeting detail provider errors when stale detail refresh fails',
      () async {
    final key = AppCacheKey(
      namespace: 'events',
      value: 'detail:event-1',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {'id': 'event-1', 'title': 'Stale meeting'},
      expiresAt: DateTime.now().subtract(const Duration(seconds: 1)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
            error: 'offline',
          );
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      meetingDetailProvider('event-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);

    await expectLater(
      container.read(meetingDetailProvider('event-1').future),
      throwsA(
        isA<DioException>().having((error) => error.error, 'error', 'offline'),
      ),
    );
  });

  test('meetings list cache key includes city, filters and limit', () async {
    const query = EventListQuery(
      city: 'Москва',
      filter: 'nearby',
      lifestyle: 'coffee',
      access: 'request',
      limit: 12,
    );
    final key = AppCacheKey(
      namespace: 'events',
      value: 'meetings?${query.cacheValue(resolvedCity: 'Москва')}',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'cached-event', 'title': 'Cached event'},
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final seen = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen.add(options);
          return _jsonResponse(options, {
            'items': [
              {'id': 'fresh-event', 'title': 'Fresh event'},
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription =
        container.listen(meetingsQueryProvider(query), (_, __) {});
    addTearDown(subscription.close);

    final first = await container.read(meetingsQueryProvider(query).future);

    expect(first.items.single.id, 'cached-event');
    await _waitForValue(() => seen.any((options) => options.path == '/events'));
    final request = seen.firstWhere((options) => options.path == '/events');
    expect(request.queryParameters['city'], 'Москва');
    expect(request.queryParameters['filter'], 'nearby');
    expect(request.queryParameters['lifestyle'], 'coffee');
    expect(request.queryParameters['access'], 'request');
    expect(request.queryParameters['limit'], 12);
  });

  test('meetings list keeps warm items while refresh is pending', () async {
    const query = EventListQuery(limit: 20);
    final key = AppCacheKey(
      namespace: 'events',
      value: 'meetings?${query.cacheValue()}',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'cached-event', 'title': 'Cached event'},
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final releaseRefresh = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          await releaseRefresh.future;
          return _jsonResponse(options, {
            'items': [
              {'id': 'fresh-event', 'title': 'Fresh event'},
            ],
          });
        }),
    );
    addTearDown(() {
      if (!releaseRefresh.isCompleted) {
        releaseRefresh.complete();
      }
    });
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final pages = <CardPage>[];
    final freshPage = Completer<CardPage>();
    final subscription = container.listen(
      meetingsQueryProvider(query),
      (_, next) {
        final page = next.valueOrNull;
        if (page == null) {
          return;
        }
        pages.add(page);
        if (page.items.any((item) => item.id == 'fresh-event') &&
            !freshPage.isCompleted) {
          freshPage.complete(page);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    expect(pages.single.items.single.id, 'cached-event');

    releaseRefresh.complete();
    final refreshed = await freshPage.future.timeout(
      const Duration(milliseconds: 500),
    );

    expect(refreshed.items.single.id, 'fresh-event');
  });

  test('meeting join and leave invalidate detail and meeting lists', () async {
    var detailCalls = 0;
    var eventListCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' &&
              options.path == '/events/event-1/join') {
            return _jsonResponse(options, {
              'id': 'event-1',
              'title': 'Joined meeting',
              'joined': true,
            });
          }
          if (options.method == 'DELETE' &&
              options.path == '/events/event-1/join') {
            return _jsonResponse(options, {
              'id': 'event-1',
              'title': 'Left meeting',
              'joined': false,
            });
          }
          if (options.method == 'GET' && options.path == '/events/event-1') {
            detailCalls += 1;
            return _jsonResponse(options, {
              'id': 'event-1',
              'title': 'Meeting $detailCalls',
            });
          }
          if (options.method == 'GET' && options.path == '/events') {
            eventListCalls += 1;
            return _jsonResponse(options, {'items': <Object?>[]});
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final detailSubscription =
        container.listen(meetingDetailProvider('event-1'), (_, __) {});
    final homeSubscription = container.listen(homeEventsProvider, (_, __) {});
    final meetingsSubscription = container.listen(meetingsProvider, (_, __) {});
    addTearDown(detailSubscription.close);
    addTearDown(homeSubscription.close);
    addTearDown(meetingsSubscription.close);

    await container.read(meetingDetailProvider('event-1').future);
    await container.read(homeEventsProvider.future);
    await container.read(meetingsProvider.future);
    final initialDetailCalls = detailCalls;
    final initialEventListCalls = eventListCalls;

    await container.read(meetingActionsProvider).setJoined(
          eventId: 'event-1',
          joined: true,
        );
    await _waitForValue(
      () =>
          detailCalls >= initialDetailCalls + 1 &&
          eventListCalls >= initialEventListCalls + 2,
    );
    final afterJoinDetailCalls = detailCalls;
    final afterJoinEventListCalls = eventListCalls;

    await container.read(meetingActionsProvider).setJoined(
          eventId: 'event-1',
          joined: false,
        );
    await _waitForValue(
      () =>
          detailCalls >= afterJoinDetailCalls + 1 &&
          eventListCalls >= afterJoinEventListCalls + 2,
    );

    expect(detailCalls, greaterThanOrEqualTo(initialDetailCalls + 2));
    expect(eventListCalls, greaterThanOrEqualTo(initialEventListCalls + 4));
  });

  test('community join updates cached detail and list', () async {
    final scope = AppCacheUserScope.user('u1');
    final detailKey = AppCacheKey(
      namespace: 'communities',
      value: 'detail:community-1',
      userScope: scope,
    );
    final listKey = AppCacheKey(
      namespace: 'communities',
      value: 'list?limit=20',
      userScope: scope,
    );
    await cacheStore.putJson(
      detailKey,
      {
        'id': 'community-1',
        'name': 'Wine Club',
        'joined': false,
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    await cacheStore.putJson(
      listKey,
      {
        'items': [
          {
            'id': 'community-1',
            'name': 'Wine Club',
            'joined': false,
          },
          {
            'id': 'community-2',
            'name': 'Book Club',
            'joined': false,
          },
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'community-1',
            'name': 'Wine Club',
            'joined': true,
            'joinedCount': 12,
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(communityActionsProvider).setJoined(
          communityId: 'community-1',
          joined: true,
        );

    final cachedDetail = await cacheStore.getFreshJson(
      detailKey,
      now: DateTime.now(),
    );
    final cachedList = await cacheStore.getFreshJson(
      listKey,
      now: DateTime.now(),
    );
    final cachedItems = _cachedItems(cachedList);

    expect(cachedDetail?['joined'], isTrue);
    expect(cachedDetail?['joinedCount'], 12);
    expect(cachedItems, hasLength(2));
    expect(cachedItems.first['joined'], isTrue);
    expect(cachedItems.first['joinedCount'], 12);
    expect(cachedItems.last['joined'], isFalse);
  });

  test('community media pagination loads next page by cursor', () async {
    final seen = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen.add(options);
          return _jsonResponse(options, {
            'items': [
              {'id': 'media-next', 'title': 'Next media'},
            ],
            'nextCursor': 'cursor-2',
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      communityMediaPaginationProvider('community-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);

    final controller = container.read(
      communityMediaPaginationProvider('community-1').notifier,
    );
    controller.primeNextCursor('cursor-1');
    await controller.loadNextPage();

    final state = container.read(
      communityMediaPaginationProvider('community-1'),
    );

    expect(seen.single.path, '/communities/community-1/media');
    expect(seen.single.queryParameters, {
      'limit': 20,
      'cursor': 'cursor-1',
    });
    expect(state.items.single.id, 'media-next');
    expect(state.nextCursor, 'cursor-2');
    expect(state.loading, isFalse);
    expect(state.error, isFalse);
  });

  test('communities pagination loads next page by cursor', () async {
    final seen = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen.add(options);
          return _jsonResponse(options, {
            'items': [
              {'id': 'community-next', 'name': 'Next community'},
            ],
            'nextCursor': 'cursor-2',
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      communitiesPaginationProvider,
      (_, __) {},
    );
    addTearDown(subscription.close);

    final controller = container.read(communitiesPaginationProvider.notifier);
    controller.primeNextCursor('cursor-1');
    await controller.loadNextPage();

    final state = container.read(communitiesPaginationProvider);

    expect(seen.single.path, '/communities');
    expect(seen.single.queryParameters, {
      'limit': 20,
      'cursor': 'cursor-1',
    });
    expect(state.items.single.id, 'community-next');
    expect(state.nextCursor, 'cursor-2');
    expect(state.loading, isFalse);
    expect(state.error, isFalse);
  });

  test('community create prepends cached list for current user', () async {
    final scope = AppCacheUserScope.user('u1');
    final listKey = AppCacheKey(
      namespace: 'communities',
      value: 'list?limit=20',
      userScope: scope,
    );
    await cacheStore.putJson(
      listKey,
      {
        'items': [
          {
            'id': 'community-old',
            'name': 'Old club',
          },
        ],
        'nextCursor': 'cursor-1',
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'community-new',
            'name': 'New club',
            'joined': true,
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(communityActionsProvider).createCommunity(
      data: const {
        'name': 'New club',
        'privacy': 'public',
      },
      idempotencyKey: 'community-create-1',
    );

    final cached = await cacheStore.getFreshJson(listKey, now: DateTime.now());
    final items = _cachedItems(cached);

    expect(items, hasLength(2));
    expect(items.first['id'], 'community-new');
    expect(items.first['joined'], isTrue);
    expect(items.last['id'], 'community-old');
    expect(cached?['nextCursor'], 'cursor-1');
  });

  test('community news create updates cached detail', () async {
    final scope = AppCacheUserScope.user('u1');
    final detailKey = AppCacheKey(
      namespace: 'communities',
      value: 'detail:community-1',
      userScope: scope,
    );
    await cacheStore.putJson(
      detailKey,
      {
        'id': 'community-1',
        'name': 'Wine Club',
        'news': [
          {
            'id': 'news-old',
            'title': 'Old news',
          },
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'community-1',
            'name': 'Wine Club',
            'news': [
              {
                'id': 'news-new',
                'title': 'Fresh news',
                'body': 'Starts at 20:00',
              },
              {
                'id': 'news-old',
                'title': 'Old news',
              },
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(communityActionsProvider).createNews(
          communityId: 'community-1',
          title: 'Fresh news',
          body: 'Starts at 20:00',
        );

    final cached = await cacheStore.getFreshJson(
      detailKey,
      now: DateTime.now(),
    );
    final news = _cachedItems({'items': cached?['news']});

    expect(news, hasLength(2));
    expect(news.first['id'], 'news-new');
    expect(news.first['title'], 'Fresh news');
  });

  test('meeting create clears events cache namespace for current user',
      () async {
    final scope = AppCacheUserScope.user('u1');
    final homeKey = AppCacheKey(
      namespace: 'events',
      value: 'home?limit=6',
      userScope: scope,
    );
    final meetingsKey = AppCacheKey(
      namespace: 'events',
      value: 'meetings?limit=20',
      userScope: scope,
    );
    await cacheStore.putJson(
      homeKey,
      {
        'items': ['cached-home']
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    await cacheStore.putJson(
      meetingsKey,
      {
        'items': ['cached-meetings']
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' && options.path == '/events') {
            return _jsonResponse(options, {
              'id': 'event-created',
              'title': 'Created meeting',
            });
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        homeEventsProvider.overrideWith(
          (ref) => Stream.value(const BackendPage<BackendCardItem>(items: [])),
        ),
        homeEventsQueryProvider.overrideWith(
          (ref, query) =>
              Stream.value(const BackendPage<BackendCardItem>(items: [])),
        ),
        meetingsProvider.overrideWith(
          (ref) => Stream.value(const BackendPage<BackendCardItem>(items: [])),
        ),
        meetingsQueryProvider.overrideWith(
          (ref, query) =>
              Stream.value(const BackendPage<BackendCardItem>(items: [])),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(meetingActionsProvider).createEvent(
      idempotencyKey: 'create-1',
      data: const {
        'title': 'Created meeting',
        'description': 'Description',
        'place': 'Duo',
      },
    );

    expect(await cacheStore.getFreshJson(homeKey, now: DateTime.now()), isNull);
    expect(
      await cacheStore.getFreshJson(meetingsKey, now: DateTime.now()),
      isNull,
    );
  });

  test('meeting create invalidates home and meetings providers', () async {
    var listCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' && options.path == '/events') {
            return _jsonResponse(options, {
              'id': 'event-created',
              'title': 'Created meeting',
            });
          }
          if (options.method == 'GET' && options.path == '/events') {
            listCalls += 1;
            return _jsonResponse(options, {
              'items': [
                {'id': 'event-$listCalls', 'title': 'Meeting $listCalls'},
              ],
            });
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
      ],
    );
    addTearDown(container.dispose);
    final homeSubscription = container.listen(
      homeEventsProvider,
      (_, __) {},
    );
    final meetingsSubscription = container.listen(
      meetingsProvider,
      (_, __) {},
    );
    addTearDown(homeSubscription.close);
    addTearDown(meetingsSubscription.close);

    await container.read(homeEventsProvider.future);
    await container.read(meetingsProvider.future);
    expect(listCalls, 2);

    await container.read(meetingActionsProvider).createEvent(
      idempotencyKey: 'create-1',
      data: const {
        'title': 'Created meeting',
        'description': 'Description',
        'place': 'Duo',
      },
    );
    await _waitForValue(() => listCalls >= 4);

    expect(listCalls, greaterThanOrEqualTo(4));
  });

  test('wallet provider returns warm cache and refreshes balance', () async {
    final key = AppCacheKey(
      namespace: 'wallet',
      value: 'tokens',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {'balance': 7, 'history': <Object?>[]},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'balance': 11,
            'history': <Object?>[],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      tokenWalletProvider,
      (_, __) {},
    );
    addTearDown(subscription.close);

    final first = await container.read(tokenWalletProvider.future);

    expect(first.balance, 7);
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => json['balance'] == 11,
    );
    expect(refreshed?['balance'], 11);
  });

  test('payment return invalidates wallet, catalog and subscription providers',
      () async {
    var walletCalls = 0;
    var catalogCalls = 0;
    var subscriptionCalls = 0;
    var planCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/tokens/wallet') {
            walletCalls += 1;
            return _jsonResponse(options, {
              'balance': walletCalls,
              'history': <Object?>[],
            });
          }
          if (options.path == '/payments/catalog') {
            catalogCalls += 1;
            return _jsonResponse(options, {
              'tbankEnabled': true,
              'tokenPacks': <Object?>[],
              'subscriptions': <Object?>[],
            });
          }
          if (options.path == '/subscription/me') {
            subscriptionCalls += 1;
            return _jsonResponse(options, {
              'status': subscriptionCalls == 1 ? 'inactive' : 'active',
              'plan': subscriptionCalls == 1 ? null : 'month',
            });
          }
          if (options.path == '/subscription/plans') {
            planCalls += 1;
            return _jsonResponse(options, {
              'plans': [
                {
                  'id': 'month',
                  'label': 'Месячный',
                  'tokenCost': 799 + planCalls,
                },
              ],
            });
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final walletSubscription = container.listen(tokenWalletProvider, (_, __) {});
    final catalogSubscription =
        container.listen(paymentsCatalogProvider, (_, __) {});
    final subscriptionSubscription =
        container.listen(subscriptionProvider, (_, __) {});
    final plansSubscription =
        container.listen(subscriptionPlansProvider, (_, __) {});
    addTearDown(walletSubscription.close);
    addTearDown(catalogSubscription.close);
    addTearDown(subscriptionSubscription.close);
    addTearDown(plansSubscription.close);

    await container.read(tokenWalletProvider.future);
    await container.read(paymentsCatalogProvider.future);
    await container.read(subscriptionProvider.future);
    await container.read(subscriptionPlansProvider.future);

    container.read(paymentActionsProvider).handlePaymentReturn();
    await _waitForValue(
      () =>
          walletCalls >= 2 &&
          catalogCalls >= 2 &&
          subscriptionCalls >= 2 &&
          planCalls >= 2,
    );

    expect(walletCalls, greaterThanOrEqualTo(2));
    expect(catalogCalls, greaterThanOrEqualTo(2));
    expect(subscriptionCalls, greaterThanOrEqualTo(2));
    expect(planCalls, greaterThanOrEqualTo(2));
  });

  test('subscribe with tokens invalidates wallet and subscription providers',
      () async {
    var walletCalls = 0;
    var subscriptionCalls = 0;
    var subscribeCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'GET' && options.path == '/tokens/wallet') {
            walletCalls += 1;
            return _jsonResponse(options, {
              'balance': 900 - walletCalls,
              'history': <Object?>[],
            });
          }
          if (options.method == 'GET' && options.path == '/subscription/me') {
            subscriptionCalls += 1;
            return _jsonResponse(options, {
              'status': subscriptionCalls == 1 ? 'inactive' : 'active',
              'plan': subscriptionCalls == 1 ? null : 'month',
            });
          }
          if (options.method == 'POST' &&
              options.path == '/subscription/subscribe') {
            subscribeCalls += 1;
            return _jsonResponse(options, {
              'status': 'active',
              'plan': 'month',
            });
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final walletSubscription = container.listen(tokenWalletProvider, (_, __) {});
    final subscriptionSubscription =
        container.listen(subscriptionProvider, (_, __) {});
    addTearDown(walletSubscription.close);
    addTearDown(subscriptionSubscription.close);

    await container.read(tokenWalletProvider.future);
    await container.read(subscriptionProvider.future);

    final subscription =
        await container.read(paymentActionsProvider).subscribeWithTokens(
              'month',
            );
    await _waitForValue(() => walletCalls >= 2 && subscriptionCalls >= 2);

    expect(subscription.status, 'active');
    expect(subscribeCalls, 1);
    expect(walletCalls, greaterThanOrEqualTo(2));
    expect(subscriptionCalls, greaterThanOrEqualTo(2));
  });

  test('frendly season provider returns warm cache and refreshes state',
      () async {
    final key = AppCacheKey(
      namespace: 'profile',
      value: 'frendly-season',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'seasonKey': '2026-05',
        'seasonLabel': 'Май',
        'checkedInCount': 1,
        'calendarDays': [1],
        'rewards': <Object?>[],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'seasonKey': '2026-05',
            'seasonLabel': 'Май',
            'checkedInCount': 3,
            'calendarDays': [1, 2, 3],
            'rewards': <Object?>[],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(frendlySeasonProvider, (_, __) {});
    addTearDown(subscription.close);

    final season = await container.read(frendlySeasonProvider.future);

    expect(season.checkedInCount, 1);
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => json['checkedInCount'] == 3,
    );
    expect(refreshed?['calendarDays'], [1, 2, 3]);
  });

  test('claiming frendly season reward invalidates season and wallet',
      () async {
    var seasonCalls = 0;
    var walletCalls = 0;
    var claimCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'GET' &&
              options.path == '/profile/me/frendly-season') {
            seasonCalls += 1;
            return _jsonResponse(options, {
              'seasonKey': '2026-05',
              'seasonLabel': 'Май',
              'checkedInCount': seasonCalls,
              'calendarDays': [1],
              'rewards': [
                {
                  'key': 'checkin-1',
                  'threshold': 1,
                  'title': 'Первый check-in',
                  'description': '50 FT',
                  'rewardKind': 'tokens',
                  'rewardAmount': 50,
                  'unlocked': true,
                  'claimed': seasonCalls > 1,
                },
              ],
            });
          }
          if (options.method == 'GET' && options.path == '/tokens/wallet') {
            walletCalls += 1;
            return _jsonResponse(options, {
              'balance': 100 + walletCalls,
              'history': <Object?>[],
            });
          }
          if (options.method == 'POST' &&
              options.path ==
                  '/profile/me/frendly-season/rewards/checkin-1/claim') {
            claimCalls += 1;
            return _jsonResponse(options, {'claimed': true});
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final seasonSubscription =
        container.listen(frendlySeasonProvider, (_, __) {});
    final walletSubscription = container.listen(tokenWalletProvider, (_, __) {});
    addTearDown(seasonSubscription.close);
    addTearDown(walletSubscription.close);

    await container.read(frendlySeasonProvider.future);
    await container.read(tokenWalletProvider.future);

    await container.read(frendlySeasonActionsProvider).claimReward('checkin-1');
    await _waitForValue(() => seasonCalls >= 2 && walletCalls >= 2);

    expect(claimCalls, 1);
    expect(seasonCalls, greaterThanOrEqualTo(2));
    expect(walletCalls, greaterThanOrEqualTo(2));
  });

  test('profile history provider emits warm cache and refreshed data',
      () async {
    final key = AppCacheKey(
      namespace: 'profile',
      value: 'frendly-history?limit=20',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'history-cached', 'title': 'Cached check-in'}
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {'id': 'history-fresh', 'title': 'Fresh check-in'}
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(profileHistoryProvider, (_, __) {});
    addTearDown(subscription.close);

    final first = await container.read(profileHistoryProvider.future);

    expect(first.items.single.id, 'history-cached');
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => ((json['items'] as List<Object?>?)?.first
              as Map<String, Object?>?)?['id'] ==
          'history-fresh',
    );
    expect(refreshed?['items'], [
      {'id': 'history-fresh', 'title': 'Fresh check-in'}
    ]);
  });

  test('memory people provider emits warm cache and refreshed data', () async {
    final key = AppCacheKey(
      namespace: 'profile',
      value: 'frendly-people?limit=20',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'person-cached', 'title': 'Cached person'}
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {'id': 'person-fresh', 'title': 'Fresh person'}
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(memoryPeopleProvider, (_, __) {});
    addTearDown(subscription.close);

    final first = await container.read(memoryPeopleProvider.future);

    expect(first.items.single.id, 'person-cached');
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => ((json['items'] as List<Object?>?)?.first
              as Map<String, Object?>?)?['id'] ==
          'person-fresh',
    );
    expect(refreshed?['items'], [
      {'id': 'person-fresh', 'title': 'Fresh person'}
    ]);
  });

  test('evening ai draft provider returns warm cache and refreshes draft',
      () async {
    final key = AppCacheKey(
      namespace: 'evening-ai-drafts',
      value: 'draft-1',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'draftId': 'draft-1',
        'acceptedStepIndexes': <int>[],
        'currentStepIndex': 0,
        'canConfirm': false,
        'route': {
          'title': 'Cached route',
          'steps': [
            {'title': 'Cached place'}
          ],
        },
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'draftId': 'draft-1',
            'acceptedStepIndexes': [0],
            'currentStepIndex': 1,
            'canConfirm': true,
            'route': {
              'title': 'Fresh route',
              'steps': [
                {'title': 'Fresh place'}
              ],
            },
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription =
        container.listen(eveningAiDraftProvider('draft-1'), (_, __) {});
    addTearDown(subscription.close);

    final draft = await container.read(eveningAiDraftProvider('draft-1').future);

    expect(draft.route.title, 'Cached route');
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => (json['route'] as Map<String, Object?>?)?['title'] ==
          'Fresh route',
    );
    expect((refreshed?['route'] as Map<String, Object?>?)?['title'],
        'Fresh route');
  });

  test('evening ai draft actions invalidate visible draft provider', () async {
    var detailCalls = 0;
    var acceptCalls = 0;
    var regenerateCalls = 0;
    var confirmCalls = 0;
    Map<String, Object?> draftJson() {
      return {
        'draftId': 'draft-1',
        'acceptedStepIndexes': acceptCalls > 0 ? [0] : <int>[],
        'currentStepIndex': confirmCalls > 0 ? null : 0,
        'canConfirm': confirmCalls > 0,
        'route': {
          'title': regenerateCalls > 0 ? 'Regenerated route' : 'Draft route',
          'steps': [
            {'title': 'First place'}
          ],
        },
      };
    }

    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'GET' &&
              options.path == '/evening/routes/ai-drafts/draft-1') {
            detailCalls += 1;
            return _jsonResponse(options, draftJson());
          }
          if (options.method == 'POST' &&
              options.path ==
                  '/evening/routes/ai-drafts/draft-1/steps/0/accept') {
            acceptCalls += 1;
            return _jsonResponse(options, draftJson());
          }
          if (options.method == 'POST' &&
              options.path == '/evening/routes/ai-drafts/draft-1/regenerate') {
            regenerateCalls += 1;
            return _jsonResponse(options, draftJson());
          }
          if (options.method == 'POST' &&
              options.path == '/evening/routes/ai-drafts/draft-1/confirm') {
            confirmCalls += 1;
            return _jsonResponse(options, draftJson());
          }
          return _jsonResponse(options, {'ok': true});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription =
        container.listen(eveningAiDraftProvider('draft-1'), (_, __) {});
    addTearDown(subscription.close);

    await container.read(eveningAiDraftProvider('draft-1').future);
    await container.read(eveningAiActionsProvider).acceptStep(
          draftId: 'draft-1',
          stepIndex: 0,
        );
    await _waitForValue(() => detailCalls >= 2);
    await container.read(eveningAiActionsProvider).regenerate('draft-1');
    await _waitForValue(() => detailCalls >= 3);
    await container.read(eveningAiActionsProvider).confirm('draft-1');
    await _waitForValue(() => detailCalls >= 4);

    expect(acceptCalls, 1);
    expect(regenerateCalls, 1);
    expect(confirmCalls, 1);
    expect(detailCalls, greaterThanOrEqualTo(4));
  });

  test('safety provider returns warm cache and refreshes state', () async {
    final key = AppCacheKey(
      namespace: 'safety',
      value: 'me',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'trustScore': 60,
        'settings': {'autoSharePlans': false},
        'trustedContacts': <Object?>[],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'trustScore': 74,
            'settings': {'autoSharePlans': true},
            'trustedContacts': <Object?>[],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      safetyProvider,
      (_, __) {},
    );
    addTearDown(subscription.close);

    final first = await container.read(safetyProvider.future);

    expect(first.trustScore, 60);
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) => json['trustScore'] == 74,
    );
    expect(refreshed?['trustScore'], 74);
  });

  test('reports provider returns warm cache and refreshes reports', () async {
    final key = AppCacheKey(
      namespace: 'reports',
      value: 'me',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'items': [
          {'id': 'report-cached', 'targetUserId': 'u2', 'reason': 'spam'},
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponseList(options, [
            {'id': 'report-fresh', 'targetUserId': 'u3', 'reason': 'abuse'},
          ]);
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      reportsProvider,
      (_, __) {},
    );
    addTearDown(subscription.close);

    final first = await container.read(reportsProvider.future);

    expect(first.items.single.id, 'report-cached');
    final refreshed = await _waitForCacheJson(
      cacheStore,
      key,
      (json) {
        final items = _cachedItems(json);
        return items.isNotEmpty && items.first['id'] == 'report-fresh';
      },
    );
    expect(_cachedItems(refreshed).single['id'], 'report-fresh');
  });

  test('profile actions clear stale profile cache after saving edits',
      () async {
    final key = AppCacheKey(
      namespace: 'profile',
      value: 'me',
      userScope: AppCacheUserScope.user('u1'),
    );
    await cacheStore.putJson(
      key,
      {
        'id': 'u1',
        'displayName': 'Old name',
        'bio': 'Old bio',
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = _ProfileEditRepository();
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Old name');
        }),
      ],
    );
    addTearDown(container.dispose);

    final cached = await container.read(ownProfileProvider.future);
    expect(cached.title, 'Old name');

    await container.read(profileActionsProvider).updateProfileAndInterests(
      profileData: {
        'displayName': 'New name',
        'bio': 'New bio',
      },
      interests: ['Кофе'],
    );

    final refreshed = await container.read(ownProfileProvider.future);
    expect(refreshed.title, 'New name');
    expect(refreshed.raw['interests'], ['Кофе']);
    expect(repository.profileUpdates.single['displayName'], 'New name');
    expect(repository.savedOnboarding.single.interests, ['Кофе']);
  });

  test('private user providers do not request backend without tokens',
      () async {
    var networkCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          networkCalls += 1;
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
      ],
    );
    addTearDown(container.dispose);

    final matches = await container.read(matchesProvider.future);
    final afterDarkEvents =
        await container.read(afterDarkEventsProvider.future);
    final trustedContacts =
        await container.read(trustedContactsProvider.future);
    final subscription = await container.read(subscriptionProvider.future);
    final verification = await container.read(verificationProvider.future);
    final afterDarkAccess =
        await container.read(afterDarkAccessProvider.future);
    final safety = await container.read(safetyProvider.future);
    final reports = await container.read(reportsProvider.future);
    final blocks = await container.read(blocksProvider.future);
    final search = await container.read(searchResultsProvider('coffee').future);

    expect(matches.items, isEmpty);
    expect(afterDarkEvents.items, isEmpty);
    expect(trustedContacts.items, isEmpty);
    expect(subscription.status, 'inactive');
    expect(verification.status, 'not_started');
    expect(afterDarkAccess.unlocked, false);
    expect(safety.trustScore, 0);
    expect(reports.items, isEmpty);
    expect(blocks.items, isEmpty);
    expect(search.items, isEmpty);
    expect(networkCalls, 0);
  });

  test('deletes a single cache key without clearing the user scope', () async {
    final scope = AppCacheUserScope.user('u1');
    final keepKey = AppCacheKey(
      namespace: 'events',
      value: 'home?limit=12',
      userScope: scope,
    );
    final dropKey = AppCacheKey(
      namespace: 'notifications',
      value: 'list?limit=30',
      userScope: scope,
    );
    await cacheStore.putJson(
      keepKey,
      {
        'items': ['event']
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    await cacheStore.putJson(
      dropKey,
      {
        'items': ['notification']
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );

    await cacheStore.deleteKey(dropKey);

    expect(
      await cacheStore.getFreshJson(dropKey, now: DateTime.now()),
      isNull,
    );
    expect(
      await cacheStore.getFreshJson(keepKey, now: DateTime.now()),
      {
        'items': ['event']
      },
    );
  });

  test('notifications provider reads warm data from local cache', () async {
    var networkCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          networkCalls += 1;
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'n1',
                'title': 'Match',
                'body': 'You have a new match',
                'createdAt': '2026-05-19T09:00:00.000Z',
              },
            ],
          });
        }),
    );
    ProviderContainer createContainer() => ProviderContainer(
          overrides: [
            backendRepositoryProvider.overrideWithValue(repository),
            appLocalCacheStoreProvider.overrideWithValue(cacheStore),
            initialAuthTokensProvider.overrideWithValue(
              const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
            ),
            currentUserProvider.overrideWith((ref) {
              return const BackendUser(id: 'u1', name: 'Alex');
            }),
          ],
        );

    final coldContainer = createContainer();
    final coldSubscription = coldContainer.listen(
      notificationsProvider,
      (_, __) {},
    );
    final first = await coldContainer.read(notificationsProvider.future);
    coldSubscription.close();
    coldContainer.dispose();

    final warmContainer = createContainer();
    addTearDown(warmContainer.dispose);
    final warmSubscription = warmContainer.listen(
      notificationsProvider,
      (_, __) {},
    );
    addTearDown(warmSubscription.close);
    final second = await warmContainer.read(notificationsProvider.future);

    expect(first.items.single.id, 'n1');
    expect(second.items.single.id, 'n1');
    await Future<void>.delayed(const Duration(milliseconds: 20));

    expect(networkCalls, 2);
  });

  test('notification unread count provider reads warm data from local cache',
      () async {
    var networkCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          networkCalls += 1;
          return _jsonResponse(options, {'unreadCount': 5});
        }),
    );
    await cacheStore.putJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'unread-count',
        userScope: AppCacheUserScope.user('u1'),
      ),
      {'unreadCount': 3},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final count = await container.read(notificationUnreadCountProvider.future);

    expect(count, 3);
    expect(networkCalls, 0);
  });

  test('marking one notification read updates local list and unread count',
      () async {
    var readCalls = 0;
    var notificationCalls = 0;
    var unreadCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' &&
              options.path == '/notifications/n1/read') {
            readCalls += 1;
            return _jsonResponse(options, {
              'notificationId': 'n1',
              'read': true,
            });
          }
          if (options.method == 'GET' && options.path == '/notifications') {
            notificationCalls += 1;
            return _jsonResponse(options, {
              'items': [
                {
                  'id': 'n1',
                  'title': 'Invite',
                  'body': 'Join us',
                  'read': false,
                },
                {
                  'id': 'n2',
                  'title': 'System',
                  'body': 'Already read',
                  'read': true,
                },
              ],
            });
          }
          if (options.method == 'GET' &&
              options.path == '/notifications/unread-count') {
            unreadCalls += 1;
            return _jsonResponse(options, {'unreadCount': 2});
          }
          return _jsonResponse(options, {'ok': true});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final notificationsSubscription =
        container.listen(notificationsProvider, (_, __) {});
    final unreadSubscription =
        container.listen(notificationUnreadCountProvider, (_, __) {});
    addTearDown(notificationsSubscription.close);
    addTearDown(unreadSubscription.close);

    await container.read(notificationsProvider.future);
    await container.read(notificationUnreadCountProvider.future);
    expect(notificationCalls, 1);
    expect(unreadCalls, 1);

    await container.read(notificationsActionsProvider).markRead('n1');

    final userScope = AppCacheUserScope.user('u1');
    final cachedNotifications = await cacheStore.getFreshJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'list?limit=30',
        userScope: userScope,
      ),
      now: DateTime.now(),
    );
    final cachedUnread = await cacheStore.getFreshJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'unread-count',
        userScope: userScope,
      ),
      now: DateTime.now(),
    );
    final items = cachedNotifications?['items'] as List<Object?>;
    final first = items.first as Map<String, Object?>;

    expect(readCalls, 1);
    expect(notificationCalls, 1);
    expect(unreadCalls, 1);
    expect(first['read'], isTrue);
    expect(first['readAt'], isNotNull);
    expect(cachedUnread, {'unreadCount': 1});
  });

  test('marking all notifications read updates local list and unread count',
      () async {
    var readAllCalls = 0;
    var notificationCalls = 0;
    var unreadCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' &&
              options.path == '/notifications/read-all') {
            readAllCalls += 1;
            return _jsonResponse(options, {'ok': true});
          }
          if (options.method == 'GET' && options.path == '/notifications') {
            notificationCalls += 1;
            return _jsonResponse(options, {
              'items': [
                {
                  'id': 'n1',
                  'title': 'Invite',
                  'body': 'Join us',
                  'read': false,
                },
                {
                  'id': 'n2',
                  'title': 'Match',
                  'body': 'New match',
                  'isRead': false,
                },
                {
                  'id': 'n3',
                  'title': 'System',
                  'body': 'Already read',
                  'read': true,
                },
              ],
            });
          }
          if (options.method == 'GET' &&
              options.path == '/notifications/unread-count') {
            unreadCalls += 1;
            return _jsonResponse(options, {'unreadCount': 2});
          }
          return _jsonResponse(options, {'ok': true});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final notificationsSubscription =
        container.listen(notificationsProvider, (_, __) {});
    final unreadSubscription =
        container.listen(notificationUnreadCountProvider, (_, __) {});
    addTearDown(notificationsSubscription.close);
    addTearDown(unreadSubscription.close);

    await container.read(notificationsProvider.future);
    await container.read(notificationUnreadCountProvider.future);
    expect(notificationCalls, 1);
    expect(unreadCalls, 1);

    await container.read(notificationsActionsProvider).markAllRead();

    final userScope = AppCacheUserScope.user('u1');
    final cachedNotifications = await cacheStore.getFreshJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'list?limit=30',
        userScope: userScope,
      ),
      now: DateTime.now(),
    );
    final cachedUnread = await cacheStore.getFreshJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'unread-count',
        userScope: userScope,
      ),
      now: DateTime.now(),
    );
    final items = cachedNotifications?['items'] as List<Object?>;

    expect(readAllCalls, 1);
    expect(notificationCalls, 1);
    expect(unreadCalls, 1);
    expect(
      items.map((item) => item as Map<String, Object?>),
      everyElement(
        allOf(
          containsPair('read', true),
          containsPair('isRead', true),
          contains('readAt'),
        ),
      ),
    );
    expect(cachedUnread, {'unreadCount': 0});
  });

  test('realtime notification created prepends local list and increments count',
      () async {
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'n1',
                'kind': 'event_invite',
                'title': 'Old invite',
                'body': 'Join later',
                'readAt': null,
                'createdAt': '2026-05-19T08:00:00.000Z',
              },
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await cacheStore.putJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'list?limit=30',
        userScope: AppCacheUserScope.user('u1'),
      ),
      {
        'items': [
          {
            'id': 'n1',
            'kind': 'event_invite',
            'title': 'Old invite',
            'body': 'Join later',
            'readAt': null,
            'createdAt': '2026-05-19T08:00:00.000Z',
          },
        ],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 2)),
    );
    await cacheStore.putJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'unread-count',
        userScope: AppCacheUserScope.user('u1'),
      ),
      {'unreadCount': 1},
      expiresAt: DateTime.now().add(const Duration(minutes: 1)),
    );

    await container
        .read(notificationsActionsProvider)
        .applyRealtimeNotificationCreated({
      'notificationId': 'n2',
      'kind': 'like',
      'title': 'New match',
      'body': 'Someone liked you',
      'payload': {'userId': 'u2'},
      'readAt': null,
      'createdAt': '2026-05-19T09:00:00.000Z',
    });

    final cachedNotifications = await cacheStore.getFreshJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'list?limit=30',
        userScope: AppCacheUserScope.user('u1'),
      ),
      now: DateTime.now(),
    );
    final cachedUnread = await cacheStore.getFreshJson(
      AppCacheKey(
        namespace: 'notifications',
        value: 'unread-count',
        userScope: AppCacheUserScope.user('u1'),
      ),
      now: DateTime.now(),
    );
    final items = cachedNotifications?['items'] as List<Object?>;
    final first = items.first as Map<String, Object?>;

    expect(first['id'], 'n2');
    expect(first['kind'], 'like');
    expect(first['payload'], {'userId': 'u2'});
    expect(items.length, 2);
    expect(cachedUnread, {'unreadCount': 2});
  });

  test(
      'accepting event invite invalidates event, map, chat and notification providers',
      () async {
    var eventListCalls = 0;
    var mapCalls = 0;
    var chatCalls = 0;
    var notificationCalls = 0;
    var unreadCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' &&
              options.path == '/events/event-1/invites/request-1/accept') {
            return _jsonResponse(options, {
              'id': 'event-1',
              'title': 'Accepted event',
            });
          }
          if (options.method == 'GET' &&
              options.path == '/events' &&
              options.queryParameters.containsKey('north')) {
            mapCalls += 1;
            return _jsonResponse(options, {'items': <Object?>[]});
          }
          if (options.method == 'GET' && options.path == '/events') {
            eventListCalls += 1;
            return _jsonResponse(options, {'items': <Object?>[]});
          }
          if (options.method == 'GET' && options.path == '/chats/meetups') {
            chatCalls += 1;
            return _jsonResponse(options, {'items': <Object?>[]});
          }
          if (options.method == 'GET' && options.path == '/notifications') {
            notificationCalls += 1;
            return _jsonResponse(options, {'items': <Object?>[]});
          }
          if (options.method == 'GET' &&
              options.path == '/notifications/unread-count') {
            unreadCalls += 1;
            return _jsonResponse(options, {'unreadCount': unreadCalls});
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final mapQuery =
        const MapViewportQuery(north: 1, south: 0, east: 1, west: 0);
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
      ],
    );
    addTearDown(container.dispose);
    final homeSubscription = container.listen(homeEventsProvider, (_, __) {});
    final meetingsSubscription = container.listen(meetingsProvider, (_, __) {});
    final mapSubscription =
        container.listen(mapEventsProvider(mapQuery), (_, __) {});
    final chatsSubscription = container.listen(chatsProvider, (_, __) {});
    final notificationsSubscription =
        container.listen(notificationsProvider, (_, __) {});
    final unreadSubscription =
        container.listen(notificationUnreadCountProvider, (_, __) {});
    addTearDown(homeSubscription.close);
    addTearDown(meetingsSubscription.close);
    addTearDown(mapSubscription.close);
    addTearDown(chatsSubscription.close);
    addTearDown(notificationsSubscription.close);
    addTearDown(unreadSubscription.close);

    await container.read(homeEventsProvider.future);
    await container.read(meetingsProvider.future);
    await container.read(mapEventsProvider(mapQuery).future);
    await container.read(chatsProvider.future);
    await container.read(notificationsProvider.future);
    await container.read(notificationUnreadCountProvider.future);
    final initialEventListCalls = eventListCalls;
    final initialMapCalls = mapCalls;
    final initialChatCalls = chatCalls;
    final initialNotificationCalls = notificationCalls;
    final initialUnreadCalls = unreadCalls;

    await container.read(notificationsActionsProvider).acceptEventInvite(
          eventId: 'event-1',
          requestId: 'request-1',
        );
    await _waitForValue(
      () =>
          eventListCalls >= initialEventListCalls + 2 &&
          mapCalls >= initialMapCalls + 1 &&
          chatCalls >= initialChatCalls + 1 &&
          notificationCalls >= initialNotificationCalls + 1 &&
          unreadCalls >= initialUnreadCalls + 1,
    );

    expect(eventListCalls, greaterThanOrEqualTo(initialEventListCalls + 2));
    expect(mapCalls, greaterThanOrEqualTo(initialMapCalls + 1));
    expect(chatCalls, greaterThanOrEqualTo(initialChatCalls + 1));
    expect(
      notificationCalls,
      greaterThanOrEqualTo(initialNotificationCalls + 1),
    );
    expect(unreadCalls, greaterThanOrEqualTo(initialUnreadCalls + 1));
  });

  test('declining event invite invalidates detail and notification providers',
      () async {
    var detailCalls = 0;
    var notificationCalls = 0;
    var unreadCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' &&
              options.path == '/events/event-1/invites/request-1/decline') {
            return _jsonResponse(options, {'ok': true});
          }
          if (options.method == 'GET' && options.path == '/events/event-1') {
            detailCalls += 1;
            return _jsonResponse(options, {
              'id': 'event-1',
              'title': 'Invite event',
            });
          }
          if (options.method == 'GET' && options.path == '/notifications') {
            notificationCalls += 1;
            return _jsonResponse(options, {'items': <Object?>[]});
          }
          if (options.method == 'GET' &&
              options.path == '/notifications/unread-count') {
            unreadCalls += 1;
            return _jsonResponse(options, {'unreadCount': unreadCalls});
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
      ],
    );
    addTearDown(container.dispose);
    final detailSubscription =
        container.listen(meetingDetailProvider('event-1'), (_, __) {});
    final notificationsSubscription =
        container.listen(notificationsProvider, (_, __) {});
    final unreadSubscription =
        container.listen(notificationUnreadCountProvider, (_, __) {});
    addTearDown(detailSubscription.close);
    addTearDown(notificationsSubscription.close);
    addTearDown(unreadSubscription.close);

    await container.read(meetingDetailProvider('event-1').future);
    await container.read(notificationsProvider.future);
    await container.read(notificationUnreadCountProvider.future);
    expect(detailCalls, 1);
    expect(notificationCalls, 1);
    expect(unreadCalls, 1);

    await container.read(notificationsActionsProvider).declineEventInvite(
          eventId: 'event-1',
          requestId: 'request-1',
        );
    await _waitForValue(
      () => detailCalls >= 2 && notificationCalls >= 2 && unreadCalls >= 2,
    );

    expect(detailCalls, greaterThanOrEqualTo(2));
    expect(notificationCalls, greaterThanOrEqualTo(2));
    expect(unreadCalls, greaterThanOrEqualTo(2));
  });

  test('home event providers request only visible first-screen items',
      () async {
    final seen = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen.add(options);
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    final eventsSubscription = container.listen(
      homeEventsProvider,
      (_, __) {},
    );
    final postersSubscription = container.listen(
      postersProvider,
      (_, __) {},
    );
    addTearDown(eventsSubscription.close);
    addTearDown(postersSubscription.close);

    await container.read(homeEventsProvider.future);
    await container.read(postersProvider.future);

    final eventsRequest =
        seen.firstWhere((options) => options.path == '/events');
    final postersRequest =
        seen.firstWhere((options) => options.path == '/affiche/events');

    expect(eventsRequest.queryParameters['limit'], 6);
    expect(eventsRequest.queryParameters['city'], isNull);
    expect(postersRequest.queryParameters['limit'], 8);
  });

  test('home event providers send selected user city to backend', () async {
    final seen = <RequestOptions>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen.add(options);
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    container.read(currentUserProvider.notifier).state =
        const BackendUser(id: 'u1', name: 'Alex', city: 'Москва');
    final eventsSubscription = container.listen(
      homeEventsProvider,
      (_, __) {},
    );
    addTearDown(eventsSubscription.close);

    await container.read(homeEventsProvider.future);

    final eventsRequest =
        seen.firstWhere((options) => options.path == '/events');

    expect(eventsRequest.queryParameters['city'], 'Москва');
  });

  test('onboarding save updates local-first cache immediately', () async {
    final scope = AppCacheUserScope.user('u1');
    await cacheStore.putJson(
      AppCacheKey(namespace: 'onboarding', value: 'me', userScope: scope),
      {
        'city': null,
        'interests': <String>[],
      },
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'PUT' && options.path == '/onboarding/me') {
            return _jsonResponse(options, {
              'city': 'Москва',
              'interests': ['Кофе', 'Кино'],
              'vibe': 'Чилл',
            });
          }
          if (options.method == 'GET' && options.path == '/me') {
            return _jsonResponse(options, {
              'id': 'u1',
              'name': 'Alex',
              'onboardingComplete': true,
              'city': 'Москва',
            });
          }
          return _jsonResponse(options, {
            'city': null,
            'interests': <String>[],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        backendRepositoryProvider.overrideWithValue(repository),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(onboardingFlowControllerProvider).save(
          const OnboardingData(
            city: 'Москва',
            interests: ['Кофе', 'Кино'],
            vibe: 'Чилл',
          ),
        );
    final saved = await container.read(onboardingProvider.future);

    expect(saved.city, 'Москва');
    expect(saved.interests, ['Кофе', 'Кино']);
    expect(saved.vibe, 'Чилл');
  });

  test('cleanup clears private DTO cache, chat rows, cursors and outbox',
      () async {
    final scope = AppCacheUserScope.user('u1');
    await cacheStore.putJson(
      AppCacheKey(namespace: 'profile', value: 'me', userScope: scope),
      {'name': 'Alex'},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {'id': 'chat-1', 'title': 'Coffee'},
      ],
    );
    await chatStore.upsertMessages(
      userId: 'u1',
      chatId: 'chat-1',
      messages: [
        {'id': 'm1', 'text': 'Hi'},
      ],
    );
    await chatStore.setSyncCursor(userId: 'u1', chatId: 'chat-1', cursor: '9');
    await chatStore.enqueuePendingCommand(
      userId: 'u1',
      commandId: 'cmd-1',
      dedupeKey: 'send-1',
      payload: {'type': 'message.send'},
    );

    await SessionCleanupController(
      cacheStore: cacheStore,
      chatStore: chatStore,
      clearPrivateMediaCache: () async {},
    ).clearPrivateUserData('u1');

    expect(
      await cacheStore.getFreshJson(
        AppCacheKey(namespace: 'profile', value: 'me', userScope: scope),
        now: DateTime.now(),
      ),
      isNull,
    );
    expect(await chatStore.watchSummaries(userId: 'u1', kind: 'meetups').first,
        isEmpty);
    expect(
        await chatStore
            .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
            .first,
        isEmpty);
    expect(
        await chatStore.getSyncCursor(userId: 'u1', chatId: 'chat-1'), isNull);
    expect(await chatStore.pendingCommands(userId: 'u1'), isEmpty);
  });

  test('chat sender writes optimistic message and durable outbox command',
      () async {
    final container = ProviderContainer(
      overrides: [
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(chatMessageSenderProvider).sendText(
          chatId: 'chat-1',
          text: 'Hi',
        );

    final messages = await chatStore
        .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
        .first;
    final commands = await chatStore.pendingCommands(userId: 'u1');

    expect(messages.single['pending'], true);
    expect(messages.single['text'], 'Hi');
    expect(messages.single['clientMessageId'], isNotEmpty);
    expect(commands.single['type'], 'message.send');
    expect((commands.single['payload'] as Map)['chatId'], 'chat-1');
  });

  test('chat attachment sender keeps pending message while upload runs',
      () async {
    final tempDir = await Directory.systemTemp.createTemp('mobile2-chat-send');
    addTearDown(() => tempDir.delete(recursive: true));
    final file = File('${tempDir.path}/photo.jpg');
    await file.writeAsString('hello');
    final uploadStarted = Completer<void>();
    final releaseUpload = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/uploads/chat-attachment/upload-url') {
            return _jsonResponse(options, {
              'uploadUrl': 'https://storage.test/upload/photo',
              'objectKey': 'chat-attachments/u1/photo.jpg',
              'headers': {'content-type': 'image/jpeg'},
            });
          }
          if (options.method == 'PUT') {
            uploadStarted.complete();
            await releaseUpload.future;
            return _jsonResponse(options, {});
          }
          return _jsonResponse(options, {
            'assetId': 'asset-1',
            'status': 'ready',
            'url': 'https://cdn.test/photo.jpg',
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final send = container.read(chatMessageSenderProvider).sendAttachment(
          chatId: 'chat-1',
          filePath: file.path,
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
        );
    await uploadStarted.future;

    final uploadingMessages = await chatStore
        .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
        .first;
    final uploadingAttachment =
        (uploadingMessages.single['attachments'] as List).single as Map;

    expect(uploadingMessages.single['pending'], true);
    expect(uploadingMessages.single['clientMessageId'], isNotEmpty);
    expect(uploadingAttachment['status'], 'uploading');
    expect(uploadingAttachment['fileName'], 'photo.jpg');
    expect(uploadingAttachment['id'], isNull);
    expect(await chatStore.pendingCommands(userId: 'u1'), isEmpty);

    releaseUpload.complete();
    await send;

    final readyMessages = await chatStore
        .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
        .first;
    final readyAttachment =
        (readyMessages.single['attachments'] as List).single as Map;
    final commands = await chatStore.pendingCommands(userId: 'u1');

    expect(readyMessages.single['pending'], true);
    expect(readyAttachment['id'], 'asset-1');
    expect(readyAttachment['status'], 'ready');
    expect(commands.single['type'], 'message.send');
    expect((commands.single['payload'] as Map)['attachmentIds'], ['asset-1']);
    expect(
      (commands.single['payload'] as Map)['clientMessageId'],
      readyMessages.single['clientMessageId'],
    );
  });

  test('chat attachment sender marks pending message failed on bad upload',
      () async {
    final tempDir =
        await Directory.systemTemp.createTemp('mobile2-chat-send-fail');
    addTearDown(() => tempDir.delete(recursive: true));
    final file = File('${tempDir.path}/photo.jpg');
    await file.writeAsString('hello');
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/uploads/chat-attachment/upload-url') {
            return _jsonResponse(options, {
              'uploadUrl': 'https://storage.test/upload/photo',
              'objectKey': 'chat-attachments/u1/photo.jpg',
              'headers': {'content-type': 'image/jpeg'},
            });
          }
          if (options.method == 'PUT') {
            return _jsonResponse(options, {});
          }
          return _jsonResponse(options, {
            'status': 'ready',
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await expectLater(
      container.read(chatMessageSenderProvider).sendAttachment(
            chatId: 'chat-1',
            filePath: file.path,
            fileName: 'photo.jpg',
            mimeType: 'image/jpeg',
          ),
      throwsStateError,
    );

    final messages = await chatStore
        .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
        .first;
    final attachment = (messages.single['attachments'] as List).single as Map;

    expect(attachment['status'], 'failed');
    expect(await chatStore.pendingCommands(userId: 'u1'), isEmpty);
  });

  test('marking chat summary read clears unread counters locally', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Coffee',
          'unreadCount': 4,
          'unread': 4,
        },
      ],
    );

    await chatStore.markSummaryRead(userId: 'u1', chatId: 'chat-1');

    final summaries =
        await chatStore.watchSummaries(userId: 'u1', kind: 'meetups').first;

    expect(summaries.single['unreadCount'], 0);
    expect(summaries.single['unread'], 0);
  });

  test('watches a single chat summary by chat id', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'personal',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Nina',
          'kind': 'personal',
        },
      ],
    );

    final summary =
        await chatStore.watchSummary(userId: 'u1', chatId: 'chat-1').first;

    expect(summary?['title'], 'Nina');
    expect(summary?['kind'], 'personal');
  });

  test('pin and delete chat update local chat cache', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {'id': 'chat-1', 'title': 'Coffee', 'isPinned': false},
      ],
    );
    await chatStore.upsertMessages(
      userId: 'u1',
      chatId: 'chat-1',
      messages: [
        {'id': 'm1', 'text': 'Hi'},
      ],
    );
    await chatStore.setSyncCursor(userId: 'u1', chatId: 'chat-1', cursor: '9');
    await chatStore.enqueuePendingCommand(
      userId: 'u1',
      commandId: 'cmd-1',
      dedupeKey: 'message.send:chat-1:cmd-1',
      payload: {'type': 'message.send'},
    );

    await chatStore.setSummaryPinned(
      userId: 'u1',
      chatId: 'chat-1',
      isPinned: true,
    );
    final pinned =
        await chatStore.watchSummary(userId: 'u1', chatId: 'chat-1').first;
    expect(pinned?['isPinned'], true);

    await chatStore.deleteChat(userId: 'u1', chatId: 'chat-1');

    expect(await chatStore.watchSummary(userId: 'u1', chatId: 'chat-1').first,
        isNull);
    expect(
      await chatStore.watchRecentMessages(userId: 'u1', chatId: 'chat-1').first,
      isEmpty,
    );
    expect(
      await chatStore.getSyncCursor(userId: 'u1', chatId: 'chat-1'),
      isNull,
    );
    expect(await chatStore.pendingCommands(userId: 'u1'), isEmpty);
  });

  test('pin chat action updates cached summary row locally', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {'id': 'chat-1', 'title': 'Coffee', 'isPinned': false},
      ],
    );
    var pinCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'POST' && options.path == '/chats/chat-1/pin') {
            pinCalls += 1;
            expect(options.data, {'isPinned': true});
            return _jsonResponse(options, {'ok': true});
          }
          return _jsonResponse(options, {'ok': true});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(chatActionsProvider).setPinned(
          chatId: 'chat-1',
          isPinned: true,
        );

    final summary =
        await chatStore.watchSummary(userId: 'u1', chatId: 'chat-1').first;

    expect(pinCalls, 1);
    expect(summary?['isPinned'], true);
  });

  test('delete chat action removes summary before backend completes', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {'id': 'chat-1', 'title': 'Coffee'},
      ],
    );
    final deleteStarted = Completer<void>();
    final releaseDelete = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'DELETE' && options.path == '/chats/chat-1') {
            deleteStarted.complete();
            await releaseDelete.future;
            return _jsonResponse(options, {'ok': true});
          }
          return _jsonResponse(options, {'ok': true});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final delete = container.read(chatActionsProvider).deleteChat('chat-1');
    await deleteStarted.future;

    expect(
      await chatStore.watchSummaries(userId: 'u1', kind: 'meetups').first,
      isEmpty,
    );

    releaseDelete.complete();
    await delete;
  });

  test('delete chat action restores summary when backend fails', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'personal',
      summaries: [
        {'id': 'chat-1', 'title': 'Nina', 'kind': 'personal'},
      ],
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.method == 'DELETE' && options.path == '/chats/chat-1') {
            throw DioException(
              requestOptions: options,
              response: Response(
                requestOptions: options,
                statusCode: 500,
                data: {'message': 'failed'},
              ),
            );
          }
          return _jsonResponse(options, {'ok': true});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await expectLater(
      container.read(chatActionsProvider).deleteChat('chat-1'),
      throwsA(isA<DioException>()),
    );

    final summaries =
        await chatStore.watchSummaries(userId: 'u1', kind: 'personal').first;

    expect(summaries.single['id'], 'chat-1');
    expect(summaries.single['title'], 'Nina');
    expect(summaries.single['kind'], 'personal');
  });

  test('chat pagination loads older messages into local snapshot', () async {
    late RequestOptions seen;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          seen = options;
          return _jsonResponse(options, {
            'currentUserId': 'u1',
            'items': [
              {
                'id': 'm-old',
                'chatId': 'chat-1',
                'senderId': 'u2',
                'senderName': 'Nina',
                'text': 'Earlier',
                'createdAt': '2026-05-19T09:00:00.000Z',
              },
            ],
            'nextCursor': null,
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      chatHistoryPaginationProvider('chat-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);

    container
        .read(chatHistoryPaginationProvider('chat-1').notifier)
        .setNextCursor('cursor-1');
    await container
        .read(chatHistoryPaginationProvider('chat-1').notifier)
        .loadNextPage();

    final messages = await chatStore
        .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
        .first;
    final pagination = container.read(chatHistoryPaginationProvider('chat-1'));

    expect(seen.path, '/chats/chat-1/messages');
    expect(seen.queryParameters['cursor'], 'cursor-1');
    expect(messages.single['id'], 'm-old');
    expect(pagination.hasNextPage, false);
    expect(pagination.loading, false);
    expect(pagination.error, false);
  });

  test('chat pagination error keeps loaded messages', () async {
    await chatStore.upsertMessages(
      userId: 'u1',
      chatId: 'chat-1',
      messages: [
        {
          'id': 'loaded-message',
          'chatId': 'chat-1',
          'senderId': 'u2',
          'senderName': 'Nina',
          'text': 'Already loaded',
          'createdAt': '2026-05-19T09:00:00.000Z',
        },
      ],
    );
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
            error: 'offline',
          );
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      chatHistoryPaginationProvider('chat-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);

    container
        .read(chatHistoryPaginationProvider('chat-1').notifier)
        .setNextCursor('cursor-1');
    await container
        .read(chatHistoryPaginationProvider('chat-1').notifier)
        .loadNextPage();

    final messages = await chatStore
        .watchRecentMessages(userId: 'u1', chatId: 'chat-1')
        .first;
    final pagination = container.read(chatHistoryPaginationProvider('chat-1'));

    expect(messages.single['id'], 'loaded-message');
    expect(pagination.loading, false);
    expect(pagination.error, true);
    expect(pagination.nextCursor, 'cursor-1');
  });

  test('chat history prewarms only ready image attachments', () async {
    final warmedPaths = <String>[];
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'currentUserId': 'u1',
            'items': [
              {
                'id': 'm-1',
                'chatId': 'chat-1',
                'senderId': 'u2',
                'senderName': 'Nina',
                'text': '',
                'createdAt': '2026-05-19T09:00:00.000Z',
                'attachments': [
                  {
                    'kind': 'chat_attachment',
                    'status': 'ready',
                    'mimeType': 'image/jpeg',
                    'fileName': 'ready.jpg',
                    'downloadUrlPath': '/media/ready/download-url',
                  },
                  {
                    'kind': 'chat_attachment',
                    'status': 'pending',
                    'mimeType': 'image/jpeg',
                    'fileName': 'pending.jpg',
                    'downloadUrlPath': '/media/pending/download-url',
                  },
                  {
                    'kind': 'chat_attachment',
                    'mimeType': 'image/jpeg',
                    'fileName': 'missing-status.jpg',
                    'downloadUrlPath': '/media/missing/download-url',
                  },
                  {
                    'kind': 'chat_voice',
                    'status': 'ready',
                    'mimeType': 'audio/mp4',
                    'fileName': 'voice.m4a',
                    'downloadUrlPath': '/media/voice/download-url',
                  },
                ],
              },
            ],
            'nextCursor': null,
          });
        }),
    );
    final service = AppAttachmentService(
      fetchSignedUrl: (path) async {
        warmedPaths.add(path);
        return SignedMediaUrl(
          url: 'https://cdn.test$path',
          expiresAt: DateTime.now().add(const Duration(minutes: 4)),
        );
      },
      fetchFile: (_, __) async {},
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        appAttachmentServiceProvider.overrideWithValue(service),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);
    final loaded = Completer<void>();
    final subscription = container.listen(
      chatMessagesProvider('chat-1'),
      (_, next) {
        if (next.hasValue && !loaded.isCompleted) {
          loaded.complete();
        }
      },
    );
    addTearDown(subscription.close);

    await loaded.future;
    await Future<void>.delayed(Duration.zero);

    expect(warmedPaths, ['/media/ready/download-url']);
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

class _ProfileEditRepository extends BackendRepository {
  _ProfileEditRepository()
      : super(Dio(BaseOptions(baseUrl: 'https://api.test')));

  final profileUpdates = <Map<String, Object?>>[];
  final savedOnboarding = <OnboardingData>[];
  var _profileName = 'Old name';
  var _profileBio = 'Old bio';
  var _interests = <String>['Старое'];

  @override
  Future<BackendCardItem> fetchOwnProfile({CancelToken? cancelToken}) async {
    return BackendCardItem.fromJson({
      'id': 'u1',
      'displayName': _profileName,
      'bio': _profileBio,
      'interests': _interests,
    });
  }

  @override
  Future<BackendCardItem> updateOwnProfile({
    required Map<String, Object?> data,
    CancelToken? cancelToken,
  }) async {
    profileUpdates.add(data);
    _profileName = data['displayName']?.toString() ?? _profileName;
    _profileBio = data['bio']?.toString() ?? _profileBio;
    return fetchOwnProfile(cancelToken: cancelToken);
  }

  @override
  Future<OnboardingData> fetchOnboarding({CancelToken? cancelToken}) async {
    return const OnboardingData(
      intent: 'meet',
      gender: 'female',
      city: 'Москва',
      interests: ['Старое'],
    );
  }

  @override
  Future<OnboardingData> saveOnboarding(
    OnboardingData data, {
    CancelToken? cancelToken,
  }) async {
    savedOnboarding.add(data);
    _interests = data.interests;
    return data;
  }
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

Future<Map<String, Object?>?> _waitForCacheJson(
  AppLocalCacheStore store,
  AppCacheKey key,
  bool Function(Map<String, Object?> json) matches,
) async {
  for (var attempt = 0; attempt < 20; attempt += 1) {
    final json = await store.getFreshJson(key, now: DateTime.now());
    if (json != null && matches(json)) {
      return json;
    }
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  return store.getFreshJson(key, now: DateTime.now());
}

Future<void> _waitForValue(bool Function() matches) async {
  for (var attempt = 0; attempt < 20; attempt += 1) {
    if (matches()) {
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

List<Map<String, Object?>> _cachedItems(Map<String, Object?>? json) {
  final items = json?['items'];
  if (items is! List) {
    return const [];
  }
  return items
      .whereType<Map>()
      .map((item) => item.map((key, value) => MapEntry('$key', value)))
      .toList(growable: false);
}
