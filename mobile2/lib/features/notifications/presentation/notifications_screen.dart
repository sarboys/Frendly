import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final Set<String> _readOverride = <String>{};
  bool _markingAll = false;
  _NotificationFilter _activeFilter = _NotificationFilter.all;

  Future<void> _markRead(_NotificationItem item) async {
    if (item.read || _readOverride.contains(item.id)) {
      _openRoute(item);
      return;
    }
    setState(() => _readOverride.add(item.id));
    try {
      await ref.read(notificationsActionsProvider).markRead(item.id);
    } catch (_) {
      if (mounted) {
        setState(() => _readOverride.remove(item.id));
      }
    }
    _openRoute(item);
  }

  Future<void> _markAllRead() async {
    if (_markingAll) {
      return;
    }
    setState(() => _markingAll = true);
    try {
      await ref.read(notificationsActionsProvider).markAllRead();
    } finally {
      if (mounted) {
        setState(() => _markingAll = false);
      }
    }
  }

  void _openRoute(_NotificationItem item) {
    final route = item.route;
    if (route != null && mounted) {
      context.go(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 132,
            ),
            children: [
              _Header(
                markingAll: _markingAll,
                onMarkAll: _markAllRead,
              ),
              _FilterChips(
                active: _activeFilter,
                onChanged: (filter) {
                  setState(() => _activeFilter = filter);
                },
              ),
              _UnreadCountBanner(ref: ref),
              Builder(builder: (context) {
                final notifications = ref.watch(notificationsProvider);
                return notifications.when(
                  data: (page) {
                    final items = page.items
                        .map(_NotificationItem.fromBackend)
                        .where((item) => item.matches(_activeFilter))
                        .toList(growable: false);
                    if (items.isEmpty) {
                      return const _InlineState(text: 'Уведомлений пока нет');
                    }
                    return _Section(
                      title: _activeFilter.title,
                      items: items,
                      readOverride: _readOverride,
                      onTap: _markRead,
                    );
                  },
                  loading: () =>
                      const _InlineState(text: 'Загружаю уведомления'),
                  error: (_, __) =>
                      const _InlineState(text: 'Уведомления недоступны'),
                );
              }),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.markingAll,
    required this.onMarkAll,
  });

  final bool markingAll;
  final VoidCallback onMarkAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/'),
          ),
          Expanded(
            child: Text(
              'Уведомления',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          _GlassIconButton(
            icon:
                markingAll ? LucideIcons.loaderCircle : LucideIcons.checkCheck,
            onTap: onMarkAll,
          ),
        ],
      ),
    );
  }
}

class _UnreadCountBanner extends StatelessWidget {
  const _UnreadCountBanner({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationUnreadCountProvider);
    final count = state.valueOrNull ?? 0;
    if (state.isLoading && count == 0) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(
              LucideIcons.bell,
              size: 16,
              color: DateasyColors.lime,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                count == 0 ? 'Новых уведомлений нет' : 'Новых: $count',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 12,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.active,
    required this.onChanged,
  });

  final _NotificationFilter active;
  final ValueChanged<_NotificationFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        itemBuilder: (context, index) {
          final filter = _NotificationFilter.values[index];
          final selected = filter == active;

          return GestureDetector(
            onTap: () => onChanged(filter),
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color:
                    selected ? DateasyColors.foreground : DateasyColors.glass,
                borderRadius: BorderRadius.circular(999),
                border: selected
                    ? null
                    : Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Text(
                filter.title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: selected
                          ? DateasyColors.background
                          : DateasyColors.foreground,
                      fontSize: 12,
                      height: 1.1,
                      fontWeight: selected ? FontWeight.w600 : null,
                    ),
              ),
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _NotificationFilter.values.length,
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.items,
    required this.readOverride,
    required this.onTap,
  });

  final String title;
  final List<_NotificationItem> items;
  final Set<String> readOverride;
  final ValueChanged<_NotificationItem> onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title.toUpperCase(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                    letterSpacing: 1,
                  ),
            ),
          ),
          for (var index = 0; index < items.length; index++) ...[
            _NotificationRow(
              item: items[index],
              unread:
                  !items[index].read && !readOverride.contains(items[index].id),
              onTap: () => onTap(items[index]),
            ),
            if (index != items.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.item,
    required this.unread,
    required this.onTap,
  });

  final _NotificationItem item;
  final bool unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: unread
              ? DateasyColors.lime.withValues(alpha: 0.05)
              : DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: unread
                ? DateasyColors.lime.withValues(alpha: 0.2)
                : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Row(
          children: [
            _NotificationIcon(item: item),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: item.who,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: DateasyColors.foreground,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    height: 1.15,
                                  ),
                        ),
                        TextSpan(
                          text: ' ${item.text}',
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: DateasyColors.muted,
                                    fontSize: 14,
                                    height: 1.15,
                                  ),
                        ),
                      ],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.time,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (item.cta != null)
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 88),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: dateasyLimeGradient,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    item.cta!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          height: 1.05,
                        ),
                  ),
                ),
              )
            else if (unread)
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: DateasyColors.lime,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NotificationIcon extends StatelessWidget {
  const _NotificationIcon({required this.item});

  final _NotificationItem item;

  @override
  Widget build(BuildContext context) {
    final image = item.imageAsset;
    final tint = item.color;

    return SizedBox(
      width: 46,
      height: 46,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: image == null
                ? Container(
                    decoration: BoxDecoration(
                      gradient: tint == _NoticeColor.lime
                          ? dateasyLimeGradient
                          : tint == _NoticeColor.pink
                              ? dateasyPinkGradient
                              : null,
                      color: tint == _NoticeColor.lilac
                          ? DateasyColors.lilac
                          : null,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      item.icon,
                      color: _foregroundForNotice(tint),
                      size: 20,
                    ),
                  )
                : ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: DateasyRemoteImage(
                      imageUrl: image,
                      usage: DateasyImageUsage.avatar,
                    ),
                  ),
          ),
          if (image != null)
            Positioned(
              right: -3,
              bottom: -3,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: _solidColor(tint),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: DateasyColors.background,
                    width: 2,
                  ),
                ),
                child: Icon(
                  item.icon,
                  color: _foregroundForNotice(tint),
                  size: 12,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return const DateasyBottomNav();
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 22),
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
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

enum _NoticeColor { lime, pink, lilac }

class _NotificationItem {
  const _NotificationItem({
    required this.id,
    required this.icon,
    required this.color,
    required this.who,
    required this.text,
    required this.time,
    required this.read,
    this.imageAsset,
    this.cta,
    this.route,
    this.filter = _NotificationFilter.system,
  });

  final String id;
  final IconData icon;
  final _NoticeColor color;
  final String who;
  final String text;
  final String time;
  final bool read;
  final String? imageAsset;
  final String? cta;
  final String? route;
  final _NotificationFilter filter;

  bool matches(_NotificationFilter value) {
    return value == _NotificationFilter.all || filter == value;
  }

  factory _NotificationItem.fromBackend(BackendCardItem item) {
    return _NotificationItem(
      id: item.id,
      icon: LucideIcons.bell,
      color: _NoticeColor.lime,
      who: item.title,
      text: item.subtitle ?? '',
      time: _formatDate(item.startsAt),
      read: item.raw['readAt'] != null,
      imageAsset: item.imageUrl,
      cta: item.raw['cta']?.toString(),
      route: _routeFromPayload(item.raw),
      filter: _filterFromBackend(item.raw),
    );
  }
}

Color _solidColor(_NoticeColor color) {
  return switch (color) {
    _NoticeColor.lime => DateasyColors.lime,
    _NoticeColor.pink => DateasyColors.pink,
    _NoticeColor.lilac => DateasyColors.lilac,
  };
}

Color _foregroundForNotice(_NoticeColor color) {
  return switch (color) {
    _NoticeColor.pink => DateasyColors.foreground,
    _ => DateasyColors.backgroundDeep,
  };
}

enum _NotificationFilter {
  all('Все'),
  matches('Мэтчи'),
  meetings('Встречи'),
  chats('Чаты'),
  system('Система');

  const _NotificationFilter(this.title);

  final String title;
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

String _formatDate(DateTime? value) {
  if (value == null) {
    return '';
  }
  final local = value.toLocal();
  return '${local.day}.${local.month}';
}

String? _routeFromPayload(Map<String, Object?> raw) {
  final payload = raw['payload'];
  if (payload is! Map) {
    return null;
  }
  final eventId = payload['eventId']?.toString();
  if (eventId != null && eventId.isNotEmpty) {
    final requestId = payload['requestId']?.toString();
    final invite =
        payload['invite'] == true && requestId != null && requestId.isNotEmpty;
    if (invite) {
      return '/meetings/$eventId?inviteRequestId=${Uri.encodeComponent(requestId)}';
    }
    return '/meetings/$eventId';
  }
  final chatId = payload['chatId']?.toString();
  if (chatId != null && chatId.isNotEmpty) {
    return '/meetings/$chatId/chat';
  }
  final userId = payload['userId']?.toString();
  if (userId != null && userId.isNotEmpty) {
    return '/u/$userId';
  }
  return null;
}

_NotificationFilter _filterFromBackend(Map<String, Object?> raw) {
  final kind = raw['kind']?.toString().toLowerCase() ?? '';
  if (kind.contains('match') || kind.contains('like')) {
    return _NotificationFilter.matches;
  }
  if (kind.contains('chat') || kind.contains('message')) {
    return _NotificationFilter.chats;
  }
  if (kind.contains('event') ||
      kind.contains('meet') ||
      kind.contains('invite')) {
    return _NotificationFilter.meetings;
  }
  final payload = raw['payload'];
  if (payload is Map && payload['eventId'] != null) {
    return _NotificationFilter.meetings;
  }
  if (payload is Map && payload['chatId'] != null) {
    return _NotificationFilter.chats;
  }
  return _NotificationFilter.system;
}
