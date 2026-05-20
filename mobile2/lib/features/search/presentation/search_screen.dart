import 'dart:async';

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

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  Timer? _searchDebounce;
  _SearchTab _tab = _SearchTab.all;
  String _debouncedQuery = '';

  bool get _hasQuery => _controller.text.trim().isNotEmpty;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _clearQuery() {
    _searchDebounce?.cancel();
    _controller.clear();
    setState(() => _debouncedQuery = '');
  }

  void _scheduleSearch(String value) {
    _searchDebounce?.cancel();
    final trimmed = value.trim();
    setState(() {});
    if (trimmed.isEmpty) {
      setState(() => _debouncedQuery = '');
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) {
        return;
      }
      setState(() => _debouncedQuery = trimmed);
    });
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding:
                EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 16),
            sliver: SliverList.list(
              children: [
                _SearchHeader(
                  controller: _controller,
                  hasQuery: _hasQuery,
                  onChanged: _scheduleSearch,
                  onClear: _clearQuery,
                ),
                _Tabs(
                  active: _tab,
                  onSelect: (tab) => setState(() => _tab = tab),
                ),
              ],
            ),
          ),
          if (_debouncedQuery.isNotEmpty)
            _SearchResults(query: _debouncedQuery)
          else
            const SliverToBoxAdapter(child: _EmptySearchState()),
          const SliverToBoxAdapter(child: SizedBox(height: 56)),
        ],
      ),
    );
  }
}

class _SearchHeader extends StatelessWidget {
  const _SearchHeader({
    required this.controller,
    required this.hasQuery,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final bool hasQuery;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: _GlassPanel(
              borderRadius: 16,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
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
                      autofocus: true,
                      onChanged: onChanged,
                      cursorColor: DateasyColors.lime,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontSize: 14,
                            color: DateasyColors.foreground,
                          ),
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: 'Места, события, люди, теги',
                        hintStyle:
                            Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontSize: 14,
                                  color: DateasyColors.muted,
                                ),
                        border: InputBorder.none,
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  if (hasQuery)
                    GestureDetector(
                      onTap: onClear,
                      child: const Padding(
                        padding: EdgeInsets.all(4),
                        child: Icon(
                          LucideIcons.x,
                          size: 16,
                          color: DateasyColors.muted,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => context.go('/'),
            child: Text(
              'Отмена',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.lime,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.active,
    required this.onSelect,
  });

  final _SearchTab active;
  final ValueChanged<_SearchTab> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        itemBuilder: (context, index) {
          final tab = _SearchTab.values[index];
          final selected = tab == active;

          return GestureDetector(
            onTap: () => onSelect(tab),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color:
                    selected ? DateasyColors.foreground : DateasyColors.glass,
                borderRadius: BorderRadius.circular(999),
                border: selected
                    ? null
                    : Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Text(
                tab.label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: selected
                          ? DateasyColors.backgroundDeep
                          : DateasyColors.foreground,
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.w600 : null,
                    ),
              ),
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _SearchTab.values.length,
      ),
    );
  }
}

class _EmptySearchState extends StatelessWidget {
  const _EmptySearchState();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _ChipSection(
          title: 'Недавнее',
          icon: LucideIcons.clock,
          chips: ['винил', 'rooftop', 'speciality coffee', 'Нина'],
        ),
        _ChipSection(
          title: 'В тренде',
          icon: LucideIcons.trendingUp,
          chips: [
            '#patriki',
            '#nightrun',
            '#wineFriday',
            '#cinemaclub',
            '#artnight',
          ],
          lime: true,
        ),
        _AiCard(),
      ],
    );
  }
}

class _ChipSection extends StatelessWidget {
  const _ChipSection({
    required this.title,
    required this.icon,
    required this.chips,
    this.lime = false,
  });

  final String title;
  final IconData icon;
  final List<String> chips;
  final bool lime;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(title: title, icon: icon),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final chip in chips)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: lime
                        ? DateasyColors.lime.withValues(alpha: 0.2)
                        : DateasyColors.glass,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: lime
                          ? DateasyColors.lime.withValues(alpha: 0.3)
                          : Colors.white.withValues(alpha: 0.1),
                    ),
                  ),
                  child: Text(
                    chip,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: lime
                              ? DateasyColors.lime
                              : DateasyColors.foreground,
                          fontSize: 14,
                          fontWeight: lime ? FontWeight.w600 : null,
                        ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AiCard extends StatelessWidget {
  const _AiCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: 'Подбери AI', icon: LucideIcons.sparkles),
          GestureDetector(
            onTap: () => context.go('/ai-builder'),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: dateasyLimeGradient,
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66BEFF67),
                    blurRadius: 30,
                    spreadRadius: -14,
                    offset: Offset(0, 16),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Опиши вайб — соберу маршрут',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '«Тёплый вечер у воды, спешелти и винил»',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.backgroundDeep
                              .withValues(alpha: 0.78),
                          fontSize: 12,
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

class _SearchResults extends ConsumerWidget {
  const _SearchResults({required this.query});

  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final results = ref.watch(searchResultsProvider(query));
    return results.when(
      data: (page) {
        if (page.items.isEmpty) {
          return const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
            sliver: SliverToBoxAdapter(
              child: _InlineState(text: 'Ничего не найдено'),
            ),
          );
        }
        unawaited(
          ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                searchPrewarmImageUrls(page.items),
                usage: DateasyImageUsage.avatar,
                limit: 10,
                concurrency: 2,
              ),
        );
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          sliver: SliverList.separated(
            itemCount: page.items.length,
            itemBuilder: (context, index) {
              return _ResultRow(
                result: _SearchResult.fromBackend(page.items[index]),
              );
            },
            separatorBuilder: (_, __) => const SizedBox(height: 8),
          ),
        );
      },
      loading: () => const SliverPadding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
        sliver: SliverToBoxAdapter(child: _InlineState(text: 'Ищу')),
      ),
      error: (_, __) => const SliverPadding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
        sliver:
            SliverToBoxAdapter(child: _InlineState(text: 'Поиск недоступен')),
      ),
    );
  }
}

Iterable<String> searchPrewarmImageUrls(List<BackendCardItem> results) sync* {
  var emitted = 0;
  for (final result in results) {
    if (emitted >= 10) {
      return;
    }
    final url = result.imageUrl?.trim();
    if (url == null || url.isEmpty) {
      continue;
    }
    emitted += 1;
    yield url;
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.result});

  final _SearchResult result;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(result.route),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 48,
                height: 48,
                child: DateasyRemoteImage(
                  imageUrl: result.imageUrl,
                  usage: DateasyImageUsage.avatar,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    result.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: DateasyColors.foreground,
                        ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Icon(
                        result.icon,
                        size: 14,
                        color: DateasyColors.muted,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          result.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 11,
                                    color: DateasyColors.muted,
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    required this.icon,
  });

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: DateasyColors.muted),
          const SizedBox(width: 6),
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 12,
                  letterSpacing: 1.2,
                ),
          ),
        ],
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

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(14),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

enum _SearchTab {
  all('Всё'),
  people('Люди'),
  meetings('Встречи'),
  places('Места'),
  tags('Теги');

  const _SearchTab(this.label);

  final String label;
}

class _SearchResult {
  const _SearchResult({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.imageUrl,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? imageUrl;
  final String route;

  factory _SearchResult.fromBackend(BackendCardItem item) {
    return _SearchResult(
      icon: LucideIcons.search,
      title: item.title,
      subtitle: item.subtitle ?? item.city ?? '',
      imageUrl: item.imageUrl,
      route: _routeFor(item),
    );
  }
}

String _routeFor(BackendCardItem item) {
  final type = item.raw['type']?.toString() ?? item.raw['kind']?.toString();
  if (type == 'person' || type == 'user') {
    return '/u/${item.id}';
  }
  if (type == 'route') {
    return '/routes/${item.id}';
  }
  return '/meetings/${item.id}';
}
