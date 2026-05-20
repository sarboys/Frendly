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
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:mobile2/shared/widgets/dateasy_top_bar.dart';

const _filters = [
  _RouteFilter(label: 'Все'),
  _RouteFilter(label: 'Романтика', query: 'романтика'),
  _RouteFilter(label: 'С друзьями', query: 'друзья'),
  _RouteFilter(label: 'Соло', query: 'соло'),
  _RouteFilter(label: 'Бюджет', query: 'бюджет'),
];

class DateasyRoutesScreen extends StatefulWidget {
  const DateasyRoutesScreen({super.key});

  @override
  State<DateasyRoutesScreen> createState() => _DateasyRoutesScreenState();
}

class _DateasyRoutesScreenState extends State<DateasyRoutesScreen> {
  var _selectedFilter = 0;
  final Set<String> _liked = {};

  void _toggleLike(String id) {
    setState(() {
      if (_liked.contains(id)) {
        _liked.remove(id);
      } else {
        _liked.add(id);
      }
    });
  }

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
                    const _HeroHeader(),
                    _FilterRail(
                      selected: _selectedFilter,
                      onSelected: (index) =>
                          setState(() => _selectedFilter = index),
                    ),
                    const _AiRouteCard(),
                  ],
                ),
              ),
              _HotRoutes(
                query: _filters[_selectedFilter].query,
                liked: _liked,
                onLike: _toggleLike,
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 148)),
            ],
          ),
          const _BottomNav(),
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
                  'Маршруты вечера',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        fontSize: 30,
                        height: 1.08,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Готовые сценарии — бронируй в один клик',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 14,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () => context.go('/ai-builder'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: dateasyLimeGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66BEFF67),
                    blurRadius: 30,
                    spreadRadius: -14,
                    offset: Offset(0, 14),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.sparkles,
                size: 20,
                color: DateasyColors.backgroundDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterRail extends StatelessWidget {
  const _FilterRail({
    required this.selected,
    required this.onSelected,
  });

  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 76,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (var index = 0; index < _filters.length; index++) ...[
              _FilterPill(
                text: _filters[index].label,
                active: selected == index,
                onTap: () => onSelected(index),
              ),
              if (index != _filters.length - 1) const SizedBox(width: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.text,
    required this.active,
    required this.onTap,
  });

  final String text;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? DateasyColors.foreground : DateasyColors.glass,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? DateasyColors.foreground : DateasyColors.border,
          ),
        ),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: active
                    ? DateasyColors.background
                    : DateasyColors.foreground.withValues(alpha: 0.80),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
        ),
      ),
    );
  }
}

class _AiRouteCard extends StatelessWidget {
  const _AiRouteCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/ai-builder'),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: dateasyLimeGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x66BEFF67),
                blurRadius: 34,
                spreadRadius: -14,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                right: -48,
                top: -48,
                child: Container(
                  width: 128,
                  height: 128,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.38),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white.withValues(alpha: 0.34),
                        blurRadius: 44,
                        spreadRadius: 8,
                      ),
                    ],
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        LucideIcons.sparkles,
                        size: 16,
                        color: DateasyColors.backgroundDeep,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'AI',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.backgroundDeep,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.1,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Собрать персональный',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 20,
                          height: 1.1,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  Text(
                    'маршрут под настроение',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 20,
                          height: 1.1,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HotRoutes extends ConsumerWidget {
  const _HotRoutes({
    required this.query,
    required this.liked,
    required this.onLike,
  });

  final String? query;
  final Set<String> liked;
  final ValueChanged<String> onLike;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routes = ref.watch(routeTemplatesByQueryProvider(query));
    return routes.when(
      data: (page) {
        if (page.items.isEmpty) {
          return SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
            sliver: SliverList.list(
              children: const [
                _HotRoutesHeader(),
                SizedBox(height: 12),
                _InlineState(text: 'Маршрутов пока нет'),
              ],
            ),
          );
        }
        unawaited(
          ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                routePrewarmImageUrls(page.items),
                usage: DateasyImageUsage.card,
                limit: 6,
                concurrency: 2,
              ),
        );
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
          sliver: SliverMainAxisGroup(
            slivers: [
              SliverList.list(
                children: const [
                  _HotRoutesHeader(),
                  SizedBox(height: 12),
                ],
              ),
              SliverList.separated(
                itemCount: page.items.length,
                itemBuilder: (context, index) {
                  final item = page.items[index];
                  return _RouteCard(
                    route: _EveningRoute.fromBackend(item),
                    liked: liked.contains(item.id),
                    onLike: () => onLike(item.id),
                  );
                },
                separatorBuilder: (_, __) => const SizedBox(height: 16),
              ),
            ],
          ),
        );
      },
      loading: () => SliverPadding(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
        sliver: SliverList.list(
          children: const [
            _HotRoutesHeader(),
            SizedBox(height: 12),
            _InlineState(text: 'Загружаю маршруты'),
          ],
        ),
      ),
      error: (_, __) => SliverPadding(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
        sliver: SliverList.list(
          children: const [
            _HotRoutesHeader(),
            SizedBox(height: 12),
            _InlineState(text: 'Маршруты недоступны'),
          ],
        ),
      ),
    );
  }
}

class _HotRoutesHeader extends StatelessWidget {
  const _HotRoutesHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(
          LucideIcons.flame,
          size: 20,
          color: DateasyColors.pink,
        ),
        const SizedBox(width: 8),
        Text(
          'Сегодня горячо',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

Iterable<String> routePrewarmImageUrls(List<BackendCardItem> routes) sync* {
  var emitted = 0;
  for (final route in routes) {
    if (emitted >= 6) {
      return;
    }
    final url = route.imageUrl?.trim();
    if (url == null || url.isEmpty) {
      continue;
    }
    emitted += 1;
    yield url;
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({
    required this.route,
    required this.liked,
    required this.onLike,
  });

  final _EveningRoute route;
  final bool liked;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    final tone = switch (route.tone) {
      _RouteTone.pink => (
          background: DateasyColors.pink,
          foreground: DateasyColors.foreground,
        ),
      _RouteTone.lime => (
          background: DateasyColors.lime,
          foreground: DateasyColors.backgroundDeep,
        ),
      _RouteTone.lilac => (
          background: DateasyColors.lilac,
          foreground: DateasyColors.backgroundDeep,
        ),
    };

    return GestureDetector(
      onTap: () => context.go('/routes/${route.id}'),
      child: _GlassPanel(
        borderRadius: 24,
        padding: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            SizedBox(
              height: 160,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  DateasyRemoteImage(
                    imageUrl: route.cover,
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
                          Color(0xCC000000),
                        ],
                        stops: [0, 0.45, 1],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 12,
                    top: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: tone.background,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        route.tag,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tone.foreground,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 12,
                    top: 12,
                    child: GestureDetector(
                      onTap: onLike,
                      child: _GlassSquare(
                        size: 36,
                        radius: 999,
                        child: Icon(
                          liked ? Icons.favorite : LucideIcons.heart,
                          size: 17,
                          color: liked
                              ? DateasyColors.pink
                              : DateasyColors.foreground,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 12,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Text(
                            route.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  fontSize: 20,
                                  height: 1.08,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        _RouteIconStack(icons: route.icons),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        _MetaItem(
                          icon: LucideIcons.mapPin,
                          text: '${route.stops} точки · ${route.distance}',
                        ),
                        _MetaItem(
                          icon: LucideIcons.clock,
                          text: route.duration,
                        ),
                        _MetaItem(
                          icon: LucideIcons.wallet,
                          text: route.price,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: DateasyColors.foreground,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      LucideIcons.arrowUpRight,
                      size: 17,
                      color: DateasyColors.background,
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

class _RouteIconStack extends StatelessWidget {
  const _RouteIconStack({required this.icons});

  final List<IconData> icons;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 20.0 + icons.length * 22,
      height: 30,
      child: Stack(
        children: [
          for (var index = 0; index < icons.length; index++)
            Positioned(
              left: index * 22,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: DateasyColors.background.withValues(alpha: 0.82),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: DateasyColors.background,
                    width: 2,
                  ),
                ),
                child: Icon(
                  icons[index],
                  size: 15,
                  color: DateasyColors.foreground,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: DateasyColors.muted),
        const SizedBox(width: 4),
        Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
                fontSize: 12,
              ),
        ),
      ],
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

class _GlassSquare extends StatelessWidget {
  const _GlassSquare({
    required this.child,
    this.size = 44,
    this.radius = 16,
  });

  final Widget child;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: DateasyColors.border),
      ),
      child: child,
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    this.padding = EdgeInsets.zero,
    this.clipBehavior = Clip.none,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Clip clipBehavior;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: clipBehavior,
      padding: padding,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: DateasyColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 24,
            spreadRadius: -14,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: child,
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

class _EveningRoute {
  const _EveningRoute({
    required this.id,
    required this.title,
    required this.tag,
    required this.cover,
    required this.stops,
    required this.duration,
    required this.price,
    required this.distance,
    required this.icons,
    required this.likes,
    required this.tone,
  });

  final String id;
  final String title;
  final String tag;
  final String cover;
  final int stops;
  final String duration;
  final String price;
  final String distance;
  final List<IconData> icons;
  final int likes;
  final _RouteTone tone;

  factory _EveningRoute.fromBackend(BackendCardItem item) {
    return _EveningRoute(
      id: item.id,
      title: item.title,
      tag: item.city ?? 'Маршрут',
      cover: item.imageUrl ?? '',
      stops: _intFrom(item.raw['stops'] ?? item.raw['stepCount']),
      duration: item.raw['duration']?.toString() ?? 'Вечер',
      price:
          item.raw['price']?.toString() ?? item.raw['budget']?.toString() ?? '',
      distance: item.raw['distance']?.toString() ?? '',
      icons: const [LucideIcons.mapPin, LucideIcons.sparkles],
      likes: _intFrom(item.raw['likes'] ?? item.raw['usageCount']),
      tone: _RouteTone.lime,
    );
  }
}

class _RouteFilter {
  const _RouteFilter({
    required this.label,
    this.query,
  });

  final String label;
  final String? query;
}

enum _RouteTone { pink, lime, lilac }

int _intFrom(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
