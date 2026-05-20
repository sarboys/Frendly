import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:mobile2/shared/widgets/dateasy_top_bar.dart';

class ChatsScreen extends StatefulWidget {
  const ChatsScreen({super.key});

  @override
  State<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends State<ChatsScreen> {
  ChatListKind _kind = ChatListKind.all;

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverPadding(
                padding: EdgeInsets.only(
                  top: MediaQuery.paddingOf(context).top + 16,
                ),
                sliver: SliverList.list(
                  children: [
                    const DateasyTopBar(),
                    const _Header(),
                    const _SearchBox(),
                    const _DeferredMatchesSection(),
                    _ChatFilters(
                      selected: _kind,
                      onChanged: (kind) => setState(() => _kind = kind),
                    ),
                  ],
                ),
              ),
              _ChatsList(kind: _kind),
              const SliverToBoxAdapter(child: SizedBox(height: 144)),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    final headline = Theme.of(context).textTheme.headlineLarge?.copyWith(
          fontSize: 34,
          height: 1.05,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Новые мэтчи',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'Твои '),
                dateasyHeadlineHighlightSpan(
                  text: 'чаты',
                  style: headline,
                ),
              ],
            ),
            style: headline,
          ),
        ],
      ),
    );
  }
}

class _DeferredMatchesSection extends StatefulWidget {
  const _DeferredMatchesSection();

  @override
  State<_DeferredMatchesSection> createState() =>
      _DeferredMatchesSectionState();
}

class _DeferredMatchesSectionState extends State<_DeferredMatchesSection> {
  bool _loadMatches = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 600), () {
      if (mounted) {
        setState(() => _loadMatches = true);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _loadMatches ? const _MatchesSection() : const _MatchesPlaceholder();
  }
}

class _MatchesPlaceholder extends StatelessWidget {
  const _MatchesPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    'Новые мэтчи',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                Text(
                  'Все',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 92,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              children: const [_SwipeButton()],
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            const Icon(
              LucideIcons.search,
              size: 16,
              color: DateasyColors.muted,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Найти диалог или встречу',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MatchesSection extends ConsumerWidget {
  const _MatchesSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matches = ref.watch(matchesProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    'Новые мэтчи',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                Text(
                  'Все',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          matches.when(
            data: (page) => SizedBox(
              height: 92,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: page.items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return const _SwipeButton();
                  }

                  return _MatchBubble(match: page.items[index - 1]);
                },
              ),
            ),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _InlineState(text: 'Загружаю мэтчи'),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _InlineState(text: 'Мэтчи сейчас недоступны'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SwipeButton extends StatelessWidget {
  const _SwipeButton();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: dateasyLimeGradient,
              boxShadow: [
                BoxShadow(
                  color: Color(0x66BEFF67),
                  blurRadius: 24,
                  spreadRadius: -8,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.plus,
              size: 24,
              color: DateasyColors.backgroundDeep,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            'Свайпать',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }
}

class _MatchBubble extends StatelessWidget {
  const _MatchBubble({required this.match});

  final BackendCardItem match;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/u/${match.id}'),
      child: SizedBox(
        width: 64,
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 68,
                  height: 68,
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: dateasyPinkGradient,
                  ),
                  child: Container(
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: DateasyColors.background,
                    ),
                    padding: const EdgeInsets.all(2),
                    child: ClipOval(
                      child: DateasyRemoteImage(
                        imageUrl: match.imageUrl,
                        usage: DateasyImageUsage.avatar,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 2,
                  bottom: 2,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: DateasyColors.lime,
                      border: Border.all(
                        color: DateasyColors.background,
                        width: 2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              match.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
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

class _ChatFilters extends StatelessWidget {
  const _ChatFilters({
    required this.selected,
    required this.onChanged,
  });

  final ChatListKind selected;
  final ValueChanged<ChatListKind> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
        scrollDirection: Axis.horizontal,
        itemCount: _chatFilters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final filter = _chatFilters[index];
          final active = selected == filter.kind;
          return GestureDetector(
            onTap: () => onChanged(filter.kind),
            child: Container(
              height: 30,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: active ? DateasyColors.foreground : DateasyColors.glass,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: active
                      ? Colors.transparent
                      : Colors.white.withValues(alpha: 0.1),
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                filter.label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: active
                          ? DateasyColors.background
                          : DateasyColors.foreground,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ChatsList extends ConsumerWidget {
  const _ChatsList({required this.kind});

  final ChatListKind kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(chatListRealtimeProvider(kind));
    final chats = ref.watch(chatListProvider(kind));
    return chats.when(
      data: (page) {
        if (page.items.isEmpty) {
          return const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
            sliver:
                SliverToBoxAdapter(child: _InlineState(text: 'Чатов пока нет')),
          );
        }
        unawaited(
          ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                chatPrewarmImageUrls(page.items),
                usage: DateasyImageUsage.avatar,
                limit: 10,
                concurrency: 2,
              ),
        );
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, rawIndex) {
                if (rawIndex.isOdd) {
                  return const SizedBox(height: 8);
                }
                final index = rawIndex ~/ 2;
                return _ChatTile(
                  chat: _Chat.fromBackend(page.items[index]),
                  index: index,
                );
              },
              childCount: page.items.length * 2 - 1,
            ),
          ),
        );
      },
      loading: () => const SliverPadding(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
        sliver: SliverToBoxAdapter(child: _InlineState(text: 'Загружаю чаты')),
      ),
      error: (_, __) => const SliverPadding(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
        sliver: SliverToBoxAdapter(
          child: _InlineState(text: 'Не удалось загрузить чаты'),
        ),
      ),
    );
  }
}

class _ChatTile extends StatelessWidget {
  const _ChatTile({required this.chat, required this.index});

  final _Chat chat;
  final int index;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(chat.route),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 56,
                    height: 56,
                    child: DateasyRemoteImage(
                      imageUrl: chat.image,
                      usage: DateasyImageUsage.avatar,
                    ),
                  ),
                ),
                if (chat.status == _ChatStatus.online ||
                    chat.status == _ChatStatus.typing)
                  Positioned(
                    right: -1,
                    bottom: -1,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: DateasyColors.lime,
                        border: Border.all(
                          color: DateasyColors.background,
                          width: 2,
                        ),
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          chat.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    height: 1.15,
                                  ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        chat.time,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 11,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (chat.status == _ChatStatus.read) ...[
                        const Icon(
                          LucideIcons.checkCheck,
                          size: 14,
                          color: DateasyColors.lime,
                        ),
                        const SizedBox(width: 5),
                      ] else if (chat.status == _ChatStatus.delivered) ...[
                        const Icon(
                          LucideIcons.check,
                          size: 14,
                          color: DateasyColors.muted,
                        ),
                        const SizedBox(width: 5),
                      ],
                      Expanded(
                        child: Text(
                          chat.last,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: chat.status == _ChatStatus.typing
                                        ? DateasyColors.lime
                                        : DateasyColors.muted,
                                    fontSize: 12,
                                  ),
                        ),
                      ),
                    ],
                  ),
                  if (chat.tag != null) ...[
                    const SizedBox(height: 8),
                    _TagPill(tag: chat.tag!),
                  ],
                ],
              ),
            ),
            if (chat.unread > 0) ...[
              const SizedBox(width: 10),
              Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: dateasyLimeGradient,
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x55BEFF67),
                      blurRadius: 20,
                      spreadRadius: -8,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '${chat.unread}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TagPill extends StatelessWidget {
  const _TagPill({required this.tag});

  final _ChatTag tag;

  @override
  Widget build(BuildContext context) {
    final color = switch (tag.tone) {
      _Tone.lime => DateasyColors.lime,
      _Tone.pink => DateasyColors.pink,
      _Tone.lilac => DateasyColors.lilac,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Text(
        tag.label.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w400,
              letterSpacing: 1,
            ),
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

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 20,
      padding: const EdgeInsets.all(16),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _Chat {
  const _Chat({
    required this.id,
    required this.name,
    required this.image,
    required this.last,
    required this.time,
    required this.unread,
    required this.status,
    required this.route,
    this.tag,
  });

  final String id;
  final String name;
  final String image;
  final String last;
  final String time;
  final int unread;
  final _ChatStatus status;
  final _ChatTag? tag;
  final String route;

  factory _Chat.fromBackend(BackendChatSummary summary) {
    return _Chat(
      id: summary.id,
      name: summary.title,
      image: _chatPreviewImageUrl(summary) ?? '',
      last: summary.subtitle ?? '',
      time: _chatTime(summary),
      unread: summary.unreadCount,
      status: _chatStatus(summary),
      tag: _chatTag(summary),
      route: chatRouteForSummary(summary),
    );
  }
}

String? _chatPreviewImageUrl(BackendChatSummary summary) {
  final raw = summary.raw;
  if (summary.kind == 'personal') {
    return summary.imageUrl ??
        _firstProfileImage(raw['memberProfiles']) ??
        _firstProfileImage(raw['participants']) ??
        _firstProfileImage(raw['members']) ??
        _stringOrNull(raw['peerAvatarUrl'] ?? raw['peerImageUrl']);
  }

  return summary.imageUrl ??
      _stringOrNull(
        raw['coverImageUrl'] ??
            raw['eventImageUrl'] ??
            raw['meetingImageUrl'] ??
            raw['thumbnailUrl'] ??
            raw['posterImageUrl'] ??
            raw['imageUrl'] ??
            raw['avatarUrl'],
      ) ??
      _firstProfileImage(raw['memberProfiles']) ??
      _firstProfileImage(raw['participants']);
}

Iterable<String> chatPrewarmImageUrls(Iterable<BackendChatSummary> summaries) {
  return summaries.map(_chatPreviewImageUrl).whereType<String>().take(10);
}

String? _firstProfileImage(Object? value) {
  if (value is! List) {
    return null;
  }
  for (final item in value) {
    if (item is! Map) {
      continue;
    }
    final map = item.map((key, value) => MapEntry('$key', value));
    if (map['isCurrentUser'] == true) {
      continue;
    }
    final image = _stringOrNull(
      map['avatarUrl'] ?? map['imageUrl'] ?? map['photoUrl'] ?? map['picture'],
    );
    if (image != null) {
      return image;
    }
  }
  return null;
}

String chatRouteForSummary(BackendChatSummary summary) {
  return summary.kind == 'personal'
      ? '/chats/${summary.id}'
      : '/meetings/${summary.id}/chat';
}

class _ChatTag {
  const _ChatTag(this.label, this.tone);

  final String label;
  final _Tone tone;
}

enum _ChatStatus { online, read, typing, delivered }

enum _Tone { lime, pink, lilac }

class _ChatFilter {
  const _ChatFilter(this.label, this.kind);

  final String label;
  final ChatListKind kind;
}

const _chatFilters = [
  _ChatFilter('Все', ChatListKind.all),
  _ChatFilter('Встречи', ChatListKind.meetups),
  _ChatFilter('Личные', ChatListKind.personal),
  _ChatFilter('Непрочитанные', ChatListKind.unread),
];

String _chatTime(BackendChatSummary summary) {
  final raw = summary.raw;
  final direct = _stringOrNull(raw['lastTime'] ?? raw['timeLabel']);
  if (direct != null) {
    return direct;
  }
  final at = DateTime.tryParse(raw['lastMessageAt']?.toString() ?? '');
  if (at == null) {
    return '';
  }
  final local = at.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

_ChatStatus _chatStatus(BackendChatSummary summary) {
  if (summary.raw['typing'] == true) {
    return _ChatStatus.typing;
  }
  if (summary.raw['online'] == true || summary.unreadCount > 0) {
    return _ChatStatus.online;
  }
  if (summary.raw['lastMessageRead'] == true) {
    return _ChatStatus.read;
  }
  return _ChatStatus.delivered;
}

_ChatTag? _chatTag(BackendChatSummary summary) {
  final raw = summary.raw;
  final label = _stringOrNull(
        raw['fromMeetup'] ??
            raw['contextLine'] ??
            raw['venueLine'] ??
            raw['area'] ??
            raw['category'],
      ) ??
      (summary.kind == 'personal' ? null : 'Встреча');
  if (label == null) {
    return null;
  }
  final tone = switch (summary.kind) {
    'personal' => _Tone.pink,
    _ => _Tone.lime,
  };
  return _ChatTag(label, tone);
}

String? _stringOrNull(Object? value) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? null : text;
}
