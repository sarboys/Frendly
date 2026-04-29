import 'dart:io';
import 'dart:typed_data';

import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _CapturedRequest {
  const _CapturedRequest({
    required this.method,
    required this.path,
    required this.headers,
  });

  final String method;
  final String path;
  final Map<String, dynamic> headers;
}

void main() {
  test('evening publish sends privacy and returns session ids', () async {
    Object? requestBody;
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requestBody = options.data;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'sessionId': 'session-1',
                  'routeId': 'r-cozy-circle',
                  'chatId': 'chat-1',
                  'phase': 'scheduled',
                  'chatPhase': 'soon',
                  'privacy': 'request',
                  'mode': 'hybrid',
                  'joinedCount': 1,
                  'maxGuests': 10,
                  'inviteToken': 'secret-token',
                },
              ),
            );
          },
        ),
      );
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    final result = await repository.publishEveningRoute(
      'r-cozy-circle',
      privacy: EveningPrivacy.request,
    );

    expect(requestBody, {'privacy': 'request'});
    expect(result.sessionId, 'session-1');
    expect(result.chatId, 'chat-1');
    expect(result.privacy, EveningPrivacy.request);
    expect(result.inviteToken, 'secret-token');
  });

  test('evening builder endpoints fetch options and resolve route', () async {
    final apiRequests = <String>[];
    final requestBodies = <Object?>[];
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add('${options.method} ${options.path}');
            requestBodies.add(options.data);
            if (options.path == '/evening/options') {
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'goals': [
                      {'key': 'newfriends', 'label': 'Новые друзья'},
                    ],
                  },
                ),
              );
              return;
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'id': 'r-backend',
                  'title': 'Backend Route',
                  'steps': [],
                },
              ),
            );
          },
        ),
      );
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    final options = await repository.fetchEveningOptions();
    final route = await repository.resolveEveningRoute(
      goal: 'newfriends',
      mood: 'social',
      budget: 'mid',
      format: 'bar',
      area: 'center',
    );
    final routeDetail = await repository.fetchEveningRoute('r-backend');

    expect(apiRequests, [
      'GET /evening/options',
      'POST /evening/routes/resolve',
      'GET /evening/routes/r-backend',
    ]);
    expect(requestBodies[1], {
      'goal': 'newfriends',
      'mood': 'social',
      'budget': 'mid',
      'format': 'bar',
      'area': 'center',
    });
    expect(options['goals'], isA<List<dynamic>>());
    expect(route['id'], 'r-backend');
    expect(routeDetail['title'], 'Backend Route');
  });

  test('fetch evening sessions parses summaries', () async {
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'items': [
                    {
                      'id': 'session-1',
                      'routeId': 'r-cozy-circle',
                      'chatId': 'chat-1',
                      'phase': 'live',
                      'chatPhase': 'live',
                      'privacy': 'open',
                      'title': 'Теплый круг',
                      'joinedCount': 4,
                      'maxGuests': 10,
                    }
                  ],
                  'nextCursor': null,
                },
              ),
            );
          },
        ),
      );
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    final result = await repository.fetchEveningSessions();

    expect(result.items.single.id, 'session-1');
    expect(result.items.single.privacy, EveningPrivacy.open);
  });

  test('fetch matches parses paginated backend response', () async {
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'items': [
                    {
                      'userId': 'user-anya',
                      'displayName': 'Аня',
                      'avatarUrl': null,
                      'area': 'Центр',
                      'vibe': 'Спокойно',
                      'score': 82,
                      'commonInterests': ['кофе'],
                      'eventId': 'event-1',
                      'eventTitle': 'Кофе',
                    },
                  ],
                  'nextCursor': null,
                },
              ),
            );
          },
        ),
      );
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    final result = await repository.fetchMatches();

    expect(result.single.userId, 'user-anya');
    expect(result.single.score, 82);
  });

  test('evening session actions call v2 endpoints', () async {
    final apiRequests = <String>[];
    Object? feedbackBody;
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add('${options.method} ${options.path}');
            if (options.path.endsWith('/feedback')) {
              feedbackBody = options.data;
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: <String, dynamic>{},
              ),
            );
          },
        ),
      );
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    await repository.approveEveningJoinRequest('session-1', 'request-1');
    await repository.checkInEveningStep('session-1', 'step-1');
    await repository.advanceEveningStep('session-1', 'step-1');
    await repository.saveEveningAfterPartyFeedback(
      'session-1',
      rating: 5,
      reaction: 'repeat',
    );

    expect(apiRequests, [
      'POST /evening/sessions/session-1/join-requests/request-1/approve',
      'POST /evening/sessions/session-1/steps/step-1/check-in',
      'POST /evening/sessions/session-1/steps/step-1/advance',
      'POST /evening/sessions/session-1/after-party/feedback',
    ]);
    expect(feedbackBody, {'rating': 5, 'reaction': 'repeat'});
  });

  test('community creation sends idempotency key header', () async {
    final apiRequests = <_CapturedRequest>[];
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'id': 'community-created',
                  'chatId': 'community-created-chat',
                  'name': 'Sage Circle',
                  'avatar': '🌿',
                  'description': 'Клуб',
                  'privacy': 'public',
                  'members': 1,
                  'online': 0,
                  'tags': ['Городской клуб'],
                  'joinRule': 'Открытое вступление',
                  'premiumOnly': true,
                  'unread': 0,
                  'mood': 'Городской клуб',
                  'sharedMediaLabel': '0 медиа',
                  'news': [],
                  'meetups': [],
                  'media': [],
                  'chatPreview': [],
                  'chatMessages': [],
                  'socialLinks': [],
                  'memberNames': ['Никита'],
                },
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    final created = await repository.createCommunity(
      name: 'Sage Circle',
      avatar: '🌿',
      description: 'Клуб',
      privacy: CommunityPrivacy.public,
      purpose: 'Городской клуб',
      socialLinks: const [],
      idempotencyKey: 'community-key-1',
    );

    expect(created.id, 'community-created');
    expect(apiRequests.single.path, '/communities');
    expect(apiRequests.single.headers['idempotency-key'], 'community-key-1');
  });

  test('community news publishing posts to the community news endpoint',
      () async {
    final apiRequests = <_CapturedRequest>[];
    Object? requestBody;
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            requestBody = options.data;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'id': 'community-created',
                  'chatId': 'community-created-chat',
                  'name': 'Sage Circle',
                  'avatar': '🌿',
                  'description': 'Клуб',
                  'privacy': 'public',
                  'members': 1,
                  'online': 0,
                  'tags': ['Городской клуб'],
                  'joinRule': 'Открытое вступление',
                  'premiumOnly': true,
                  'unread': 0,
                  'mood': 'Городской клуб',
                  'sharedMediaLabel': '0 медиа',
                  'news': [
                    {
                      'id': 'news-1',
                      'title': 'Я',
                      'blurb': 'Ок',
                      'time': 'сейчас',
                    },
                  ],
                  'meetups': [],
                  'media': [],
                  'chatPreview': [],
                  'chatMessages': [],
                  'socialLinks': [],
                  'memberNames': ['Никита'],
                },
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    final community = await repository.createCommunityNews(
      communityId: 'c1',
      title: 'Я',
      body: 'Ок',
      category: 'news',
      audience: 'all',
      pin: true,
      push: false,
    );

    expect(community.news.single.title, 'Я');
    expect(apiRequests.single.method, 'POST');
    expect(apiRequests.single.path, '/communities/c1/news');
    expect(requestBody, {
      'title': 'Я',
      'body': 'Ок',
      'category': 'news',
      'audience': 'all',
      'pin': true,
      'push': false,
    });
  });

  test('event creation sends community id when provided', () async {
    final apiRequests = <_CapturedRequest>[];
    Object? requestBody;
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            requestBody = options.data;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'id': 'event-created',
                  'title': 'Бранч клуба',
                  'emoji': '🥐',
                  'time': 'Сегодня · 12:00',
                  'place': 'Friends Bistro',
                  'distance': '1 км',
                  'vibe': 'Спокойно',
                  'description': 'Клубная встреча',
                  'hostNote': null,
                  'joined': false,
                  'partnerName': null,
                  'partnerOffer': null,
                  'capacity': 8,
                  'going': 1,
                  'chatId': 'event-created-chat',
                  'host': {
                    'id': 'user-me',
                    'displayName': 'Никита',
                    'verified': true,
                    'rating': 4.9,
                    'meetupCount': 10,
                    'avatarUrl': null,
                  },
                  'attendees': [],
                },
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    await repository.createEvent(
      title: 'Бранч клуба',
      description: 'Клубная встреча',
      emoji: '🥐',
      vibe: 'Спокойно',
      place: 'Friends Bistro',
      startsAt: DateTime.utc(2026, 5, 1, 12),
      capacity: 8,
      communityId: 'c-owned',
    );

    expect(apiRequests.single.path, '/events');
    expect(requestBody, containsPair('communityId', 'c-owned'));
  });

  test('event creation sends resolved place coordinates when provided',
      () async {
    final apiRequests = <_CapturedRequest>[];
    Object? requestBody;
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            requestBody = options.data;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 201,
                data: {
                  'id': 'event-created',
                  'title': 'Кофе на Тверской',
                  'emoji': '☕',
                  'time': 'Сегодня · 12:00',
                  'place': 'Кофемания, Тверская 10',
                  'distance': '1.7 км',
                  'vibe': 'Спокойно',
                  'description': 'Короткая встреча',
                  'hostNote': null,
                  'joined': false,
                  'partnerName': null,
                  'partnerOffer': null,
                  'capacity': 6,
                  'going': 1,
                  'chatId': 'event-created-chat',
                  'host': {
                    'id': 'user-me',
                    'displayName': 'Никита',
                    'verified': true,
                    'rating': 4.9,
                    'meetupCount': 10,
                    'avatarUrl': null,
                  },
                  'attendees': [],
                },
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    await repository.createEvent(
      title: 'Кофе на Тверской',
      description: 'Короткая встреча',
      emoji: '☕',
      vibe: 'Спокойно',
      place: 'Кофемания, Тверская 10',
      startsAt: DateTime.utc(2026, 5, 1, 12),
      capacity: 6,
      distanceKm: 1.7,
      latitude: 55.765,
      longitude: 37.605,
    );

    expect(apiRequests.single.path, '/events');
    expect(requestBody, containsPair('distanceKm', 1.7));
    expect(requestBody, containsPair('latitude', 55.765));
    expect(requestBody, containsPair('longitude', 37.605));
  });

  test('event feed sends geo viewport query params', () async {
    Map<String, dynamic>? queryParameters;
    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            queryParameters = Map<String, dynamic>.from(
              options.queryParameters,
            );
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: const {
                  'items': [],
                  'nextCursor': null,
                },
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(ref: ref, dio: apiDio),
      ),
    );

    await repository.fetchEvents(
      filter: 'nearby',
      latitude: 55.75,
      longitude: 37.61,
      radiusKm: 3.5,
      southWestLatitude: 55.70,
      southWestLongitude: 37.50,
      northEastLatitude: 55.80,
      northEastLongitude: 37.70,
      limit: 50,
    );

    expect(queryParameters, isNotNull);
    expect(queryParameters, containsPair('latitude', 55.75));
    expect(queryParameters, containsPair('longitude', 37.61));
    expect(queryParameters, containsPair('radiusKm', 3.5));
    expect(queryParameters, containsPair('southWestLatitude', 55.70));
    expect(queryParameters, containsPair('southWestLongitude', 37.50));
    expect(queryParameters, containsPair('northEastLatitude', 55.80));
    expect(queryParameters, containsPair('northEastLongitude', 37.70));
  });

  test('voice upload uses presigned upload flow instead of api file upload',
      () async {
    final apiRequests = <_CapturedRequest>[];
    final uploadRequests = <_CapturedRequest>[];
    final metrics = <String, int>{};

    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );

            if (options.path == '/uploads/chat-attachment/upload-url') {
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 201,
                  data: {
                    'uploadUrl': 'https://storage.example.com/chat-voice-1',
                    'objectKey': 'chat-attachments/user-me/voice-1.m4a',
                    'headers': {
                      'content-type': 'audio/mp4',
                    },
                  },
                ),
              );
              return;
            }

            if (options.path == '/uploads/chat-attachment/complete') {
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 201,
                  data: {
                    'assetId': 'voice-asset-1',
                    'status': 'ready',
                  },
                ),
              );
              return;
            }

            fail('Unexpected API request: ${options.method} ${options.path}');
          },
        ),
      );

    final uploadDio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            uploadRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: '',
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(
          ref: ref,
          dio: apiDio,
          createUploadDio: () => uploadDio,
          voiceMetricReporter: (name, milliseconds) {
            metrics[name] = milliseconds;
          },
        ),
      ),
    );

    final assetId = await repository.uploadChatVoice(
      PlatformFile(
        name: 'voice.m4a',
        size: 4096,
        bytes: Uint8List.fromList(List<int>.filled(4096, 7)),
      ),
      chatId: 'p1',
      durationMs: 7000,
      waveform: const [0.1, 0.5, 0.8],
    );

    expect(assetId, 'voice-asset-1');
    expect(
      apiRequests.map((request) => request.path),
      [
        '/uploads/chat-attachment/upload-url',
        '/uploads/chat-attachment/complete'
      ],
    );
    expect(
      apiRequests.any(
        (request) => request.path == '/uploads/chat-attachment/file',
      ),
      false,
    );
    expect(uploadRequests, hasLength(1));
    expect(uploadRequests.single.method, 'PUT');
    expect(
        uploadRequests.single.path, 'https://storage.example.com/chat-voice-1');
    expect(uploadRequests.single.headers['content-type'], 'audio/mp4');
    expect(uploadRequests.single.headers['content-length'], 4096);
    expect(metrics.containsKey('voice_upload_ms'), true);
  });

  test(
      'chat attachment upload uses presigned upload flow instead of api file upload',
      () async {
    final apiRequests = <_CapturedRequest>[];
    final uploadRequests = <_CapturedRequest>[];

    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );

            if (options.path == '/uploads/chat-attachment/upload-url') {
              final data = Map<String, dynamic>.from(options.data as Map);
              expect(data['chatId'], 'p1');
              expect(data['kind'], 'chat_attachment');
              expect(data['fileName'], 'plan.pdf');
              expect(data['contentType'], 'application/pdf');
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 201,
                  data: {
                    'uploadUrl': 'https://storage.example.com/chat-file-1',
                    'objectKey': 'chat-attachments/user-me/file-1.pdf',
                    'headers': {
                      'content-type': 'application/pdf',
                    },
                  },
                ),
              );
              return;
            }

            if (options.path == '/uploads/chat-attachment/complete') {
              final data = Map<String, dynamic>.from(options.data as Map);
              expect(data['chatId'], 'p1');
              expect(data['kind'], 'chat_attachment');
              expect(data['objectKey'], 'chat-attachments/user-me/file-1.pdf');
              expect(data['mimeType'], 'application/pdf');
              expect(data['byteSize'], 4096);
              expect(data['fileName'], 'plan.pdf');
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 201,
                  data: {
                    'assetId': 'attachment-asset-1',
                    'status': 'ready',
                  },
                ),
              );
              return;
            }

            fail('Unexpected API request: ${options.method} ${options.path}');
          },
        ),
      );

    final uploadDio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            uploadRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: '',
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(
          ref: ref,
          dio: apiDio,
          createUploadDio: () => uploadDio,
        ),
      ),
    );

    final assetId = await repository.uploadChatAttachment(
      PlatformFile(
        name: 'plan.pdf',
        size: 4096,
        bytes: Uint8List.fromList(List<int>.filled(4096, 4)),
      ),
      chatId: 'p1',
    );

    expect(assetId, 'attachment-asset-1');
    expect(
      apiRequests.map((request) => request.path),
      [
        '/uploads/chat-attachment/upload-url',
        '/uploads/chat-attachment/complete'
      ],
    );
    expect(
      apiRequests.any(
        (request) => request.path == '/uploads/chat-attachment/file',
      ),
      false,
    );
    expect(uploadRequests, hasLength(1));
    expect(uploadRequests.single.method, 'PUT');
    expect(
      uploadRequests.single.path,
      'https://storage.example.com/chat-file-1',
    );
    expect(uploadRequests.single.headers['content-type'], 'application/pdf');
    expect(uploadRequests.single.headers['content-length'], 4096);
  });

  test(
      'profile photo upload streams path file through generic direct media upload',
      () async {
    final apiRequests = <_CapturedRequest>[];
    final uploadRequests = <_CapturedRequest>[];
    final tempDir = await Directory.systemTemp.createTemp('bb-profile-upload');
    addTearDown(() async {
      if (await tempDir.exists()) {
        await tempDir.delete(recursive: true);
      }
    });
    final imageFile = File('${tempDir.path}/photo.jpg');
    await imageFile.writeAsBytes([1, 2, 3]);

    final apiDio = Dio(
      BaseOptions(baseUrl: 'http://api.example.com'),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );

            if (options.path == '/uploads/media/upload-url') {
              final data = Map<String, dynamic>.from(options.data as Map);
              expect(data['scope'], 'profile_photo');
              expect(data['fileName'], 'photo.jpg');
              expect(data['contentType'], 'image/jpeg');
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 201,
                  data: {
                    'uploadUrl': 'https://storage.example.com/profile-photo-1',
                    'objectKey': 'profile-photos/user-me/photo-1.jpg',
                    'completeUrl': '/uploads/media/complete',
                    'headers': {
                      'content-type': 'image/jpeg',
                    },
                  },
                ),
              );
              return;
            }

            if (options.path == '/uploads/media/complete') {
              final data = Map<String, dynamic>.from(options.data as Map);
              expect(data['scope'], 'profile_photo');
              expect(data['objectKey'], 'profile-photos/user-me/photo-1.jpg');
              expect(data['mimeType'], 'image/jpeg');
              expect(data['byteSize'], 3);
              expect(data['fileName'], 'photo.jpg');
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 201,
                  data: {
                    'photo': {
                      'id': 'photo-1',
                      'url': 'https://cdn.example.com/photo-1.jpg',
                      'order': 0,
                    },
                  },
                ),
              );
              return;
            }

            fail('Unexpected API request: ${options.method} ${options.path}');
          },
        ),
      );

    final uploadDio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            uploadRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: '',
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(
          ref: ref,
          dio: apiDio,
          createUploadDio: () => uploadDio,
        ),
      ),
    );

    final photo = await repository.uploadProfilePhotoFile(
      PlatformFile(
        name: 'photo.jpg',
        size: 3,
        path: imageFile.path,
      ),
    );

    expect(photo.id, 'photo-1');
    expect(photo.url, 'https://cdn.example.com/photo-1.jpg');
    expect(
      apiRequests.map((request) => request.path),
      ['/uploads/media/upload-url', '/uploads/media/complete'],
    );
    expect(
      apiRequests.any((request) => request.path == '/profile/me/photos/file'),
      false,
    );
    expect(uploadRequests, hasLength(1));
    expect(uploadRequests.single.method, 'PUT');
    expect(
      uploadRequests.single.path,
      'https://storage.example.com/profile-photo-1',
    );
    expect(uploadRequests.single.headers['content-type'], 'image/jpeg');
    expect(uploadRequests.single.headers['content-length'], 3);
  });

  test('falls back to API file upload when profile photo direct upload fails',
      () async {
    final tempDir = await Directory.systemTemp.createTemp('bb-upload-fallback');
    addTearDown(() async {
      if (await tempDir.exists()) {
        await tempDir.delete(recursive: true);
      }
    });
    final imageFile = File('${tempDir.path}/photo.jpg');
    await imageFile.writeAsBytes([1, 2, 3]);
    final apiRequests = <_CapturedRequest>[];

    final apiDio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            apiRequests.add(
              _CapturedRequest(
                method: options.method,
                path: options.path,
                headers: Map<String, dynamic>.from(options.headers),
              ),
            );
            if (options.path == '/uploads/media/upload-url') {
              handler.resolve(
                Response<Map<String, dynamic>>(
                  requestOptions: options,
                  statusCode: 200,
                  data: const {
                    'uploadUrl': 'https://storage.example.com/profile-photo-1',
                    'objectKey': 'avatars/user-me/profile-photo-1',
                    'completeUrl': '/uploads/media/complete',
                    'headers': {'content-type': 'image/jpeg'},
                  },
                ),
              );
              return;
            }
            if (options.path == '/uploads/media/file') {
              handler.resolve(
                Response<Map<String, dynamic>>(
                  requestOptions: options,
                  statusCode: 200,
                  data: const {
                    'photo': {
                      'id': 'photo-fallback',
                      'url': 'https://cdn.example.com/photo-fallback.jpg',
                      'order': 0,
                    },
                  },
                ),
              );
              return;
            }

            fail('Unexpected API request: ${options.method} ${options.path}');
          },
        ),
      );

    final uploadDio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                message: 'storage unavailable',
              ),
            );
          },
        ),
      );

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final repository = container.read(
      Provider(
        (ref) => BackendRepository(
          ref: ref,
          dio: apiDio,
          createUploadDio: () => uploadDio,
        ),
      ),
    );

    final photo = await repository.uploadProfilePhotoFile(
      PlatformFile(
        name: 'photo.jpg',
        size: 3,
        path: imageFile.path,
      ),
    );

    expect(photo.id, 'photo-fallback');
    expect(
      apiRequests.map((request) => request.path),
      ['/uploads/media/upload-url', '/uploads/media/file'],
    );
  });
}
