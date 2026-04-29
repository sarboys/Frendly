import 'dart:io' as io;
import 'dart:typed_data';

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
// ignore: depend_on_referenced_packages
import 'package:file/memory.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:dio/dio.dart';
// ignore: depend_on_referenced_packages
import 'package:file/file.dart' as pfile;
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryCacheFileSystem implements FileSystem {
  _MemoryCacheFileSystem() : _delegate = MemoryFileSystem();

  final MemoryFileSystem _delegate;

  @override
  Future<pfile.File> createFile(String name) async {
    final file = _delegate.file(name);
    await file.parent.create(recursive: true);
    return file;
  }
}

class _FakeCacheManager extends CacheManager {
  _FakeCacheManager(this.file)
      : super(
          Config(
            'bb-attachment-service-test',
            repo: JsonCacheInfoRepository.withFile(
              io.File(
                '${io.Directory.systemTemp.path}/bb-attachment-service-test.json',
              ),
            ),
            fileSystem: _MemoryCacheFileSystem(),
          ),
        );

  final pfile.File file;
  Map<String, String>? lastHeaders;
  String? lastKey;
  String? lastUrl;
  var getSingleFileCalls = 0;

  @override
  Future<pfile.File> getSingleFile(
    String url, {
    String? key,
    Map<String, String>? headers,
  }) async {
    getSingleFileCalls += 1;
    lastUrl = url;
    lastKey = key;
    lastHeaders = headers;
    return file;
  }

  @override
  Future<FileInfo?> getFileFromCache(
    String key, {
    bool ignoreMemCache = false,
  }) async {
    return null;
  }

  @override
  Future<FileInfo?> getFileFromMemory(String key) async {
    return null;
  }

  @override
  Stream<FileInfo> getFile(
    String url, {
    String? key,
    Map<String, String>? headers,
  }) {
    throw UnimplementedError();
  }

  @override
  Stream<FileResponse> getFileStream(
    String url, {
    String? key,
    Map<String, String>? headers,
    bool withProgress = false,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<FileInfo> downloadFile(
    String url, {
    String? key,
    Map<String, String>? authHeaders,
    bool force = false,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<pfile.File> putFile(
    String url,
    Uint8List fileBytes, {
    String? key,
    String? eTag,
    Duration maxAge = const Duration(days: 30),
    String fileExtension = 'file',
  }) {
    throw UnimplementedError();
  }

  @override
  Future<pfile.File> putFileStream(
    String url,
    Stream<List<int>> source, {
    String? key,
    String? eTag,
    Duration maxAge = const Duration(days: 30),
    String fileExtension = 'file',
  }) {
    throw UnimplementedError();
  }

  @override
  Future<void> removeFile(String key) async {}

  @override
  Future<void> emptyCache() async {}

  @override
  Future<void> dispose() async {}
}

void main() {
  test('voice attachment cache fetch uses signed playback url when available',
      () async {
    final cachedFile = MemoryFileSystem().file('/voice.m4a');
    await cachedFile.writeAsString('voice');

    var requestedPath = '';
    final apiDio = Dio(
      BaseOptions(baseUrl: BackendConfig.apiBaseUrl),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requestedPath = options.path;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'url': 'https://storage.example.com/signed-voice-1',
                },
              ),
            );
          },
        ),
      );

    final cacheManager = _FakeCacheManager(cachedFile);
    final service = DefaultAppAttachmentService(
      cacheManager: cacheManager,
      apiDio: apiDio,
      accessTokenProvider: () async => 'access-token',
    );

    await service.getCachedFile(
      const MessageAttachment(
        id: 'voice-1',
        kind: 'chat_voice',
        status: 'ready',
        url: '${BackendConfig.apiBaseUrl}/media/voice-1',
        mimeType: 'audio/mp4',
        byteSize: 1024,
        fileName: 'voice.m4a',
        durationMs: 1000,
      ),
    );

    expect(requestedPath, '/media/voice-1/download-url');
    expect(cacheManager.lastUrl, 'https://storage.example.com/signed-voice-1');
    expect(cacheManager.lastHeaders, isNull);
  });

  test('attachment service prefers backend download url path when provided',
      () async {
    var requestedPath = '';
    final apiDio = Dio(
      BaseOptions(baseUrl: BackendConfig.apiBaseUrl),
    )..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requestedPath = options.path;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'url': 'https://storage.example.com/signed-direct',
                },
              ),
            );
          },
        ),
      );

    final cachedFile = MemoryFileSystem().file('/photo.jpg');
    await cachedFile.writeAsString('photo');
    final service = DefaultAppAttachmentService(
      cacheManager: _FakeCacheManager(cachedFile),
      apiDio: apiDio,
    );

    final signedUrl = await service.getDownloadUrl(
      const MessageAttachment(
        id: 'asset-1',
        kind: 'chat_attachment',
        status: 'ready',
        url: '${BackendConfig.apiBaseUrl}/media/legacy-asset',
        downloadUrlPath: '/media/asset-1/download-url',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        fileName: 'photo.jpg',
      ),
    );

    expect(requestedPath, '/media/asset-1/download-url');
    expect(signedUrl, 'https://storage.example.com/signed-direct');
  });

  test('attachment service adds auth header for protected backend media',
      () async {
    final cachedFile = MemoryFileSystem().file('/voice.m4a');
    await cachedFile.writeAsString('voice');

    final cacheManager = _FakeCacheManager(cachedFile);
    final service = DefaultAppAttachmentService(
      cacheManager: cacheManager,
      accessTokenProvider: () async => 'access-token',
    );

    await service.getCachedFile(
      const MessageAttachment(
        id: 'voice-1',
        kind: 'chat_voice',
        status: 'ready',
        url: '${BackendConfig.apiBaseUrl}/media/voice-1',
        mimeType: 'audio/mp4',
        byteSize: 1024,
        fileName: 'voice.m4a',
        durationMs: 1000,
      ),
    );

    expect(cacheManager.getSingleFileCalls, 1);
    expect(cacheManager.lastUrl, '${BackendConfig.apiBaseUrl}/media/voice-1');
    expect(cacheManager.lastKey, 'chat-attachment-voice-1');
    expect(
      cacheManager.lastHeaders,
      containsPair('Authorization', 'Bearer access-token'),
    );
  });
}
