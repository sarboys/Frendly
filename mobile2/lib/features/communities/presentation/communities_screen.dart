import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:mobile2/shared/widgets/dateasy_top_bar.dart';

class CommunitiesScreen extends ConsumerStatefulWidget {
  const CommunitiesScreen({super.key});

  @override
  ConsumerState<CommunitiesScreen> createState() => _CommunitiesScreenState();
}

class _CommunitiesScreenState extends ConsumerState<CommunitiesScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  String? _toastText;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_loadMoreNearBottom);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_loadMoreNearBottom)
      ..dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _loadMoreNearBottom() {
    if (!_scrollController.hasClients) {
      return;
    }
    if (_scrollController.position.extentAfter > 420) {
      return;
    }
    unawaited(
      ref.read(communitiesPaginationProvider.notifier).loadNextPage(),
    );
  }

  void _showTrendToast(_TrendingCommunity community) {
    setState(() {
      _toastText = '${community.title} · ${community.metric}';
    });
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            controller: _scrollController,
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 148,
            ),
            children: [
              const DateasyTopBar(),
              const _HeroHeader(),
              _SearchPanel(controller: _searchController),
              const _FeaturedRail(),
              const _MyCommunitiesList(),
              _TrendingList(onTap: _showTrendToast),
              const _AiCommunityCard(),
            ],
          ),
          const _BottomNav(),
          if (_toastText != null)
            Positioned(
              left: 20,
              right: 20,
              bottom: 104,
              child: _TrendToast(text: _toastText!),
            ),
        ],
      ),
    );
  }
}

class _HeroHeader extends StatelessWidget {
  const _HeroHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Сообщества',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        fontSize: 30,
                        height: 1.08,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Найди своих по вайбу',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 14,
                      ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => context.go('/communities/new'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: dateasyLimeGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: DateasyColors.lime.withValues(alpha: 0.28),
                    blurRadius: 28,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.plus,
                size: 22,
                color: DateasyColors.backgroundDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchPanel extends StatelessWidget {
  const _SearchPanel({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: SizedBox(
          height: 48,
          child: Row(
            children: [
              const Icon(
                LucideIcons.search,
                size: 18,
                color: DateasyColors.muted,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isCollapsed: true,
                    hintText: 'Йога, гастро, музыка...',
                    hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                  style: Theme.of(context).textTheme.bodyMedium,
                  cursorColor: DateasyColors.lime,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeaturedRail extends ConsumerWidget {
  const _FeaturedRail();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final communities = ref.watch(communitiesProvider);
    final pagination = ref.watch(communitiesPaginationProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Популярные'),
          const SizedBox(height: 12),
          communities.when(
            data: (page) {
              Future<void>.microtask(() {
                ref
                    .read(communitiesPaginationProvider.notifier)
                    .primeNextCursor(page.nextCursor);
              });
              final allItems = [...page.items, ...pagination.items];
              if (allItems.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  child: _InlineState(text: 'Сообществ пока нет'),
                );
              }
              final items = allItems.take(8).toList(growable: false);
              unawaited(
                ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                      communityPrewarmImageUrls(allItems),
                      usage: DateasyImageUsage.card,
                      limit: 8,
                      concurrency: 2,
                    ),
              );
              return SizedBox(
                height: 260,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    return _FeaturedCard(
                      community: _FeaturedCommunity.fromBackend(items[index]),
                    );
                  },
                ),
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _InlineState(text: 'Загружаю сообщества'),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _InlineState(text: 'Сообщества недоступны'),
            ),
          ),
        ],
      ),
    );
  }
}

Iterable<String> communityPrewarmImageUrls(
  List<BackendCardItem> communities,
) sync* {
  var emitted = 0;
  for (final community in communities) {
    if (emitted >= 8) {
      return;
    }
    final url = community.imageUrl?.trim();
    if (url == null || url.isEmpty) {
      continue;
    }
    emitted += 1;
    yield url;
  }
}

class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({required this.community});

  final _FeaturedCommunity community;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/communities/${community.id}'),
      child: Container(
        width: 230,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: DateasyColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.24),
              blurRadius: 24,
              offset: const Offset(0, 18),
            ),
          ],
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            DateasyRemoteImage(
              imageUrl: community.cover,
              usage: DateasyImageUsage.card,
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Color(0x33000000),
                    Color(0xD9000000),
                  ],
                  stops: [0, 0.5, 1],
                ),
              ),
            ),
            Positioned(
              left: 12,
              top: 12,
              child: _ToneBadge(tone: community.tone),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    community.title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontSize: 18,
                          height: 1.12,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(
                        LucideIcons.users,
                        size: 13,
                        color: Color(0xB3FFFFFF),
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          '${community.members} участников',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: const Color(0xB3FFFFFF),
                                    fontSize: 12,
                                  ),
                        ),
                      ),
                    ],
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

class _ToneBadge extends StatelessWidget {
  const _ToneBadge({required this.tone});

  final _CommunityTone tone;

  Color get _background {
    return switch (tone) {
      _CommunityTone.pink => DateasyColors.pink,
      _CommunityTone.lime => DateasyColors.lime,
      _CommunityTone.lilac => DateasyColors.lilac,
    };
  }

  Color get _foreground {
    return switch (tone) {
      _CommunityTone.lime => DateasyColors.backgroundDeep,
      _ => DateasyColors.foreground,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: _background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'Сообщество',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _foreground,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _MyCommunitiesList extends ConsumerWidget {
  const _MyCommunitiesList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final communities = ref.watch(communitiesProvider);
    final pagination = ref.watch(communitiesPaginationProvider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Мои сообщества',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 12),
          communities.when(
            data: (page) {
              final items = [...page.items, ...pagination.items];
              return Column(
                children: [
                  for (final item in items.take(12))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _MyCommunityTile(
                        community: _MyCommunity.fromBackend(item),
                      ),
                    ),
                  if (pagination.loading)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: _InlineState(text: 'Загружаю еще'),
                    ),
                  if (pagination.error)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: _InlineState(text: 'Еще сообщества недоступны'),
                    ),
                ],
              );
            },
            loading: () => const _InlineState(text: 'Загружаю клубы'),
            error: (_, __) => const _InlineState(text: 'Клубы недоступны'),
          ),
        ],
      ),
    );
  }
}

class _MyCommunityTile extends StatelessWidget {
  const _MyCommunityTile({required this.community});

  final _MyCommunity community;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/communities/${community.id}'),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: DateasyColors.lilac.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                LucideIcons.users,
                size: 22,
                color: DateasyColors.lilac,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    community.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${community.members} участников',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (community.avatars.isNotEmpty) ...[
              const SizedBox(width: 12),
              SizedBox(
                width: 70,
                height: 30,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    for (var index = 0;
                        index < community.avatars.length;
                        index++)
                      Positioned(
                        left: index * 20,
                        child: _Avatar(imageUrl: community.avatars[index]),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: DateasyColors.background,
          width: 2,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: DateasyRemoteImage(
        imageUrl: imageUrl,
        usage: DateasyImageUsage.avatar,
      ),
    );
  }
}

class _TrendingList extends ConsumerWidget {
  const _TrendingList({required this.onTap});

  final ValueChanged<_TrendingCommunity> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final communities = ref.watch(communitiesProvider);
    final pagination = ref.watch(communitiesPaginationProvider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                LucideIcons.trendingUp,
                size: 20,
                color: DateasyColors.lime,
              ),
              const SizedBox(width: 8),
              Text(
                'В тренде недели',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          communities.when(
            data: (page) {
              final items = [...page.items, ...pagination.items]
                  .take(3)
                  .map(_TrendingCommunity.fromBackend)
                  .toList(growable: false);
              if (items.isEmpty) {
                return const _InlineState(text: 'Трендов пока нет');
              }
              return Column(
                children: [
                  for (final community in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _TrendingTile(
                        community: community,
                        onTap: () => onTap(community),
                      ),
                    ),
                ],
              );
            },
            loading: () => const _InlineState(text: 'Загружаю тренды'),
            error: (_, __) => const _InlineState(text: 'Тренды недоступны'),
          ),
        ],
      ),
    );
  }
}

class _TrendingTile extends StatelessWidget {
  const _TrendingTile({
    required this.community,
    required this.onTap,
  });

  final _TrendingCommunity community;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: DateasyColors.background.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Text(
                community.iconLabel,
                style: const TextStyle(fontSize: 20),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    community.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'за 7 дней',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                ],
              ),
            ),
            Text(
              community.metric,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.lime,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AiCommunityCard extends StatelessWidget {
  const _AiCommunityCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/ai-builder'),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: dateasyPinkGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: DateasyColors.pink.withValues(alpha: 0.24),
                blurRadius: 28,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    LucideIcons.sparkles,
                    size: 16,
                    color: DateasyColors.foreground,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'AI ПОДБОР',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.1,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'Подобрать сообщество',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 21,
                      height: 1.12,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              Text(
                'по твоим интересам',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 21,
                      height: 1.12,
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

class _TrendToast extends StatelessWidget {
  const _TrendToast({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: DateasyColors.surface.withValues(alpha: 0.9),
            border: Border.all(color: DateasyColors.border),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w600,
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: DateasyColors.glass,
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(color: DateasyColors.border),
          ),
          child: child,
        ),
      ),
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

enum _CommunityTone { pink, lime, lilac }

class _FeaturedCommunity {
  const _FeaturedCommunity({
    required this.id,
    required this.title,
    required this.members,
    required this.cover,
    required this.tone,
  });

  final String id;
  final String title;
  final int members;
  final String cover;
  final _CommunityTone tone;

  factory _FeaturedCommunity.fromBackend(BackendCardItem item) {
    return _FeaturedCommunity(
      id: item.id,
      title: item.title,
      members: _intFrom(item.raw['membersCount'] ?? item.raw['memberCount']),
      cover: item.imageUrl ?? '',
      tone: _CommunityTone.lime,
    );
  }
}

class _MyCommunity {
  const _MyCommunity({
    required this.id,
    required this.title,
    required this.members,
    required this.avatars,
  });

  final String id;
  final String title;
  final int members;
  final List<String> avatars;

  factory _MyCommunity.fromBackend(BackendCardItem item) {
    return _MyCommunity(
      id: item.id,
      title: item.title,
      members: _intFrom(item.raw['membersCount'] ?? item.raw['memberCount']),
      avatars: _avatarUrlsFrom(item.raw).take(3).toList(growable: false),
    );
  }
}

class _TrendingCommunity {
  const _TrendingCommunity({
    required this.title,
    required this.metric,
    required this.iconLabel,
  });

  final String title;
  final String metric;
  final String iconLabel;

  factory _TrendingCommunity.fromBackend(BackendCardItem item) {
    final metric = _stringOrNull(
          item.raw['growthLabel'] ??
              item.raw['trendLabel'] ??
              item.raw['weeklyGrowthLabel'],
        ) ??
        _growthText(
          item.raw['growth'] ??
              item.raw['weeklyGrowth'] ??
              item.raw['membersGrowth'] ??
              item.raw['trend'],
        ) ??
        _memberLabel(
          _intFrom(item.raw['membersCount'] ?? item.raw['memberCount']),
        );

    return _TrendingCommunity(
      title: item.title.isEmpty ? 'Сообщество' : item.title,
      metric: metric,
      iconLabel: _iconLabelFrom(item),
    );
  }
}

int _intFrom(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

String? _stringOrNull(Object? value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

String? _growthText(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    if (value == 0) {
      return 'без роста';
    }
    final sign = value > 0 ? '+' : '';
    return '$sign${value.toInt()}%';
  }
  return _stringOrNull(value);
}

String _memberLabel(int members) {
  if (members <= 0) {
    return 'активно';
  }
  return '$members участников';
}

String _iconLabelFrom(BackendCardItem item) {
  final rawLabel = _stringOrNull(item.raw['emoji'] ?? item.raw['icon']);
  if (rawLabel != null && !rawLabel.startsWith('http')) {
    return rawLabel;
  }
  final title = item.title.trim();
  if (title.isEmpty) {
    return '#';
  }
  return title.characters.first.toUpperCase();
}

List<String> _avatarUrlsFrom(Map<String, Object?> raw) {
  final values = <String>[];
  void addUrl(Object? value) {
    final text = _stringOrNull(value);
    if (text != null && text.startsWith('http')) {
      values.add(text);
    }
  }

  void visit(Object? value) {
    if (value is Iterable) {
      for (final item in value) {
        visit(item);
      }
      return;
    }
    if (value is Map) {
      addUrl(value['avatarUrl']);
      addUrl(value['photoUrl']);
      addUrl(value['imageUrl']);
      final profile = value['profile'];
      if (profile is Map) {
        addUrl(profile['avatarUrl']);
        addUrl(profile['photoUrl']);
        addUrl(profile['imageUrl']);
      }
      return;
    }
    addUrl(value);
  }

  visit(raw['avatars']);
  visit(raw['avatarUrls']);
  visit(raw['members']);
  visit(raw['participants']);
  visit(raw['recentMembers']);
  visit(raw['joinedUsers']);

  return values.toSet().toList(growable: false);
}
