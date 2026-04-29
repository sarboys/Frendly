import 'dart:io';

import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

typedef BbAttachmentPathResolver = Future<String?> Function(
  MessageAttachment attachment,
);

class BbChatAttachmentImage extends StatefulWidget {
  const BbChatAttachmentImage({
    required this.attachment,
    required this.width,
    required this.height,
    required this.fit,
    required this.borderRadius,
    required this.placeholderColor,
    required this.foregroundColor,
    super.key,
    this.resolveLocalPath,
    this.resolveRemoteUrl,
  });

  final MessageAttachment attachment;
  final double width;
  final double height;
  final BoxFit fit;
  final BorderRadius borderRadius;
  final Color placeholderColor;
  final Color foregroundColor;
  final BbAttachmentPathResolver? resolveLocalPath;
  final BbAttachmentPathResolver? resolveRemoteUrl;

  @override
  State<BbChatAttachmentImage> createState() => _BbChatAttachmentImageState();
}

class _BbChatAttachmentImageState extends State<BbChatAttachmentImage> {
  late Future<_ChatAttachmentImageSource> _sourceFuture;

  @override
  void initState() {
    super.initState();
    _sourceFuture = _resolveSource();
  }

  @override
  void didUpdateWidget(BbChatAttachmentImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.attachment.id != widget.attachment.id ||
        oldWidget.attachment.status != widget.attachment.status ||
        oldWidget.attachment.url != widget.attachment.url ||
        oldWidget.attachment.localPath != widget.attachment.localPath ||
        oldWidget.attachment.localBytes != widget.attachment.localBytes ||
        oldWidget.resolveLocalPath != widget.resolveLocalPath ||
        oldWidget.resolveRemoteUrl != widget.resolveRemoteUrl) {
      _sourceFuture = _resolveSource();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: widget.borderRadius,
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: FutureBuilder<_ChatAttachmentImageSource>(
          future: _sourceFuture,
          builder: (context, snapshot) {
            final source = snapshot.data;
            if (source == null) {
              return _placeholder();
            }

            return switch (source.kind) {
              _ChatAttachmentImageSourceKind.memory => Image.memory(
                  widget.attachment.localBytes!,
                  fit: widget.fit,
                ),
              _ChatAttachmentImageSourceKind.file => Image.file(
                  source.file!,
                  fit: widget.fit,
                ),
              _ChatAttachmentImageSourceKind.network => CachedNetworkImage(
                  imageUrl: source.url!,
                  cacheKey: 'chat-attachment-${widget.attachment.id}',
                  cacheManager: chatAttachmentCacheManager,
                  fit: widget.fit,
                  placeholder: (context, _) => _placeholder(),
                  errorWidget: (context, _, __) => _error(),
                ),
              _ChatAttachmentImageSourceKind.missing => _error(),
            };
          },
        ),
      ),
    );
  }

  Future<_ChatAttachmentImageSource> _resolveSource() async {
    if (widget.attachment.localBytes != null) {
      return const _ChatAttachmentImageSource.memory();
    }

    final directLocalPath = widget.attachment.localPath;
    final directLocalFile = _existingFile(directLocalPath);
    if (directLocalFile != null) {
      return _ChatAttachmentImageSource.file(directLocalFile);
    }

    final resolvedLocalPath = await widget.resolveLocalPath?.call(
      widget.attachment,
    );
    final resolvedLocalFile = _existingFile(resolvedLocalPath);
    if (resolvedLocalFile != null) {
      return _ChatAttachmentImageSource.file(resolvedLocalFile);
    }

    final resolvedUrl = await widget.resolveRemoteUrl?.call(widget.attachment);
    final url = (resolvedUrl?.trim().isNotEmpty ?? false)
        ? resolvedUrl!.trim()
        : widget.attachment.url?.trim();
    if (url != null && url.isNotEmpty) {
      return _ChatAttachmentImageSource.network(url);
    }

    return const _ChatAttachmentImageSource.missing();
  }

  File? _existingFile(String? path) {
    if (path == null || path.isEmpty) {
      return null;
    }

    final file = File(path);
    try {
      if (file.existsSync()) {
        return file;
      }
    } catch (_) {}

    return null;
  }

  Widget _placeholder() {
    return Container(
      color: widget.placeholderColor,
      alignment: Alignment.center,
      child: SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(widget.foregroundColor),
        ),
      ),
    );
  }

  Widget _error() {
    return Container(
      color: widget.placeholderColor,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(16),
      child: Icon(
        Icons.image_not_supported_outlined,
        color: widget.foregroundColor,
      ),
    );
  }
}

enum _ChatAttachmentImageSourceKind {
  memory,
  file,
  network,
  missing,
}

class _ChatAttachmentImageSource {
  const _ChatAttachmentImageSource._({
    required this.kind,
    this.file,
    this.url,
  });

  const _ChatAttachmentImageSource.memory()
      : this._(kind: _ChatAttachmentImageSourceKind.memory);

  const _ChatAttachmentImageSource.file(File file)
      : this._(
          kind: _ChatAttachmentImageSourceKind.file,
          file: file,
        );

  const _ChatAttachmentImageSource.network(String url)
      : this._(
          kind: _ChatAttachmentImageSourceKind.network,
          url: url,
        );

  const _ChatAttachmentImageSource.missing()
      : this._(kind: _ChatAttachmentImageSourceKind.missing);

  final _ChatAttachmentImageSourceKind kind;
  final File? file;
  final String? url;
}
