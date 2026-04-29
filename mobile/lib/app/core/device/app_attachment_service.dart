import 'dart:io';

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/models/backend_url.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/utils/voice_metrics.dart';
import 'package:dio/dio.dart';
import 'package:file_saver/file_saver.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';

final appAttachmentServiceProvider = Provider<AppAttachmentService>(
  (ref) => DefaultAppAttachmentService(
    apiDio: ref.read(apiClientProvider).dio,
    accessTokenProvider: ref.read(authTokensProvider.notifier).readAccessToken,
  ),
);

abstract class AppAttachmentService {
  Future<String?> getDownloadUrl(MessageAttachment attachment);
  Future<File?> getLocalFileIfAvailable(MessageAttachment attachment);
  Future<File> getCachedFile(MessageAttachment attachment);
  Future<void> openAttachment(MessageAttachment attachment);
  Future<String> saveAttachmentToDevice(MessageAttachment attachment);
  Future<void> clearPrivateCache();
  Future<void> warmCache(MessageAttachment attachment);
}

class DefaultAppAttachmentService implements AppAttachmentService {
  DefaultAppAttachmentService({
    CacheManager? cacheManager,
    Future<String?> Function()? accessTokenProvider,
    Dio? apiDio,
    VoiceMetricReporter? voiceMetricReporter,
  })  : _cacheManager = cacheManager ?? chatAttachmentCacheManager,
        _accessTokenProvider = accessTokenProvider,
        _apiDio = apiDio,
        _voiceMetricReporter = voiceMetricReporter;

  final Future<String?> Function()? _accessTokenProvider;
  final CacheManager _cacheManager;
  final Dio? _apiDio;
  final VoiceMetricReporter? _voiceMetricReporter;

  @override
  Future<String?> getDownloadUrl(MessageAttachment attachment) async {
    final downloadUrlPath = attachment.downloadUrlPath;
    if (downloadUrlPath != null &&
        downloadUrlPath.isNotEmpty &&
        _apiDio != null) {
      try {
        final response = await _apiDio.get<Map<String, dynamic>>(
          downloadUrlPath,
        );
        return resolveBackendUrl(response.data?['url'] as String?);
      } catch (_) {}
    }

    final url = attachment.url;
    if (url == null || url.isEmpty) {
      return null;
    }

    if (!_isProtectedBackendMediaUrl(url) || _apiDio == null) {
      return url;
    }

    final assetId = _extractAssetId(url);
    if (assetId == null) {
      return url;
    }

    try {
      final response = await _apiDio.get<Map<String, dynamic>>(
        '/media/$assetId/download-url',
      );
      return resolveBackendUrl(response.data?['url'] as String?);
    } catch (_) {
      return url;
    }
  }

  @override
  Future<File?> getLocalFileIfAvailable(MessageAttachment attachment) async {
    final localPath = attachment.localPath;
    if (localPath != null && localPath.isNotEmpty) {
      final file = File(localPath);
      try {
        if (await file.exists()) {
          return file;
        }
      } catch (_) {}
    }

    if (attachment.localBytes != null) {
      return _persistLocalAttachment(attachment);
    }

    final cached = await _cacheManager.getFileFromCache(_cacheKey(attachment));
    final file = cached?.file;
    if (file == null) {
      return null;
    }

    try {
      if (await file.exists()) {
        return file;
      }
    } catch (_) {}

    return null;
  }

  @override
  Future<File> getCachedFile(MessageAttachment attachment) async {
    final stopwatch = attachment.isVoice ? (Stopwatch()..start()) : null;
    final localFile = await getLocalFileIfAvailable(attachment);
    if (localFile != null) {
      if (stopwatch != null) {
        emitVoiceMetric(
          'voice_cache_fetch_ms',
          stopwatch,
          reporter: _voiceMetricReporter,
        );
      }
      return localFile;
    }

    final downloadUrl = await getDownloadUrl(attachment);
    final url = attachment.url;
    if ((downloadUrl == null || downloadUrl.isEmpty) &&
        (url == null || url.isEmpty)) {
      throw StateError('attachment_url_missing');
    }

    final effectiveUrl = downloadUrl ?? url!;
    final headers =
        effectiveUrl == url ? await _buildHeadersForUrl(url!) : null;
    final file = headers == null
        ? await _cacheManager.getSingleFile(
            effectiveUrl,
            key: _cacheKey(attachment),
          )
        : await _cacheManager.getSingleFile(
            effectiveUrl,
            key: _cacheKey(attachment),
            headers: headers,
          );

    if (stopwatch != null) {
      emitVoiceMetric(
        'voice_cache_fetch_ms',
        stopwatch,
        reporter: _voiceMetricReporter,
      );
    }

    return file;
  }

  @override
  Future<void> openAttachment(MessageAttachment attachment) async {
    final file = await getCachedFile(attachment);
    final result = await OpenFilex.open(file.path);
    if (result.type != ResultType.done) {
      throw StateError(result.message);
    }
  }

  @override
  Future<String> saveAttachmentToDevice(MessageAttachment attachment) async {
    final file = await getCachedFile(attachment);
    final fileName = _baseName(attachment.fileName);
    final extension = _extension(attachment.fileName);

    return FileSaver.instance.saveFile(
      name: fileName,
      file: file,
      fileExtension: extension,
      mimeType: _mimeTypeFor(attachment.mimeType),
    );
  }

  @override
  Future<void> clearPrivateCache() async {
    await _cacheManager.emptyCache();
  }

  @override
  Future<void> warmCache(MessageAttachment attachment) async {
    try {
      await getCachedFile(attachment);
    } catch (_) {}
  }

  Future<Map<String, String>?> _buildHeadersForUrl(String url) async {
    if (!_isProtectedBackendMediaUrl(url) || _accessTokenProvider == null) {
      return null;
    }

    final token = await _accessTokenProvider();
    if (token == null || token.isEmpty) {
      return null;
    }

    return {'Authorization': 'Bearer $token'};
  }

  String _cacheKey(MessageAttachment attachment) {
    return 'chat-attachment-${attachment.id}';
  }

  String? _extractAssetId(String url) {
    final targetUri = Uri.tryParse(url);
    if (targetUri == null || targetUri.pathSegments.length < 2) {
      return null;
    }

    if (targetUri.pathSegments[0] != 'media') {
      return null;
    }

    return targetUri.pathSegments[1];
  }

  bool _isProtectedBackendMediaUrl(String url) {
    final targetUri = Uri.tryParse(url);
    final backendUri = Uri.tryParse(BackendConfig.apiBaseUrl);
    if (targetUri == null || backendUri == null) {
      return false;
    }

    final sameOrigin = targetUri.scheme == backendUri.scheme &&
        targetUri.host == backendUri.host &&
        targetUri.port == backendUri.port;
    if (!sameOrigin) {
      return false;
    }

    return targetUri.path.startsWith('/media/');
  }

  Future<File> _persistLocalAttachment(MessageAttachment attachment) async {
    final tempDirectory = await Directory.systemTemp.createTemp(
      'bb-attachment-',
    );
    final fileName = _safeFileName(
      attachment.fileName.isEmpty ? attachment.id : attachment.fileName,
    );
    final file = File('${tempDirectory.path}/$fileName');
    await file.writeAsBytes(attachment.localBytes!, flush: true);
    return file;
  }

  String _baseName(String value) {
    final dot = value.lastIndexOf('.');
    if (dot <= 0) {
      return value;
    }
    return value.substring(0, dot);
  }

  String _extension(String value) {
    final dot = value.lastIndexOf('.');
    if (dot <= 0 || dot == value.length - 1) {
      return '';
    }
    return value.substring(dot + 1);
  }

  String _safeFileName(String value) {
    final sanitized = value.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
    return sanitized.isEmpty ? 'attachment' : sanitized;
  }

  MimeType _mimeTypeFor(String raw) {
    switch (raw) {
      case 'application/pdf':
        return MimeType.pdf;
      case 'image/png':
        return MimeType.png;
      case 'image/jpeg':
      case 'image/jpg':
        return MimeType.jpeg;
      case 'image/gif':
        return MimeType.gif;
      case 'image/webp':
        return MimeType.webp;
      case 'text/plain':
        return MimeType.text;
      case 'application/zip':
        return MimeType.zip;
      default:
        return MimeType.other;
    }
  }
}

final chatAttachmentCacheManager = CacheManager(
  Config(
    'chatAttachmentCache',
    stalePeriod: const Duration(days: 14),
    maxNrOfCacheObjects: 256,
  ),
);
