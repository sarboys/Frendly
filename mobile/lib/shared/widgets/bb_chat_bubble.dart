import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_chat_attachment_image.dart';
import 'package:big_break_mobile/shared/widgets/bb_voice_message.dart';
import 'package:flutter/material.dart';

class BbChatBubble extends StatelessWidget {
  const BbChatBubble({
    required this.author,
    required this.text,
    required this.time,
    super.key,
    this.authorId = '',
    this.authorAvatarUrl,
    this.chatId = '',
    this.messageClientId = '',
    this.isMine = false,
    this.showAuthor = false,
    this.showAvatar = false,
    this.isPending = false,
    this.replyTo,
    this.attachments = const [],
    this.onAttachmentTap,
    this.onAttachmentDownloadTap,
    this.onImageResolveLocalPath,
    this.onImageResolveRemoteUrl,
    this.onVoiceResolvePath,
    this.onVoiceResolveRemoteUrl,
    this.onReplyTap,
    this.onAuthorAvatarTap,
  });

  final String authorId;
  final String author;
  final String? authorAvatarUrl;
  final String text;
  final String time;
  final String chatId;
  final String messageClientId;
  final bool isMine;
  final bool showAuthor;
  final bool showAvatar;
  final bool isPending;
  final MessageReplyPreview? replyTo;
  final List<MessageAttachment> attachments;
  final Future<void> Function(MessageAttachment attachment)? onAttachmentTap;
  final Future<void> Function(MessageAttachment attachment)?
      onAttachmentDownloadTap;
  final Future<String?> Function(MessageAttachment attachment)?
      onImageResolveLocalPath;
  final Future<String?> Function(MessageAttachment attachment)?
      onImageResolveRemoteUrl;
  final Future<String?> Function(MessageAttachment attachment)?
      onVoiceResolvePath;
  final Future<String?> Function(MessageAttachment attachment)?
      onVoiceResolveRemoteUrl;
  final void Function(MessageReplyPreview replyTo)? onReplyTap;
  final void Function(String userId)? onAuthorAvatarTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final showText = _shouldShowText(text, attachments);

    if (isMine) {
      return Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.bubbleMe,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(10),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (replyTo != null) ...[
                    _ReplyQuote(
                      replyTo: replyTo!,
                      isMine: true,
                      onTap: onReplyTap == null
                          ? null
                          : () => onReplyTap!(replyTo!),
                    ),
                    const SizedBox(height: 6),
                  ],
                  if (showText)
                    Text(
                      text,
                      style: AppTextStyles.body.copyWith(
                        color: colors.bubbleMeForeground,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  if (attachments.isNotEmpty) ...[
                    if (showText) const SizedBox(height: AppSpacing.xs),
                    ...attachments.map(
                      (attachment) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: _AttachmentTile(
                          attachment: attachment,
                          isMine: true,
                          isPending: isPending,
                          onTap: onAttachmentTap,
                          onDownloadTap: onAttachmentDownloadTap,
                          onImageResolveLocalPath: onImageResolveLocalPath,
                          onImageResolveRemoteUrl: onImageResolveRemoteUrl,
                          onVoiceResolvePath: onVoiceResolvePath,
                          onVoiceResolveRemoteUrl: onVoiceResolveRemoteUrl,
                          chatId: chatId,
                          messageClientId: messageClientId,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    time,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.bubbleMeForeground.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(
          width: 28,
          child: showAvatar
              ? _AuthorAvatar(
                  authorId: authorId,
                  author: author,
                  imageUrl: authorAvatarUrl,
                  onTap: onAuthorAvatarTap,
                )
              : null,
        ),
        const SizedBox(width: AppSpacing.xs),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showAuthor)
                Padding(
                  padding:
                      const EdgeInsets.only(left: AppSpacing.sm, bottom: 4),
                  child: Text(
                    author,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkSoft,
                    ),
                  ),
                ),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 320),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.bubbleThem,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(24),
                      topRight: Radius.circular(24),
                      bottomLeft: Radius.circular(10),
                      bottomRight: Radius.circular(24),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (replyTo != null) ...[
                          _ReplyQuote(
                            replyTo: replyTo!,
                            isMine: false,
                            onTap: onReplyTap == null
                                ? null
                                : () => onReplyTap!(replyTo!),
                          ),
                          const SizedBox(height: 6),
                        ],
                        if (showText)
                          Text(
                            text,
                            style: AppTextStyles.body.copyWith(
                              color: colors.bubbleThemForeground,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        if (attachments.isNotEmpty) ...[
                          if (showText) const SizedBox(height: AppSpacing.xs),
                          ...attachments.map(
                            (attachment) => Padding(
                              padding:
                                  const EdgeInsets.only(bottom: AppSpacing.xs),
                              child: _AttachmentTile(
                                attachment: attachment,
                                isMine: false,
                                isPending: isPending,
                                onTap: onAttachmentTap,
                                onDownloadTap: onAttachmentDownloadTap,
                                onImageResolveLocalPath:
                                    onImageResolveLocalPath,
                                onImageResolveRemoteUrl:
                                    onImageResolveRemoteUrl,
                                onVoiceResolvePath: onVoiceResolvePath,
                                onVoiceResolveRemoteUrl:
                                    onVoiceResolveRemoteUrl,
                                chatId: chatId,
                                messageClientId: messageClientId,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 2),
                        Text(
                          time,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AuthorAvatar extends StatelessWidget {
  const _AuthorAvatar({
    required this.authorId,
    required this.author,
    required this.imageUrl,
    required this.onTap,
  });

  final String authorId;
  final String author;
  final String? imageUrl;
  final void Function(String userId)? onTap;

  @override
  Widget build(BuildContext context) {
    final avatar = BbAvatar(
      name: author,
      size: BbAvatarSize.sm,
      imageUrl: imageUrl,
    );
    final handleTap = onTap;
    final canOpenProfile = handleTap != null && authorId.isNotEmpty;

    if (!canOpenProfile) {
      return avatar;
    }

    return Semantics(
      button: true,
      label: 'Открыть профиль $author',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => handleTap(authorId),
        child: avatar,
      ),
    );
  }
}

class _ReplyQuote extends StatelessWidget {
  const _ReplyQuote({
    required this.replyTo,
    required this.isMine,
    required this.onTap,
  });

  final MessageReplyPreview replyTo;
  final bool isMine;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final quoteIsMine = replyTo.mine;
    final accent = quoteIsMine
        ? (isMine ? colors.bubbleMeForeground : colors.bubbleMe)
        : (isMine ? colors.bubbleMeForeground : colors.primary);
    final background = quoteIsMine
        ? (isMine
            ? colors.bubbleMeForeground.withValues(alpha: 0.12)
            : colors.primarySoft)
        : (isMine
            ? colors.bubbleMeForeground.withValues(alpha: 0.12)
            : colors.foreground.withValues(alpha: 0.05));
    final textColor = quoteIsMine
        ? (isMine
            ? colors.bubbleMeForeground.withValues(alpha: 0.82)
            : colors.foreground)
        : (isMine
            ? colors.bubbleMeForeground.withValues(alpha: 0.82)
            : colors.inkSoft);

    return Align(
      alignment: quoteIsMine ? Alignment.centerRight : Alignment.centerLeft,
      widthFactor: 1,
      child: SizedBox(
        width: _replyQuoteWidth(replyTo),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            key: Key(
              quoteIsMine
                  ? 'bb-chat-reply-quote-mine'
                  : 'bb-chat-reply-quote-other',
            ),
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(12),
              border: Border(
                left: quoteIsMine
                    ? BorderSide.none
                    : BorderSide(
                        color: accent,
                        width: 2,
                      ),
                right: quoteIsMine
                    ? BorderSide(
                        color: accent,
                        width: 2,
                      )
                    : BorderSide.none,
              ),
            ),
            child: Column(
              crossAxisAlignment: quoteIsMine
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  replyTo.mine ? 'Ты' : replyTo.author,
                  textAlign: quoteIsMine ? TextAlign.right : TextAlign.left,
                  style: AppTextStyles.caption.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  replyTo.isVoice ? 'Голосовое сообщение' : replyTo.text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: quoteIsMine ? TextAlign.right : TextAlign.left,
                  style: AppTextStyles.caption.copyWith(
                    color: textColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  double _replyQuoteWidth(MessageReplyPreview replyTo) {
    final authorLength = (replyTo.mine ? 'Ты' : replyTo.author).length;
    final textLength =
        (replyTo.isVoice ? 'Голосовое сообщение' : replyTo.text).length;
    final longest = authorLength > textLength ? authorLength : textLength;
    return (longest * 7.0 + 28).clamp(72.0, 220.0).toDouble();
  }
}

bool _shouldShowText(String text, List<MessageAttachment> attachments) {
  if (text.trim().isEmpty) {
    return false;
  }

  if (attachments.length == 1 && text.trim() == attachments.first.fileName) {
    return false;
  }

  return true;
}

class _AttachmentTile extends StatelessWidget {
  const _AttachmentTile({
    required this.attachment,
    required this.isMine,
    required this.isPending,
    required this.onTap,
    required this.onDownloadTap,
    required this.onImageResolveLocalPath,
    required this.onImageResolveRemoteUrl,
    required this.onVoiceResolvePath,
    required this.onVoiceResolveRemoteUrl,
    required this.chatId,
    required this.messageClientId,
  });

  final MessageAttachment attachment;
  final bool isMine;
  final bool isPending;
  final Future<void> Function(MessageAttachment attachment)? onTap;
  final Future<void> Function(MessageAttachment attachment)? onDownloadTap;
  final Future<String?> Function(MessageAttachment attachment)?
      onImageResolveLocalPath;
  final Future<String?> Function(MessageAttachment attachment)?
      onImageResolveRemoteUrl;
  final Future<String?> Function(MessageAttachment attachment)?
      onVoiceResolvePath;
  final Future<String?> Function(MessageAttachment attachment)?
      onVoiceResolveRemoteUrl;
  final String chatId;
  final String messageClientId;

  bool get _isLocationReady =>
      attachment.isLocation && attachment.status == 'ready';

  bool get _isImageReady =>
      attachment.mimeType.startsWith('image/') &&
      (attachment.localBytes != null ||
          (attachment.localPath != null && attachment.localPath!.isNotEmpty) ||
          (attachment.status == 'ready' &&
              ((attachment.url != null && attachment.url!.isNotEmpty) ||
                  (attachment.downloadUrlPath != null &&
                      attachment.downloadUrlPath!.isNotEmpty))));

  bool get _isVoiceReady =>
      attachment.isVoice &&
      attachment.durationMs != null &&
      ((attachment.localPath != null && attachment.localPath!.isNotEmpty) ||
          (attachment.status == 'ready' && attachment.url != null));

  bool get _isFileReady =>
      !attachment.isLocation &&
      !attachment.isVoice &&
      !attachment.mimeType.startsWith('image/') &&
      (attachment.localBytes != null ||
          (attachment.localPath != null && attachment.localPath!.isNotEmpty) ||
          (attachment.status == 'ready' && attachment.url != null));

  bool get _isReady =>
      _isLocationReady || _isImageReady || _isVoiceReady || _isFileReady;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final foreground =
        isMine ? colors.bubbleMeForeground : colors.bubbleThemForeground;
    final subtitleColor = isMine
        ? colors.bubbleMeForeground.withValues(alpha: 0.7)
        : colors.inkMute;
    final background = isMine
        ? colors.bubbleMeForeground.withValues(alpha: 0.16)
        : colors.background;

    return Material(
      color: background,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: _isReady && onTap != null ? () => onTap!(attachment) : null,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: _isImageReady
              ? EdgeInsets.zero
              : const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: attachment.isLocation
              ? _LocationTileContent(
                  attachment: attachment,
                  foreground: foreground,
                  subtitleColor: subtitleColor,
                  isPending: isPending,
                  isReady: _isLocationReady,
                )
              : attachment.isVoice
                  ? SizedBox(
                      width: 184,
                      child: BbVoiceMessage(
                        chatId: chatId,
                        playbackId: messageClientId.isEmpty
                            ? attachment.id
                            : messageClientId,
                        attachmentId: attachment.id,
                        isMine: isMine,
                        url: attachment.url,
                        localPath: attachment.localPath,
                        durationMs: attachment.durationMs ?? 0,
                        waveform: attachment.waveform ?? const [],
                        resolveLocalPath: onVoiceResolvePath == null
                            ? null
                            : () => onVoiceResolvePath!(attachment),
                        resolveRemoteUrl: onVoiceResolveRemoteUrl == null
                            ? null
                            : () => onVoiceResolveRemoteUrl!(attachment),
                      ),
                    )
                  : _isImageReady
                      ? Stack(
                          children: [
                            BbChatAttachmentImage(
                              attachment: attachment,
                              width: 184,
                              height: 148,
                              fit: BoxFit.cover,
                              borderRadius: BorderRadius.circular(16),
                              placeholderColor: background,
                              foregroundColor: foreground,
                              resolveLocalPath: onImageResolveLocalPath,
                              resolveRemoteUrl: onImageResolveRemoteUrl,
                            ),
                            if (attachment.status == 'uploading')
                              Positioned.fill(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  alignment: Alignment.center,
                                  child: SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        foreground,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        )
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 28,
                              height: 28,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: foreground.withValues(
                                    alpha: isMine ? 0.14 : 0.08),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: _isReady
                                  ? Icon(
                                      _iconForAttachment(attachment),
                                      size: 16,
                                      color: foreground,
                                    )
                                  : SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                                foreground),
                                      ),
                                    ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Flexible(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    attachment.fileName,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTextStyles.body.copyWith(
                                      color: foreground,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _isReady
                                        ? 'Скачать на телефон'
                                        : 'Загрузка файла...',
                                    style: AppTextStyles.caption.copyWith(
                                      color: subtitleColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (_isReady) ...[
                              const SizedBox(width: AppSpacing.xs),
                              GestureDetector(
                                onTap: onDownloadTap == null
                                    ? null
                                    : () => onDownloadTap!(attachment),
                                child: Icon(
                                  Icons.download_rounded,
                                  size: 18,
                                  color: foreground,
                                ),
                              ),
                            ],
                          ],
                        ),
        ),
      ),
    );
  }
}

class _LocationTileContent extends StatelessWidget {
  const _LocationTileContent({
    required this.attachment,
    required this.foreground,
    required this.subtitleColor,
    required this.isPending,
    required this.isReady,
  });

  final MessageAttachment attachment;
  final Color foreground;
  final Color subtitleColor;
  final bool isPending;
  final bool isReady;

  @override
  Widget build(BuildContext context) {
    final title = attachment.title ?? attachment.fileName;
    final subtitle = attachment.subtitle ?? '';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: foreground.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(12),
          ),
          child: isReady
              ? Icon(
                  Icons.place_outlined,
                  size: 18,
                  color: foreground,
                )
              : SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(foreground),
                  ),
                ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (subtitle.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: subtitleColor,
                  ),
                ),
              ],
              const SizedBox(height: 2),
              Text(
                isReady
                    ? attachment.isExpired
                        ? 'Трансляция окончена'
                        : 'Открыть карту'
                    : 'Отправляем локацию...',
                style: AppTextStyles.caption.copyWith(
                  color: subtitleColor,
                ),
              ),
            ],
          ),
        ),
        if (isReady) ...[
          const SizedBox(width: AppSpacing.xs),
          Icon(
            Icons.open_in_full_rounded,
            size: 18,
            color: foreground,
          ),
        ],
      ],
    );
  }
}

IconData _iconForAttachment(MessageAttachment attachment) {
  if (attachment.isLocation) {
    return Icons.place_outlined;
  }

  if (attachment.mimeType.contains('pdf')) {
    return Icons.picture_as_pdf_rounded;
  }

  if (attachment.mimeType.startsWith('image/')) {
    return Icons.image_rounded;
  }

  return Icons.attach_file_rounded;
}
