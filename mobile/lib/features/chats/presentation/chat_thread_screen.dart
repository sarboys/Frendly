import 'dart:async';

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_chat_bubble.dart';
import 'package:big_break_mobile/shared/widgets/bb_swipeable_message.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ChatThreadScreen extends StatefulWidget {
  const ChatThreadScreen({
    required this.header,
    required this.messagesAsync,
    required this.composer,
    required this.onMessageReply,
    required this.onMessageLongPress,
    required this.onAttachmentTap,
    required this.onAttachmentDownloadTap,
    required this.onVoiceResolvePath,
    required this.onVoiceResolveRemoteUrl,
    super.key,
    this.onAuthorAvatarTap,
    this.topContent,
    this.onImageResolvePath,
    this.onImageResolveRemoteUrl,
    this.trailingStatus,
  });

  final Widget header;
  final Widget? topContent;
  final AsyncValue<List<Message>> messagesAsync;
  final Widget composer;
  final void Function(Message message) onMessageReply;
  final Future<void> Function(Message message) onMessageLongPress;
  final Future<void> Function(MessageAttachment attachment) onAttachmentTap;
  final Future<void> Function(MessageAttachment attachment)
      onAttachmentDownloadTap;
  final Future<String?> Function(MessageAttachment attachment)?
      onImageResolvePath;
  final Future<String?> Function(MessageAttachment attachment)?
      onImageResolveRemoteUrl;
  final Future<String?> Function(MessageAttachment attachment)?
      onVoiceResolvePath;
  final Future<String?> Function(MessageAttachment attachment)?
      onVoiceResolveRemoteUrl;
  final void Function(String userId)? onAuthorAvatarTap;
  final Widget Function(List<Message> messages)? trailingStatus;

  @override
  State<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends State<ChatThreadScreen> {
  final ScrollController _scrollController = ScrollController();
  int? _lastMessageCount;
  String? _lastMessageId;
  bool _bottomScrollScheduled = false;
  String? _replyTargetMessageId;
  GlobalKey? _replyTargetKey;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.background,
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              widget.header,
              if (widget.topContent != null) widget.topContent!,
              Expanded(
                child: AsyncValueView(
                  value: widget.messagesAsync,
                  data: (messages) {
                    _handleMessagesRendered(messages);
                    final hasTrailingStatus = widget.trailingStatus != null;
                    return ListView.separated(
                      controller: _scrollController,
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.manual,
                      padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
                      itemCount:
                          1 + messages.length + (hasTrailingStatus ? 1 : 0),
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: AppSpacing.xs),
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return Center(
                            child: Text(
                              'сегодня',
                              style: AppTextStyles.caption.copyWith(
                                letterSpacing: 1,
                              ),
                            ),
                          );
                        }

                        final messageIndex = index - 1;
                        if (messageIndex < messages.length) {
                          final message = messages[messageIndex];
                          if (message.isSystem) {
                            return _SystemPill(message: message);
                          }

                          final row = SizedBox(
                            key: Key('chat-message-${message.id}'),
                            child: BbSwipeableMessage(
                              onReply: () => widget.onMessageReply(message),
                              onLongPress: () =>
                                  widget.onMessageLongPress(message),
                              child: BbChatBubble(
                                chatId: message.chatId,
                                messageClientId: message.clientMessageId,
                                authorId: message.authorId,
                                author: message.author,
                                authorAvatarUrl: message.authorAvatarUrl,
                                text: message.text,
                                time: message.time,
                                isMine: message.mine,
                                showAuthor: message.showAuthor,
                                showAvatar: message.showAvatar,
                                isPending: message.isPending,
                                replyTo: message.replyTo,
                                attachments: message.attachments,
                                onAttachmentTap: widget.onAttachmentTap,
                                onAttachmentDownloadTap:
                                    widget.onAttachmentDownloadTap,
                                onImageResolveLocalPath:
                                    widget.onImageResolvePath,
                                onImageResolveRemoteUrl:
                                    widget.onImageResolveRemoteUrl,
                                onVoiceResolvePath: widget.onVoiceResolvePath,
                                onVoiceResolveRemoteUrl:
                                    widget.onVoiceResolveRemoteUrl,
                                onAuthorAvatarTap: widget.onAuthorAvatarTap,
                                onReplyTap: (replyTo) {
                                  unawaited(
                                    _scrollToMessage(replyTo.id, messages),
                                  );
                                },
                              ),
                            ),
                          );

                          if (message.id == _replyTargetMessageId &&
                              _replyTargetKey != null) {
                            return KeyedSubtree(
                              key: _replyTargetKey,
                              child: row,
                            );
                          }

                          return row;
                        }

                        return widget.trailingStatus!(messages);
                      },
                    );
                  },
                ),
              ),
              widget.composer,
            ],
          ),
        ),
      ),
    );
  }

  void _handleMessagesRendered(List<Message> messages) {
    final lastMessage = messages.isEmpty ? null : messages.last;
    final lastId = lastMessage?.id;
    final previousCount = _lastMessageCount;
    final previousLastId = _lastMessageId;
    final shouldInitialScroll = previousCount == null && messages.isNotEmpty;
    final shouldScrollAfterMine = previousCount != null &&
        messages.length > previousCount &&
        lastMessage?.mine == true &&
        lastId != previousLastId;

    _lastMessageCount = messages.length;
    _lastMessageId = lastId;

    if (shouldInitialScroll || shouldScrollAfterMine) {
      _scheduleScrollToBottom(animated: !shouldInitialScroll);
    }
  }

  void _scheduleScrollToBottom({required bool animated}) {
    if (_bottomScrollScheduled) {
      return;
    }

    _bottomScrollScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _bottomScrollScheduled = false;
      if (!mounted || !_scrollController.hasClients) {
        return;
      }

      final target = _scrollController.position.maxScrollExtent;
      if (animated) {
        await _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
        );
      } else {
        _scrollController.jumpTo(target);
      }

      if (mounted && _scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  Future<void> _scrollToMessage(
    String messageId,
    List<Message> messages,
  ) async {
    final index = messages.indexWhere((message) => message.id == messageId);
    if (index == -1 || !_scrollController.hasClients) {
      return;
    }

    _setReplyTarget(messageId);
    await _afterFrame();
    if (await _ensureReplyTargetVisible(
      duration: const Duration(milliseconds: 260),
    )) {
      _clearReplyTarget();
      return;
    }

    final maxOffset = _scrollController.position.maxScrollExtent;
    final estimatedOffset = ((index + 1) * 88.0).clamp(0.0, maxOffset);
    await _scrollController.animateTo(
      estimatedOffset,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );

    if (!mounted) {
      return;
    }

    await _afterFrame();
    await _ensureReplyTargetVisible(
      duration: const Duration(milliseconds: 180),
    );
    _clearReplyTarget();
  }

  void _setReplyTarget(String messageId) {
    if (!mounted) {
      return;
    }

    setState(() {
      _replyTargetMessageId = messageId;
      _replyTargetKey = GlobalKey(debugLabel: 'reply-target-$messageId');
    });
  }

  Future<void> _afterFrame() {
    final completer = Completer<void>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      completer.complete();
    });
    return completer.future;
  }

  Future<bool> _ensureReplyTargetVisible({
    required Duration duration,
  }) async {
    final context = _replyTargetKey?.currentContext;
    if (context == null) {
      return false;
    }

    await Scrollable.ensureVisible(
      context,
      duration: duration,
      curve: Curves.easeOutCubic,
      alignment: 0.18,
    );
    return true;
  }

  void _clearReplyTarget() {
    if (!mounted || _replyTargetMessageId == null) {
      return;
    }

    setState(() {
      _replyTargetMessageId = null;
      _replyTargetKey = null;
    });
  }
}

class _SystemPill extends StatelessWidget {
  const _SystemPill({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Center(
      key: Key('chat-system-message-${message.id}'),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.85,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.muted.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Text(
              message.text,
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(
                color: colors.inkSoft,
                height: 1.2,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
