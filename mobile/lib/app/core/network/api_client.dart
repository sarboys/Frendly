import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class ApiClient {
  ApiClient({
    required Future<String?> Function() readAccessToken,
    required Future<AuthTokens> Function() refreshTokens,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: BackendConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 20),
            headers: {
              'content-type': 'application/json',
            },
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final skipAuthHeader = options.extra['skipAuthHeader'] == true;
          final token = skipAuthHeader ? null : await readAccessToken();
          final hasExplicitAuthHeader =
              options.headers['authorization'] != null;
          if (!hasExplicitAuthHeader && token != null && token.isNotEmpty) {
            options.headers['authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final skipAuthRefresh =
              error.requestOptions.extra['skipAuthRefresh'] == true;
          if (error.response?.statusCode == 401 &&
              !skipAuthRefresh &&
              error.requestOptions.extra['retried'] != true) {
            try {
              _debugAuthLog('Auth refresh started after 401');
              final tokens = await refreshTokens();
              final cloned = await _retry(
                error.requestOptions,
                tokens.accessToken,
              );
              _debugAuthLog('Auth refresh succeeded, retrying request');
              handler.resolve(cloned);
              return;
            } catch (refreshError) {
              _debugAuthLog(
                'Auth refresh failed: ${refreshError.runtimeType}',
              );
              handler.next(error);
              return;
            }
          }

          handler.next(error);
        },
      ),
    );
  }

  final Dio _dio;

  Dio get dio => _dio;

  Future<Response<dynamic>> _retry(
    RequestOptions requestOptions,
    String accessToken,
  ) {
    final options = Options(
      method: requestOptions.method,
      headers: {
        ...requestOptions.headers,
        'authorization': 'Bearer $accessToken',
      },
      extra: {
        ...requestOptions.extra,
        'retried': true,
      },
    );

    return _dio.request<dynamic>(
      requestOptions.path,
      data: requestOptions.data,
      queryParameters: requestOptions.queryParameters,
      options: options,
    );
  }
}

void _debugAuthLog(String message) {
  if (kDebugMode || kProfileMode) {
    debugPrint(message);
  }
}
