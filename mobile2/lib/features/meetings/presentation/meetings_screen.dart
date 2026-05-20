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

class MeetingsScreen extends StatefulWidget {
  const MeetingsScreen({super.key});

  @override
  State<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends State<MeetingsScreen> {
  int _activeDay = 0;
  int _activeCategory = 0;
  final Map<String, BackendCardItem> _localMeetings =
      <String, BackendCardItem>{};
  final Set<String> _joining = <String>{};
  final Set<String> _joinErrors = <String>{};

  @override
  Widget build(BuildContext context) {
    final query = _eventQueryFor(_activeDay, _activeCategory);
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
                    _Header(query: query),
                    _DayTabs(
                      activeIndex: _activeDay,
                      onChanged: (index) => setState(() => _activeDay = index),
                    ),
                    _CategoryPills(
                      active: _activeCategory,
                      onChanged: (index) {
                        setState(() => _activeCategory = index);
                      },
                    ),
                    if (_tabs[_activeDay].date == null &&
                        _tabs[_activeDay].label == 'Эти выходные')
                      const Padding(
                        padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
                        child: _InlineState(
                          text:
                              'Фильтр выходных ждет dateFrom/dateTo в /events',
                        ),
                      ),
                    const _AiSuggestCard(),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 144),
                sliver: Consumer(
                  builder: (context, ref, _) {
                    final meetings = ref.watch(meetingsQueryProvider(query));
                    return meetings.when(
                      data: (page) {
                        if (page.items.isEmpty) {
                          return const SliverToBoxAdapter(
                            child: _InlineState(text: 'Встреч пока нет'),
                          );
                        }
                        unawaited(
                          ref
                              .read(appMediaPrewarmServiceProvider)
                              .warmRemoteImages(
                                meetingPrewarmImageUrls(page.items),
                                usage: DateasyImageUsage.card,
                                limit: 6,
                                concurrency: 2,
                              ),
                        );
                        return SliverList.separated(
                          itemCount: page.items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 16),
                          itemBuilder: (context, index) {
                            final item = page.items[index];
                            final backendMeeting =
                                _localMeetings[item.id] ?? item;
                            final meeting =
                                _Meeting.fromBackend(backendMeeting);
                            return _MeetingCard(
                              meeting: meeting,
                              joined: _isJoined(backendMeeting),
                              joining: _joining.contains(meeting.id),
                              joinFailed: _joinErrors.contains(meeting.id),
                              onJoin: () => _toggleJoin(ref, backendMeeting),
                            );
                          },
                        );
                      },
                      loading: () => const SliverToBoxAdapter(
                        child: _InlineState(text: 'Загружаю встречи'),
                      ),
                      error: (_, __) => const SliverToBoxAdapter(
                        child:
                            _InlineState(text: 'Не удалось загрузить встречи'),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }

  EventListQuery _eventQueryFor(int dayIndex, int categoryIndex) {
    final tab = _tabs[dayIndex];
    final category = _categories[categoryIndex];
    return EventListQuery(
      date: tab.date,
      query: category.query,
      limit: 20,
    );
  }

  Future<void> _toggleJoin(WidgetRef ref, BackendCardItem meeting) async {
    if (_joining.contains(meeting.id) || meeting.id.isEmpty) {
      return;
    }
    setState(() {
      _joining.add(meeting.id);
      _joinErrors.remove(meeting.id);
    });
    try {
      final updated = await ref.read(meetingActionsProvider).setJoined(
            eventId: meeting.id,
            joined: !_isJoined(meeting),
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _localMeetings[meeting.id] = updated;
        _joining.remove(meeting.id);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _joining.remove(meeting.id);
        _joinErrors.add(meeting.id);
      });
    }
  }
}

Iterable<String> meetingPrewarmImageUrls(List<BackendCardItem> meetings) sync* {
  var emitted = 0;
  for (final meeting in meetings) {
    if (emitted >= 6) {
      return;
    }
    final url = meeting.imageUrl?.trim();
    if (url == null || url.isEmpty) {
      continue;
    }
    emitted += 1;
    yield url;
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.query});

  final EventListQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetings = ref.watch(meetingsQueryProvider(query));
    final page = meetings.valueOrNull;
    final count = page?.items.length;
    final countLabel = count == null
        ? 'Встречи рядом'
        : '$count${page?.nextCursor == null ? '' : '+'} ${_meetingWord(count)} рядом';
    final headline = Theme.of(context).textTheme.headlineLarge?.copyWith(
          fontSize: 34,
          height: 1.05,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  countLabel,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
                const SizedBox(height: 8),
                Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Список '),
                      dateasyHeadlineHighlightSpan(
                        text: 'встреч',
                        style: headline,
                      ),
                    ],
                  ),
                  style: headline,
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          _GlassBox(
            borderRadius: 16,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => context.go('/dating/filter'),
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Icon(LucideIcons.slidersHorizontal, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DayTabs extends StatelessWidget {
  const _DayTabs({
    required this.activeIndex,
    required this.onChanged,
  });

  final int activeIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 74,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          return _PillButton(
            label: _tabs[index].label,
            active: index == activeIndex,
            foregroundActive: DateasyColors.background,
            backgroundActive: const LinearGradient(
              colors: [DateasyColors.foreground, DateasyColors.foreground],
            ),
            onTap: () => onChanged(index),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _tabs.length,
      ),
    );
  }
}

class _CategoryPills extends StatelessWidget {
  const _CategoryPills({
    required this.active,
    required this.onChanged,
  });

  final int active;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final category = _categories[index];
          final selected = index == active;
          return _CategoryPill(
            category: category,
            selected: selected,
            onTap: () => onChanged(index),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _categories.length,
      ),
    );
  }
}

class _CategoryPill extends StatelessWidget {
  const _CategoryPill({
    required this.category,
    required this.selected,
    required this.onTap,
  });

  final _Category category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = selected
        ? DateasyColors.backgroundDeep
        : DateasyColors.foreground.withValues(alpha: 0.8);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutCubic,
        height: 42,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? null : DateasyColors.glass,
          gradient: selected ? dateasyLimeGradient : null,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected
                ? Colors.transparent
                : Colors.white.withValues(alpha: 0.1),
          ),
          boxShadow: selected
              ? const [
                  BoxShadow(
                    color: Color(0x55BEFF67),
                    blurRadius: 24,
                    spreadRadius: -10,
                    offset: Offset(0, 10),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              category.label,
              maxLines: 1,
              overflow: TextOverflow.visible,
              softWrap: false,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: foreground,
                    fontSize: 14,
                    height: 1.15,
                    fontWeight: FontWeight.w500,
                  ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: selected
                    ? DateasyColors.backgroundDeep.withValues(alpha: 0.15)
                    : Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                category.count.toString(),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: foreground,
                      fontSize: 10,
                      height: 1,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AiSuggestCard extends StatelessWidget {
  const _AiSuggestCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/ai-builder'),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: dateasyPinkGradient,
            boxShadow: const [
              BoxShadow(
                color: Color(0x55FF639F),
                blurRadius: 28,
                spreadRadius: -12,
                offset: Offset(0, 16),
              ),
            ],
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: DateasyColors.background.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  LucideIcons.sparkles,
                  size: 20,
                  color: DateasyColors.foreground,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'AI подберёт встречу под вечер',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.foreground,
                            fontWeight: FontWeight.w600,
                            height: 1.15,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Расскажи настроение — соберём план',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.foreground
                                .withValues(alpha: 0.78),
                            fontSize: 12,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                height: 30,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: DateasyColors.background.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(999),
                ),
                alignment: Alignment.center,
                child: Text(
                  'Собрать',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.foreground,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
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

class _MeetingCard extends StatelessWidget {
  const _MeetingCard({
    required this.meeting,
    required this.joined,
    required this.joining,
    required this.joinFailed,
    required this.onJoin,
  });

  final _Meeting meeting;
  final bool joined;
  final bool joining;
  final bool joinFailed;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(24);
    final content = Container(
      decoration: BoxDecoration(
        color: null,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: meeting.boosted
              ? [
                  DateasyColors.pink.withValues(alpha: 0.16),
                  DateasyColors.background,
                  DateasyColors.background,
                ]
              : [
                  Colors.white.withValues(alpha: 0.08),
                  DateasyColors.glass,
                  DateasyColors.background.withValues(alpha: 0.72),
                ],
        ),
        borderRadius: borderRadius,
        border: Border.all(
          color: meeting.boosted
              ? DateasyColors.pink.withValues(alpha: 0.35)
              : Colors.white.withValues(alpha: 0.14),
          width: meeting.boosted ? 1.6 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: meeting.boosted
                ? const Color(0x88FF639F)
                : const Color(0x66000000),
            blurRadius: meeting.boosted ? 40 : 34,
            spreadRadius: meeting.boosted ? -16 : -18,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: Column(
          children: [
            GestureDetector(
              onTap: () => context.go('/meetings/${meeting.id}'),
              child: SizedBox(
                height: 144,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    DateasyRemoteImage(
                      imageUrl: meeting.cover,
                      usage: DateasyImageUsage.card,
                    ),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            DateasyColors.background
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: 12,
                      top: 12,
                      child: _ToneBadge(meeting: meeting),
                    ),
                    if (meeting.boosted)
                      const Positioned(
                        right: 12,
                        top: 12,
                        child: _BoostBadge(),
                      )
                    else
                      const Positioned(
                        right: 12,
                        top: 12,
                        child: _GlassBox(
                          borderRadius: 999,
                          child: SizedBox(
                            width: 36,
                            height: 36,
                            child: Icon(LucideIcons.arrowUpRight, size: 16),
                          ),
                        ),
                      ),
                    Positioned(
                      left: 12,
                      right: 12,
                      bottom: 12,
                      child: Text(
                        meeting.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontSize: 18,
                              height: 1.15,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                children: [
                  Container(
                    height: 1,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          Colors.white.withValues(alpha: 0.1),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _AvatarStack(meeting: meeting),
                      const SizedBox(width: 12),
                      Expanded(child: _MeetingMeta(meeting: meeting)),
                      const SizedBox(width: 10),
                      _JoinButton(
                        joined: joined,
                        busy: joining,
                        failed: joinFailed,
                        onTap: onJoin,
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

    if (!meeting.boosted) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.go('/meetings/${meeting.id}'),
        child: content,
      );
    }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.go('/meetings/${meeting.id}'),
      child: Stack(
        children: [
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 128,
              height: 128,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: DateasyColors.pink.withValues(alpha: 0.3),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66FF639F),
                    blurRadius: 64,
                    spreadRadius: 20,
                  ),
                ],
              ),
            ),
          ),
          content,
        ],
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.active,
    required this.foregroundActive,
    required this.backgroundActive,
    required this.onTap,
  });

  final String label;
  final bool active;
  final Color foregroundActive;
  final Gradient backgroundActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textColor = active
        ? foregroundActive
        : DateasyColors.foreground.withValues(alpha: 0.8);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 38,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: active ? null : DateasyColors.glass,
          gradient: active ? backgroundActive : null,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active
                ? Colors.transparent
                : Colors.white.withValues(alpha: 0.1),
          ),
          boxShadow: active && backgroundActive == dateasyLimeGradient
              ? const [
                  BoxShadow(
                    color: Color(0x55BEFF67),
                    blurRadius: 24,
                    spreadRadius: -10,
                    offset: Offset(0, 10),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: textColor,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToneBadge extends StatelessWidget {
  const _ToneBadge({required this.meeting});

  final _Meeting meeting;

  @override
  Widget build(BuildContext context) {
    final color = switch (meeting.tone) {
      _MeetingTone.lime => DateasyColors.lime,
      _MeetingTone.lilac => DateasyColors.lilac,
      _MeetingTone.pink => DateasyColors.pink,
    };
    final foreground = switch (meeting.tone) {
      _MeetingTone.lime || _MeetingTone.lilac => DateasyColors.backgroundDeep,
      _MeetingTone.pink => DateasyColors.foreground,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '${meeting.going}/${meeting.total} идут',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: foreground,
              fontSize: 11,
              height: 1.1,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _BoostBadge extends StatelessWidget {
  const _BoostBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: dateasyPinkGradient,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55FF639F),
            blurRadius: 20,
            spreadRadius: -8,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Text.rich(
        TextSpan(
          children: [
            const WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Icon(
                Icons.bolt,
                size: 12,
                color: DateasyColors.foreground,
              ),
            ),
            TextSpan(
              text: '  BOOST',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.foreground,
                    fontSize: 10,
                    height: 1.1,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AvatarStack extends StatelessWidget {
  const _AvatarStack({required this.meeting});

  final _Meeting meeting;

  @override
  Widget build(BuildContext context) {
    final visiblePeople = meeting.people.take(3).toList();
    final extraCount = (meeting.going - visiblePeople.length).clamp(0, 999);
    if (visiblePeople.isEmpty) {
      return SizedBox(
        width: 38,
        height: 32,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: DateasyColors.foreground,
            shape: BoxShape.circle,
            border: Border.all(color: DateasyColors.background, width: 2),
          ),
          alignment: Alignment.center,
          child: Text(
            '${meeting.going}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.background,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      );
    }
    return SizedBox(
      width: 32.0 + visiblePeople.length * 20,
      height: 32,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var index = 0; index < visiblePeople.length; index++)
            Positioned(
              left: index * 20,
              child: _Avatar(asset: visiblePeople[index]),
            ),
          if (extraCount > 0)
            Positioned(
              left: visiblePeople.length * 20,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: DateasyColors.foreground,
                  shape: BoxShape.circle,
                  border: Border.all(color: DateasyColors.background, width: 2),
                ),
                alignment: Alignment.center,
                child: Text(
                  '+$extraCount',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.background,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.asset});

  final String asset;

  @override
  Widget build(BuildContext context) {
    final isUrl = asset.startsWith('http://') ||
        asset.startsWith('https://') ||
        asset.startsWith('/');
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: DateasyColors.background, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: isUrl
          ? DateasyRemoteImage(
              imageUrl: asset,
              usage: DateasyImageUsage.avatar,
            )
          : ColoredBox(
              color: DateasyColors.foreground,
              child: Center(
                child: Text(
                  asset.isEmpty ? '?' : asset.characters.first.toUpperCase(),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.background,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ),
    );
  }
}

class _MeetingMeta extends StatelessWidget {
  const _MeetingMeta({required this.meeting});

  final _Meeting meeting;

  @override
  Widget build(BuildContext context) {
    return DefaultTextStyle.merge(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                LucideIcons.clock,
                color: DateasyColors.lime,
                size: 14,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  meeting.time,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 13,
                        color: DateasyColors.foreground,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(
                LucideIcons.mapPin,
                color: DateasyColors.muted,
                size: 12,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  '${meeting.place} · Хост · ${meeting.host}',
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        color: DateasyColors.muted,
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

class _JoinButton extends StatelessWidget {
  const _JoinButton({
    required this.joined,
    required this.busy,
    required this.failed,
    required this.onTap,
  });

  final bool joined;
  final bool busy;
  final bool failed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: joined ? DateasyColors.glass : null,
          gradient: joined ? null : dateasyLimeGradient,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: joined
                ? DateasyColors.lime.withValues(alpha: 0.4)
                : Colors.transparent,
          ),
          boxShadow: joined
              ? null
              : const [
                  BoxShadow(
                    color: Color(0x55BEFF67),
                    blurRadius: 24,
                    spreadRadius: -10,
                    offset: Offset(0, 10),
                  ),
                ],
        ),
        alignment: Alignment.center,
        child: busy
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(
                failed ? 'Повтор' : (joined ? '✓ Иду' : 'Иду'),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: joined
                          ? DateasyColors.lime
                          : DateasyColors.backgroundDeep,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
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

class _GlassBox extends StatelessWidget {
  const _GlassBox({
    required this.child,
    required this.borderRadius,
  });

  final Widget child;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: child,
    );
  }
}

class _MeetingTab {
  const _MeetingTab({
    required this.label,
    this.date,
  });

  final String label;
  final String? date;
}

class _Category {
  const _Category(this.label, this.count, [this.query]);

  final String label;
  final int count;
  final String? query;
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassBox(
      borderRadius: 20,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _Meeting {
  const _Meeting({
    required this.id,
    required this.title,
    required this.cover,
    required this.time,
    required this.place,
    required this.going,
    required this.total,
    required this.people,
    required this.host,
    required this.tone,
    this.boosted = false,
  });

  final String id;
  final String title;
  final String cover;
  final String time;
  final String place;
  final int going;
  final int total;
  final List<String> people;
  final String host;
  final _MeetingTone tone;
  final bool boosted;

  factory _Meeting.fromBackend(BackendCardItem item) {
    return _Meeting(
      id: item.id,
      title: item.title,
      cover: item.imageUrl ?? '',
      time: _formatDate(item.startsAt),
      place: item.subtitle ?? item.city ?? 'Место уточняется',
      going: _intFrom(item.raw['going'] ?? item.raw['participantCount']),
      total: _intFrom(item.raw['capacity'] ?? item.raw['maxGuests']),
      people: _attendeeLabels(item.raw),
      host: _hostName(item.raw),
      tone: _MeetingTone.lime,
      boosted: item.raw['promoted'] == true,
    );
  }
}

enum _MeetingTone { lime, lilac, pink }

final _tabs = [
  _MeetingTab(label: 'Сегодня', date: _isoDate(DateTime.now())),
  _MeetingTab(
    label: 'Завтра',
    date: _isoDate(DateTime.now().add(const Duration(days: 1))),
  ),
  const _MeetingTab(label: 'Эти выходные'),
  const _MeetingTab(label: 'Все'),
];

const _categories = [
  _Category('Все', 32),
  _Category('Кофе', 8, 'кофе'),
  _Category('Музыка', 6, 'музыка'),
  _Category('Спорт', 5, 'спорт'),
  _Category('Бар', 7, 'бар'),
  _Category('Арт', 4, 'арт'),
];

String _isoDate(DateTime value) {
  final local = value.toLocal();
  return '${local.year.toString().padLeft(4, '0')}-'
      '${local.month.toString().padLeft(2, '0')}-'
      '${local.day.toString().padLeft(2, '0')}';
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

String _meetingWord(int count) {
  final mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return 'встреч';
  }
  switch (count % 10) {
    case 1:
      return 'встреча';
    case 2:
    case 3:
    case 4:
      return 'встречи';
    default:
      return 'встреч';
  }
}

List<String> _attendeeLabels(Map<String, Object?> raw) {
  final source = raw['attendees'] ?? raw['participants'];
  if (source is! List) {
    return const [];
  }
  return source
      .map((item) {
        if (item is String) {
          return item;
        }
        if (item is! Map) {
          return '';
        }
        final profile = item['profile'];
        final user = item['user'];
        return item['avatarUrl'] ??
            item['photoUrl'] ??
            (profile is Map
                ? profile['avatarUrl'] ?? profile['photoUrl']
                : null) ??
            (user is Map
                ? user['avatarUrl'] ??
                    user['photoUrl'] ??
                    user['displayName'] ??
                    user['name']
                : null) ??
            item['displayName'] ??
            item['name'];
      })
      .map((value) => value?.toString().trim() ?? '')
      .where((value) => value.isNotEmpty)
      .take(4)
      .toList(growable: false);
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

String _hostName(Map<String, Object?> raw) {
  final host = raw['host'];
  if (host is Map) {
    return host['name']?.toString() ?? host['displayName']?.toString() ?? '';
  }
  return '';
}

bool _isJoined(BackendCardItem meeting) {
  final raw = meeting.raw;
  final value = raw['participantState'] ??
      raw['viewerState'] ??
      raw['participationState'] ??
      raw['attendanceState'] ??
      raw['rsvpState'];
  final text = value?.toString().toLowerCase();
  return text == 'joined' ||
      text == 'going' ||
      text == 'approved' ||
      text == 'participant' ||
      text == 'host';
}
