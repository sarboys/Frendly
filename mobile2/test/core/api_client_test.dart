import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/network/api_client.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('deduplicates equal GET requests inside one auth scope', () async {
    var calls = 0;
    final adapter = _FakeAdapter((options) async {
      calls++;
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return _jsonResponse(options, 200, {'ok': true});
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async => 'token-a',
      refreshTokens: () async => const AuthTokens(
        accessToken: 'unused',
        refreshToken: 'unused',
      ),
      adapter: adapter,
    );

    final results = await Future.wait([
      client.dio.get('/events', queryParameters: {'limit': 10}),
      client.dio.get('/events', queryParameters: {'limit': 10}),
    ]);

    expect(results.map((response) => response.data), [
      {'ok': true},
      {'ok': true},
    ]);
    expect(calls, 1);
  });

  test('deduplicates equal GET requests with caller cancel tokens', () async {
    var calls = 0;
    final adapter = _FakeAdapter((options) async {
      calls++;
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return _jsonResponse(options, 200, {'ok': true});
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async => 'token-a',
      refreshTokens: () async => const AuthTokens(
        accessToken: 'unused',
        refreshToken: 'unused',
      ),
      adapter: adapter,
    );

    await Future.wait([
      client.dio.get(
        '/events',
        queryParameters: {'limit': 10},
        cancelToken: CancelToken(),
      ),
      client.dio.get(
        '/events',
        queryParameters: {'limit': 10},
        cancelToken: CancelToken(),
      ),
    ]);

    expect(calls, 1);
  });

  test('keeps shared GET request alive when first caller cancels', () async {
    var calls = 0;
    final adapter = _FakeAdapter((options) async {
      calls++;
      final response = Future<ResponseBody>.delayed(
        const Duration(milliseconds: 20),
        () => _jsonResponse(options, 200, {'ok': true}),
      );
      return Future.any([
        response,
        options.cancelToken?.whenCancel.then<ResponseBody>((error) {
              throw error;
            }) ??
            Completer<ResponseBody>().future,
      ]);
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async => 'token-a',
      refreshTokens: () async => const AuthTokens(
        accessToken: 'unused',
        refreshToken: 'unused',
      ),
      adapter: adapter,
    );
    final firstCancel = CancelToken();
    final secondCancel = CancelToken();

    final first = client.dio.get(
      '/events',
      queryParameters: {'limit': 10},
      cancelToken: firstCancel,
    );
    final second = client.dio.get(
      '/events',
      queryParameters: {'limit': 10},
      cancelToken: secondCancel,
    );
    await Future<void>.delayed(Duration.zero);
    firstCancel.cancel('disposed');

    await expectLater(first, throwsA(isA<DioException>()));
    final secondResponse = await second;

    expect(secondResponse.data, {'ok': true});
    expect(calls, 1);
  });

  test('keeps GET dedupe separate for different auth scopes', () async {
    var calls = 0;
    var tokenReads = 0;
    final adapter = _FakeAdapter((options) async {
      calls++;
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return _jsonResponse(options, 200, {'ok': true});
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async {
        tokenReads++;
        return tokenReads == 1 ? 'token-a' : 'token-b';
      },
      refreshTokens: () async => const AuthTokens(
        accessToken: 'unused',
        refreshToken: 'unused',
      ),
      adapter: adapter,
    );

    final first = client.dio.get('/profile/me');
    final second = client.dio.get('/profile/me');
    await Future.wait([first, second]);

    expect(calls, 2);
  });

  test('does not deduplicate GET stream responses', () async {
    var calls = 0;
    final adapter = _FakeAdapter((options) async {
      calls++;
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return ResponseBody.fromString(
        'stream-$calls',
        200,
        headers: {
          Headers.contentTypeHeader: ['text/plain'],
        },
      );
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async => 'token-a',
      refreshTokens: () async => const AuthTokens(
        accessToken: 'unused',
        refreshToken: 'unused',
      ),
      adapter: adapter,
    );

    await Future.wait([
      client.dio.get<ResponseBody>(
        '/files/export',
        options: Options(responseType: ResponseType.stream),
      ),
      client.dio.get<ResponseBody>(
        '/files/export',
        options: Options(responseType: ResponseType.stream),
      ),
    ]);

    expect(calls, 2);
  });

  test('refreshes once after 401 and retries the original request', () async {
    var calls = 0;
    var refreshCalls = 0;
    var token = 'expired';
    final adapter = _FakeAdapter((options) async {
      calls++;
      if (calls == 1) {
        return _jsonResponse(options, 401, {'error': 'expired'});
      }
      return _jsonResponse(options, 200, {
        'method': options.method,
        'query': options.queryParameters,
        'body': options.data,
        'auth': options.headers['authorization'],
      });
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async => token,
      refreshTokens: () async {
        refreshCalls++;
        token = 'fresh';
        return const AuthTokens(accessToken: 'fresh', refreshToken: 'refresh');
      },
      adapter: adapter,
    );

    final response = await client.dio.post(
      '/events',
      queryParameters: {'city': 'Moscow'},
      data: {'title': 'Coffee'},
      options: Options(headers: {'x-test': '1'}),
    );

    expect(refreshCalls, 1);
    expect(calls, 2);
    expect(response.data, {
      'method': 'POST',
      'query': {'city': 'Moscow'},
      'body': {'title': 'Coffee'},
      'auth': 'Bearer fresh',
    });
  });

  test('coalesces concurrent token refreshes after multiple 401 responses',
      () async {
    var calls = 0;
    var refreshCalls = 0;
    var token = 'expired';
    final adapter = _FakeAdapter((options) async {
      calls++;
      if (options.headers['authorization'] == 'Bearer expired') {
        return _jsonResponse(options, 401, {'error': 'expired'});
      }
      return _jsonResponse(options, 200, {
        'path': options.path,
        'auth': options.headers['authorization'],
      });
    });
    final client = ApiClient(
      apiBaseUrl: 'https://api.test',
      readAccessToken: () async => token,
      refreshTokens: () async {
        refreshCalls++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        token = 'fresh';
        return const AuthTokens(accessToken: 'fresh', refreshToken: 'refresh');
      },
      adapter: adapter,
    );

    final responses = await Future.wait([
      client.dio.post('/events', data: {'title': 'Coffee'}),
      client.dio.post('/profile/me', data: {'name': 'Alex'}),
    ]);

    expect(refreshCalls, 1);
    expect(calls, 4);
    expect(responses.map((response) => response.data['auth']), [
      'Bearer fresh',
      'Bearer fresh',
    ]);
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
  int statusCode,
  Map<String, Object?> body,
) {
  return ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}
