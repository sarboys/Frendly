import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/device/app_media_picker_service.dart';
import 'package:big_break_mobile/app/core/device/app_permission_service.dart';
import 'package:big_break_mobile/app/core/device/app_voice_recorder_service.dart';
import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_providers.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_screen.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/widgets/bb_chat_attachment_image.dart';
import 'package:big_break_mobile/shared/widgets/bb_composer.dart';
import 'package:big_break_mobile/shared/widgets/bb_message_actions_sheet.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' show Point;

class CommunityChatScreen extends ConsumerStatefulWidget {
  const CommunityChatScreen({
    required this.communityId,
    super.key,
  });

  final String communityId;

  @override
  ConsumerState<CommunityChatScreen> createState() =>
      _CommunityChatScreenState();
}

class _CommunityChatScreenState extends ConsumerState<CommunityChatScreen> {
  MessageReplyPreview? _replyTo;
  Message? _editingMessage;
  String? _markedReadChatId;

  Future<void> _openAttachment(MessageAttachment attachment) async {
    if (attachment.mimeType.startsWith('image/')) {
      if (!mounted) {
        return;
      }
      await showDialog<void>(
        context: context,
        builder: (context) => Dialog.fullscreen(
          backgroundColor: Colors.black,
          child: Stack(
            children: [
              Center(
                child: InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 4,
                  child: Builder(
                    builder: (context) {
                      final size = MediaQuery.sizeOf(context);
                      return BbChatAttachmentImage(
                        attachment: attachment,
                        width: size.width,
                        height: size.height,
                        fit: BoxFit.contain,
                        borderRadius: BorderRadius.zero,
                        placeholderColor: Colors.black,
                        foregroundColor: Colors.white,
                        resolveLocalPath: _resolveAttachmentPath,
                        resolveRemoteUrl: _resolveAttachmentUrl,
                      );
                    },
                  ),
                ),
              ),
              Positioned(
                top: 24,
                left: 16,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(
                    Icons.close_rounded,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
      return;
    }

    if (attachment.isLocation &&
        attachment.latitude != null &&
        attachment.longitude != null) {
      if (attachment.isExpired) {
        _showSnackBar('Трансляция окончена');
        return;
      }
      if (!mounted) {
        return;
      }
      await context.pushRoute(
        AppRoute.chatLocation,
        queryParameters: {
          'latitude': attachment.latitude!.toString(),
          'longitude': attachment.longitude!.toString(),
          'title': attachment.title ?? attachment.fileName,
          'subtitle': attachment.subtitle ?? '',
        },
      );
      return;
    }

    try {
      await ref
          .read(appAttachmentServiceProvider)
          .saveAttachmentToDevice(attachment);
    } catch (_) {
      _showSnackBar('Не получилось сохранить файл');
    }
  }

  Future<void> _downloadAttachment(MessageAttachment attachment) async {
    try {
      await ref
          .read(appAttachmentServiceProvider)
          .saveAttachmentToDevice(attachment);
      _showSnackBar('Файл сохранён на устройство');
    } catch (_) {
      _showSnackBar('Не получилось сохранить файл');
    }
  }

  Future<String?> _resolveVoicePath(MessageAttachment attachment) async {
    return _resolveAttachmentPath(attachment);
  }

  Future<String?> _resolveAttachmentPath(MessageAttachment attachment) async {
    final file = await ref
        .read(appAttachmentServiceProvider)
        .getLocalFileIfAvailable(attachment);
    if (file == null) {
      return null;
    }
    return file.path;
  }

  Future<String?> _resolveVoiceUrl(MessageAttachment attachment) {
    return _resolveAttachmentUrl(attachment);
  }

  Future<String?> _resolveAttachmentUrl(MessageAttachment attachment) {
    return ref.read(appAttachmentServiceProvider).getDownloadUrl(attachment);
  }

  Future<void> _handleAttachmentAction(
    BbComposerAttachmentAction action,
    String chatId,
  ) async {
    switch (action) {
      case BbComposerAttachmentAction.photo:
        await _pickPhoto(chatId);
        return;
      case BbComposerAttachmentAction.file:
        await _pickFile(chatId);
        return;
      case BbComposerAttachmentAction.location:
        await _shareCurrentLocation(chatId);
        return;
    }
  }

  Future<void> _pickPhoto(String chatId) async {
    final permitted =
        await ref.read(appPermissionServiceProvider).requestPhotos();
    if (!permitted) {
      _showSnackBar('Нет доступа к фото');
      return;
    }

    final file =
        await ref.read(appMediaPickerServiceProvider).pickFromGallery();
    if (file == null) {
      return;
    }

    await ref.read(chatThreadProvider(chatId).notifier).sendAttachment(
          file,
          replyTo: _replyTo,
        );
    _clearReply();
  }

  Future<void> _pickFile(String chatId) async {
    final result = await FilePicker.platform.pickFiles(withData: false);
    final files = result?.files;
    if (files == null || files.isEmpty) {
      return;
    }

    await ref.read(chatThreadProvider(chatId).notifier).sendAttachment(
          files.first,
          replyTo: _replyTo,
        );
    _clearReply();
  }

  Future<void> _shareCurrentLocation(String chatId) async {
    final permissionGranted =
        await ref.read(appPermissionServiceProvider).requestLocation();
    if (!permissionGranted) {
      _showSnackBar('Нет доступа к геопозиции');
      return;
    }

    try {
      final position = await Geolocator.getCurrentPosition();
      final point = Point(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      final resolved =
          await ref.read(yandexMapServiceProvider).reverseGeocode(point);
      final subtitle = resolved?.address ??
          '${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}';
      await ref.read(chatThreadProvider(chatId).notifier).sendCurrentLocation(
            latitude: point.latitude,
            longitude: point.longitude,
            title: 'Ты здесь',
            subtitle: subtitle,
            replyTo: _replyTo,
          );
      _clearReply();
    } catch (_) {
      _showSnackBar('Не получилось определить локацию');
    }
  }

  void _clearReply() {
    if (!mounted) {
      return;
    }
    setState(() {
      _replyTo = null;
    });
  }

  void _clearEditing() {
    if (!mounted) {
      return;
    }
    setState(() {
      _editingMessage = null;
    });
  }

  Future<void> _handleSendText(String chatId, String text) async {
    final editingMessage = _editingMessage;
    final controller = ref.read(chatThreadProvider(chatId).notifier);
    if (editingMessage != null) {
      await controller.editMessage(editingMessage, text);
      _clearEditing();
      return;
    }

    await controller.sendMessage(
      text,
      replyTo: _replyTo,
    );
    _clearReply();
  }

  MessageReplyPreview _toReplyPreview(Message message) {
    final hasVoice =
        message.attachments.any((attachment) => attachment.isVoice);
    final hasLocation =
        message.attachments.any((attachment) => attachment.isLocation);
    final previewText = hasVoice
        ? 'Голосовое сообщение'
        : hasLocation
            ? 'Локация'
            : message.text.trim().isNotEmpty
                ? message.text
                : message.attachments.isNotEmpty
                    ? 'Вложение'
                    : 'Сообщение';

    return MessageReplyPreview(
      id: message.id,
      authorId: message.authorId,
      author: message.author,
      text: previewText,
      isVoice: hasVoice,
      mine: message.mine,
    );
  }

  Future<void> _handleMessageLongPress(String chatId, Message message) async {
    final action = await showBbMessageActionsSheet(
      context,
      message: message,
    );
    if (action == null || !mounted) {
      return;
    }

    switch (action) {
      case BbMessageActionType.reply:
        setState(() {
          _replyTo = _toReplyPreview(message);
          _editingMessage = null;
        });
        return;
      case BbMessageActionType.copy:
        await Clipboard.setData(ClipboardData(text: message.text));
        _showSnackBar('Скопировано');
        return;
      case BbMessageActionType.edit:
        setState(() {
          _replyTo = null;
          _editingMessage = message;
        });
        return;
      case BbMessageActionType.delete:
        await ref.read(chatThreadProvider(chatId).notifier).deleteMessage(
              message,
            );
        if (_editingMessage?.id == message.id) {
          _clearEditing();
        }
        return;
    }
  }

  Future<bool> _requestMicrophonePermission() async {
    final granted =
        await ref.read(appPermissionServiceProvider).requestMicrophone();
    if (!granted) {
      _showSnackBar('Нет доступа к микрофону');
    }
    return granted;
  }

  void _markReadOnce(String chatId) {
    if (_markedReadChatId == chatId) {
      return;
    }

    _markedReadChatId = chatId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      ref.read(chatThreadProvider(chatId).notifier).markRead();
    });
  }

  void _leaveChat() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return;
    }

    try {
      context.goRoute(AppRoute.communities);
    } catch (_) {}
  }

  void _showSnackBar(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final communityAsync = ref.watch(communityProvider(widget.communityId));

    return communityAsync.when(
      loading: () => Scaffold(
        backgroundColor: colors.background,
        body: Center(
          child: CircularProgressIndicator(color: colors.primary),
        ),
      ),
      error: (_, __) => const CommunityMissingState(),
      data: (community) {
        if (community == null) {
          return const CommunityMissingState();
        }

        final chatId = community.chatId;
        _markReadOnce(chatId);
        final messagesAsync = ref.watch(chatThreadProvider(chatId));

        return ChatThreadScreen(
          header: CommunityBackHeader(
            title: community.name,
            subtitle: 'Чат сообщества',
            onBack: _leaveChat,
          ),
          topContent: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: _CommunityChatIntro(community: community),
          ),
          messagesAsync: messagesAsync,
          onMessageReply: (message) {
            setState(() {
              _replyTo = _toReplyPreview(message);
              _editingMessage = null;
            });
          },
          onMessageLongPress: (message) =>
              _handleMessageLongPress(chatId, message),
          onAttachmentTap: _openAttachment,
          onAttachmentDownloadTap: _downloadAttachment,
          onImageResolvePath: _resolveAttachmentPath,
          onImageResolveRemoteUrl: _resolveAttachmentUrl,
          onVoiceResolvePath: _resolveVoicePath,
          onVoiceResolveRemoteUrl: _resolveVoiceUrl,
          onAuthorAvatarTap: (userId) {
            context.pushRoute(
              AppRoute.userProfile,
              pathParameters: {'userId': userId},
            );
          },
          composer: BbComposer(
            hintText: 'Сообщение в клуб',
            onSend: (text) => _handleSendText(chatId, text),
            onAttachmentActionSelected: (action) =>
                _handleAttachmentAction(action, chatId),
            onSendVoice: (voice) => ref
                .read(chatThreadProvider(chatId).notifier)
                .sendVoiceMessage(
                  voice,
                  replyTo: _replyTo,
                )
                .then((_) => _clearReply()),
            onRequestMicrophonePermission: _requestMicrophonePermission,
            voiceRecorderService: ref.read(appVoiceRecorderServiceProvider),
            replyTo: _replyTo,
            onCancelReply: _clearReply,
            editingMessage: _editingMessage == null
                ? null
                : MessageEditDraft(
                    id: _editingMessage!.id,
                    text: _editingMessage!.text,
                  ),
            onCancelEdit: _clearEditing,
          ),
        );
      },
    );
  }
}

class _CommunityChatIntro extends StatelessWidget {
  const _CommunityChatIntro({
    required this.community,
  });

  final Community community;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return CommunityInfoCard(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Общий поток сообщества'.toUpperCase(),
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Сообщения и контекст ближайших встреч',
                    style: AppTextStyles.cardTitle.copyWith(
                      color: colors.foreground,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Icon(LucideIcons.users, size: 20, color: colors.inkSoft),
          ],
        ),
        if (community.nextMeetup case final meetup?) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: colors.background,
              border: Border.all(color: colors.border),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommunityAvatarBox(
                  emoji: meetup.emoji,
                  size: 44,
                  radius: 16,
                  fontSize: 22,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Контекст встречи: ${meetup.title}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodySoft.copyWith(
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 12,
                        runSpacing: 4,
                        children: [
                          _InlineMetaIcon(
                            icon: LucideIcons.clock_3,
                            label: meetup.time,
                          ),
                          _InlineMetaIcon(
                            icon: LucideIcons.map_pin,
                            label: meetup.place,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _InlineMetaIcon extends StatelessWidget {
  const _InlineMetaIcon({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: colors.inkMute),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTextStyles.meta.copyWith(
            color: colors.inkMute,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
