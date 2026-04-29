import 'package:big_break_mobile/app/core/network/api_client.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:typed_data';

void main() {
  test('keeps original 401 when token refresh fails', () async {
    var refreshCalls = 0;
    final client = ApiClient(
      readAccessToken: () async => 'expired-access',
      refreshTokens: () async {
        refreshCalls += 1;
        throw DioException.badResponse(
          statusCode: 401,
          requestOptions: RequestOptions(path: '/auth/refresh'),
          response: Response(
            requestOptions: RequestOptions(path: '/auth/refresh'),
            statusCode: 401,
          ),
        );
      },
    );
    client.dio.httpClientAdapter = _FakeAdapter(
      onFetch: (options) {
        if (options.path == '/profile/me') {
          return ResponseBody.fromString('', 401);
        }
        return ResponseBody.fromString('', 404);
      },
    );

    final future = client.dio.get('/profile/me');

    await expectLater(
      future,
      throwsA(
        isA<DioException>().having(
          (error) => error.requestOptions.path,
          'path',
          '/profile/me',
        ),
      ),
    );
    expect(refreshCalls, 1);
  });

  test('retries original request with fresh access token after refresh',
      () async {
    var refreshCalls = 0;
    var requestCalls = 0;
    final client = ApiClient(
      readAccessToken: () async => 'expired-access',
      refreshTokens: () async {
        refreshCalls += 1;
        return const AuthTokens(
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh',
        );
      },
    );
    client.dio.httpClientAdapter = _FakeAdapter(
      onFetch: (options) {
        requestCalls += 1;
        final authHeader = options.headers['authorization']?.toString();
        if (options.path == '/profile/me' &&
            authHeader == 'Bearer expired-access') {
          return ResponseBody.fromString('', 401);
        }
        return ResponseBody.fromString('{"ok":true}', 200, headers: {
          Headers.contentTypeHeader: ['application/json'],
        });
      },
    );

    final response = await client.dio.get<Map<String, dynamic>>('/profile/me');

    expect(response.data, {'ok': true});
    expect(refreshCalls, 1);
    expect(requestCalls, 2);
  });
}

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter({
    required this.onFetch,
  });

  final ResponseBody Function(RequestOptions options) onFetch;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return onFetch(options);
  }

  @override
  void close({bool force = false}) {}
}
