import 'dart:convert';

import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MemoryAuthTokenStorage implements AuthTokenStorage {
  _MemoryAuthTokenStorage([this.value]);

  String? value;

  @override
  Future<void> delete() async {
    value = null;
  }

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String value) async {
    this.value = value;
  }
}

void main() {
  test('clears persisted tokens when refresh endpoint returns 401', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage(
      '{"accessToken":"expired-access","refreshToken":"expired-refresh"}',
    );
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.reject(
            DioException.badResponse(
              statusCode: 401,
              requestOptions: options,
              response: Response(
                requestOptions: options,
                statusCode: 401,
              ),
            ),
          );
        },
      ),
    );
    final controller = AuthTokensController(
      prefs,
      tokenStorage: storage,
      initialTokens: const AuthTokens(
        accessToken: 'expired-access',
        refreshToken: 'expired-refresh',
      ),
      createRefreshDio: () => dio,
    );

    await expectLater(
      controller.refreshTokens(),
      throwsA(isA<DioException>()),
    );

    expect(controller.state, isNull);
    expect(storage.value, isNull);
  });

  test('shares one in-flight refresh across parallel callers', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage();
    var refreshCalls = 0;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          refreshCalls += 1;
          await Future<void>.delayed(const Duration(milliseconds: 10));
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              data: const {
                'accessToken': 'fresh-access',
                'refreshToken': 'fresh-refresh',
              },
            ),
          );
        },
      ),
    );
    final controller = AuthTokensController(
      prefs,
      tokenStorage: storage,
      initialTokens: const AuthTokens(
        accessToken: 'expired-access',
        refreshToken: 'expired-refresh',
      ),
      createRefreshDio: () => dio,
    );

    final results = await Future.wait([
      controller.refreshTokens(),
      controller.refreshTokens(),
      controller.refreshTokens(),
    ]);

    expect(refreshCalls, 1);
    expect(results.every((item) => item.accessToken == 'fresh-access'), isTrue);
    expect(
      storage.value,
      jsonEncode(const AuthTokens(
        accessToken: 'fresh-access',
        refreshToken: 'fresh-refresh',
      ).toJson()),
    );
  });
}
