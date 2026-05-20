import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/features/chats/presentation/chat_voice_playback_controller.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:record/record.dart';

class MeetingChatScreen extends ConsumerStatefulWidget {
  const MeetingChatScreen({super.key, required this.meetingId});

  final String meetingId;

  @override
  ConsumerState<MeetingChatScreen> createState() => _MeetingChatScreenState();
}

class _MeetingChatScreenState extends ConsumerState<MeetingChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _messagesScrollController = ScrollController();
  final AudioRecorder _audioRecorder = AudioRecorder();
  StreamSubscription<Amplitude>? _amplitudeSubscription;
  final List<double> _recordWaveformSamples = [];
  bool _attachOpen = false;
  _SheetKind? _sheet;
  bool _sending = false;
  bool _attaching = false;
  bool _recording = false;
  DateTime? _recordStartedAt;

  bool get _hasText => _controller.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _messagesScrollController.addListener(_loadOlderMessagesNearTop);
  }

  @override
  void dispose() {
    _controller.dispose();
    _messagesScrollController
      ..removeListener(_loadOlderMessagesNearTop)
      ..dispose();
    _amplitudeSubscription?.cancel();
    _audioRecorder.dispose();
    super.dispose();
  }

  void _loadOlderMessagesNearTop() {
    if (!_messagesScrollController.hasClients) {
      return;
    }
    final position = _messagesScrollController.position;
    if (position.pixels > 120) {
      return;
    }
    unawaited(
      ref
          .read(chatHistoryPaginationProvider(widget.meetingId).notifier)
          .loadNextPage(),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(chatRealtimeProvider(widget.meetingId));
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          Column(
            children: [
              _Header(
                meetingId: widget.meetingId,
                onPeople: () => setState(() => _sheet = _SheetKind.people),
                onMenu: () => setState(() => _sheet = _SheetKind.menu),
              ),
              Expanded(
                child: Consumer(
                  builder: (context, ref, _) {
                    final messages =
                        ref.watch(chatMessagesProvider(widget.meetingId));
                    final pagination = ref
                        .watch(chatHistoryPaginationProvider(widget.meetingId));
                    return messages.when(
                      data: (items) {
                        if (items.isEmpty) {
                          return const Center(
                            child: _SystemMessage(text: 'Сообщений пока нет'),
                          );
                        }
                        final paginationController = ref.read(
                          chatHistoryPaginationProvider(widget.meetingId)
                              .notifier,
                        );
                        return ListView.separated(
                          controller: _messagesScrollController,
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 160),
                          itemCount: items.length + 1,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            if (index == 0) {
                              return _OlderMessagesButton(
                                state: pagination,
                                onTap: () =>
                                    paginationController.loadNextPage(),
                              );
                            }
                            return _MessageBubble.fromBackend(items[index - 1]);
                          },
                        );
                      },
                      loading: () => const Center(
                        child: _SystemMessage(text: 'Загружаю сообщения'),
                      ),
                      error: (_, __) => const Center(
                        child: _SystemMessage(text: 'Чат недоступен'),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
          _Composer(
            controller: _controller,
            attachOpen: _attachOpen,
            hasText: _hasText,
            sending: _sending || _attaching,
            recording: _recording,
            onChanged: () => setState(() {}),
            onAttach: () => setState(() => _attachOpen = !_attachOpen),
            onPickPhoto: _pickPhotoAttachment,
            onPickFile: _pickFileAttachment,
            onVoice: _toggleVoiceRecording,
            onSend: _sendMessage,
          ),
          if (_sheet != null)
            Positioned.fill(
              child: GestureDetector(
                onTap: () => setState(() => _sheet = null),
                child: Container(color: Colors.black.withValues(alpha: 0.5)),
              ),
            ),
          if (_sheet == _SheetKind.people)
            _PeopleSheet(
              chatId: widget.meetingId,
              onClose: () => setState(() => _sheet = null),
            ),
          if (_sheet == _SheetKind.menu)
            _MenuSheet(
              chatId: widget.meetingId,
              onClose: () => setState(() => _sheet = null),
            ),
        ],
      ),
    );
  }

  Future<void> _sendMessage() async {
    final text = _controller.text;
    if (_sending || text.trim().isEmpty) {
      return;
    }
    setState(() => _sending = true);
    try {
      await ref.read(chatMessageSenderProvider).sendText(
            chatId: widget.meetingId,
            text: text,
          );
      await ref.read(chatRealtimeProvider(widget.meetingId))?.flushOutbox();
      if (!mounted) {
        return;
      }
      _controller.clear();
      setState(() => _sending = false);
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Не удалось сохранить сообщение'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: DateasyColors.surface2,
        ),
      );
    }
  }

  Future<void> _pickPhotoAttachment() async {
    if (_attaching) {
      return;
    }
    setState(() => _attaching = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
      );
      if (picked == null) {
        return;
      }
      await ref.read(chatMessageSenderProvider).sendAttachment(
            chatId: widget.meetingId,
            filePath: picked.path,
            fileName: picked.name,
            mimeType: _guessMimeType(picked.name, picked.mimeType),
          );
      await ref.read(chatRealtimeProvider(widget.meetingId))?.flushOutbox();
      if (!mounted) {
        return;
      }
      setState(() => _attachOpen = false);
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showChatSnack(context, 'Не удалось отправить фото');
    } finally {
      if (mounted) {
        setState(() => _attaching = false);
      }
    }
  }

  Future<void> _pickFileAttachment() async {
    if (_attaching) {
      return;
    }
    setState(() => _attaching = true);
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const [
          'pdf',
          'zip',
          'txt',
          'jpg',
          'jpeg',
          'png',
          'webp',
          'gif'
        ],
        withData: false,
      );
      final file = result?.files.single;
      final path = file?.path;
      if (file == null || path == null) {
        return;
      }
      await ref.read(chatMessageSenderProvider).sendAttachment(
            chatId: widget.meetingId,
            filePath: path,
            fileName: file.name,
            mimeType: _guessMimeType(file.name, null),
          );
      await ref.read(chatRealtimeProvider(widget.meetingId))?.flushOutbox();
      if (!mounted) {
        return;
      }
      setState(() => _attachOpen = false);
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showChatSnack(context, 'Не удалось отправить файл');
    } finally {
      if (mounted) {
        setState(() => _attaching = false);
      }
    }
  }

  Future<void> _toggleVoiceRecording() async {
    if (_sending || _attaching) {
      return;
    }
    if (_recording) {
      await _stopVoiceRecording();
      return;
    }
    await _startVoiceRecording();
  }

  Future<void> _startVoiceRecording() async {
    final allowed = await _audioRecorder.hasPermission();
    if (!allowed) {
      if (!mounted) {
        return;
      }
      _showChatSnack(context, 'Нет доступа к микрофону');
      return;
    }
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/dateasy-voice-${DateTime.now().microsecondsSinceEpoch}.m4a';
    await _audioRecorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
      ),
      path: path,
    );
    await _amplitudeSubscription?.cancel();
    _recordWaveformSamples.clear();
    _amplitudeSubscription = _audioRecorder
        .onAmplitudeChanged(const Duration(milliseconds: 90))
        .listen((amplitude) {
      _recordWaveformSamples.add(_normalizeAmplitude(amplitude.current));
      if (_recordWaveformSamples.length > 1800) {
        _recordWaveformSamples.removeRange(
          0,
          _recordWaveformSamples.length - 1800,
        );
      }
    });
    if (!mounted) {
      return;
    }
    setState(() {
      _recording = true;
      _recordStartedAt = DateTime.now();
      _attachOpen = false;
    });
  }

  Future<void> _stopVoiceRecording() async {
    setState(() => _attaching = true);
    try {
      final startedAt = _recordStartedAt;
      final path = await _audioRecorder.stop();
      await _amplitudeSubscription?.cancel();
      _amplitudeSubscription = null;
      final waveform = _recordWaveformFromSamples(_recordWaveformSamples);
      _recordWaveformSamples.clear();
      final durationMs = startedAt == null
          ? 1
          : DateTime.now()
              .difference(startedAt)
              .inMilliseconds
              .clamp(1, 180000);
      if (!mounted) {
        return;
      }
      setState(() {
        _recording = false;
        _recordStartedAt = null;
      });
      if (path == null || durationMs < 500) {
        _showChatSnack(context, 'Голосовое слишком короткое');
        return;
      }
      await ref.read(chatMessageSenderProvider).sendAttachment(
            chatId: widget.meetingId,
            filePath: path,
            fileName: path.split('/').last,
            mimeType: 'audio/mp4',
            kind: 'chat_voice',
            durationMs: durationMs,
            waveform: waveform,
          );
      await ref.read(chatRealtimeProvider(widget.meetingId))?.flushOutbox();
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showChatSnack(context, 'Не удалось отправить голосовое');
    } finally {
      if (mounted) {
        setState(() {
          _attaching = false;
          _recording = false;
          _recordStartedAt = null;
        });
        await _amplitudeSubscription?.cancel();
        _amplitudeSubscription = null;
      }
    }
  }
}

class _Header extends ConsumerWidget {
  const _Header({
    required this.meetingId,
    required this.onPeople,
    required this.onMenu,
  });

  final String meetingId;
  final VoidCallback onPeople;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(chatSummaryProvider(meetingId)).valueOrNull;
    final meta = _ChatHeaderData.fromSummary(summary, fallbackId: meetingId);
    return _GlassPanel(
      borderRadius: 0,
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
      borderAlpha: 0.05,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Row(
              children: [
                _GlassIconButton(
                  icon: LucideIcons.arrowLeft,
                  onTap: () => context.go(meta.backRoute),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      final route = meta.primaryProfileRoute;
                      if (route == null) {
                        onPeople();
                      } else {
                        context.go(route);
                      }
                    },
                    child: Row(
                      children: [
                        _HeaderAvatars(participants: meta.participants),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                meta.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                meta.peopleLine,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: DateasyColors.lime,
                                      fontSize: 11,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                _GlassIconButton(
                  icon: LucideIcons.ellipsis,
                  onTap: onMenu,
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => context.go(meta.detailsRoute),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: dateasyLimeGradient,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      meta.isDirect
                          ? LucideIcons.messageCircle
                          : LucideIcons.calendarHeart,
                      size: 14,
                      color: DateasyColors.backgroundDeep,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Icon(
                    LucideIcons.clock,
                    size: 12,
                    color: DateasyColors.muted,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    meta.timeLine,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 12,
                        ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      '·',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted.withValues(alpha: 0.45),
                          ),
                    ),
                  ),
                  const Icon(
                    LucideIcons.mapPin,
                    size: 12,
                    color: DateasyColors.lime,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      meta.contextLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                  ),
                  Container(
                    height: 28,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: DateasyColors.foreground,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      meta.actionLabel,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.background,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderAvatars extends StatelessWidget {
  const _HeaderAvatars({required this.participants});

  final List<_Participant> participants;

  @override
  Widget build(BuildContext context) {
    final visible = participants.take(3).toList();

    return SizedBox(
      width: 66,
      height: 36,
      child: Stack(
        children: [
          for (var index = 0; index < visible.length; index++)
            Positioned(
              left: index * 15,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: DateasyColors.background, width: 2),
                ),
                clipBehavior: Clip.antiAlias,
                child: DateasyRemoteImage(
                  imageUrl: visible[index].imageUrl,
                  usage: DateasyImageUsage.avatar,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ChatHeaderData {
  const _ChatHeaderData({
    required this.title,
    required this.peopleLine,
    required this.timeLine,
    required this.contextLine,
    required this.actionLabel,
    required this.backRoute,
    required this.detailsRoute,
    this.primaryProfileRoute,
    required this.participants,
    required this.isDirect,
  });

  final String title;
  final String peopleLine;
  final String timeLine;
  final String contextLine;
  final String actionLabel;
  final String backRoute;
  final String detailsRoute;
  final String? primaryProfileRoute;
  final List<_Participant> participants;
  final bool isDirect;

  factory _ChatHeaderData.fromSummary(
    BackendChatSummary? summary, {
    required String fallbackId,
  }) {
    if (summary == null) {
      return const _ChatHeaderData(
        title: 'Чат',
        peopleLine: 'Данные чата обновляются',
        timeLine: 'Обновляю данные',
        contextLine: 'Сообщения доступны локально',
        actionLabel: 'Чат',
        backRoute: '/chats',
        detailsRoute: '/chats',
        participants: [
          _Participant(
            name: 'Чат',
            userId: null,
            imageUrl: null,
            role: 'Участник',
            online: false,
          ),
        ],
        isDirect: false,
      );
    }

    final raw = summary.raw;
    final peerUserId = _stringOrNull(raw['peerUserId']);
    final eventId = _stringOrNull(raw['eventId']);
    final isDirect = peerUserId != null || summary.kind == 'personal';
    final participants = _participantsFromSummary(summary, isDirect: isDirect);
    final onlineCount = participants.where((item) => item.online).length;
    final peopleLine = isDirect
        ? (onlineCount > 0 ? 'онлайн' : 'личный чат')
        : '$onlineCount онлайн · ${participants.length} участников';
    final status = _stringOrNull(raw['status']);
    final time = _stringOrNull(raw['time'] ?? raw['lastTime']);
    final timeLine = [status, time]
        .where((item) => item != null && item.isNotEmpty)
        .join(' · ');
    final fromMeetup = _stringOrNull(raw['fromMeetup']);
    final meetingContextLine = _stringOrNull(
      raw['contextLine'] ??
          raw['venueLine'] ??
          raw['locationName'] ??
          raw['placeName'],
    );

    return _ChatHeaderData(
      title: summary.title.isEmpty ? 'Чат' : summary.title,
      peopleLine: peopleLine,
      timeLine:
          timeLine.isEmpty ? (isDirect ? 'Личный чат' : 'Встреча') : timeLine,
      contextLine: isDirect
          ? (fromMeetup == null ? 'Личный чат' : 'После встречи: $fromMeetup')
          : (meetingContextLine ?? 'Детали встречи'),
      actionLabel: isDirect ? 'Профиль' : 'Встреча',
      backRoute: '/chats',
      detailsRoute: isDirect
          ? (peerUserId == null ? '/chats' : '/u/$peerUserId')
          : (eventId == null ? '/chats' : '/meetings/$eventId'),
      primaryProfileRoute: isDirect && peerUserId != null
          ? '/u/${Uri.encodeComponent(peerUserId)}'
          : null,
      participants: participants,
      isDirect: isDirect,
    );
  }
}

class _SystemMessage extends StatelessWidget {
  const _SystemMessage({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: DateasyColors.surface.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
                fontSize: 11,
              ),
        ),
      ),
    );
  }
}

class _OlderMessagesButton extends StatelessWidget {
  const _OlderMessagesButton({
    required this.state,
    required this.onTap,
  });

  final ChatHistoryPaginationState state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (!state.hasNextPage && !state.error) {
      return const SizedBox.shrink();
    }
    return Center(
      child: GestureDetector(
        onTap: state.loading ? () {} : onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: DateasyColors.surface.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (state.loading) ...[
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 8),
              ],
              Text(
                state.error
                    ? 'Повторить загрузку'
                    : state.loading
                        ? 'Загружаю'
                        : 'Ранее',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: state.error
                          ? DateasyColors.pink
                          : DateasyColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.chatId,
    required this.text,
    required this.time,
    this.system = false,
    this.mine = false,
    this.name,
    this.image,
    this.profileRoute,
    this.attachments = const [],
  });

  final String chatId;
  final String text;
  final String time;
  final bool system;
  final bool mine;
  final String? name;
  final String? image;
  final String? profileRoute;
  final List<_ChatAttachmentPreview> attachments;

  factory _MessageBubble.fromBackend(BackendChatMessage message) {
    final attachments = _attachmentPreviews(message.raw['attachments']);
    final system = _isSystemMessage(message);
    final senderId = message.senderId;
    final senderRoute = system ||
            senderId == null ||
            senderId.isEmpty ||
            message.raw['mine'] == true
        ? null
        : '/u/${Uri.encodeComponent(senderId)}';
    return _MessageBubble(
      chatId: message.chatId,
      name: message.senderName ?? 'Участник',
      image: message.senderAvatarUrl,
      profileRoute: senderRoute,
      text: message.text.isEmpty &&
              attachments.isNotEmpty &&
              !attachments.every((attachment) => attachment.isVoice)
          ? attachments.first.label
          : message.text,
      time: _formatTime(message.createdAt),
      system: system,
      mine: message.raw['mine'] == true,
      attachments: attachments,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (system) {
      return _SystemMessage(text: text);
    }

    final maxBubbleWidth = MediaQuery.sizeOf(context).width * 0.78;
    final hasText = text.trim().isNotEmpty;
    if (mine) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxBubbleWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (hasText)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: const BoxDecoration(
                        gradient: dateasyLimeGradient,
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(16),
                          topRight: Radius.circular(16),
                          bottomLeft: Radius.circular(16),
                          bottomRight: Radius.circular(6),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x55BEFF67),
                            blurRadius: 24,
                            spreadRadius: -12,
                            offset: Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Text(
                        text,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: DateasyColors.backgroundDeep,
                            ),
                      ),
                    ),
                  if (attachments.isNotEmpty) ...[
                    if (hasText) const SizedBox(height: 6),
                    for (final attachment in attachments)
                      _AttachmentPreviewPill(
                        chatId: chatId,
                        attachment: attachment,
                      ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    time,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 10,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        ClipOval(
          child: SizedBox(
            width: 28,
            height: 28,
            child: DateasyRemoteImage(
              imageUrl: image,
              usage: DateasyImageUsage.avatar,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxBubbleWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
                const SizedBox(height: 4),
                if (hasText)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: DateasyColors.glass,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(16),
                        bottomLeft: Radius.circular(6),
                        bottomRight: Radius.circular(16),
                      ),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                    ),
                    child: Text(
                      text,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                if (attachments.isNotEmpty) ...[
                  if (hasText) const SizedBox(height: 6),
                  for (final attachment in attachments)
                    _AttachmentPreviewPill(
                      chatId: chatId,
                      attachment: attachment,
                    ),
                ],
                const SizedBox(height: 4),
                Text(
                  time,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 10,
                      ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
    final route = profileRoute;
    if (route == null) {
      return content;
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.go(route),
      child: content,
    );
  }
}

class _AttachmentPreviewPill extends ConsumerStatefulWidget {
  const _AttachmentPreviewPill({
    required this.chatId,
    required this.attachment,
  });

  final String chatId;
  final _ChatAttachmentPreview attachment;

  @override
  ConsumerState<_AttachmentPreviewPill> createState() =>
      _AttachmentPreviewPillState();
}

class _AttachmentPreviewPillState
    extends ConsumerState<_AttachmentPreviewPill> {
  _ChatAttachmentPreview get attachment => widget.attachment;

  @override
  Widget build(BuildContext context) {
    final directUrl = attachment.directUrl;
    final signedUrl = attachment.isVoice || attachment.signedUrlPath == null
        ? null
        : ref.watch(signedMediaUrlProvider(attachment.signedUrlPath!));
    final resolvedUrl = signedUrl?.maybeWhen(
          data: (url) => url,
          orElse: () => null,
        ) ??
        directUrl;
    final voicePlayback = attachment.isVoice
        ? ref.watch(
            chatVoicePlaybackControllerProvider(widget.chatId).select(
              (state) => _VoicePlaybackViewState.fromController(
                state,
                playbackId: attachment.playbackId,
              ),
            ),
          )
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (attachment.isImage)
          Container(
            width: 220,
            height: 148,
            margin: const EdgeInsets.only(bottom: 6),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: DateasyColors.background.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            ),
            child: resolvedUrl == null
                ? const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : DateasyRemoteImage(
                    imageUrl: resolvedUrl,
                    usage: DateasyImageUsage.card,
                  ),
          ),
        attachment.isVoice
            ? _VoiceAttachmentPill(
                attachment: attachment,
                loading: voicePlayback?.loading ?? false,
                playing: voicePlayback?.playing ?? false,
                urlReady: directUrl != null || attachment.signedUrlPath != null,
                onTap: _toggleVoice,
              )
            : _FileAttachmentPill(attachment: attachment),
      ],
    );
  }

  Future<void> _toggleVoice() async {
    if (!attachment.isVoice) {
      return;
    }
    await ref
        .read(chatVoicePlaybackControllerProvider(widget.chatId).notifier)
        .toggle(
          ChatVoicePlaybackRequest(
            playbackId: attachment.playbackId,
            url: attachment.directUrl,
            durationMs: attachment.durationMs ?? 0,
            resolveRemoteUrl: attachment.signedUrlPath == null
                ? null
                : () => ref
                    .read(appAttachmentServiceProvider)
                    .resolveSignedUrl(attachment.signedUrlPath!),
          ),
        );
  }
}

class _FileAttachmentPill extends StatelessWidget {
  const _FileAttachmentPill({required this.attachment});

  final _ChatAttachmentPreview attachment;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: DateasyColors.background.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            attachment.icon,
            size: 14,
            color: DateasyColors.lime,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              attachment.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _VoiceAttachmentPill extends StatelessWidget {
  const _VoiceAttachmentPill({
    required this.attachment,
    required this.loading,
    required this.playing,
    required this.urlReady,
    required this.onTap,
  });

  final _ChatAttachmentPreview attachment;
  final bool loading;
  final bool playing;
  final bool urlReady;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: urlReady ? onTap : () {},
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: DateasyColors.background.withValues(alpha: 0.22),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: dateasyLimeGradient,
              ),
              child: loading || !urlReady
                  ? const Padding(
                      padding: EdgeInsets.all(9),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      playing ? LucideIcons.pause : LucideIcons.play,
                      size: 15,
                      color: DateasyColors.backgroundDeep,
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _VoiceWaveform(waveform: attachment.waveform),
            ),
            const SizedBox(width: 10),
            Text(
              _durationLabel(attachment.durationMs),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VoicePlaybackViewState {
  const _VoicePlaybackViewState({
    required this.playing,
    required this.loading,
  });

  final bool playing;
  final bool loading;

  factory _VoicePlaybackViewState.fromController(
    ChatVoicePlaybackState state, {
    required String playbackId,
  }) {
    final active = state.activePlaybackId == playbackId;
    return _VoicePlaybackViewState(
      playing: active && state.isPlaying,
      loading: active && state.isLoading,
    );
  }
}

class _VoiceWaveform extends StatelessWidget {
  const _VoiceWaveform({required this.waveform});

  final List<double> waveform;

  @override
  Widget build(BuildContext context) {
    final bars = waveform.isEmpty ? _fallbackWaveform(2400) : waveform;
    return SizedBox(
      height: 24,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (final value in bars.take(28)) ...[
            Expanded(
              child: Align(
                alignment: Alignment.center,
                child: FractionallySizedBox(
                  heightFactor: value.clamp(0.12, 1),
                  child: Container(
                    width: 3,
                    decoration: BoxDecoration(
                      color: DateasyColors.lime.withValues(alpha: 0.82),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }
}

class _ChatAttachmentPreview {
  const _ChatAttachmentPreview({
    required this.playbackId,
    required this.label,
    required this.icon,
    required this.isImage,
    required this.isVoice,
    required this.durationMs,
    required this.waveform,
    this.directUrl,
    this.signedUrlPath,
  });

  final String playbackId;
  final String label;
  final IconData icon;
  final bool isImage;
  final bool isVoice;
  final int? durationMs;
  final List<double> waveform;
  final String? directUrl;
  final String? signedUrlPath;
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.attachOpen,
    required this.hasText,
    required this.sending,
    required this.recording,
    required this.onChanged,
    required this.onAttach,
    required this.onPickPhoto,
    required this.onPickFile,
    required this.onVoice,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool attachOpen;
  final bool hasText;
  final bool sending;
  final bool recording;
  final VoidCallback onChanged;
  final VoidCallback onAttach;
  final VoidCallback onPickPhoto;
  final VoidCallback onPickFile;
  final VoidCallback onVoice;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 12,
      right: 12,
      bottom: 12,
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (attachOpen)
              _AttachmentPopup(
                disabled: sending,
                onPickPhoto: onPickPhoto,
                onPickFile: onPickFile,
              ),
            _GlassPanel(
              borderRadius: 999,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: onAttach,
                    child: AnimatedRotation(
                      turns: attachOpen ? 0.125 : 0,
                      duration: const Duration(milliseconds: 160),
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          gradient: attachOpen ? dateasyLimeGradient : null,
                          color: attachOpen ? null : DateasyColors.surface2,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          LucideIcons.plus,
                          color: attachOpen
                              ? DateasyColors.backgroundDeep
                              : DateasyColors.foreground,
                          size: 20,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      onChanged: (_) => onChanged(),
                      minLines: 1,
                      maxLines: 3,
                      style: Theme.of(context).textTheme.bodyMedium,
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: 'Сообщение в чат встречи',
                        hintStyle:
                            Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: DateasyColors.muted,
                                ),
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      controller.text = '${controller.text} 🔥';
                      onChanged();
                    },
                    child: const _RoundComposerButton(icon: LucideIcons.smile),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: sending
                        ? () {}
                        : hasText
                            ? onSend
                            : onVoice,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: recording
                            ? dateasyPinkGradient
                            : dateasyLimeGradient,
                        shape: BoxShape.circle,
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x55BEFF67),
                            blurRadius: 20,
                            spreadRadius: -8,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: sending
                          ? const Center(
                              child: SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            )
                          : Icon(
                              hasText
                                  ? LucideIcons.send
                                  : recording
                                      ? LucideIcons.square
                                      : LucideIcons.mic,
                              color: recording
                                  ? DateasyColors.foreground
                                  : DateasyColors.backgroundDeep,
                              size: 16,
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentPopup extends StatelessWidget {
  const _AttachmentPopup({
    required this.disabled,
    required this.onPickPhoto,
    required this.onPickFile,
  });

  final bool disabled;
  final VoidCallback onPickPhoto;
  final VoidCallback onPickFile;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: _AttachmentItem(
                icon: LucideIcons.image,
                label: 'Фото/видео',
                gradient: dateasyLimeGradient,
                onTap: disabled ? null : onPickPhoto,
              ),
            ),
            Expanded(
              child: _AttachmentItem(
                icon: LucideIcons.mapPinned,
                label: 'Локация',
                gradient: dateasyPinkGradient,
                foreground: DateasyColors.foreground,
                onTap: disabled
                    ? null
                    : () => _showChatSnack(context, 'Локация пока недоступна'),
              ),
            ),
            Expanded(
              child: _AttachmentItem(
                icon: LucideIcons.chartBar,
                label: 'Опрос',
                onTap: disabled
                    ? null
                    : () => _showChatSnack(context, 'Опрос пока недоступен'),
              ),
            ),
            Expanded(
              child: _AttachmentItem(
                icon: LucideIcons.fileText,
                label: 'Файл',
                onTap: disabled ? null : onPickFile,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentItem extends StatelessWidget {
  const _AttachmentItem({
    required this.icon,
    required this.label,
    this.gradient,
    this.foreground = DateasyColors.backgroundDeep,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Gradient? gradient;
  final Color foreground;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final active = gradient != null;
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.55 : 1,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: gradient,
                color: active ? null : DateasyColors.glass,
                borderRadius: BorderRadius.circular(16),
                border: active
                    ? null
                    : Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Icon(
                icon,
                size: 20,
                color: active ? foreground : DateasyColors.foreground,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundComposerButton extends StatelessWidget {
  const _RoundComposerButton({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: DateasyColors.surface2,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 20),
    );
  }
}

class _PeopleSheet extends ConsumerWidget {
  const _PeopleSheet({
    required this.chatId,
    required this.onClose,
  });

  final String chatId;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(chatSummaryProvider(chatId)).valueOrNull;
    final meta = _ChatHeaderData.fromSummary(summary, fallbackId: chatId);
    return _BottomSheetFrame(
      onClose: onClose,
      title: 'Участники',
      subtitle: meta.peopleLine,
      child: Column(
        children: [
          for (final person in meta.participants)
            _ParticipantRow(
              person: person,
              onTap: () {
                final route = person.profileRoute;
                if (route == null) {
                  return;
                }
                context.go(route);
              },
            ),
        ],
      ),
    );
  }
}

class _MenuSheet extends ConsumerWidget {
  const _MenuSheet({
    required this.chatId,
    required this.onClose,
  });

  final String chatId;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(chatSummaryProvider(chatId)).valueOrNull;
    final isPinned = summary?.raw['isPinned'] == true;
    return _BottomSheetFrame(
      onClose: onClose,
      title: 'Меню чата',
      child: Column(
        children: [
          const _MenuRow(icon: LucideIcons.users, label: 'Участники'),
          const _MenuRow(icon: LucideIcons.search, label: 'Поиск по чату'),
          _MenuRow(
            icon: LucideIcons.pin,
            label: isPinned ? 'Открепить чат' : 'Закрепить чат',
            onTap: () async {
              try {
                await ref.read(chatActionsProvider).setPinned(
                      chatId: chatId,
                      isPinned: !isPinned,
                    );
                onClose();
              } catch (_) {
                if (!context.mounted) {
                  return;
                }
                _showChatSnack(context, 'Не удалось обновить чат');
              }
            },
          ),
          const _MenuRow(
              icon: LucideIcons.bellOff, label: 'Отключить уведомления'),
          const _MenuRow(icon: LucideIcons.bell, label: 'Напомнить о встрече'),
          const _MenuRow(
            icon: LucideIcons.flag,
            label: 'Пожаловаться',
            danger: true,
          ),
          _MenuRow(
            icon: LucideIcons.logOut,
            label: 'Покинуть чат',
            danger: true,
            onTap: () async {
              try {
                await ref.read(chatActionsProvider).deleteChat(chatId);
                if (!context.mounted) {
                  return;
                }
                context.go('/chats');
              } catch (_) {
                if (!context.mounted) {
                  return;
                }
                _showChatSnack(context, 'Не удалось покинуть чат');
              }
            },
          ),
        ],
      ),
    );
  }
}

class _BottomSheetFrame extends StatelessWidget {
  const _BottomSheetFrame({
    required this.onClose,
    required this.title,
    required this.child,
    this.subtitle,
  });

  final VoidCallback onClose;
  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: SafeArea(
        top: false,
        child: Container(
          constraints: const BoxConstraints(maxHeight: 460),
          decoration: const BoxDecoration(
            color: DateasyColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: DateasyColors.border)),
            boxShadow: [
              BoxShadow(
                color: Color(0xAA000000),
                blurRadius: 40,
                offset: Offset(0, -10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 48,
                height: 6,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              subtitle!,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    _GlassIconButton(icon: LucideIcons.x, onTap: onClose),
                  ],
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                  children: [child],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ParticipantRow extends StatelessWidget {
  const _ParticipantRow({required this.person, required this.onTap});

  final _Participant person;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Stack(
              children: [
                ClipOval(
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: DateasyRemoteImage(
                      imageUrl: person.imageUrl,
                      usage: DateasyImageUsage.avatar,
                    ),
                  ),
                ),
                if (person.online)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: DateasyColors.lime,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: DateasyColors.background, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    person.name,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  Text(
                    '${person.role}${person.online ? ' · онлайн' : ''}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            if (person.role == 'Хост')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Хост'.toUpperCase(),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    this.danger = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool danger;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = danger ? DateasyColors.pink : DateasyColors.foreground;
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            _GlassPanel(
              borderRadius: 12,
              padding: EdgeInsets.zero,
              child: SizedBox(
                width: 40,
                height: 40,
                child: Icon(icon, size: 16, color: color),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: EdgeInsets.zero,
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 20),
        ),
      ),
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
    this.borderAlpha = 0.1,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final double borderAlpha;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: borderAlpha)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _Participant {
  const _Participant({
    required this.name,
    required this.userId,
    required this.imageUrl,
    required this.role,
    required this.online,
    this.isCurrentUser = false,
  });

  final String name;
  final String? userId;
  final String? imageUrl;
  final String role;
  final bool online;
  final bool isCurrentUser;

  String? get profileRoute {
    if (isCurrentUser) {
      return '/profile';
    }
    final id = userId;
    if (id == null || id.isEmpty) {
      return null;
    }
    return '/u/${Uri.encodeComponent(id)}';
  }
}

List<_Participant> _participantsFromSummary(
  BackendChatSummary summary, {
  required bool isDirect,
}) {
  final profiles = _listOfMaps(summary.raw['memberProfiles']);
  if (profiles.isNotEmpty) {
    return profiles
        .map(
          (profile) => _Participant(
            userId: _stringOrNull(profile['userId'] ?? profile['id']),
            name: _stringOrNull(profile['name']) ?? 'Участник',
            imageUrl: _stringOrNull(
              profile['avatarUrl'] ??
                  profile['imageUrl'] ??
                  profile['photoUrl'],
            ),
            role: profile['isCurrentUser'] == true ? 'Вы' : 'Участник',
            online: profile['online'] == true,
            isCurrentUser: profile['isCurrentUser'] == true,
          ),
        )
        .toList(growable: false);
  }

  final names = _listOfStrings(summary.raw['members']);
  if (names.isNotEmpty) {
    return names
        .map(
          (name) => _Participant(
            userId: null,
            name: name,
            imageUrl: null,
            role: 'Участник',
            online: false,
          ),
        )
        .toList(growable: false);
  }

  return [
    _Participant(
      userId: _stringOrNull(summary.raw['peerUserId']),
      name: summary.title.isEmpty
          ? (isDirect ? 'Собеседник' : 'Чат')
          : summary.title,
      imageUrl: summary.imageUrl,
      role: isDirect ? 'Собеседник' : 'Участник',
      online: summary.raw['online'] == true,
    ),
  ];
}

List<Map<String, Object?>> _listOfMaps(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => item.map((key, value) => MapEntry('$key', value)))
      .toList(growable: false);
}

List<String> _listOfStrings(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .map((item) => item?.toString() ?? '')
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

List<_ChatAttachmentPreview> _attachmentPreviews(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.whereType<Map>().map((raw) {
    final item = raw.map((key, value) => MapEntry('$key', value));
    final mimeType = item['mimeType']?.toString() ?? '';
    final fileName = item['fileName']?.toString() ?? '';
    final kind = item['kind']?.toString() ?? '';
    final isVoice = kind == 'chat_voice';
    final isImage = mimeType.startsWith('image/') ||
        kind == 'image' ||
        kind == 'chat_attachment' && _looksLikeImage(fileName);
    final directUrl = _stringOrNull(item['url'] ?? item['downloadUrl']);
    final signedUrlPath = _stringOrNull(item['downloadUrlPath']);
    final id = _stringOrNull(item['id'] ?? item['assetId']);
    return _ChatAttachmentPreview(
      playbackId: id ??
          signedUrlPath ??
          directUrl ??
          (fileName.isNotEmpty ? fileName : 'attachment-${item.hashCode}'),
      label: fileName.isNotEmpty
          ? fileName
          : isVoice
              ? 'Голосовое'
              : isImage
                  ? 'Изображение'
                  : 'Вложение',
      icon: isVoice
          ? LucideIcons.audioLines
          : isImage
              ? LucideIcons.image
              : LucideIcons.fileText,
      isImage: isImage,
      isVoice: isVoice,
      durationMs: _intOrNull(item['durationMs']),
      waveform: _listOfDoubles(item['waveform']),
      directUrl: directUrl,
      signedUrlPath: signedUrlPath,
    );
  }).toList(growable: false);
}

List<double> _listOfDoubles(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .map((item) => double.tryParse(item?.toString() ?? '') ?? 0)
      .where((item) => item > 0)
      .map((item) => item.clamp(0, 1).toDouble())
      .toList(growable: false);
}

int? _intOrNull(Object? value) {
  if (value is int) {
    return value;
  }
  return int.tryParse(value?.toString() ?? '');
}

bool _looksLikeImage(String fileName) {
  final lower = fileName.toLowerCase();
  return lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.gif');
}

String? _stringOrNull(Object? value) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? null : text;
}

String _guessMimeType(String fileName, String? provided) {
  if (provided != null && provided.isNotEmpty) {
    return provided;
  }
  final lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.gif')) {
    return 'image/gif';
  }
  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lower.endsWith('.zip')) {
    return 'application/zip';
  }
  if (lower.endsWith('.txt')) {
    return 'text/plain';
  }
  return 'application/octet-stream';
}

bool _isSystemMessage(BackendChatMessage message) {
  final kind = _stringOrNull(message.raw['kind']);
  return kind == 'system' ||
      message.raw['systemKind'] != null ||
      (message.senderId == null && message.senderName == 'Frendly');
}

double _normalizeAmplitude(double decibels) {
  if (decibels.isNaN || decibels.isInfinite) {
    return 0.08;
  }
  if (decibels <= -80) {
    return 0.08;
  }
  if (decibels >= 0) {
    return 1;
  }
  return ((decibels + 45) / 45).clamp(0.08, 1).toDouble();
}

List<double> _recordWaveformFromSamples(List<double> samples) {
  const barCount = 28;
  if (samples.isEmpty) {
    return List<double>.filled(barCount, 0.08);
  }

  final bucketSize = samples.length / barCount;
  return [
    for (var index = 0; index < barCount; index += 1)
      _averageWaveformBucket(
          samples, index * bucketSize, (index + 1) * bucketSize),
  ];
}

double _averageWaveformBucket(List<double> samples, double start, double end) {
  final from = start.floor().clamp(0, samples.length - 1);
  final to = end.ceil().clamp(from + 1, samples.length);
  var total = 0.0;
  var count = 0;
  for (var index = from; index < to; index += 1) {
    total += samples[index];
    count += 1;
  }
  if (count == 0) {
    return 0.08;
  }
  return (total / count).clamp(0.08, 1).toDouble();
}

List<double> _fallbackWaveform(int durationMs) {
  final bars = durationMs < 3000 ? 24 : 28;
  return List<double>.filled(bars, 0.18);
}

String _durationLabel(int? durationMs) {
  final totalSeconds = ((durationMs ?? 0) / 1000).ceil();
  if (totalSeconds <= 0) {
    return '0:01';
  }
  final minutes = totalSeconds ~/ 60;
  final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

void _showChatSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      behavior: SnackBarBehavior.floating,
      backgroundColor: DateasyColors.surface2,
    ),
  );
}

enum _SheetKind { people, menu }

String _formatTime(DateTime? value) {
  if (value == null) {
    return '';
  }
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}
