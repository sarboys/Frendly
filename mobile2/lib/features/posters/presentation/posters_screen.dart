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
import 'package:url_launcher/url_launcher.dart';

class PostersScreen extends ConsumerStatefulWidget {
  const PostersScreen({super.key});

  @override
  ConsumerState<PostersScreen> createState() => _PostersScreenState();
}

class _PostersScreenState extends ConsumerState<PostersScreen> {
  int _day = 0;
  int _category = 0;
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  final Set<String> _liked = {};
  Timer? _searchDebounce;
  String _debouncedQuery = '';

  PostersQuery get _query {
    final now = DateTime.now();
    final selectedDate = switch (_day) {
      0 => now,
      1 => now.add(const Duration(days: 1)),
      2 => _nextWeekday(now, DateTime.saturday),
      3 => _nextWeekday(now, DateTime.sunday),
      _ => null,
    };
    final weekTo = now.add(const Duration(days: 7));
    return PostersQuery(
      query: _debouncedQuery.isEmpty ? null : _debouncedQuery,
      date: selectedDate == null ? null : _isoDate(selectedDate),
      dateFrom: _day == 4 ? _isoDate(now) : null,
      dateTo: _day == 4 ? _isoDate(weekTo) : null,
      category: _categoryToBackend(_category),
    );
  }

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
    _searchDebounce?.cancel();
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
        ref.read(postersPaginationProvider(_query).notifier).loadNextPage());
  }

  void _onSearchChanged(String value) {
    setState(() {});
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 260), () {
      if (!mounted) {
        return;
      }
      setState(() => _debouncedQuery = value.trim());
    });
  }

  void _clearSearch() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() => _debouncedQuery = '');
  }

  void _toggleLike(String title) {
    final likedNow = !_liked.contains(title);
    setState(() {
      if (likedNow) {
        _liked.add(title);
      } else {
        _liked.remove(title);
      }
    });
    _showToast(likedNow ? 'Добавили в избранное' : 'Убрали из избранного');
  }

  Future<void> _buy(_PosterEvent event) async {
    final url = event.actionUrl;
    final uri = url == null ? null : Uri.tryParse(url);
    if (uri != null && uri.hasScheme) {
      final opened = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (opened) {
        return;
      }
    }
    if (!mounted) {
      return;
    }
    _showToast(
      'Билет · ${event.title}',
      subtitle: url == null ? 'Backend не отдает ссылку' : 'Не удалось открыть',
    );
  }

  void _showToast(String text, {String? subtitle}) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text),
            if (subtitle != null)
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12),
              ),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DateasyColors.surface2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          CustomScrollView(
            controller: _scrollController,
            slivers: [
              SliverPadding(
                padding: EdgeInsets.only(
                  top: MediaQuery.paddingOf(context).top + 16,
                ),
                sliver: SliverList.list(
                  children: [
                    const DateasyTopBar(),
                    const _TitleBlock(),
                    _SearchBlock(
                      controller: _searchController,
                      hasQuery: _searchController.text.trim().isNotEmpty,
                      onChanged: _onSearchChanged,
                      onClear: _clearSearch,
                      onCalendar: () {
                        setState(() => _day = 4);
                        _showToast('Показываем события на неделю');
                      },
                    ),
                    _DayChips(
                      selected: _day,
                      onSelected: (index) => setState(() => _day = index),
                    ),
                    Consumer(
                      builder: (context, ref, _) {
                        final featured =
                            ref.watch(postersQueryProvider(_query)).valueOrNull;
                        final event = featured == null || featured.items.isEmpty
                            ? null
                            : _PosterEvent.fromBackend(featured.items.first);
                        if (event == null) {
                          return const SizedBox.shrink();
                        }
                        return _FeaturedPoster(
                          event: event,
                          liked: _liked.contains(event.title),
                          onOpen: () => context.go('/posters/${event.id}'),
                          onLike: () => _toggleLike(event.title),
                          onBuy: () => _buy(event),
                        );
                      },
                    ),
                    _CategoryChips(
                      selected: _category,
                      onSelected: (index) => setState(() => _category = index),
                    ),
                  ],
                ),
              ),
              _PosterList(query: _query, onBuy: _buy),
              const SliverToBoxAdapter(child: SizedBox(height: 148)),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }
}

class _TitleBlock extends StatelessWidget {
  const _TitleBlock();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Афиша',
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontSize: 30,
                  height: 1.08,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'События рядом с тобой',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 14,
                ),
          ),
        ],
      ),
    );
  }
}

class _SearchBlock extends StatelessWidget {
  const _SearchBlock({
    required this.controller,
    required this.hasQuery,
    required this.onChanged,
    required this.onClear,
    required this.onCalendar,
  });

  final TextEditingController controller;
  final bool hasQuery;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final VoidCallback onCalendar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const Icon(
              LucideIcons.search,
              size: 16,
              color: DateasyColors.muted,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                decoration: const InputDecoration(
                  hintText: 'Концерты, бары, выставки...',
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.foreground,
                      fontSize: 14,
                    ),
              ),
            ),
            if (hasQuery) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onClear,
                child: const SizedBox(
                  width: 28,
                  height: 28,
                  child: Icon(
                    LucideIcons.x,
                    size: 16,
                    color: DateasyColors.muted,
                  ),
                ),
              ),
            ],
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onCalendar,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: DateasyColors.lime,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  LucideIcons.calendar,
                  size: 16,
                  color: DateasyColors.backgroundDeep,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayChips extends StatelessWidget {
  const _DayChips({
    required this.selected,
    required this.onSelected,
  });

  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return _HorizontalChips(
      marginTop: 16,
      children: [
        for (var index = 0; index < _days.length; index++)
          _PillChip(
            label: _days[index],
            active: index == selected,
            activeColor: DateasyColors.foreground,
            activeTextColor: DateasyColors.backgroundDeep,
            onTap: () => onSelected(index),
          ),
      ],
    );
  }
}

class _FeaturedPoster extends StatelessWidget {
  const _FeaturedPoster({
    required this.event,
    required this.liked,
    required this.onOpen,
    required this.onLike,
    required this.onBuy,
  });

  final _PosterEvent event;
  final bool liked;
  final VoidCallback onOpen;
  final VoidCallback onLike;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: GestureDetector(
        onTap: onOpen,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            height: 320,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DateasyRemoteImage(
                  imageUrl: event.cover,
                  usage: DateasyImageUsage.hero,
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Color(0xE6000000),
                        Color(0x33000000),
                        Color(0x00000000),
                      ],
                      stops: [0, 0.62, 1],
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  top: 16,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: DateasyColors.lime,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      event.tag,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.backgroundDeep,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.8,
                          ),
                    ),
                  ),
                ),
                Positioned(
                  right: 16,
                  top: 16,
                  child: GestureDetector(
                    onTap: onLike,
                    child: _GlassPanel(
                      borderRadius: 999,
                      padding: EdgeInsets.zero,
                      child: SizedBox(
                        width: 40,
                        height: 40,
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
                ),
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 18,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              color: Colors.white,
                              fontSize: 24,
                              height: 1.08,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 12,
                        runSpacing: 6,
                        children: [
                          _MetaLabel(
                            icon: LucideIcons.clock,
                            label: event.meta,
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                          _MetaLabel(
                            icon: LucideIcons.mapPin,
                            label: event.place,
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Text(
                            event.price,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: onBuy,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                gradient: dateasyLimeGradient,
                                borderRadius: BorderRadius.circular(999),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x66BEFF67),
                                    blurRadius: 28,
                                    spreadRadius: -12,
                                    offset: Offset(0, 14),
                                  ),
                                ],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    LucideIcons.ticket,
                                    size: 16,
                                    color: DateasyColors.backgroundDeep,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Купить билет',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: DateasyColors.backgroundDeep,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                        ),
                                  ),
                                ],
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
        ),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.selected,
    required this.onSelected,
  });

  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return _HorizontalChips(
      marginTop: 24,
      children: [
        for (var index = 0; index < _categories.length; index++)
          _PillChip(
            label: _categories[index],
            active: index == selected,
            activeColor: DateasyColors.lilac,
            activeTextColor: DateasyColors.backgroundDeep,
            onTap: () => onSelected(index),
          ),
      ],
    );
  }
}

class _PosterList extends ConsumerWidget {
  const _PosterList({
    required this.query,
    required this.onBuy,
  });

  final PostersQuery query;
  final Future<void> Function(_PosterEvent event) onBuy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final posters = ref.watch(postersQueryProvider(query));
    final pagination = ref.watch(postersPaginationProvider(query));
    return posters.when(
      data: (page) {
        Future<void>.microtask(() {
          ref
              .read(postersPaginationProvider(query).notifier)
              .primeNextCursor(page.nextCursor);
        });
        final items = [...page.items, ...pagination.items];
        if (items.isEmpty) {
          return const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
            sliver: SliverToBoxAdapter(
              child: _InlineState(text: 'Событий пока нет'),
            ),
          );
        }
        unawaited(
          ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                posterPrewarmImageUrls(items),
                usage: DateasyImageUsage.card,
                limit: 8,
                concurrency: 2,
              ),
        );
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          sliver: SliverList.separated(
            itemCount: items.length,
            itemBuilder: (context, index) {
              final event = _PosterEvent.fromBackend(items[index]);
              return _PosterRow(
                event: event,
                onBuy: () => onBuy(event),
              );
            },
            separatorBuilder: (_, __) => const SizedBox(height: 12),
          ),
        );
      },
      loading: () => const SliverPadding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
        sliver: SliverToBoxAdapter(child: _InlineState(text: 'Загружаю афишу')),
      ),
      error: (_, __) => const SliverPadding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
        sliver:
            SliverToBoxAdapter(child: _InlineState(text: 'Афиша недоступна')),
      ),
    );
  }
}

Iterable<String> posterPrewarmImageUrls(List<BackendCardItem> posters) sync* {
  var emitted = 0;
  for (final poster in posters) {
    if (emitted >= 8) {
      return;
    }
    final url = poster.imageUrl?.trim();
    if (url == null || url.isEmpty) {
      continue;
    }
    emitted += 1;
    yield url;
  }
}

class _PosterRow extends StatelessWidget {
  const _PosterRow({
    required this.event,
    required this.onBuy,
  });

  final _PosterEvent event;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/posters/${event.id}'),
      child: _GlassPanel(
        borderRadius: 24,
        padding: EdgeInsets.zero,
        child: SizedBox(
          height: 140,
          child: Row(
            children: [
              SizedBox(
                width: 112,
                height: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.horizontal(
                        left: Radius.circular(24),
                      ),
                      child: DateasyRemoteImage(
                        imageUrl: event.cover,
                        usage: DateasyImageUsage.card,
                      ),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            Colors.transparent,
                            DateasyColors.background.withValues(alpha: 0.3),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: event.tone.color,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          event.tag,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DateasyColors.backgroundDeep,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontSize: 16,
                              height: 1.14,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const SizedBox(height: 7),
                      _MetaLabel(icon: LucideIcons.clock, label: event.meta),
                      const SizedBox(height: 3),
                      _MetaLabel(icon: LucideIcons.mapPin, label: event.place),
                      const Spacer(),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              event.price,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: DateasyColors.foreground,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ),
                          GestureDetector(
                            onTap: onBuy,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 7,
                              ),
                              decoration: BoxDecoration(
                                color: DateasyColors.foreground,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    LucideIcons.ticket,
                                    size: 13,
                                    color: DateasyColors.backgroundDeep,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Билет',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: DateasyColors.backgroundDeep,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HorizontalChips extends StatelessWidget {
  const _HorizontalChips({
    required this.children,
    required this.marginTop,
  });

  final List<Widget> children;
  final double marginTop;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: EdgeInsets.fromLTRB(20, marginTop, 20, 0),
      child: Row(
        children: [
          for (var index = 0; index < children.length; index++) ...[
            children[index],
            if (index != children.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _PillChip extends StatelessWidget {
  const _PillChip({
    required this.label,
    required this.active,
    required this.activeColor,
    required this.activeTextColor,
    required this.onTap,
  });

  final String label;
  final bool active;
  final Color activeColor;
  final Color activeTextColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? activeColor : DateasyColors.glass,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? activeColor : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: active ? activeTextColor : DateasyColors.foreground,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
        ),
      ),
    );
  }
}

class _MetaLabel extends StatelessWidget {
  const _MetaLabel({
    required this.icon,
    required this.label,
    this.color = DateasyColors.muted,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: color,
                  fontSize: 12,
                ),
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

enum _PosterTone {
  lime(DateasyColors.lime);

  const _PosterTone(this.color);

  final Color color;
}

class _PosterEvent {
  const _PosterEvent({
    required this.id,
    required this.title,
    required this.meta,
    required this.place,
    required this.price,
    required this.cover,
    required this.tag,
    required this.tone,
    this.actionUrl,
  });

  final String id;
  final String title;
  final String meta;
  final String place;
  final String price;
  final String cover;
  final String tag;
  final _PosterTone tone;
  final String? actionUrl;

  factory _PosterEvent.fromBackend(BackendCardItem item) {
    return _PosterEvent(
      id: item.id,
      title: item.title,
      meta: _formatDate(item.startsAt),
      place: item.subtitle ?? item.city ?? 'Место уточняется',
      price: item.raw['price']?.toString() ??
          item.raw['priceMode']?.toString() ??
          '',
      cover: item.imageUrl ?? '',
      tag: item.city ?? 'Event',
      tone: _PosterTone.lime,
      actionUrl: _rawString(
        item.raw,
        const ['actionUrl', 'ticketUrl', 'bookingUrl', 'url'],
      ),
    );
  }
}

const _days = ['Сегодня', 'Завтра', 'Сб', 'Вс', 'Эта неделя'];
const _categories = ['Все', 'Концерты', 'Бары', 'Выставки', 'Кино', 'Спорт'];

DateTime _nextWeekday(DateTime from, int weekday) {
  final delta = (weekday - from.weekday) % DateTime.daysPerWeek;
  return from.add(Duration(days: delta == 0 ? DateTime.daysPerWeek : delta));
}

String _isoDate(DateTime value) {
  final local = value.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}

String? _categoryToBackend(int index) {
  return switch (index) {
    1 => 'concert',
    2 => 'bar',
    3 => 'exhibition',
    4 => 'cinema',
    5 => 'sport',
    _ => null,
  };
}

String? _rawString(Map<String, Object?> raw, List<String> keys) {
  for (final key in keys) {
    final value = raw[key]?.toString().trim();
    if (value != null && value.isNotEmpty) {
      return value;
    }
  }
  return null;
}

String _formatDate(DateTime? value) {
  if (value == null) {
    return 'Время уточняется';
  }
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.day}.${local.month} · $hour:$minute';
}
