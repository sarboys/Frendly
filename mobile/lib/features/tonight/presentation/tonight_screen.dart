import 'dart:async';

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_hero_card.dart';
import 'package:big_break_mobile/features/posters/presentation/widgets/poster_card.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_event_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _ongoingMeetupDotColor = Color(0xFFF97316);
final _meetupStartTimePattern = RegExp(r'(\d{1,2}):(\d{2})');

class TonightScreen extends ConsumerStatefulWidget {
  const TonightScreen({super.key});

  @override
  ConsumerState<TonightScreen> createState() => _TonightScreenState();
}

class _TonightScreenState extends ConsumerState<TonightScreen> {
  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final afterDarkAccess = ref.watch(afterDarkAccessProvider).valueOrNull ??
        const AfterDarkAccessData.fallback();
    final eventsAsync = ref.watch(eventsProvider('nearby'));
    final events = eventsAsync.valueOrNull ?? const [];

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: _TonightHeader(),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _TonightFeedSwitch(
                  afterDarkUnlocked: afterDarkAccess.unlocked,
                  onOpenAfterDark: () => openAfterDarkEntry(context, ref),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: EveningHeroCard(
                  onTap: () => context.pushRoute(AppRoute.eveningBuilder),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: _RoutesEntryCard(
                  onTap: () => context.pushRoute(AppRoute.eveningRoutes),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: _TonightEveningsSection()),
            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
            const SliverToBoxAdapter(
              child: _TonightMeetupChatsPreview(),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Сегодня вечером',
                            style: AppTextStyles.caption
                                .copyWith(letterSpacing: 1.0),
                          ),
                          const SizedBox(height: 2),
                          Text('Рядом с тобой',
                              style: AppTextStyles.sectionTitle),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        Icon(
                          LucideIcons.wand_sparkles,
                          size: 14,
                          color: colors.primary,
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        InkWell(
                          onTap: () => context.pushRoute(
                            AppRoute.search,
                            queryParameters: {'preset': 'nearby'},
                          ),
                          borderRadius: BorderRadius.circular(999),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 2,
                            ),
                            child: Text(
                              'Все ${events.length} →',
                              style: AppTextStyles.meta.copyWith(
                                color: colors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: eventsAsync.when(
                data: (_) {
                  if (events.isEmpty) {
                    return SliverToBoxAdapter(
                      child: _NearbyMeetupsEmptyCard(
                        onCreate: () =>
                            context.pushRoute(AppRoute.createMeetup),
                      ),
                    );
                  }

                  return SliverList.separated(
                    itemBuilder: (context, index) {
                      if (index == 5) {
                        return _ShowAllNearbyButton(
                          onTap: () => context.pushRoute(
                            AppRoute.search,
                            queryParameters: {'preset': 'nearby'},
                          ),
                        );
                      }
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
                    itemCount: events.length > 5 ? 6 : events.length,
                  );
                },
                loading: () => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: CircularProgressIndicator(color: colors.primary),
                    ),
                  ),
                ),
                error: (_, __) => SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'Не получилось загрузить встречи',
                      style: AppTextStyles.body,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 28, 20, 0),
                child: _TonightPosterPreview(),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Text('Новые рядом', style: AppTextStyles.sectionTitle),
              ),
            ),
            SliverToBoxAdapter(
              child: _TonightPeoplePreview(),
            ),
            const SliverToBoxAdapter(
              child: SizedBox(height: 120),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoutesEntryCard extends StatelessWidget {
  const _RoutesEntryCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.secondarySoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.route,
                  size: 21,
                  color: colors.secondary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Маршруты', style: AppTextStyles.itemTitle),
                    const SizedBox(height: 2),
                    Text(
                      'Командные сценарии вечера',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: colors.inkMute,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TonightHeader extends ConsumerWidget {
  const _TonightHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final unreadCount =
        ref.watch(notificationUnreadCountProvider).valueOrNull ?? 0;
    final onboarding = ref.watch(onboardingProvider).valueOrNull;
    final locationLabel = _composeHeaderLocation(
      onboarding?.city,
      onboarding?.area,
    );

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    LucideIcons.map_pin,
                    size: 14,
                    color: colors.inkMute,
                  ),
                  const SizedBox(width: AppSpacing.xxs),
                  Flexible(
                    child: Text(
                      locationLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text('Что сегодня вечером?', style: AppTextStyles.screenTitle),
            ],
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _HeaderCircleButton(
              icon: LucideIcons.search,
              onTap: () => context.pushRoute(AppRoute.search),
            ),
            const SizedBox(width: AppSpacing.xs),
            _HeaderCircleButton(
              icon: LucideIcons.bell,
              onTap: () => context.pushRoute(AppRoute.notifications),
              showDot: unreadCount > 0,
              animateIcon: unreadCount > 0,
            ),
          ],
        ),
      ],
    );
  }

  String _composeHeaderLocation(String? city, String? area) {
    final parts = [city, area]
        .whereType<String>()
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);

    if (parts.isEmpty) {
      return 'Москва';
    }

    if (parts.length == 2 && parts.first.contains(parts.last)) {
      return parts.first;
    }

    return parts.join(' · ');
  }
}

class _TonightMeetupChatsPreview extends ConsumerWidget {
  const _TonightMeetupChatsPreview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chats =
        ref.watch(meetupChatsProvider).valueOrNull ?? const <MeetupChat>[];
    final todayChats =
        chats.where(_isTodayMeetupChat).take(2).toList(growable: false);
    if (todayChats.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: _ActiveMeetupChatsCard(
        onOpenAll: () => context.goRoute(AppRoute.chats),
        chats: todayChats,
      ),
    );
  }

  bool _isTodayMeetupChat(MeetupChat chat) {
    final status = chat.status?.trim().toLowerCase();
    if (status != null && status.isNotEmpty) {
      return status == 'сегодня';
    }

    return !chat.time.toLowerCase().contains('завтра');
  }
}

class _TonightEveningsSection extends ConsumerWidget {
  const _TonightEveningsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final sessions = ref.watch(eveningSessionsProvider).valueOrNull ?? const [];
    final active = sessions
        .where((session) =>
            session.phase == EveningSessionPhase.live ||
            session.phase == EveningSessionPhase.scheduled)
        .toList(growable: false);
    final visible = [
      ...active.where((session) => session.phase == EveningSessionPhase.live),
      ...active.where((session) => session.phase != EveningSessionPhase.live),
    ].take(5).toList(growable: false);
    if (visible.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md, bottom: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            LucideIcons.radio,
                            size: 13,
                            color: colors.primary,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            'Frendly Evenings',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.inkMute,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Идут и собираются',
                        style: AppTextStyles.sectionTitle,
                      ),
                    ],
                  ),
                ),
                InkWell(
                  onTap: () => context.pushRoute(
                    AppRoute.search,
                    queryParameters: {'preset': 'evenings'},
                  ),
                  borderRadius: BorderRadius.circular(999),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 2,
                    ),
                    child: Text(
                      'Все ${active.length} →',
                      style: AppTextStyles.meta.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 142,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) => _TonightEveningCard(
                session: visible[index],
              ),
              separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
              itemCount: visible.length,
            ),
          ),
        ],
      ),
    );
  }
}

class _TonightEveningCard extends StatelessWidget {
  const _TonightEveningCard({required this.session});

  final EveningSessionSummary session;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final live = session.phase == EveningSessionPhase.live;
    final privacy = _privacyLabel(session.privacy);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.pushRoute(
          AppRoute.eveningPreview,
          pathParameters: {'sessionId': session.id},
        ),
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          width: 260,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _EveningStatusBadge(
                    live: live,
                    sessionId: session.id,
                  ),
                  if (session.isCurated) ...[
                    const SizedBox(width: 6),
                    const _CuratedEveningBadge(),
                  ],
                  const Spacer(),
                  Text(
                    live
                        ? 'шаг ${session.currentStep}/${session.totalSteps}'
                        : formatTonightEveningStartLabel(session.startsAt),
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: live ? colors.warmStart : colors.secondarySoft,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      session.emoji,
                      style: const TextStyle(fontSize: 24),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          live
                              ? 'Сейчас: ${session.currentPlace ?? 'маршрут'}'
                              : '${session.area ?? 'Рядом'} · ${session.totalSteps ?? 0} шагов',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Row(
                children: [
                  Icon(LucideIcons.users, size: 13, color: colors.inkMute),
                  const SizedBox(width: 4),
                  Text(
                    '${session.joinedCount ?? 0}'
                    '${session.maxGuests == null ? '' : '/${session.maxGuests}'}',
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkSoft,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  Icon(privacy.icon, size: 13, color: colors.inkMute),
                  const SizedBox(width: 4),
                  Text(
                    privacy.label,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      fontWeight: FontWeight.w700,
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

class _CuratedEveningBadge extends StatelessWidget {
  const _CuratedEveningBadge();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Text(
        'Frendly',
        style: AppTextStyles.caption.copyWith(
          color: colors.primary,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _EveningStatusBadge extends StatelessWidget {
  const _EveningStatusBadge({
    required this.live,
    required this.sessionId,
  });

  final bool live;
  final String sessionId;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: live ? colors.primary : colors.warmStart,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (live)
            _EveningLivePulseDot(
              key: ValueKey('tonight-evening-live-pulse-$sessionId'),
            )
          else
            Icon(
              LucideIcons.sparkles,
              size: 12,
              color: colors.secondary,
            ),
          const SizedBox(width: 5),
          Text(
            live ? 'Live' : 'Собираются',
            style: AppTextStyles.caption.copyWith(
              color: live ? colors.primaryForeground : colors.secondary,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _EveningLivePulseDot extends StatefulWidget {
  const _EveningLivePulseDot({super.key});

  @override
  State<_EveningLivePulseDot> createState() => _EveningLivePulseDotState();
}

class _EveningLivePulseDotState extends State<_EveningLivePulseDot> {
  Timer? _pulseTimer;
  bool _bright = true;

  @override
  void initState() {
    super.initState();
    _pulseTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _bright = !_bright;
      });
    });
  }

  @override
  void dispose() {
    _pulseTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return AnimatedOpacity(
      opacity: _bright ? 1 : 0.42,
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeInOut,
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: colors.primaryForeground,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: colors.primaryForeground.withValues(alpha: 0.45),
              blurRadius: 8,
              spreadRadius: 1,
            ),
          ],
        ),
      ),
    );
  }
}

({IconData icon, String label}) _privacyLabel(EveningPrivacy privacy) {
  switch (privacy) {
    case EveningPrivacy.request:
      return (icon: LucideIcons.user_check, label: 'По заявке');
    case EveningPrivacy.invite:
      return (icon: LucideIcons.lock, label: 'Инвайт');
    case EveningPrivacy.open:
      return (icon: LucideIcons.globe, label: 'Открытый');
  }
}

String formatTonightEveningStartLabel(String? startsAt, {DateTime? now}) {
  final raw = startsAt?.trim();
  if (raw == null || raw.isEmpty) {
    return 'скоро';
  }
  final start = DateTime.tryParse(raw);
  if (start == null) {
    return 'скоро';
  }

  final diff = start.difference(now ?? DateTime.now());
  if (diff.inMinutes <= 0) {
    return 'сейчас';
  }
  if (diff.inMinutes < 60) {
    return 'через ${diff.inMinutes} мин';
  }
  if (diff.inHours < 24) {
    return 'через ${diff.inHours} ч';
  }
  return 'скоро';
}

class _TonightPosterPreview extends ConsumerWidget {
  const _TonightPosterPreview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final posters =
        ref.watch(featuredPostersProvider).valueOrNull ?? const <Poster>[];
    if (posters.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Что в городе',
                    style: AppTextStyles.caption.copyWith(letterSpacing: 1.0),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Афиша рядом',
                    style: AppTextStyles.sectionTitle,
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () => context.pushRoute(AppRoute.posters),
              child: Text(
                'Все',
                style: AppTextStyles.meta.copyWith(
                  color: colors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          height: 220,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemBuilder: (context, index) {
              final poster = posters[index];
              return PosterCard(
                poster: poster,
                variant: PosterCardVariant.compact,
                onTap: () => context.pushRoute(
                  AppRoute.poster,
                  pathParameters: {'posterId': poster.id},
                ),
              );
            },
            separatorBuilder: (context, index) =>
                const SizedBox(width: AppSpacing.sm),
            itemCount: posters.length > 6 ? 6 : posters.length,
          ),
        ),
      ],
    );
  }
}

class _NearbyMeetupsEmptyCard extends StatelessWidget {
  const _NearbyMeetupsEmptyCard({
    required this.onCreate,
  });

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.calendar_plus,
                  size: 20,
                  color: colors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Встреч рядом нет', style: AppTextStyles.itemTitle),
                    const SizedBox(height: 2),
                    Text(
                      'Можно создать свою встречу.',
                      style: AppTextStyles.meta.copyWith(color: colors.inkMute),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton(
              onPressed: onCreate,
              child: const Text('Создать встречу'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShowAllNearbyButton extends StatelessWidget {
  const _ShowAllNearbyButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.border),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Показать все встречи рядом',
                style: AppTextStyles.itemTitle.copyWith(fontSize: 13),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                LucideIcons.sparkles,
                size: 14,
                color: colors.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TonightPeoplePreview extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final people = ref.watch(peopleProvider).valueOrNull ?? const [];

    return SizedBox(
      height: 176,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final person = people[index];
          return InkWell(
            onTap: () => context.pushRoute(
              AppRoute.userProfile,
              pathParameters: {'userId': person.id},
            ),
            borderRadius: AppRadii.cardBorder,
            child: Container(
              width: 120,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: AppRadii.cardBorder,
                border: Border.all(color: colors.border),
                boxShadow: AppShadows.soft,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  BbAvatar(
                    name: person.name,
                    size: BbAvatarSize.lg,
                    online: person.online,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    person.name,
                    style: AppTextStyles.itemTitle.copyWith(fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 2),
                  Flexible(
                    child: Text(
                      '2 общих интереса',
                      style: AppTextStyles.caption,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
        separatorBuilder: (context, index) =>
            const SizedBox(width: AppSpacing.sm),
        itemCount: people.length > 5 ? 5 : people.length,
      ),
    );
  }
}

class _HeaderCircleButton extends StatelessWidget {
  const _HeaderCircleButton({
    required this.icon,
    required this.onTap,
    this.showDot = false,
    this.animateIcon = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool showDot;
  final bool animateIcon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: colors.card,
          shape: BoxShape.circle,
          border: Border.all(color: colors.border),
        ),
        child: Stack(
          children: [
            Center(
              child: animateIcon
                  ? _SubtleShakeIcon(
                      icon: icon,
                      color: colors.inkSoft,
                    )
                  : Icon(icon, size: 20, color: colors.inkSoft),
            ),
            if (showDot)
              Positioned(
                right: 11,
                top: 11,
                child: Container(
                  key: const ValueKey('tonight-notification-dot'),
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: colors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colors.card,
                      width: 2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SubtleShakeIcon extends StatefulWidget {
  const _SubtleShakeIcon({
    required this.icon,
    required this.color,
  });

  final IconData icon;
  final Color color;

  @override
  State<_SubtleShakeIcon> createState() => _SubtleShakeIconState();
}

class _SubtleShakeIconState extends State<_SubtleShakeIcon>
    with SingleTickerProviderStateMixin {
  static const _shakeDuration = Duration(milliseconds: 620);
  static const _restDuration = Duration(seconds: 4);

  late final AnimationController _controller;
  late final Animation<double> _rotation;
  late final Animation<double> _shift;
  Timer? _restTimer;
  bool _shakeScheduled = false;
  bool _disableAnimations = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: _shakeDuration,
    )..addStatusListener(_handleStatus);
    _rotation = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween<double>(0), weight: 18),
      TweenSequenceItem(tween: Tween(begin: 0, end: -0.045), weight: 11),
      TweenSequenceItem(tween: Tween(begin: -0.045, end: 0.045), weight: 14),
      TweenSequenceItem(tween: Tween(begin: 0.045, end: -0.03), weight: 13),
      TweenSequenceItem(tween: Tween(begin: -0.03, end: 0.025), weight: 11),
      TweenSequenceItem(tween: Tween(begin: 0.025, end: 0), weight: 10),
      TweenSequenceItem(tween: ConstantTween<double>(0), weight: 23),
    ]).animate(_controller);
    _shift = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween<double>(0), weight: 18),
      TweenSequenceItem(tween: Tween(begin: 0, end: -0.7), weight: 11),
      TweenSequenceItem(tween: Tween(begin: -0.7, end: 0.7), weight: 14),
      TweenSequenceItem(tween: Tween(begin: 0.7, end: -0.45), weight: 13),
      TweenSequenceItem(tween: Tween(begin: -0.45, end: 0.35), weight: 11),
      TweenSequenceItem(tween: Tween(begin: 0.35, end: 0), weight: 10),
      TweenSequenceItem(tween: ConstantTween<double>(0), weight: 23),
    ]).animate(_controller);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _disableAnimations = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (_disableAnimations) {
      _restTimer?.cancel();
      _restTimer = null;
      _controller.stop();
      return;
    }

    if (!_controller.isAnimating && _restTimer == null) {
      _scheduleShake();
    }
  }

  @override
  void dispose() {
    _restTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _handleStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || !mounted) {
      return;
    }

    _restTimer?.cancel();
    _restTimer = Timer(_restDuration, _playShake);
  }

  void _scheduleShake() {
    if (_shakeScheduled) {
      return;
    }

    _shakeScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _shakeScheduled = false;
      _playShake();
    });
  }

  void _playShake() {
    if (!mounted || _disableAnimations) {
      return;
    }

    _restTimer?.cancel();
    _restTimer = null;
    _controller.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final icon = Icon(widget.icon, size: 20, color: widget.color);
    if (_disableAnimations) {
      return KeyedSubtree(
        key: const ValueKey('tonight-notification-bell-shake'),
        child: icon,
      );
    }

    return AnimatedBuilder(
      key: const ValueKey('tonight-notification-bell-shake'),
      animation: _controller,
      child: icon,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(_shift.value, 0),
          child: Transform.rotate(
            angle: _rotation.value,
            child: child,
          ),
        );
      },
    );
  }
}

class _TonightFeedSwitch extends StatelessWidget {
  const _TonightFeedSwitch({
    required this.afterDarkUnlocked,
    required this.onOpenAfterDark,
  });

  final bool afterDarkUnlocked;
  final VoidCallback onOpenAfterDark;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      height: 44,
      padding: const EdgeInsets.all(AppSpacing.xxs),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.pillBorder,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          const Expanded(
            child: _TonightFeedChip(
              key: ValueKey('tonight-feed-day'),
              label: 'Сегодня',
              leadingIcon: LucideIcons.sunset,
              backgroundColor: AppColors.foreground,
              foregroundColor: AppColors.primaryForeground,
            ),
          ),
          const SizedBox(width: AppSpacing.xxs),
          Expanded(
            child: _TonightFeedChip(
              key: const ValueKey('tonight-feed-after-dark'),
              label: 'After Dark',
              leadingIcon: LucideIcons.moon,
              trailingIcon: afterDarkUnlocked ? null : LucideIcons.lock,
              foregroundColor: colors.foreground,
              backgroundGradient: LinearGradient(
                colors: [
                  AppColors.adMagenta.withValues(alpha: 0.12),
                  AppColors.adViolet.withValues(alpha: 0.12),
                ],
              ),
              onTap: onOpenAfterDark,
            ),
          ),
        ],
      ),
    );
  }
}

class _TonightFeedChip extends StatelessWidget {
  const _TonightFeedChip({
    required this.label,
    required this.leadingIcon,
    required this.foregroundColor,
    super.key,
    this.backgroundColor,
    this.backgroundGradient,
    this.trailingIcon,
    this.onTap,
  });

  final String label;
  final IconData leadingIcon;
  final IconData? trailingIcon;
  final Color foregroundColor;
  final Color? backgroundColor;
  final Gradient? backgroundGradient;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Ink(
          decoration: BoxDecoration(
            color: backgroundColor,
            gradient: backgroundGradient,
            borderRadius: AppRadii.pillBorder,
          ),
          child: SizedBox(
            height: 36,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  leadingIcon,
                  size: 14,
                  color: foregroundColor,
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: AppTextStyles.meta.copyWith(
                    fontFamily: 'Sora',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.26,
                    color: foregroundColor,
                  ),
                ),
                if (trailingIcon != null) ...[
                  const SizedBox(width: AppSpacing.xxs),
                  Icon(
                    trailingIcon,
                    size: 12,
                    color: foregroundColor,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ActiveMeetupChatsCard extends StatelessWidget {
  const _ActiveMeetupChatsCard({
    required this.chats,
    required this.onOpenAll,
  });

  final List<MeetupChat> chats;
  final VoidCallback onOpenAll;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOpenAll,
        borderRadius: AppRadii.cardBorder,
        child: Container(
          key: const ValueKey('tonight-active-meetup-card'),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Твои встречи сегодня',
                      style: AppTextStyles.caption.copyWith(
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  Text(
                    'Все →',
                    style: AppTextStyles.meta.copyWith(
                      color: colors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              for (var index = 0; index < chats.length; index++) ...[
                _ActiveChatRow(chat: chats[index]),
                if (index != chats.length - 1)
                  const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ActiveChatRow extends StatefulWidget {
  const _ActiveChatRow({required this.chat});

  final MeetupChat chat;

  @override
  State<_ActiveChatRow> createState() => _ActiveChatRowState();
}

class _ActiveChatRowState extends State<_ActiveChatRow> {
  Timer? _statusTimer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _scheduleStatusTick();
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  void _scheduleStatusTick() {
    _statusTimer?.cancel();
    final now = DateTime.now();
    final delay = Duration(
      minutes: 1,
      seconds: -now.second,
      milliseconds: -now.millisecond,
      microseconds: -now.microsecond,
    );
    _statusTimer = Timer(delay, () {
      if (!mounted) {
        return;
      }
      setState(() {
        _now = DateTime.now();
      });
      _scheduleStatusTick();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final chat = widget.chat;
    final isOngoing = _isMeetupChatOngoing(chat, _now);
    return InkWell(
      onTap: () => context.pushRoute(
        AppRoute.meetupChat,
        pathParameters: {'chatId': chat.id},
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.warmStart,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(chat.emoji, style: const TextStyle(fontSize: 20)),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(chat.title, style: AppTextStyles.itemTitle),
                const SizedBox(height: 2),
                Text(
                  '${chat.lastAuthor}: ${chat.lastMessage}',
                  style: AppTextStyles.meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (isOngoing) ...[
            const SizedBox(width: AppSpacing.sm),
            _OngoingMeetupPulseDot(
              key: ValueKey('tonight-active-meetup-ongoing-dot-${chat.id}'),
            ),
          ],
          if (chat.unread > 0) ...[
            const SizedBox(width: AppSpacing.sm),
            Container(
              constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(
                color: colors.primary,
                borderRadius: const BorderRadius.all(Radius.circular(999)),
              ),
              alignment: Alignment.center,
              child: Text(
                '${chat.unread}',
                style: AppTextStyles.caption.copyWith(
                  color: colors.primaryForeground,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OngoingMeetupPulseDot extends StatefulWidget {
  const _OngoingMeetupPulseDot({super.key});

  @override
  State<_OngoingMeetupPulseDot> createState() => _OngoingMeetupPulseDotState();
}

class _OngoingMeetupPulseDotState extends State<_OngoingMeetupPulseDot> {
  Timer? _pulseTimer;
  bool _bright = true;

  @override
  void initState() {
    super.initState();
    _pulseTimer = Timer.periodic(const Duration(milliseconds: 1400), (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _bright = !_bright;
      });
    });
  }

  @override
  void dispose() {
    _pulseTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Встреча уже идет',
      child: AnimatedOpacity(
        opacity: _bright ? 1 : 0.38,
        duration: const Duration(milliseconds: 700),
        curve: Curves.easeInOut,
        child: Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: _ongoingMeetupDotColor,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: _ongoingMeetupDotColor.withValues(alpha: 0.35),
                blurRadius: 8,
                spreadRadius: 1,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _isMeetupChatOngoing(MeetupChat chat, DateTime now) {
  final status = chat.status?.trim().toLowerCase();
  if (status != null && status.isNotEmpty && status != 'сегодня') {
    return false;
  }

  final normalizedTime = chat.time.trim().toLowerCase();
  if (normalizedTime.contains('завтра') ||
      normalizedTime.contains('вчера') ||
      normalizedTime.isEmpty) {
    return false;
  }

  final startMinutes = _parseMeetupStartMinutes(normalizedTime);
  if (startMinutes == null) {
    return false;
  }

  final nowMinutes = now.hour * 60 + now.minute;
  return nowMinutes >= startMinutes;
}

int? _parseMeetupStartMinutes(String time) {
  final match = _meetupStartTimePattern.firstMatch(time);
  if (match == null) {
    return null;
  }

  final hour = int.tryParse(match.group(1) ?? '');
  final minute = int.tryParse(match.group(2) ?? '');
  if (hour == null || minute == null) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}
