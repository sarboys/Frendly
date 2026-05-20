import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/features/giveaways/presentation/giveaway_teaser.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:mobile2/shared/widgets/dateasy_top_bar.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _activeChip = 0;

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 144,
            ),
            children: [
              const DateasyTopBar(),
              const _Greeting(),
              _Chips(
                active: _activeChip,
                onChanged: (index) => setState(() => _activeChip = index),
              ),
              const _RadarCard(),
              const GiveawayTeaser(),
              _MeetingsList(query: _chips[_activeChip].query),
              const _Posters(),
              const _AiBuilder(),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }
}

class _Greeting extends ConsumerWidget {
  const _Greeting();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(
      currentUserProvider.select((user) => user?.name.split(' ').first),
    );
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
            name == null || name.isEmpty ? 'Привет' : 'Привет, $name 👋',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'Найди свою '),
                dateasyHeadlineHighlightSpan(
                  text: 'встречу',
                  style: headline,
                ),
                const TextSpan(text: '\nсегодня вечером'),
              ],
            ),
            style: headline,
          ),
        ],
      ),
    );
  }
}

class _Chips extends StatelessWidget {
  const _Chips({
    required this.active,
    required this.onChanged,
  });

  final int active;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final chip = _chips[index];
          final isActive = index == active;
          return _ChipButton(
            label: chip.label,
            active: isActive,
            onTap: () => onChanged(index),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _chips.length,
      ),
    );
  }
}

class _RadarCard extends ConsumerWidget {
  const _RadarCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final matches = ref.watch(matchesProvider).valueOrNull?.items ??
        const <BackendCardItem>[];
    final avatars = matches
        .map((item) => item.imageUrl)
        .whereType<String>()
        .where((url) => url.isNotEmpty)
        .take(3)
        .toList(growable: false);
    final nearbyLabel = matches.isEmpty
        ? 'Люди рядом'
        : '${matches.length} ${_peopleWord(matches.length)} рядом';
    final locationLabel = user?.city == null || user!.city!.isEmpty
        ? 'Радар встреч'
        : 'Радар встреч · ${user.city}';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
      child: Container(
        key: const Key('home-radar-card'),
        constraints: const BoxConstraints(minHeight: 250),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [DateasyColors.surface2, DateasyColors.background],
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x80000000),
              blurRadius: 40,
              spreadRadius: -16,
              offset: Offset(0, 12),
            ),
          ],
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            LucideIcons.mapPin,
                            color: DateasyColors.muted,
                            size: 14,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              locationLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        nearbyLabel,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontSize: 20,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
                _LimePillButton(
                  label: 'Открыть',
                  onTap: () => context.go('/map'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    for (final inset in [0.0, 34.0, 68.0, 102.0])
                      Positioned.fill(
                        left: inset,
                        top: inset,
                        right: inset,
                        bottom: inset,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.1),
                            ),
                          ),
                        ),
                      ),
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: DateasyColors.lime.withValues(alpha: 0.12),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/map'),
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: dateasyLimeGradient,
                          boxShadow: _activeShadow,
                        ),
                        child: const Icon(
                          LucideIcons.users,
                          color: DateasyColors.backgroundDeep,
                          size: 20,
                        ),
                      ),
                    ),
                    for (var index = 0; index < avatars.length; index++)
                      _RadarAvatar(
                        imageUrl: avatars[index],
                        alignment: _radarAvatarAlignments[index],
                        ring: _radarAvatarRings[index],
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MeetingsList extends ConsumerWidget {
  const _MeetingsList({required this.query});

  final String? query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetings = ref.watch(
      homeEventsQueryProvider(EventListQuery(query: query, limit: 6)),
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 0),
      child: Column(
        children: [
          _SectionHeader(
            title: 'Ближайшие встречи',
            action: 'Все',
            onTap: () => context.go('/meetings'),
          ),
          const SizedBox(height: 16),
          meetings.when(
            data: (page) {
              if (page.items.isEmpty) {
                return const _InlineState(text: 'Пока нет встреч рядом');
              }
              final items = page.items.take(6).toList(growable: false);
              unawaited(
                ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                      items.map((item) => item.imageUrl),
                      usage: DateasyImageUsage.card,
                      limit: 6,
                      concurrency: 2,
                    ),
              );
              return Column(
                children: [
                  for (final item in items) ...[
                    _MeetingTile(meeting: _Meeting.fromBackend(item)),
                    if (item != items.last) const SizedBox(height: 12),
                  ],
                ],
              );
            },
            loading: () => const _InlineState(text: 'Загружаю встречи'),
            error: (_, __) => const _InlineState(text: 'Не удалось обновить'),
          ),
        ],
      ),
    );
  }
}

class _Posters extends ConsumerWidget {
  const _Posters();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final posters = ref.watch(postersProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _SectionHeader(
              title: 'Афиша',
              action: 'Все события',
              onTap: () => context.go('/posters'),
            ),
          ),
          const SizedBox(height: 16),
          posters.when(
            data: (page) {
              if (page.items.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  child: _InlineState(text: 'Афиша пока пустая'),
                );
              }
              final items = page.items.take(8).toList(growable: false);
              unawaited(
                ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                      items.map((item) => item.imageUrl),
                      usage: DateasyImageUsage.card,
                      limit: 8,
                      concurrency: 2,
                    ),
              );
              return SizedBox(
                height: 290,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  scrollDirection: Axis.horizontal,
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    return _PosterCard(
                        poster: _Poster.fromBackend(items[index]));
                  },
                ),
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _InlineState(text: 'Загружаю афишу'),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: _InlineState(text: 'Афиша недоступна'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiBuilder extends StatelessWidget {
  const _AiBuilder();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/ai-builder'),
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: dateasyLimeGradient,
            boxShadow: _activeShadow,
          ),
          child: Stack(
            children: [
              const Positioned(
                right: -64,
                top: -64,
                child: _SoftCardGlow(size: 224, opacity: 0.30),
              ),
              const Positioned(
                left: -40,
                bottom: -64,
                child: _SoftCardGlow(size: 160, opacity: 0.20),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          LucideIcons.sparkles,
                          size: 16,
                          color: DateasyColors.backgroundDeep,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'AI DATE BUILDER',
                          style: TextStyle(
                            color: DateasyColors.backgroundDeep,
                            fontSize: 11,
                            height: 1.2,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Соберём идеальную\nвстречу за 30 секунд',
                      style:
                          Theme.of(context).textTheme.headlineMedium?.copyWith(
                                color: DateasyColors.backgroundDeep,
                                fontSize: 28,
                                height: 1.05,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0,
                              ),
                    ),
                    const SizedBox(height: 12),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 280),
                      child: Text(
                        'Опиши вайб одним предложением — AI подберёт место, время и компанию рядом.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: DateasyColors.backgroundDeep
                                  .withValues(alpha: 0.8),
                              height: 1.25,
                            ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: DateasyColors.foreground,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x33000000),
                                  blurRadius: 16,
                                  offset: Offset(0, 8),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  LucideIcons.wand,
                                  size: 16,
                                  color: DateasyColors.background,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'Открыть билдер',
                                  style: TextStyle(
                                    color: DateasyColors.background,
                                    fontSize: 16,
                                    height: 1.2,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color:
                                DateasyColors.background.withValues(alpha: 0.9),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x33000000),
                                blurRadius: 16,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Icon(
                            LucideIcons.arrowRight,
                            color: DateasyColors.foreground,
                            size: 20,
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
    );
  }
}

class _SoftCardGlow extends StatelessWidget {
  const _SoftCardGlow({
    required this.size,
    required this.opacity,
  });

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 48, sigmaY: 48),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: opacity),
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

class _ChipButton extends StatelessWidget {
  const _ChipButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? DateasyColors.foreground : DateasyColors.glass,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active
                ? Colors.transparent
                : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Text(
          label,
          style: TextStyle(
            color: active ? DateasyColors.background : DateasyColors.foreground,
            fontSize: 14,
            height: 1.2,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _LimePillButton extends StatelessWidget {
  const _LimePillButton({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.all(Radius.circular(999)),
          gradient: dateasyLimeGradient,
          boxShadow: _activeShadow,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Text(
          label,
          style: const TextStyle(
            color: DateasyColors.backgroundDeep,
            fontSize: 14,
            height: 1.2,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _RadarAvatar extends StatelessWidget {
  const _RadarAvatar({
    required this.imageUrl,
    required this.alignment,
    required this.ring,
  });

  final String imageUrl;
  final Alignment alignment;
  final Color ring;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: DateasyColors.background, width: 4),
          boxShadow: [
            BoxShadow(color: ring, spreadRadius: 2),
          ],
        ),
        child: ClipOval(
          child: DateasyRemoteImage(
            imageUrl: imageUrl,
            usage: DateasyImageUsage.avatar,
          ),
        ),
      ),
    );
  }
}

const _radarAvatarAlignments = [
  Alignment(-0.44, -0.56),
  Alignment(0.54, 0.18),
  Alignment(-0.40, 0.42),
];

const _radarAvatarRings = [
  DateasyColors.lime,
  DateasyColors.lilac,
  DateasyColors.pink,
];

String _peopleWord(int count) {
  final lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'человек';
  }
  return switch (count % 10) {
    1 => 'человек',
    2 || 3 || 4 => 'человека',
    _ => 'человек',
  };
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.action,
    required this.onTap,
  });

  final String title;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 24,
                  height: 1.12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0,
                ),
          ),
        ),
        GestureDetector(
          onTap: onTap,
          child: Text(
            action,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
        ),
      ],
    );
  }
}

class _MeetingTile extends StatelessWidget {
  const _MeetingTile({required this.meeting});

  final _Meeting meeting;

  @override
  Widget build(BuildContext context) {
    final visiblePeople = meeting.people.take(3).toList(growable: false);
    final extraPeople = (meeting.count - visiblePeople.length).clamp(0, 999);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.go('/meetings/${meeting.id}'),
      child: _GlassBox(
        borderRadius: 24,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: meeting.tone.background,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${meeting.count}',
                  style: TextStyle(
                    color: meeting.tone.foreground,
                    fontFamily: 'Sora',
                    fontSize: 18,
                    height: 1,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      meeting.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: DateasyColors.foreground,
                        fontSize: 16,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: _Meta(
                            icon: LucideIcons.clock,
                            label: meeting.time,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _Meta(
                              icon: LucideIcons.mapPin, label: meeting.place),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (visiblePeople.isNotEmpty || extraPeople > 0)
                      Row(
                        children: [
                          if (visiblePeople.isNotEmpty)
                            SizedBox(
                              width: 24.0 + (visiblePeople.length - 1) * 16,
                              height: 24,
                              child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  for (var i = 0; i < visiblePeople.length; i++)
                                    Positioned(
                                      left: i * 16,
                                      child: _SmallAvatar(
                                        imageUrl: visiblePeople[i],
                                        size: 24,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          if (visiblePeople.isNotEmpty && extraPeople > 0)
                            const SizedBox(width: 8),
                          if (extraPeople > 0)
                            Flexible(
                              child: Text(
                                '+$extraPeople ${_peopleWord(extraPeople)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: DateasyColors.muted,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: () => context.go('/meetings/${meeting.id}'),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: DateasyColors.foreground,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    LucideIcons.arrowUpRight,
                    color: DateasyColors.background,
                    size: 16,
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

class _SmallAvatar extends StatelessWidget {
  const _SmallAvatar({
    required this.imageUrl,
    required this.size,
  });

  final String imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
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

class _Meta extends StatelessWidget {
  const _Meta({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: DateasyColors.muted),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 12,
                  height: 1.2,
                ),
          ),
        ),
      ],
    );
  }
}

class _PosterCard extends StatelessWidget {
  const _PosterCard({required this.poster});

  final _Poster poster;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/posters/${poster.id}'),
      child: Container(
        width: 230,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x80000000),
              blurRadius: 40,
              spreadRadius: -16,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            DateasyRemoteImage(
              imageUrl: poster.imageUrl,
              usage: DateasyImageUsage.card,
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Color(0xCC000000),
                    Color(0x1A000000),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
            Positioned(
              left: 12,
              top: 12,
              child: Container(
                decoration: const BoxDecoration(
                  color: DateasyColors.lime,
                  borderRadius: BorderRadius.all(Radius.circular(999)),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                child: Text(
                  poster.tag.toUpperCase(),
                  style: const TextStyle(
                    color: DateasyColors.backgroundDeep,
                    fontSize: 11,
                    height: 1.2,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.1,
                  ),
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    poster.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontFamily: 'Sora',
                      fontSize: 18,
                      height: 1.12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    poster.meta,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 12,
                      height: 1.2,
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

class _GlassBox extends StatelessWidget {
  const _GlassBox({
    required this.borderRadius,
    required this.child,
  });

  final double borderRadius;
  final Widget child;

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

class _Meeting {
  const _Meeting({
    required this.id,
    required this.title,
    required this.time,
    required this.place,
    required this.people,
    required this.count,
    required this.tone,
  });

  final String id;
  final String title;
  final String time;
  final String place;
  final List<String> people;
  final int count;
  final _Tone tone;

  factory _Meeting.fromBackend(BackendCardItem item) {
    return _Meeting(
      id: item.id,
      title: item.title,
      time: _formatDate(item.startsAt),
      place: item.subtitle ?? item.city ?? 'Место уточняется',
      people: _avatarUrls(item.raw),
      count: _extractCount(item.raw),
      tone: _toneLime,
    );
  }
}

List<String> _avatarUrls(Map<String, Object?> raw) {
  final source = raw['attendees'] ??
      raw['participants'] ??
      raw['members'] ??
      raw['memberProfiles'];
  if (source is! List) {
    return const [];
  }
  return source
      .whereType<Map>()
      .map((item) {
        final profile = item['profile'];
        final user = item['user'];
        return item['avatarUrl'] ??
            item['photoUrl'] ??
            (profile is Map
                ? profile['avatarUrl'] ?? profile['photoUrl']
                : null) ??
            (user is Map ? user['avatarUrl'] ?? user['photoUrl'] : null);
      })
      .map((value) => value?.toString() ?? '')
      .where((value) => value.isNotEmpty)
      .take(3)
      .toList(growable: false);
}

class _Poster {
  const _Poster({
    required this.id,
    required this.imageUrl,
    required this.tag,
    required this.title,
    required this.meta,
  });

  final String id;
  final String? imageUrl;
  final String tag;
  final String title;
  final String meta;

  factory _Poster.fromBackend(BackendCardItem item) {
    return _Poster(
      id: item.id,
      imageUrl: item.imageUrl,
      tag: item.city ?? 'event',
      title: item.title,
      meta: _formatDate(item.startsAt),
    );
  }
}

class _Tone {
  const _Tone(this.background, this.foreground);

  final Color background;
  final Color foreground;
}

const _chips = [
  _HomeChip('Все'),
  _HomeChip('Кофе', 'кофе'),
  _HomeChip('Спорт', 'спорт'),
  _HomeChip('Музыка', 'музыка'),
  _HomeChip('Прогулка', 'прогулка'),
  _HomeChip('Бар', 'бар'),
];

class _HomeChip {
  const _HomeChip(this.label, [this.query]);

  final String label;
  final String? query;
}

const _toneLime = _Tone(DateasyColors.lime, DateasyColors.backgroundDeep);

String _formatDate(DateTime? value) {
  if (value == null) {
    return 'Время уточняется';
  }
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.day}.${local.month} · $hour:$minute';
}

int _extractCount(Map<String, Object?> raw) {
  final value = raw['going'] ?? raw['participantCount'] ?? raw['joinedCount'];
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

const _activeShadow = [
  BoxShadow(
    color: Color(0x59BEFF67),
    blurRadius: 60,
    spreadRadius: -20,
    offset: Offset(0, 20),
  ),
];
