import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const _NotificationsView();
  }
}

class _NotificationsView extends ConsumerStatefulWidget {
  const _NotificationsView();

  @override
  ConsumerState<_NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends ConsumerState<_NotificationsView> {
  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final notificationsAsync = ref.watch(notificationsProvider);
    final localItems = ref.watch(notificationsLocalStateProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: colors.border.withValues(alpha: 0.6),
                  ),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.chevron_left_rounded, size: 28),
                  ),
                  Expanded(
                    child: Text(
                      'Уведомления',
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _markAllRead();
                    },
                    style: TextButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_rounded,
                          size: 14,
                          color: colors.primary,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          'Всё',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: AsyncValueView(
                value: notificationsAsync,
                data: (items) {
                  final effectiveItems = localItems ?? items;
                  final now = DateTime.now();
                  final today = effectiveItems
                      .where((item) => _isSameDay(item.createdAt, now))
                      .toList(growable: false);
                  final earlier = effectiveItems
                      .where((item) => !_isSameDay(item.createdAt, now))
                      .toList(growable: false);

                  return ListView(
                    padding: const EdgeInsets.only(bottom: 24),
                    children: [
                      if (today.isNotEmpty) ...[
                        const _NotificationGroupLabel(title: 'Сегодня'),
                        ...today.map((item) => _NotificationTile(item: item)),
                      ],
                      if (earlier.isNotEmpty) ...[
                        const _NotificationGroupLabel(title: 'Раньше'),
                        ...earlier.map((item) => _NotificationTile(item: item)),
                      ],
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isSameDay(DateTime left, DateTime right) {
    final leftLocal = left.toLocal();
    final rightLocal = right.toLocal();
    return leftLocal.year == rightLocal.year &&
        leftLocal.month == rightLocal.month &&
        leftLocal.day == rightLocal.day;
  }

  Future<void> _markAllRead() async {
    final currentItems = ref.read(notificationsLocalStateProvider) ??
        ref.read(notificationsProvider).valueOrNull;
    if (currentItems == null || currentItems.isEmpty) {
      return;
    }

    final readAt = DateTime.now();
    final nextItems = currentItems
        .map(
          (item) => NotificationItem(
            id: item.id,
            kind: item.kind,
            title: item.title,
            body: item.body,
            payload: item.payload,
            readAt: item.readAt ?? readAt,
            createdAt: item.createdAt,
          ),
        )
        .toList(growable: false);

    ref.read(notificationsLocalStateProvider.notifier).state = nextItems;
    ref.read(notificationUnreadCountOverrideProvider.notifier).state = 0;

    try {
      await ref.read(backendRepositoryProvider).markAllNotificationsRead();
      _refreshNotificationsFromServer();
    } catch (_) {
      ref.read(notificationsLocalStateProvider.notifier).state = currentItems;
      ref.read(notificationUnreadCountOverrideProvider.notifier).state =
          currentItems.where((item) => item.unread).length;
      rethrow;
    }
  }

  void _refreshNotificationsFromServer() {
    ref.read(notificationsLocalStateProvider.notifier).state = null;
    ref.read(notificationUnreadCountOverrideProvider.notifier).state = null;
    ref.invalidate(notificationsProvider);
    ref.invalidate(notificationUnreadCountProvider);
  }
}

class _NotificationGroupLabel extends StatelessWidget {
  const _NotificationGroupLabel({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Text(
        title,
        style: AppTextStyles.caption.copyWith(
          color: colors.inkMute,
          letterSpacing: 1,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerStatefulWidget {
  const _NotificationTile({required this.item});

  final NotificationItem item;

  @override
  ConsumerState<_NotificationTile> createState() => _NotificationTileState();
}

class _NotificationTileState extends ConsumerState<_NotificationTile> {
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final item = widget.item;
    final actorName = _actorName(item);
    final isInvite = _isInvite(item);
	    final icon = switch (isInvite ? 'invite' : item.kind) {
	      'message' => Icons.message_outlined,
	      'join' => Icons.groups_rounded,
	      'invite' => Icons.calendar_today_outlined,
	      'event_invite' => Icons.calendar_today_outlined,
	      'event_starting' => Icons.schedule_rounded,
	      'like' => Icons.favorite_border_rounded,
	      'subscription_expiring' => Icons.workspace_premium_outlined,
	      _ => Icons.notifications_none_rounded,
	    };

    return InkWell(
      onTap: () async {
        if (item.unread) {
          await _markNotificationRead(item.id);
        }
        if (!context.mounted) {
          return;
        }
        final chatId = item.payload['chatId'] as String?;
        final eventId = item.payload['eventId'] as String?;
        final personId = (item.payload['userId'] ??
            item.payload['personId'] ??
            item.payload['targetUserId']) as String?;
        if (chatId != null) {
          context.pushRoute(
            AppRoute.meetupChat,
            pathParameters: {'chatId': chatId},
          );
        } else if (eventId != null) {
          context.pushRoute(
            AppRoute.eventDetail,
            pathParameters: {'eventId': eventId},
          );
        } else if (personId != null) {
          context.pushRoute(
            AppRoute.userProfile,
            pathParameters: {'userId': personId},
          );
        }
      },
      child: Container(
        color: item.unread
            ? colors.primarySoft.withValues(alpha: 0.4)
            : Colors.transparent,
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _LeadingBadge(actorName: actorName, icon: icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      style: AppTextStyles.bodySoft.copyWith(
                        color: colors.inkSoft,
                      ),
                      children: [
                        if (actorName != null)
                          TextSpan(
                            text: '$actorName ',
                            style: AppTextStyles.body.copyWith(
                              fontWeight: FontWeight.w600,
                              color: colors.foreground,
                            ),
                          ),
                        TextSpan(text: _notificationText(item, actorName)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatTime(item.createdAt),
                    style: AppTextStyles.meta,
                  ),
                  if (isInvite) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _ActionPill(
                          label: 'Принять',
                          filled: true,
                          enabled: !_submitting,
                          onTap: _acceptInvite,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        _ActionPill(
                          label: 'Не сейчас',
                          enabled: !_submitting,
                          onTap: _declineInvite,
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (item.unread)
              Container(
                key: ValueKey('notification-unread-dot-${item.id}'),
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6),
                decoration: BoxDecoration(
                  color: colors.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  String? _actorName(dynamic item) {
    final payload = item.payload as Map<String, dynamic>;
    for (final key in const ['personName', 'userName', 'name']) {
      final value = payload[key];
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
    }
    if (item.kind == 'message' && item.body is String) {
      final body = item.body as String;
      final separator = body.indexOf(':');
      if (separator > 0) {
        return body.substring(0, separator).trim();
      }
    }
    return null;
  }

	  bool _isInvite(NotificationItem item) {
	    return item.payload['invite'] == true ||
	        item.kind == 'invite' ||
	        item.kind == 'event_invite';
	  }

  Future<void> _acceptInvite() async {
    final item = widget.item;
    final eventId = item.payload['eventId'] as String?;
    final requestId = item.payload['requestId'] as String?;

    if (_submitting || eventId == null || requestId == null) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      await ref
          .read(backendRepositoryProvider)
          .acceptInvite(eventId, requestId);
      _refreshNotificationsFromServer();
      ref.invalidate(eventsProvider('nearby'));
      ref.invalidate(mapEventsProvider);
      ref.invalidate(eventDetailProvider(eventId));
      ref.invalidate(meetupChatsProvider);
      ref.invalidate(hostDashboardProvider);
      ref.invalidate(hostEventProvider(eventId));
      ref.invalidate(notificationUnreadCountProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Приглашение принято')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось принять приглашение')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _declineInvite() async {
    final item = widget.item;
    final eventId = item.payload['eventId'] as String?;
    final requestId = item.payload['requestId'] as String?;

    if (_submitting || eventId == null || requestId == null) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      await ref
          .read(backendRepositoryProvider)
          .declineInvite(eventId, requestId);
      _refreshNotificationsFromServer();
      ref.invalidate(eventDetailProvider(eventId));
      ref.invalidate(meetupChatsProvider);
      ref.invalidate(hostDashboardProvider);
      ref.invalidate(hostEventProvider(eventId));
      ref.invalidate(notificationUnreadCountProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Приглашение отклонено')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось отклонить приглашение')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _markNotificationRead(String notificationId) async {
    final currentItems = ref.read(notificationsLocalStateProvider) ??
        ref.read(notificationsProvider).valueOrNull;
    if (currentItems == null) {
      ref.invalidate(notificationsProvider);
      return;
    }

    final readAt = DateTime.now();
    final nextItems = currentItems
        .map(
          (item) => item.id == notificationId
              ? item.copyWith(readAt: item.readAt ?? readAt)
              : item,
        )
        .toList(growable: false);

    ref.read(notificationsLocalStateProvider.notifier).state = nextItems;
    ref.read(notificationUnreadCountOverrideProvider.notifier).state =
        nextItems.where((item) => item.unread).length;

    try {
      await ref.read(backendRepositoryProvider).markNotificationRead(
            notificationId,
          );
      _refreshNotificationsFromServer();
    } catch (_) {
      ref.read(notificationsLocalStateProvider.notifier).state = currentItems;
      ref.read(notificationUnreadCountOverrideProvider.notifier).state =
          currentItems.where((item) => item.unread).length;
      rethrow;
    }
  }

  void _refreshNotificationsFromServer() {
    ref.read(notificationsLocalStateProvider.notifier).state = null;
    ref.read(notificationUnreadCountOverrideProvider.notifier).state = null;
    ref.invalidate(notificationsProvider);
    ref.invalidate(notificationUnreadCountProvider);
  }

  String _notificationText(dynamic item, String? actorName) {
    final body = (item.body as String).trim();
    if (actorName != null && body.startsWith('$actorName:')) {
      return body.substring(actorName.length + 1).trim();
    }
    if (body.isNotEmpty) {
      return body;
    }
    return (item.title as String).trim();
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    final now = DateTime.now();
    final difference = now.difference(local);
    if (difference.inMinutes < 60) {
      final minutes = difference.inMinutes.clamp(1, 59);
      return '$minutes мин';
    }
    if (local.year == now.year &&
        local.month == now.month &&
        local.day == now.day) {
      return '${difference.inHours} ч';
    }

    final localDay = DateTime(local.year, local.month, local.day);
    final nowDay = DateTime(now.year, now.month, now.day);
    final days = nowDay.difference(localDay).inDays;
    if (days == 1) {
      return 'вчера';
    }
    if (days > 1 && days < 7) {
      if (days <= 4) {
        return '$days дня';
      }
      return '$days дней';
    }
    return '${local.day.toString().padLeft(2, '0')}.${local.month.toString().padLeft(2, '0')}';
  }
}

class _LeadingBadge extends StatelessWidget {
  const _LeadingBadge({
    required this.actorName,
    required this.icon,
  });

  final String? actorName;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    if (actorName != null) {
      return SizedBox(
        width: 44,
        height: 44,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            BbAvatar(
              name: actorName!,
              size: BbAvatarSize.md,
            ),
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: colors.foreground,
                  shape: BoxShape.circle,
                  border: Border.all(color: colors.background, width: 2),
                ),
                child: Icon(
                  icon,
                  size: 11,
                  color: colors.primaryForeground,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Icon(icon, size: 18, color: colors.inkSoft),
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({
    required this.label,
    this.filled = false,
    this.enabled = true,
    this.onTap,
  });

  final String label;
  final bool filled;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: filled
              ? colors.foreground
              : enabled
                  ? colors.card
                  : colors.muted,
          borderRadius: BorderRadius.circular(999),
          border: filled ? null : Border.all(color: colors.border),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.meta.copyWith(
            color: filled ? colors.primaryForeground : colors.inkSoft,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
