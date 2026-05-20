import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class CommunityChatScreen extends ConsumerStatefulWidget {
  const CommunityChatScreen({super.key, required this.communityId});

  final String communityId;

  @override
  ConsumerState<CommunityChatScreen> createState() =>
      _CommunityChatScreenState();
}

class _CommunityChatScreenState extends ConsumerState<CommunityChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_loadOlderNearTop);
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController
      ..removeListener(_loadOlderNearTop)
      ..dispose();
    super.dispose();
  }

  void _loadOlderNearTop() {
    if (!_scrollController.hasClients) {
      return;
    }
    if (_scrollController.position.pixels > 120) {
      return;
    }
    final chatId = _chatId(
        ref.read(communityDetailProvider(widget.communityId)).valueOrNull);
    if (chatId == null) {
      return;
    }
    ref.read(chatHistoryPaginationProvider(chatId).notifier).loadNextPage();
  }

  @override
  Widget build(BuildContext context) {
    final communityState =
        ref.watch(communityDetailProvider(widget.communityId));
    final community = communityState.valueOrNull;
    final chatId = _chatId(community);
    if (chatId != null) {
      ref.watch(chatRealtimeProvider(chatId));
    }

    return DateasyPhoneFrame(
      child: Column(
        children: [
          _Header(
            community: community,
            loading: communityState.isLoading,
            onBack: () => context.go('/communities/${widget.communityId}'),
          ),
          if (community != null) _PinnedMeetup(community: community),
          Expanded(
            child: chatId == null
                ? const Center(child: _SystemText('Чат сообщества недоступен'))
                : _Messages(chatId: chatId, controller: _scrollController),
          ),
          _Composer(
            controller: _controller,
            sending: _sending,
            onChanged: () => setState(() {}),
            onSend: chatId == null ? null : () => _send(chatId),
          ),
        ],
      ),
    );
  }

  Future<void> _send(String chatId) async {
    final text = _controller.text.trim();
    if (_sending || text.isEmpty) {
      return;
    }
    setState(() => _sending = true);
    try {
      await ref.read(chatMessageSenderProvider).sendText(
            chatId: chatId,
            text: text,
          );
      await ref.read(chatRealtimeProvider(chatId))?.flushOutbox();
      if (!mounted) {
        return;
      }
      _controller.clear();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось отправить сообщение')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.community,
    required this.loading,
    required this.onBack,
  });

  final BackendCardItem? community;
  final bool loading;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final online = _int(community?.raw['online']);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.paddingOf(context).top + 12,
        16,
        12,
      ),
      child: Row(
        children: [
          _IconButton(icon: LucideIcons.chevronLeft, onTap: onBack),
          const SizedBox(width: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              width: 44,
              height: 44,
              child: DateasyRemoteImage(
                imageUrl: community?.imageUrl,
                usage: DateasyImageUsage.avatar,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  community?.title ?? (loading ? 'Загружаю' : 'Сообщество'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$online онлайн',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.lime,
                        fontWeight: FontWeight.w700,
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

class _PinnedMeetup extends StatelessWidget {
  const _PinnedMeetup({required this.community});

  final BackendCardItem community;

  @override
  Widget build(BuildContext context) {
    final meetup = _map(community.raw['nextMeetup']);
    if (meetup.isEmpty) {
      return const SizedBox.shrink();
    }
    final title = meetup['title']?.toString() ?? 'Ближайшая встреча';
    final time = meetup['time']?.toString() ?? meetup['timeLabel']?.toString();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: DateasyColors.lime.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: DateasyColors.lime.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.pin, color: DateasyColors.lime, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              [title, if (time != null && time.isNotEmpty) time].join(' · '),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Messages extends ConsumerWidget {
  const _Messages({required this.chatId, required this.controller});

  final String chatId;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUserId = ref.watch(currentUserIdProvider);
    final messages = ref.watch(chatMessagesProvider(chatId));
    final pagination = ref.watch(chatHistoryPaginationProvider(chatId));
    return messages.when(
      data: (items) {
        if (items.isEmpty) {
          return const Center(child: _SystemText('Сообщений пока нет'));
        }
        return ListView.separated(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
          itemCount: items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            if (index == 0) {
              return _OlderButton(
                loading: pagination.loading,
                hasNextPage: pagination.hasNextPage,
                onTap: () => ref
                    .read(chatHistoryPaginationProvider(chatId).notifier)
                    .loadNextPage(),
              );
            }
            final message = items[index - 1];
            return _MessageBubble(
              message: message,
              mine: message.senderId == currentUserId,
            );
          },
        );
      },
      loading: () => const Center(child: _SystemText('Загружаю сообщения')),
      error: (_, __) => const Center(child: _SystemText('Чат недоступен')),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.mine});

  final BackendChatMessage message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (!mine) ...[
          ClipOval(
            child: SizedBox(
              width: 28,
              height: 28,
              child: DateasyRemoteImage(
                imageUrl: message.senderAvatarUrl,
                usage: DateasyImageUsage.avatar,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: mine ? DateasyColors.lime : DateasyColors.surface2,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(18),
                topRight: const Radius.circular(18),
                bottomLeft: Radius.circular(mine ? 18 : 6),
                bottomRight: Radius.circular(mine ? 6 : 18),
              ),
            ),
            child: Column(
              crossAxisAlignment:
                  mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!mine && (message.senderName ?? '').isNotEmpty) ...[
                  Text(
                    message.senderName!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: DateasyColors.lime,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 4),
                ],
                Text(
                  message.text,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: mine
                            ? DateasyColors.backgroundDeep
                            : DateasyColors.foreground,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onChanged,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onChanged;
  final VoidCallback? onSend;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, bottom + 12),
      decoration: BoxDecoration(
        color: DateasyColors.background.withValues(alpha: 0.96),
        border: const Border(top: BorderSide(color: DateasyColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: (_) => onChanged(),
              minLines: 1,
              maxLines: 4,
              style: const TextStyle(color: DateasyColors.foreground),
              decoration: InputDecoration(
                hintText: 'Сообщение',
                hintStyle: const TextStyle(color: DateasyColors.muted),
                filled: true,
                fillColor: DateasyColors.surface2,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: sending ? null : onSend,
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: DateasyColors.lime,
                borderRadius: BorderRadius.circular(16),
              ),
              child: sending
                  ? const Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: DateasyColors.backgroundDeep,
                        ),
                      ),
                    )
                  : const Icon(
                      LucideIcons.send,
                      color: DateasyColors.backgroundDeep,
                      size: 20,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OlderButton extends StatelessWidget {
  const _OlderButton({
    required this.loading,
    required this.hasNextPage,
    required this.onTap,
  });

  final bool loading;
  final bool hasNextPage;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (!hasNextPage) {
      return const SizedBox.shrink();
    }
    return Center(
      child: GestureDetector(
        onTap: loading ? null : onTap,
        child: _SystemText(loading ? 'Загружаю' : 'Показать раньше'),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, color: DateasyColors.foreground, size: 20),
      ),
    );
  }
}

class _SystemText extends StatelessWidget {
  const _SystemText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: DateasyColors.muted,
            fontWeight: FontWeight.w700,
          ),
    );
  }
}

String? _chatId(BackendCardItem? community) {
  final value = community?.raw['chatId']?.toString().trim();
  return value == null || value.isEmpty ? null : value;
}

Map<String, Object?> _map(Object? value) {
  if (value is Map<String, Object?>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, value) => MapEntry('$key', value));
  }
  return const {};
}

int _int(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
