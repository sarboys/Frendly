import 'dart:async';

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/search/presentation/search_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_filters.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_chip.dart';
import 'package:big_break_mobile/shared/widgets/bb_event_card.dart';
import 'package:big_break_mobile/shared/widgets/bb_search_bar.dart';
import 'package:big_break_mobile/shared/widgets/event_filter_sheet.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const _searchRecents = ['настолки', 'пробежка', 'винный вечер'];
const _searchTrending = ['кино', 'йога', 'бранч', 'выставка', 'концерт'];
const _defaultSearchFilters = {'Сегодня'};
const _searchFilters = [
  'Сегодня',
  'Завтра',
  'Бесплатно',
  'Рядом',
  'Спокойно',
  'Активно'
];

enum SearchPreset {
  evenings,
  nearby;

  static SearchPreset? parse(String? value) {
    switch (value) {
      case 'evenings':
        return SearchPreset.evenings;
      case 'nearby':
        return SearchPreset.nearby;
      default:
        return null;
    }
  }

  String get queryValue {
    switch (this) {
      case SearchPreset.evenings:
        return 'evenings';
      case SearchPreset.nearby:
        return 'nearby';
    }
  }

  String get title {
    switch (this) {
      case SearchPreset.evenings:
        return 'Frendly Evenings';
      case SearchPreset.nearby:
        return 'Рядом с тобой';
    }
  }

  IconData get icon {
    switch (this) {
      case SearchPreset.evenings:
        return Icons.radio_button_checked_rounded;
      case SearchPreset.nearby:
        return Icons.location_on_outlined;
    }
  }

  Set<String> get chips {
    switch (this) {
      case SearchPreset.evenings:
        return const {'Сегодня', 'Live', 'Собираются'};
      case SearchPreset.nearby:
        return const {'Сегодня', 'Рядом'};
    }
  }
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({
    this.preset,
    super.key,
  });

  final SearchPreset? preset;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  late final Set<String> _active;
  late final List<String> _recents = [..._searchRecents];
  EventFilters _sheetFilters = EventFilters.defaults;
  Timer? _debounce;
  String _debouncedQuery = '';

  bool get _showResults =>
      _controller.text.isNotEmpty ||
      _sheetFilters.hasActiveFilters ||
      widget.preset != null ||
      !setEquals(_active, _defaultSearchFilters);

  @override
  void initState() {
    super.initState();
    _active = {...(widget.preset?.chips ?? _defaultSearchFilters)};
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _toggleFilter(String value) {
    setState(() {
      if (_active.contains(value)) {
        _active.remove(value);
      } else {
        _active.add(value);
      }
    });
  }

  void _applyRecent(String value) {
    _setQuery(value);
  }

  void _removeRecent(String value) {
    setState(() {
      _recents.remove(value);
    });
  }

  void _clearRecents() {
    setState(() {
      _recents.clear();
    });
  }

  void _setQuery(String value) {
    _controller
      ..text = value
      ..selection = TextSelection.collapsed(offset: value.length);
    _handleQueryChanged(value);
  }

  void _handleQueryChanged(String value) {
    _debounce?.cancel();
    setState(() {});
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) {
        return;
      }
      setState(() {
        _debouncedQuery = value.trim();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final rawTextQuery = _controller.text.trim();
    final discoveryEvents =
        ref.watch(eventsProvider('nearby')).valueOrNull ?? const <Event>[];
    final discoveryEvenings = ref.watch(eveningSessionsProvider).valueOrNull ??
        const <EveningSessionSummary>[];
    final currentQuery = SearchResultsQuery(
      query: _debouncedQuery,
      activeFilters: _active.toList(growable: false)..sort(),
      sheetFilters: _sheetFilters,
    );
    final filteredDiscoveryEvents = filterSearchEvents(
      events: discoveryEvents,
      query: rawTextQuery,
      activeFilters: currentQuery.activeFilters,
      sheetFilters: currentQuery.sheetFilters,
    );
    final filteredDiscoveryEvenings = filterSearchEvenings(
      sessions: discoveryEvenings,
      query: rawTextQuery,
      activeFilters: currentQuery.activeFilters,
    );
    final hasPendingDebounce =
        rawTextQuery.isNotEmpty && _debouncedQuery != rawTextQuery;
    final searchResultsAsync = rawTextQuery.isEmpty || hasPendingDebounce
        ? null
        : ref.watch(searchResultsProvider(currentQuery));
    final remoteResults = searchResultsAsync?.valueOrNull;
    final searchResultsCount = remoteResults == null
        ? filteredDiscoveryEvents.length + filteredDiscoveryEvenings.length
        : remoteResults.events.length + remoteResults.evenings.length;
    final people =
        ref.watch(peopleProvider).valueOrNull ?? const <PersonSummary>[];
    final useLocalEventResults = rawTextQuery.isEmpty;
    final showInlineLoading = _showResults &&
        !useLocalEventResults &&
        (hasPendingDebounce || searchResultsAsync?.isLoading == true);
    final rawResultEvents = useLocalEventResults
        ? filteredDiscoveryEvents
        : remoteResults?.events ?? filteredDiscoveryEvents;
    final rawResultEvenings = useLocalEventResults
        ? filteredDiscoveryEvenings
        : remoteResults?.evenings ?? filteredDiscoveryEvenings;
    final resultEvents = widget.preset == SearchPreset.evenings
        ? const <Event>[]
        : rawResultEvents;
    final resultEvenings = rawResultEvenings;
    final resultPeople = useLocalEventResults
        ? const <PersonSummary>[]
        : remoteResults?.people ?? const <PersonSummary>[];
    final presetCount = widget.preset == SearchPreset.evenings
        ? resultEvenings.length
        : resultEvents.length + resultEvenings.length;
    final visibleFilters = [
      for (final filter in _active) filter,
      for (final filter in _searchFilters)
        if (!_active.contains(filter)) filter,
    ];

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.chevron_left_rounded, size: 28),
                  ),
                  Expanded(
                    child: BbSearchBar(
                      placeholder: 'Встречи, места, люди',
                      controller: _controller,
                      onChanged: _handleQueryChanged,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Карта',
                    onPressed: () => context.pushRoute(AppRoute.map),
                    icon: const Icon(Icons.map_outlined, size: 22),
                  ),
                ],
              ),
            ),
            if (widget.preset != null)
              _PresetHeader(
                preset: widget.preset!,
                count: presetCount,
              ),
            SizedBox(
              height: 52,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                scrollDirection: Axis.horizontal,
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return _FilterLauncherChip(
                      activeCount: _sheetFilters.activeCount,
                      onTap: () async {
                        final next = await showEventFilterSheet(
                          context,
                          initialValue: _sheetFilters,
                          resultsCount: searchResultsCount,
                          resultsCountBuilder: (filters) => filterSearchEvents(
                            events: discoveryEvents,
                            query: rawTextQuery,
                            activeFilters: currentQuery.activeFilters,
                            sheetFilters: filters,
                          ).length,
                        );
                        if (next != null) {
                          setState(() {
                            _sheetFilters = next;
                          });
                        }
                      },
                    );
                  }

                  final filter = visibleFilters[index - 1];
                  return BbChip(
                    label: filter,
                    active: _active.contains(filter),
                    onTap: () => _toggleFilter(filter),
                  );
                },
                separatorBuilder: (context, index) =>
                    const SizedBox(width: AppSpacing.xs),
                itemCount: visibleFilters.length + 1,
              ),
            ),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: !_showResults
                        ? SingleChildScrollView(
                            padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                            child: _buildDiscover(context, people),
                          )
                        : CustomScrollView(
                            slivers: _buildResultSlivers(
                              context,
                              resultEvents,
                              resultEvenings,
                              resultPeople,
                            ),
                          ),
                  ),
                  if (showInlineLoading)
                    Positioned(
                      left: 20,
                      right: 20,
                      top: 0,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: const LinearProgressIndicator(minHeight: 3),
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

  Widget _buildDiscover(BuildContext context, List<PersonSummary> people) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: Text(
                'Недавнее',
                style: AppTextStyles.caption.copyWith(letterSpacing: 1),
              ),
            ),
            InkWell(
              key: const ValueKey('search-recents-clear'),
              onTap: _recents.isEmpty ? null : _clearRecents,
              borderRadius: BorderRadius.circular(999),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Text(
                  'Очистить',
                  style: AppTextStyles.meta.copyWith(
                    color: colors.primary,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final recent in _recents)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                Icon(
                  Icons.history_rounded,
                  size: 16,
                  color: colors.inkMute,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: InkWell(
                    onTap: () => _applyRecent(recent),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text(recent, style: AppTextStyles.body),
                    ),
                  ),
                ),
                InkWell(
                  key: ValueKey('recent-remove-$recent'),
                  onTap: () => _removeRecent(recent),
                  borderRadius: BorderRadius.circular(999),
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: colors.inkMute,
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (_recents.isNotEmpty) const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Icon(
              Icons.trending_up_rounded,
              size: 14,
              color: colors.inkMute,
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'В тренде',
              style: AppTextStyles.caption.copyWith(letterSpacing: 1),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: _searchTrending
              .map(
                (tag) => InkWell(
                  onTap: () => _setQuery(tag),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: colors.border),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '#$tag',
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkSoft,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              )
              .toList(growable: false),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          'Люди, которых ты можешь знать',
          style: AppTextStyles.caption.copyWith(letterSpacing: 1),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final person in people.take(3))
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.xs),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              children: [
                BbAvatar(name: person.name, size: BbAvatarSize.md),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(person.name,
                          style:
                              AppTextStyles.itemTitle.copyWith(fontSize: 14)),
                      Text(
                        _suggestedPersonSubtitle(
                            person, people.indexOf(person)),
                        style: AppTextStyles.meta,
                      ),
                    ],
                  ),
                ),
                InkWell(
                  onTap: () => context.pushRoute(
                    AppRoute.userProfile,
                    pathParameters: {'userId': person.id},
                  ),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: colors.border),
                    ),
                    child: Text('Открыть',
                        style: AppTextStyles.caption
                            .copyWith(color: colors.foreground)),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  String _suggestedPersonSubtitle(PersonSummary person, int index) {
    if (person.common.isNotEmpty) {
      return '${person.common.length} общих интереса';
    }
    if ((person.area ?? '').isNotEmpty) {
      return person.area!;
    }
    return person.online ? 'Сейчас в сети' : 'Рядом с тобой';
  }

  List<Widget> _buildResultSlivers(
    BuildContext context,
    List<Event> events,
    List<EveningSessionSummary> evenings,
    List<PersonSummary> people,
  ) {
    final colors = AppColors.of(context);
    return [
      const SliverPadding(
        padding: EdgeInsets.only(top: AppSpacing.xs),
      ),
      if (events.isNotEmpty) ...[
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Встречи · ${events.length}',
              style: AppTextStyles.caption.copyWith(letterSpacing: 1),
            ),
          ),
        ),
        const SliverPadding(
          padding: EdgeInsets.only(top: AppSpacing.sm),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList.separated(
            itemBuilder: (context, index) {
              final event = events[index];
              return BbEventCard(
                event: event,
                onTap: () => context.pushRoute(
                  AppRoute.eventDetail,
                  pathParameters: {'eventId': event.id},
                ),
              );
            },
            separatorBuilder: (context, index) =>
                const SizedBox(height: AppSpacing.md),
            itemCount: events.length,
          ),
        ),
      ],
      if (evenings.isNotEmpty) ...[
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            20,
            events.isNotEmpty ? AppSpacing.xl : 0,
            20,
            0,
          ),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Frendly Evenings · ${evenings.length}',
              style: AppTextStyles.caption.copyWith(letterSpacing: 1),
            ),
          ),
        ),
        const SliverPadding(
          padding: EdgeInsets.only(top: AppSpacing.sm),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList.separated(
            itemBuilder: (context, index) {
              final session = evenings[index];
              return _SearchEveningResultTile(
                session: session,
                colors: colors,
                onOpen: () => context.pushRoute(
                  AppRoute.eveningPreview,
                  pathParameters: {'sessionId': session.id},
                ),
              );
            },
            separatorBuilder: (context, index) =>
                const SizedBox(height: AppSpacing.xs),
            itemCount: evenings.length,
          ),
        ),
      ],
      if (people.isNotEmpty) ...[
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            20,
            events.isNotEmpty || evenings.isNotEmpty ? AppSpacing.xl : 0,
            20,
            0,
          ),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Люди · ${people.length}',
              style: AppTextStyles.caption.copyWith(letterSpacing: 1),
            ),
          ),
        ),
        const SliverPadding(
          padding: EdgeInsets.only(top: AppSpacing.sm),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList.separated(
            itemBuilder: (context, index) {
              final person = people[index];
              return _SearchPersonResultTile(
                person: person,
                colors: colors,
                onOpen: () => context.pushRoute(
                  AppRoute.userProfile,
                  pathParameters: {'userId': person.id},
                ),
              );
            },
            separatorBuilder: (context, index) =>
                const SizedBox(height: AppSpacing.xs),
            itemCount: people.length,
          ),
        ),
      ],
      if (events.isEmpty && evenings.isEmpty && people.isEmpty)
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, AppSpacing.lg, 20, 0),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Ничего не нашлось. Попробуй другой запрос.',
              style: AppTextStyles.bodySoft.copyWith(
                color: colors.inkMute,
              ),
            ),
          ),
        ),
      const SliverToBoxAdapter(child: SizedBox(height: 120)),
    ];
  }
}

class _PresetHeader extends StatelessWidget {
  const _PresetHeader({
    required this.preset,
    required this.count,
  });

  final SearchPreset preset;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: colors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(
              preset.icon,
              size: 14,
              color: colors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              preset.title,
              style: AppTextStyles.sectionTitle.copyWith(fontSize: 18),
            ),
          ),
          Text(
            '$count',
            style: AppTextStyles.meta.copyWith(
              color: colors.inkMute,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchEveningResultTile extends StatelessWidget {
  const _SearchEveningResultTile({
    required this.session,
    required this.colors,
    required this.onOpen,
  });

  final EveningSessionSummary session;
  final BigBreakThemeColors colors;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final isLive = session.phase == EveningSessionPhase.live;
    return Material(
      color: colors.card,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: isLive ? colors.primary : colors.secondarySoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Text(
                  session.emoji,
                  style: const TextStyle(fontSize: 22),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            session.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.itemTitle.copyWith(
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        _EveningStatusPill(isLive: isLive, colors: colors),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (session.area != null) session.area!,
                        if (session.hostName != null) session.hostName!,
                        if (session.joinedCount != null)
                          '${session.joinedCount}/${session.maxGuests ?? '∞'}',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EveningStatusPill extends StatelessWidget {
  const _EveningStatusPill({
    required this.isLive,
    required this.colors,
  });

  final bool isLive;
  final BigBreakThemeColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: isLive ? colors.primary : colors.warmStart,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        isLive ? 'Live' : 'Собираются',
        style: AppTextStyles.caption.copyWith(
          color: isLive ? colors.primaryForeground : colors.secondary,
          fontSize: 9,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SearchPersonResultTile extends StatelessWidget {
  const _SearchPersonResultTile({
    required this.person,
    required this.colors,
    required this.onOpen,
  });

  final PersonSummary person;
  final BigBreakThemeColors colors;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          BbAvatar(
            name: person.name,
            imageUrl: person.avatarUrl,
            size: BbAvatarSize.md,
            online: person.online,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  person.name,
                  style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
                ),
                Text(
                  [
                    if ((person.area ?? '').isNotEmpty) person.area!,
                    if (person.common.isNotEmpty)
                      '${person.common.length} общих интереса',
                  ].join(' · '),
                  style: AppTextStyles.meta,
                ),
              ],
            ),
          ),
          InkWell(
            onTap: onOpen,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: colors.border),
              ),
              child: Text(
                'Открыть',
                style: AppTextStyles.caption.copyWith(
                  color: colors.foreground,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterLauncherChip extends StatelessWidget {
  const _FilterLauncherChip({
    required this.activeCount,
    required this.onTap,
  });

  final int activeCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.foreground,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              Icon(
                Icons.tune_rounded,
                size: 14,
                color: colors.primaryForeground,
              ),
              const SizedBox(width: 6),
              Text(
                'Фильтры',
                style: AppTextStyles.caption.copyWith(
                  color: colors.primaryForeground,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (activeCount > 0) ...[
                const SizedBox(width: 6),
                Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: colors.background,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '$activeCount',
                    style: AppTextStyles.caption.copyWith(
                      color: colors.foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
