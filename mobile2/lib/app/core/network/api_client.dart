import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile2/app/core/config/backend_config.dart';
import 'package:mobile2/shared/models/backend_models.dart';

const _requestDedupeKeyExtra = '_dateasyRequestDedupeKey';
const _requestCallerCancelTokenExtra = '_dateasyCallerCancelToken';

class ApiClient {
  ApiClient({
    required Future<String?> Function() readAccessToken,
    required Future<AuthTokens> Function() refreshTokens,
    String apiBaseUrl = BackendConfig.apiBaseUrl,
    HttpClientAdapter? adapter,
  })  : _readAccessToken = readAccessToken,
        _refreshTokens = refreshTokens,
        dio = Dio(
          BaseOptions(
            baseUrl: apiBaseUrl,
            connectTimeout: const Duration(seconds: 10),
            sendTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 20),
            headers: {'content-type': 'application/json'},
          ),
        ) {
    if (adapter != null) {
      dio.httpClientAdapter = adapter;
    }
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final skipAuthHeader = options.extra['skipAuthHeader'] == true;
          final token = skipAuthHeader ? null : await _readAccessToken();
          if (token != null &&
              token.isNotEmpty &&
              options.headers['authorization'] == null) {
            options.headers['authorization'] = 'Bearer $token';
          }

          final dedupeKey = _dedupeKey(options, token);
          if (dedupeKey == null) {
            handler.next(options);
            return;
          }

          final pending = _inFlightGetRequests[dedupeKey];
          if (pending != null) {
            try {
              handler
                  .resolve(await _awaitDedupeResponse(pending.future, options));
            } on DioException catch (error) {
              handler.reject(error);
            } catch (error, stackTrace) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  error: error,
                  stackTrace: stackTrace,
                ),
              );
            }
            return;
          }

          final completer = Completer<Response<dynamic>>();
          completer.future.catchError((_) => Response<dynamic>(
                requestOptions: options,
              ));
          _inFlightGetRequests[dedupeKey] = completer;
          options.extra[_requestDedupeKeyExtra] = dedupeKey;
          final callerCancelToken = options.cancelToken;
          if (callerCancelToken != null) {
            options.extra[_requestCallerCancelTokenExtra] = callerCancelToken;
            options.cancelToken = null;
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          _completeDedupe(response.requestOptions, response);
          final callerCancelError = _callerCancelError(response.requestOptions);
          if (callerCancelError != null) {
            handler.reject(callerCancelError);
            return;
          }
          handler.next(response);
        },
        onError: (error, handler) async {
          final canRefresh = error.response?.statusCode == 401 &&
              error.requestOptions.extra['skipAuthRefresh'] != true &&
              error.requestOptions.extra['retried'] != true;
          if (!canRefresh) {
            _completeDedupeError(error.requestOptions, error);
            handler.next(error);
            return;
          }

          try {
            final tokens = await _refreshOnce();
            final retryOptions = _copyForRetry(error.requestOptions, tokens);
            final response = await dio.fetch<dynamic>(retryOptions);
            _completeDedupe(error.requestOptions, response);
            handler.resolve(response);
          } on DioException catch (retryError) {
            _completeDedupeError(error.requestOptions, retryError);
            handler.reject(retryError);
          } catch (retryError, stackTrace) {
            final wrapped = DioException(
              requestOptions: error.requestOptions,
              error: retryError,
              stackTrace: stackTrace,
            );
            _completeDedupeError(error.requestOptions, wrapped);
            handler.reject(wrapped);
          }
        },
      ),
    );
  }

  final Dio dio;
  final Future<String?> Function() _readAccessToken;
  final Future<AuthTokens> Function() _refreshTokens;
  final Map<String, Completer<Response<dynamic>>> _inFlightGetRequests = {};
  Future<AuthTokens>? _refreshFuture;

  Future<AuthTokens> _refreshOnce() {
    final existing = _refreshFuture;
    if (existing != null) {
      return existing;
    }
    final future = _refreshTokens();
    _refreshFuture = future;
    future.whenComplete(() {
      if (identical(_refreshFuture, future)) {
        _refreshFuture = null;
      }
    });
    return future;
  }

  RequestOptions _copyForRetry(RequestOptions source, AuthTokens tokens) {
    final headers = Map<String, dynamic>.of(source.headers);
    headers['authorization'] = 'Bearer ${tokens.accessToken}';
    final extra = Map<String, dynamic>.of(source.extra);
    extra['retried'] = true;
    extra['skipRequestDeduplication'] = true;
    return source.copyWith(
      method: source.method,
      path: source.path,
      data: source.data,
      queryParameters: Map<String, dynamic>.of(source.queryParameters),
      baseUrl: source.baseUrl,
      cancelToken: source.cancelToken,
      connectTimeout: source.connectTimeout,
      sendTimeout: source.sendTimeout,
      receiveTimeout: source.receiveTimeout,
      headers: headers,
      extra: extra,
      responseType: source.responseType,
      validateStatus: source.validateStatus,
      receiveDataWhenStatusError: source.receiveDataWhenStatusError,
      followRedirects: source.followRedirects,
      maxRedirects: source.maxRedirects,
      requestEncoder: source.requestEncoder,
      responseDecoder: source.responseDecoder,
      listFormat: source.listFormat,
    );
  }

  String? _dedupeKey(RequestOptions options, String? token) {
    if (options.method.toUpperCase() != 'GET' ||
        options.extra['skipRequestDeduplication'] == true ||
        options.responseType == ResponseType.stream) {
      return null;
    }
    final query = Map<String, dynamic>.from(options.queryParameters);
    final queryKeys = query.keys.map((key) => key.toString()).toList()..sort();
    final queryPart = queryKeys.map((key) => '$key=${query[key]}').join('&');
    final authScope =
        token == null || token.isEmpty ? 'public' : 'auth:${shortHash(token)}';
    return '${options.method.toUpperCase()} ${options.baseUrl}${options.path}'
        '?$queryPart $authScope';
  }

  @visibleForTesting
  static int shortHash(String value) => Object.hashAll(value.codeUnits);

  void _completeDedupe(RequestOptions options, Response<dynamic> response) {
    final key = options.extra[_requestDedupeKeyExtra] as String?;
    if (key == null) {
      return;
    }
    _inFlightGetRequests.remove(key)?.complete(response);
  }

  void _completeDedupeError(RequestOptions options, DioException error) {
    final key = options.extra[_requestDedupeKeyExtra] as String?;
    if (key == null) {
      return;
    }
    _inFlightGetRequests.remove(key)?.completeError(error, error.stackTrace);
  }

  Future<Response<dynamic>> _awaitDedupeResponse(
    Future<Response<dynamic>> response,
    RequestOptions options,
  ) {
    final cancelToken = options.cancelToken;
    if (cancelToken == null) {
      return response;
    }
    return Future.any([
      response,
      cancelToken.whenCancel.then<Response<dynamic>>((error) => throw error),
    ]);
  }

  DioException? _callerCancelError(RequestOptions options) {
    final cancelToken = options.extra[_requestCallerCancelTokenExtra];
    if (cancelToken is CancelToken && cancelToken.isCancelled) {
      return cancelToken.cancelError;
    }
    return null;
  }
}
