import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/device/app_media_picker_service.dart';
import 'package:big_break_mobile/app/core/device/app_permission_service.dart';
import 'package:big_break_mobile/app/core/device/app_voice_recorder_service.dart';
import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_style.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_screen.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_chat_attachment_image.dart';
import 'package:big_break_mobile/shared/widgets/bb_composer.dart';
import 'package:big_break_mobile/shared/widgets/bb_message_actions_sheet.dart';
import 'package:big_break_mobile/shared/widgets/bb_pinned_meetup_card.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' show Point;

class MeetupChatScreen extends ConsumerStatefulWidget {
  const MeetupChatScreen({
    required this.chatId,
    this.afterDarkGlow,
    super.key,
  });

  final String chatId;
  final String? afterDarkGlow;

  @override
  ConsumerState<MeetupChatScreen> createState() => _MeetupChatScreenState();
}

class _MeetupChatScreenState extends ConsumerState<MeetupChatScreen> {
  MessageReplyPreview? _replyTo;
  Message? _editingMessage;
  final Set<String> _processingEveningRequestIds = <String>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(chatThreadProvider(widget.chatId).notifier).markRead();
    });
  }

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
      BbComposerAttachmentAction action) async {
    switch (action) {
      case BbComposerAttachmentAction.photo:
        await _pickPhoto();
        return;
      case BbComposerAttachmentAction.file:
        await _pickFile();
        return;
      case BbComposerAttachmentAction.location:
        await _shareCurrentLocation();
        return;
    }
  }

  Future<void> _pickPhoto() async {
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

    await ref.read(chatThreadProvider(widget.chatId).notifier).sendAttachment(
          file,
          replyTo: _replyTo,
        );
    _clearReply();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(withData: false);
    final file = result?.files.firstOrNull;
    if (file == null) {
      return;
    }

    await ref.read(chatThreadProvider(widget.chatId).notifier).sendAttachment(
          file,
          replyTo: _replyTo,
        );
    _clearReply();
  }

  Future<void> _shareCurrentLocation() async {
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
      await ref
          .read(chatThreadProvider(widget.chatId).notifier)
          .sendCurrentLocation(
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

  Future<void> _handleSendText(String text) async {
    final editingMessage = _editingMessage;
    final controller = ref.read(chatThreadProvider(widget.chatId).notifier);
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

  Future<void> _handleMessageLongPress(Message message) async {
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
        await ref
            .read(chatThreadProvider(widget.chatId).notifier)
            .deleteMessage(message);
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

  void _showSnackBar(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  String _statusLine(MeetupChat? chat) {
    if (chat == null) {
      return '';
    }

    switch (chat.phase) {
      case MeetupPhase.live:
        final step = chat.currentStep == null || chat.totalSteps == null
            ? 'LIVE'
            : 'LIVE · Шаг ${chat.currentStep}/${chat.totalSteps}';
        final place = chat.currentPlace;
        return place == null || place.isEmpty ? step : '$step · $place';
      case MeetupPhase.soon:
        return 'Скоро · ${chat.startsInLabel ?? chat.time}';
      case MeetupPhase.done:
        return 'Завершено';
      case MeetupPhase.upcoming:
        final status = chat.status ?? '';
        return '${chat.members.length} участников · $status ${chat.time}'
            .trim();
    }
  }

  @override
  Widget build(BuildContext context) {
    final baseTheme = Theme.of(context);
    final chat = ref.watch(meetupChatSummaryProvider(widget.chatId));
    final isAfterDark =
        widget.afterDarkGlow != null || (chat?.isAfterDark ?? false);
    final glow = widget.afterDarkGlow ?? chat?.afterDarkGlow;
    final themeColors = isAfterDark
        ? buildAfterDarkChatColors(
            baseTheme.extension<BigBreakThemeColors>() ?? AppColors.lightTheme,
            glow: glow,
          )
        : (baseTheme.extension<BigBreakThemeColors>() ?? AppColors.lightTheme);
    final messagesAsync = ref.watch(chatThreadProvider(widget.chatId));
    final currentUserId = ref.watch(currentUserIdProvider);
    final isEveningHost = chat != null &&
        chat.sessionId != null &&
        chat.hostUserId != null &&
        chat.hostUserId == currentUserId;
    final eveningSessionAsync = isEveningHost
        ? ref.watch(eveningSessionProvider(chat.sessionId!))
        : null;
    final eventAsync = chat?.eventId == null || isAfterDark
        ? null
        : ref.watch(eventDetailProvider(chat!.eventId!));

    return Theme(
      data: baseTheme.copyWith(extensions: [themeColors]),
      child: Builder(
        builder: (context) {
          final colors = AppColors.of(context);
          final eveningPin = chat != null &&
                  chat.phase == MeetupPhase.live &&
                  chat.routeId != null
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: _EveningPinnedStepCard(
                    chat: chat,
                    onTap: () => context.pushRoute(
                      AppRoute.eveningLive,
                      pathParameters: {'routeId': chat.routeId!},
                      queryParameters: {
                        'mode': eveningLaunchModeToJson(chat.mode),
                        if (chat.sessionId != null)
                          'sessionId': chat.sessionId!,
                      },
                    ),
                  ),
                )
              : null;
          final eveningStartBanner = chat != null &&
                  chat.routeId != null &&
                  chat.hostUserId == currentUserId &&
                  (chat.phase == MeetupPhase.soon ||
                      chat.phase == MeetupPhase.upcoming)
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: _EveningStartLiveBanner(
                    onTap: () => _startEveningLive(chat),
                  ),
                )
              : null;
          final eventPin = chat != null && eventAsync != null
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: eventAsync.when(
                    data: (event) => BbPinnedMeetupCard(
                      chat: chat,
                      place: event.place,
                      onTap: () => context.pushRoute(
                        AppRoute.eventDetail,
                        pathParameters: {'eventId': event.id},
                      ),
                    ),
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                )
              : null;
          final eveningRequestsPanel = chat != null &&
                  eveningSessionAsync != null
              ? eveningSessionAsync.when(
                  data: (session) => session.pendingRequests.isEmpty
                      ? null
                      : Padding(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                          child: _EveningJoinRequestsPanel(
                            requests: session.pendingRequests,
                            busyIds: _processingEveningRequestIds,
                            onApprove: (request) => _handleEveningJoinRequest(
                              chat,
                              request,
                              approve: true,
                            ),
                            onReject: (request) => _handleEveningJoinRequest(
                              chat,
                              request,
                              approve: false,
                            ),
                          ),
                        ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                )
              : null;
          final eveningInvitePanel = chat != null && eveningSessionAsync != null
              ? eveningSessionAsync.when(
                  data: (session) {
                    final inviteLink = _eveningInviteLink(session);
                    if (session.privacy != EveningPrivacy.invite ||
                        inviteLink == null) {
                      return null;
                    }
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      child: _EveningInviteLinkPanel(
                        inviteLink: inviteLink,
                        onCopy: () => _copyEveningInviteLink(session),
                      ),
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                )
              : null;
          final topItems = [
            if (eveningPin != null) eveningPin,
            if (eveningPin == null && eventPin != null) eventPin,
            if (eveningStartBanner != null) eveningStartBanner,
            if (eveningInvitePanel != null) eveningInvitePanel,
            if (eveningRequestsPanel != null) eveningRequestsPanel,
          ];
          return ChatThreadScreen(
            header: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: colors.border.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => context.pop(),
                        icon: Icon(
                          LucideIcons.chevron_left,
                          color: colors.foreground,
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              chat?.title ?? 'Чат встречи',
                              style: AppTextStyles.itemTitle.copyWith(
                                color: colors.foreground,
                              ),
                            ),
                            Text(
                              _statusLine(chat),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.meta.copyWith(
                                color: colors.inkSoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (chat != null &&
                          chat.routeId != null &&
                          chat.phase != MeetupPhase.done &&
                          isEveningHost)
                        IconButton(
                          tooltip: 'Редактировать вечер',
                          onPressed: () => context.pushRoute(
                            AppRoute.eveningEdit,
                            pathParameters: {'routeId': chat.routeId!},
                            queryParameters: {'chatId': chat.id},
                          ),
                          icon: Icon(
                            LucideIcons.pencil,
                            size: 18,
                            color: colors.inkSoft,
                          ),
                        ),
                      BbAvatarStack(
                        names: (chat?.members ?? const <String>[])
                            .where((item) => item != 'Ты')
                            .toList(growable: false),
                        size: BbAvatarSize.xs,
                        max: 3,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            topContent: topItems.isEmpty
                ? null
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: topItems,
                  ),
            messagesAsync: messagesAsync,
            onMessageReply: (message) {
              setState(() {
                _replyTo = _toReplyPreview(message);
                _editingMessage = null;
              });
            },
            onMessageLongPress: _handleMessageLongPress,
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
            trailingStatus: (chat?.typing ?? false)
                ? (messages) =>
                    _TypingIndicator(name: chat?.lastAuthor ?? 'Кто-то')
                : null,
            composer: BbComposer(
              onSend: _handleSendText,
              onAttachmentActionSelected: _handleAttachmentAction,
              onSendVoice: (voice) => ref
                  .read(chatThreadProvider(widget.chatId).notifier)
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
      ),
    );
  }

  Future<void> _startEveningLive(MeetupChat chat) async {
    final sessionId = chat.sessionId;
    if (sessionId != null && sessionId.isNotEmpty) {
      try {
        await ref
            .read(backendRepositoryProvider)
            .startEveningSession(sessionId);
        ref.invalidate(eveningSessionProvider(sessionId));
        ref.invalidate(eveningSessionsProvider);
        ref.invalidate(meetupChatsProvider);
      } catch (_) {
        _showSnackBar('Не получилось запустить live');
        return;
      }
    }
    if (!mounted || chat.routeId == null) {
      return;
    }
    await context.pushRoute(
      AppRoute.eveningLive,
      pathParameters: {'routeId': chat.routeId!},
      queryParameters: {
        'mode': eveningLaunchModeToJson(chat.mode),
        if (chat.sessionId != null) 'sessionId': chat.sessionId!,
      },
    );
  }

  String? _eveningInviteLink(EveningSessionDetail session) {
    final token = session.inviteToken?.trim();
    if (token == null || token.isEmpty) {
      return null;
    }
    final sessionId = Uri.encodeComponent(session.id);
    final inviteToken = Uri.encodeQueryComponent(token);
    return 'bigbreak://evening-preview/$sessionId?inviteToken=$inviteToken';
  }

  Future<void> _copyEveningInviteLink(EveningSessionDetail session) async {
    final inviteLink = _eveningInviteLink(session);
    if (inviteLink == null) {
      _showSnackBar('Инвайт недоступен');
      return;
    }
    await Clipboard.setData(ClipboardData(text: inviteLink));
    _showSnackBar('Инвайт скопирован');
  }

  Future<void> _handleEveningJoinRequest(
    MeetupChat chat,
    EveningSessionJoinRequest request, {
    required bool approve,
  }) async {
    final sessionId = chat.sessionId;
    if (sessionId == null || sessionId.isEmpty) {
      return;
    }
    if (_processingEveningRequestIds.contains(request.id)) {
      return;
    }

    setState(() {
      _processingEveningRequestIds.add(request.id);
    });
    try {
      final repository = ref.read(backendRepositoryProvider);
      if (approve) {
        await repository.approveEveningJoinRequest(sessionId, request.id);
      } else {
        await repository.rejectEveningJoinRequest(sessionId, request.id);
      }
      ref.invalidate(eveningSessionProvider(sessionId));
      ref.invalidate(eveningSessionsProvider);
      ref.invalidate(meetupChatsProvider);
    } catch (_) {
      _showSnackBar(
        approve ? 'Не получилось принять заявку' : 'Не получилось отклонить',
      );
    } finally {
      if (mounted) {
        setState(() {
          _processingEveningRequestIds.remove(request.id);
        });
      }
    }
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _EveningStartLiveBanner extends StatelessWidget {
  const _EveningStartLiveBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: colors.foreground,
            borderRadius: BorderRadius.circular(20),
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.background.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.play,
                  color: colors.background,
                  size: 21,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Все на месте? Запусти live',
                      style: AppTextStyles.itemTitle.copyWith(
                        color: colors.background,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Активирует таймлайн, чек-ины и перки для группы',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.background.withValues(alpha: 0.72),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                LucideIcons.sparkles,
                size: 16,
                color: colors.background.withValues(alpha: 0.72),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EveningInviteLinkPanel extends StatelessWidget {
  const _EveningInviteLinkPanel({
    required this.inviteLink,
    required this.onCopy,
  });

  final String inviteLink;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      key: const ValueKey('meetup-chat-evening-invite'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.muted,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Icon(
              LucideIcons.link,
              color: colors.foreground,
              size: 18,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Инвайт-ссылка',
                  style: AppTextStyles.itemTitle.copyWith(
                    color: colors.foreground,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  inviteLink,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(
                    color: colors.inkSoft,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: onCopy,
                    icon: const Icon(LucideIcons.copy, size: 16),
                    label: const Text('Скопировать'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EveningJoinRequestsPanel extends StatelessWidget {
  const _EveningJoinRequestsPanel({
    required this.requests,
    required this.busyIds,
    required this.onApprove,
    required this.onReject,
  });

  final List<EveningSessionJoinRequest> requests;
  final Set<String> busyIds;
  final ValueChanged<EveningSessionJoinRequest> onApprove;
  final ValueChanged<EveningSessionJoinRequest> onReject;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final visibleRequests = requests.take(3).toList(growable: false);
    return Container(
      key: const ValueKey('meetup-chat-evening-requests'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colors.warmStart,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.user_check,
                  size: 16,
                  color: colors.secondary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Заявки на вечер',
                  style: AppTextStyles.itemTitle.copyWith(
                    color: colors.foreground,
                    fontSize: 14,
                  ),
                ),
              ),
              Text(
                '${requests.length}',
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final request in visibleRequests) ...[
            _EveningJoinRequestTile(
              request: request,
              busy: busyIds.contains(request.id),
              onApprove: () => onApprove(request),
              onReject: () => onReject(request),
            ),
            if (request != visibleRequests.last)
              const SizedBox(height: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}

class _EveningJoinRequestTile extends StatelessWidget {
  const _EveningJoinRequestTile({
    required this.request,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final EveningSessionJoinRequest request;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              BbAvatar(name: request.name, size: BbAvatarSize.sm),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  request.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.itemTitle.copyWith(fontSize: 13),
                ),
              ),
            ],
          ),
          if ((request.note ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              request.note!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: colors.inkSoft),
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  child: Text(busy ? '...' : 'Отклонить'),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onApprove,
                  child: Text(busy ? '...' : 'Принять'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EveningPinnedStepCard extends StatelessWidget {
  const _EveningPinnedStepCard({
    required this.chat,
    required this.onTap,
  });

  final MeetupChat chat;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final step = chat.currentStep == null || chat.totalSteps == null
        ? 'LIVE'
        : 'Шаг ${chat.currentStep}/${chat.totalSteps}';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: const Key('meetup-chat-evening-pin'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: colors.primarySoft,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colors.primary.withValues(alpha: 0.22)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(15),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.map_pin,
                  color: colors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: colors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          step,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      chat.currentPlace ?? chat.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.itemTitle.copyWith(
                        color: colors.foreground,
                      ),
                    ),
                    Text(
                      'Открыть таймлайн',
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkSoft,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                LucideIcons.chevron_right,
                color: colors.inkSoft,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator({
    required this.name,
  });

  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Semantics(
      label: '$name печатает',
      child: Row(
        key: const Key('meetup-chat-typing-indicator'),
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          BbAvatar(
            name: name,
            size: BbAvatarSize.sm,
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: colors.bubbleThem,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _TypingDot(delay: 0, color: colors.inkMute),
                const SizedBox(width: 4),
                _TypingDot(delay: 120, color: colors.inkMute),
                const SizedBox(width: 4),
                _TypingDot(delay: 240, color: colors.inkMute),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingDot extends StatefulWidget {
  const _TypingDot({
    required this.delay,
    required this.color,
  });

  final int delay;
  final Color color;

  @override
  State<_TypingDot> createState() => _TypingDotState();
}

class _TypingDotState extends State<_TypingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.35, end: 1).animate(
        CurvedAnimation(
          parent: _controller,
          curve: Interval(
            (widget.delay / 900).clamp(0, 1).toDouble(),
            1,
            curve: Curves.easeInOut,
          ),
        ),
      ),
      child: Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          color: widget.color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
