import 'dart:async';
import 'dart:math' as math;
import 'package:big_break_mobile/app/core/device/app_voice_recorder_service.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/recorded_voice_draft.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

enum BbComposerAttachmentAction {
  photo,
  file,
  location,
}

class MessageEditDraft {
  const MessageEditDraft({
    required this.id,
    required this.text,
  });

  final String id;
  final String text;
}

class BbComposer extends StatefulWidget {
  const BbComposer({
    required this.onSend,
    super.key,
    this.hintText = 'Сообщение',
    this.enabled = true,
    this.onAttachmentActionSelected,
    this.onSendVoice,
    this.onRequestMicrophonePermission,
    this.voiceRecorderService,
    this.replyTo,
    this.onCancelReply,
    this.editingMessage,
    this.onCancelEdit,
  });

  final Future<void> Function(String text) onSend;
  final String hintText;
  final bool enabled;
  final Future<void> Function(BbComposerAttachmentAction action)?
      onAttachmentActionSelected;
  final Future<void> Function(RecordedVoiceDraft voice)? onSendVoice;
  final Future<bool> Function()? onRequestMicrophonePermission;
  final AppVoiceRecorderService? voiceRecorderService;
  final MessageReplyPreview? replyTo;
  final VoidCallback? onCancelReply;
  final MessageEditDraft? editingMessage;
  final VoidCallback? onCancelEdit;

  @override
  State<BbComposer> createState() => _BbComposerState();
}

class _BbComposerState extends State<BbComposer> {
  final _controller = TextEditingController();
  final _inputFocusNode = FocusNode();
  bool _sending = false;
  bool _voiceProcessing = false;
  bool _recording = false;
  Duration _recordingDuration = Duration.zero;
  final List<double> _recordingWaveform = <double>[];
  Timer? _recordingTimer;
  StreamSubscription<double>? _recordingLevelSubscription;
  DateTime? _recordingStartedAt;
  AppVoiceRecorderService? _ownedVoiceRecorderService;

  bool get _hasText => _controller.text.trim().isNotEmpty;
  bool get _isEditing => widget.editingMessage != null;
  bool get _canRecordVoice => widget.onSendVoice != null && !_isEditing;

  AppVoiceRecorderService get _voiceRecorderService {
    return widget.voiceRecorderService ??
        (_ownedVoiceRecorderService ??= NativeAppVoiceRecorderService());
  }

  @override
  void initState() {
    super.initState();
    _controller.addListener(_handleTextChanged);
    if (widget.editingMessage != null) {
      _replaceInputText(widget.editingMessage!.text);
    }
  }

  @override
  void didUpdateWidget(covariant BbComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    final editing = widget.editingMessage;
    final oldEditing = oldWidget.editingMessage;
    if (editing != null && editing.id != oldEditing?.id) {
      _replaceInputText(editing.text);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _inputFocusNode.canRequestFocus) {
          _inputFocusNode.requestFocus();
        }
      });
      return;
    }

    if (editing == null && oldEditing != null) {
      _controller.clear();
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_handleTextChanged);
    _recordingTimer?.cancel();
    _recordingLevelSubscription?.cancel();
    _ownedVoiceRecorderService?.dispose();
    _inputFocusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _handleTextChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _replaceInputText(String text) {
    _controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  Future<void> _submit() async {
    if (!widget.enabled || _sending) {
      return;
    }

    final text = _controller.text.trim();
    if (text.isEmpty) {
      return;
    }

    setState(() {
      _sending = true;
    });

    try {
      await widget.onSend(text);
      _controller.clear();
      if (mounted && _inputFocusNode.canRequestFocus) {
        _inputFocusNode.requestFocus();
      }
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  Future<void> _startVoiceRecording() async {
    if (!widget.enabled ||
        _sending ||
        _voiceProcessing ||
        _recording ||
        !_canRecordVoice) {
      return;
    }

    final permissionGranted =
        await widget.onRequestMicrophonePermission?.call() ?? true;
    if (!permissionGranted) {
      return;
    }

    await _dismissKeyboard();

    try {
      await _voiceRecorderService.start();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          const SnackBar(
            content: Text('Не получилось начать запись'),
          ),
        );
      }
      return;
    }

    _recordingTimer?.cancel();
    _recordingLevelSubscription?.cancel();
    _recordingStartedAt = DateTime.now();

    setState(() {
      _recording = true;
      _recordingDuration = Duration.zero;
      _recordingWaveform.clear();
    });

    _recordingLevelSubscription = _voiceRecorderService.amplitudeStream.listen((
      level,
    ) {
      if (!mounted || !_recording) {
        return;
      }
      setState(() {
        _recordingWaveform.add(level.clamp(0.0, 1.0));
        if (_recordingWaveform.length > 48) {
          _recordingWaveform.removeAt(0);
        }
      });
    });

    _recordingTimer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted || _recordingStartedAt == null) {
        return;
      }
      setState(() {
        _recordingDuration = DateTime.now().difference(_recordingStartedAt!);
      });
    });
  }

  Future<void> _cancelVoiceRecording() async {
    if (!_recording) {
      return;
    }

    _recordingTimer?.cancel();
    _recordingLevelSubscription?.cancel();
    await _voiceRecorderService.cancel();

    if (!mounted) {
      return;
    }

    setState(() {
      _recording = false;
      _recordingDuration = Duration.zero;
      _recordingWaveform.clear();
      _recordingStartedAt = null;
    });
  }

  Future<void> _sendVoiceRecording() async {
    if (!_recording ||
        widget.onSendVoice == null ||
        _sending ||
        _voiceProcessing) {
      return;
    }

    _recordingTimer?.cancel();
    _recordingLevelSubscription?.cancel();

    setState(() {
      _voiceProcessing = true;
    });

    RecordedVoiceDraft? draft;
    try {
      final voice = await _voiceRecorderService.stop();
      final waveform = voice.waveform.isNotEmpty
          ? voice.waveform
          : List<double>.from(_recordingWaveform, growable: false);
      draft = voice.copyWith(waveform: waveform);

      if (!mounted) {
        return;
      }

      setState(() {
        _recording = false;
        _recordingDuration = Duration.zero;
        _recordingWaveform.clear();
        _recordingStartedAt = null;
        _voiceProcessing = false;
      });

      unawaited(_dispatchVoiceDraft(draft));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          const SnackBar(
            content: Text('Не получилось отправить голосовое'),
          ),
        );
        setState(() {
          _voiceProcessing = false;
        });
      }
    }
  }

  Future<void> _dispatchVoiceDraft(RecordedVoiceDraft draft) async {
    try {
      await widget.onSendVoice!(draft);
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Не получилось отправить голосовое'),
        ),
      );
    }
  }

  Future<void> _openAttachmentActions() async {
    if (!widget.enabled ||
        widget.onAttachmentActionSelected == null ||
        _recording) {
      return;
    }

    await _dismissKeyboard();
    if (!mounted) {
      return;
    }

    final action = await showModalBottomSheet<BbComposerAttachmentAction>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => const _AttachmentActionSheet(),
    );
    if (action == null) {
      return;
    }
    await widget.onAttachmentActionSelected!(action);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(
          top: BorderSide(
            color: colors.border.withValues(alpha: 0.6),
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.editingMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _EditComposerPreview(
                    editingMessage: widget.editingMessage!,
                    onCancel: widget.onCancelEdit,
                  ),
                )
              else if (widget.replyTo != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _ReplyComposerPreview(
                    replyTo: widget.replyTo!,
                    onCancel: widget.onCancelReply,
                  ),
                ),
              _recording
                  ? _RecordingComposerRow(
                      duration: _recordingDuration,
                      waveform: _recordingWaveform,
                      onCancel: _voiceProcessing ? null : _cancelVoiceRecording,
                      onSend: _voiceProcessing ? null : _sendVoiceRecording,
                    )
                  : Row(
                      children: [
                        _CircleButton(
                          icon: Icons.add_rounded,
                          size: 40,
                          foreground: colors.inkSoft,
                          background: colors.muted,
                          onTap: widget.enabled && !_sending
                              ? (_isEditing ? null : _openAttachmentActions)
                              : null,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Container(
                            constraints: const BoxConstraints(minHeight: 44),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: AppRadii.pillBorder,
                              boxShadow: AppShadows.soft,
                            ),
                            padding: const EdgeInsets.only(
                              left: AppSpacing.md,
                              right: 8,
                            ),
                            alignment: Alignment.center,
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _controller,
                                    focusNode: _inputFocusNode,
                                    enabled: widget.enabled && !_sending,
                                    minLines: 1,
                                    maxLines: 4,
                                    textInputAction: TextInputAction.send,
                                    onTapOutside: (_) {
                                      unawaited(_dismissKeyboard());
                                    },
                                    onSubmitted: (_) => _submit(),
                                    decoration: InputDecoration(
                                      hintText: widget.hintText,
                                      hintStyle: AppTextStyles.body.copyWith(
                                        color: colors.inkMute,
                                      ),
                                      border: InputBorder.none,
                                      isCollapsed: true,
                                    ),
                                    style: AppTextStyles.body.copyWith(
                                      color: colors.foreground,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.xs),
                                Icon(
                                  Icons.sentiment_satisfied_alt_rounded,
                                  size: 20,
                                  color: colors.inkMute,
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        if (!_hasText && _canRecordVoice)
                          _CircleButton(
                            key: const Key('bb-composer-mic-button'),
                            icon: Icons.mic_rounded,
                            size: 44,
                            foreground: colors.primaryForeground,
                            background: colors.primary,
                            onTap: widget.enabled && !_sending
                                ? _startVoiceRecording
                                : null,
                          )
                        else
                          _CircleButton(
                            icon: _sending
                                ? Icons.more_horiz_rounded
                                : Icons.send_rounded,
                            size: 44,
                            foreground: colors.primaryForeground,
                            background: colors.primary,
                            onTap: widget.enabled ? _submit : null,
                          ),
                      ],
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _dismissKeyboard() async {
    _inputFocusNode.unfocus();
    try {
      await SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
    } catch (_) {}
  }
}

class _ReplyComposerPreview extends StatelessWidget {
  const _ReplyComposerPreview({
    required this.replyTo,
    required this.onCancel,
  });

  final MessageReplyPreview replyTo;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: colors.muted.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(18),
        border: Border(
          left: BorderSide(
            color: colors.primary,
            width: 2,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Ответ ${replyTo.author}',
                  style: AppTextStyles.caption.copyWith(
                    color: colors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  replyTo.isVoice ? 'Голосовое сообщение' : replyTo.text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.meta.copyWith(
                    color: colors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onCancel,
            icon: Icon(
              Icons.close_rounded,
              color: colors.inkSoft,
            ),
            visualDensity: VisualDensity.compact,
            splashRadius: 18,
          ),
        ],
      ),
    );
  }
}

class _EditComposerPreview extends StatelessWidget {
  const _EditComposerPreview({
    required this.editingMessage,
    required this.onCancel,
  });

  final MessageEditDraft editingMessage;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: colors.muted.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(18),
        border: Border(
          left: BorderSide(
            color: colors.primary,
            width: 2,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Редактирование',
                  style: AppTextStyles.caption.copyWith(
                    color: colors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  editingMessage.text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.meta.copyWith(
                    color: colors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onCancel,
            icon: Icon(
              Icons.close_rounded,
              color: colors.inkSoft,
            ),
            visualDensity: VisualDensity.compact,
            splashRadius: 18,
          ),
        ],
      ),
    );
  }
}

class _RecordingComposerRow extends StatelessWidget {
  const _RecordingComposerRow({
    required this.duration,
    required this.waveform,
    required this.onCancel,
    required this.onSend,
  });

  final Duration duration;
  final List<double> waveform;
  final VoidCallback? onCancel;
  final VoidCallback? onSend;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Row(
      children: [
        _CircleButton(
          key: const Key('bb-composer-voice-cancel'),
          icon: LucideIcons.trash_2,
          size: 40,
          iconSize: 18,
          foreground: colors.destructive,
          background: colors.muted,
          onTap: onCancel,
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Container(
            key: const Key('bb-composer-voice-recording-pill'),
            height: 44,
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: AppRadii.pillBorder,
              boxShadow: AppShadows.soft,
              border: Border.all(color: colors.border),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: colors.destructive,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: 1),
                Text(
                  _formatDuration(duration),
                  maxLines: 1,
                  style: AppTextStyles.bodySoft.copyWith(
                    color: colors.foreground,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: _RecordingWaveform(
                    waveform: waveform,
                    color: colors.foreground.withValues(alpha: 0.7),
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  LucideIcons.lock,
                  size: 12,
                  color: colors.inkMute,
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'запись',
                      maxLines: 1,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        _CircleButton(
          key: const Key('bb-composer-voice-send'),
          icon: LucideIcons.send,
          size: 44,
          iconSize: 18,
          foreground: colors.primaryForeground,
          background: colors.primary,
          onTap: onSend,
        ),
      ],
    );
  }

  String _formatDuration(Duration duration) {
    final safe = duration.isNegative ? Duration.zero : duration;
    final minutes = safe.inMinutes;
    final seconds = safe.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

class _RecordingWaveform extends StatelessWidget {
  const _RecordingWaveform({
    required this.waveform,
    required this.color,
  });

  final List<double> waveform;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const barWidth = 2.4;
        const barHorizontalPadding = 1.0;
        const slotWidth = barWidth + (barHorizontalPadding * 2);
        final maxBars = constraints.maxWidth < slotWidth
            ? 0
            : math.max(1, constraints.maxWidth ~/ slotWidth);
        if (maxBars == 0) {
          return const SizedBox.shrink();
        }
        final source = waveform.isEmpty
            ? List<double>.filled(maxBars, 0.38, growable: false)
            : waveform;
        final visibleBars = source.length > maxBars
            ? source.sublist(source.length - maxBars)
            : source;

        return Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: visibleBars
              .map(
                (value) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 1),
                  child: Container(
                    width: barWidth,
                    height: 4 + (value.clamp(0.0, 1.0) * 14),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              )
              .toList(growable: false),
        );
      },
    );
  }
}

class _AttachmentActionSheet extends StatelessWidget {
  const _AttachmentActionSheet();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SafeArea(
      top: false,
      bottom: false,
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Что прикрепить',
              style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
            ),
            const SizedBox(height: AppSpacing.md),
            _AttachmentActionRow(
              icon: Icons.image_outlined,
              title: 'Фото',
              subtitle: 'Выбрать снимок из галереи',
              onTap: () => Navigator.of(context).pop(
                BbComposerAttachmentAction.photo,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            _AttachmentActionRow(
              icon: Icons.attach_file_rounded,
              title: 'Файл',
              subtitle: 'Отправить документ или другой файл',
              onTap: () => Navigator.of(context).pop(
                BbComposerAttachmentAction.file,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            _AttachmentActionRow(
              icon: Icons.place_outlined,
              title: 'Локацию',
              subtitle: 'Поделиться текущей точкой',
              onTap: () => Navigator.of(context).pop(
                BbComposerAttachmentAction.location,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentActionRow extends StatelessWidget {
  const _AttachmentActionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 18, color: colors.primary),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.itemTitle),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkSoft,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: colors.inkMute),
            ],
          ),
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    super.key,
    required this.icon,
    required this.size,
    required this.foreground,
    required this.background,
    required this.onTap,
    this.iconSize = 20,
  });

  final IconData icon;
  final double size;
  final double iconSize;
  final Color foreground;
  final Color background;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon, size: iconSize, color: foreground),
        ),
      ),
    );
  }
}
