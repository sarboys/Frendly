import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_edit_state.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EveningPlanScreen extends ConsumerStatefulWidget {
  const EveningPlanScreen({
    required this.routeId,
    this.isPremium = false,
    this.autoOpenLaunch = false,
    super.key,
  });

  final String routeId;
  final bool isPremium;
  final bool autoOpenLaunch;

  @override
  ConsumerState<EveningPlanScreen> createState() => _EveningPlanScreenState();
}

class _EveningPlanScreenState extends ConsumerState<EveningPlanScreen> {
  final Set<String> _usedPerks = <String>{};
  final Set<String> _boughtTickets = <String>{};
  final Set<String> _sentToChat = <String>{};
  bool _autoLaunchOpened = false;
  EveningRouteData? _backendRoute;

  EveningRouteData get _route => readEveningRoute(
        ref,
        widget.routeId,
        fallback: _backendRoute ?? findEveningRoute(widget.routeId),
      );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadBackendRoute();
      if (widget.autoOpenLaunch) {
        if (!mounted || _autoLaunchOpened) {
          return;
        }
        _autoLaunchOpened = true;
        _openLaunchSheet();
      }
    });
  }

  Future<void> _loadBackendRoute() async {
    try {
      final json = await ref
          .read(backendRepositoryProvider)
          .fetchEveningRoute(widget.routeId);
      if (!mounted) {
        return;
      }
      setState(() {
        _backendRoute = eveningRouteFromJson(
          json,
          fallback: findEveningRoute(widget.routeId),
        );
      });
    } catch (_) {}
  }

  void _markPerkUsed(String id) {
    setState(() {
      _usedPerks.add(id);
    });
  }

  void _markTicketBought(String id) {
    setState(() {
      _boughtTickets.add(id);
    });
  }

  Future<void> _openPerkForStep(EveningRouteStep step) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: false,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.of(context).foreground.withValues(alpha: 0.4),
      builder: (context) => _PerkRedeemSheet(
        partner: _PerkPartner.fromStep(step),
        eventTitle: _route.title,
        eventTime: _route.durationLabel,
      ),
    );

    if (!mounted) {
      return;
    }
    _markPerkUsed(step.id);
  }

  void _sendStepToChat(EveningRouteStep step) {
    if (_sentToChat.contains(step.id)) {
      return;
    }

    setState(() {
      _sentToChat.add(step.id);
    });

    final text = step.ticketPrice != null
        ? '🎟 Билет ${step.ticketPrice} ₽ · ${step.title}'
        : step.perk != null
            ? '✨ Перк: ${step.perkShort ?? step.perk} · ${step.venue}'
            : '📍 ${step.title}';

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 96),
        duration: const Duration(milliseconds: 2400),
        content: Text(
          'Отправлено в meetup-чат\n${step.time}${step.endTime != null ? ' — ${step.endTime}' : ''} · $text',
          style: AppTextStyles.meta.copyWith(
            color: AppColors.of(context).background,
          ),
        ),
      ),
    );
  }

  Future<void> _openStepDetails(EveningRouteStep step) {
    final route = _route;
    final index = route.steps.indexWhere((item) => item.id == step.id);

    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: false,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.of(context).foreground.withValues(alpha: 0.4),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          return _StepDetailSheet(
            step: step,
            stepIndex: index,
            totalSteps: route.steps.length,
            kindLabel: eveningKindLabel(step.kind),
            perkUsed: _usedPerks.contains(step.id),
            ticketBought: _boughtTickets.contains(step.id),
            onUsePerk: () {
              Navigator.of(sheetContext).pop();
              _openPerkForStep(step);
            },
            onBuyTicket: () {
              _markTicketBought(step.id);
              setSheetState(() {});
            },
          );
        },
      ),
    );
  }

  Future<void> _openLaunchSheet() async {
    final route = _route;
    final result = await showModalBottomSheet<_LaunchEveningChoice>(
      context: context,
      isScrollControlled: true,
      useSafeArea: false,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.of(context).foreground.withValues(alpha: 0.4),
      builder: (context) => _LaunchEveningSheet(route: route),
    );

    if (result == null || !mounted) {
      return;
    }

    try {
      final published =
          await ref.read(backendRepositoryProvider).publishEveningRoute(
                route.id,
                privacy: result.privacy,
              );
      if (!mounted) {
        return;
      }
      _cachePublishedEveningChat(route, published);
      context.pushReplacementNamed(
        AppRoute.meetupChat.name,
        pathParameters: {'chatId': published.chatId},
      );
      return;
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Не удалось опубликовать вечер. Проверь сеть и попробуй ещё раз'),
          ),
        );
      }
    }
  }

  void _cachePublishedEveningChat(
    EveningRouteData route,
    EveningPublishResult published,
  ) {
    final currentUserId = ref.read(currentUserIdProvider);
    final existingChats = ref.read(meetupChatsProvider).valueOrNull ??
        ref.read(meetupChatsLocalStateProvider);

    if (existingChats == null || currentUserId == null) {
      ref.read(meetupChatsLocalStateProvider.notifier).state = null;
      ref.invalidate(meetupChatsProvider);
      ref.invalidate(eveningSessionsProvider);
      ref.invalidate(eveningSessionProvider(published.sessionId));
      return;
    }

    final totalSteps = route.steps.length;
    final summary = MeetupChat(
      id: published.chatId,
      eventId: null,
      title: route.title,
      emoji: route.steps.isEmpty ? '✨' : route.steps.first.emoji,
      time: route.durationLabel,
      lastMessage:
          'Вечер опубликован · $totalSteps шагов · ${_privacyLabel(published.privacy)}',
      lastAuthor: 'Frendly',
      lastTime: 'сейчас',
      unread: 0,
      members: const ['Ты'],
      status: 'Сбор участников',
      phase: MeetupPhase.soon,
      totalSteps: totalSteps,
      startsInLabel: 'Скоро',
      routeId: published.routeId,
      sessionId: published.sessionId,
      privacy: published.privacy,
      joinedCount: published.joinedCount,
      maxGuests: published.maxGuests,
      hostUserId: currentUserId,
      hostName: 'Ты',
      area: route.area,
    );

    ref.read(meetupChatsLocalStateProvider.notifier).state =
        upsertMeetupChat(existingChats, summary);
    ref.invalidate(eveningSessionsProvider);
    ref.invalidate(eveningSessionProvider(published.sessionId));
  }

  String _privacyLabel(EveningPrivacy privacy) {
    switch (privacy) {
      case EveningPrivacy.request:
        return 'по заявке';
      case EveningPrivacy.invite:
        return 'по приглашениям';
      case EveningPrivacy.open:
        return 'открытый';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    ref.watch(eveningRouteOverridesProvider);
    final route = _route;
    final subscription = ref.watch(subscriptionStateProvider).valueOrNull;
    final hasPremiumAccess =
        widget.isPremium || _hasFrendlyPlusAccess(subscription);
    final locked = route.premium && !hasPremiumAccess;
    final totalTickets = route.steps.fold<int>(
      0,
      (sum, step) => sum + (step.ticketPrice ?? 0),
    );

    return Scaffold(
      backgroundColor: colors.background,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: _PlanHero(
                  route: route,
                  onEdit: () => context.pushRoute(
                    AppRoute.eveningEdit,
                    pathParameters: {'routeId': route.id},
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        route.title,
                        style: AppTextStyles.screenTitle.copyWith(
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                          color: colors.foreground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        route.blurb,
                        style: AppTextStyles.meta.copyWith(
                          fontSize: 13,
                          color: colors.inkSoft,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.xs,
                        children: [
                          _StatPill(
                            icon: LucideIcons.clock,
                            label: route.durationLabel,
                          ),
                          _StatPill(
                            icon: LucideIcons.users,
                            label: '${route.hostsCount} идут сегодня',
                          ),
                          _StatPill(
                            icon: LucideIcons.wallet,
                            label: 'от ${route.totalPriceFrom} ₽',
                            accent: true,
                          ),
                          _StatPill(
                            icon: LucideIcons.sparkles,
                            label: '−${route.totalSavings} ₽ перки',
                            highlight: true,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 20)),
              if (locked)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _LockedOverlay(
                      onUnlock: () => context.pushRoute(AppRoute.paywall),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 168),
                  sliver: SliverList.builder(
                    itemCount: route.steps.length,
                    itemBuilder: (context, index) {
                      final step = route.steps[index];
                      return _TimelineStepTile(
                        step: step,
                        index: index,
                        isLast: index == route.steps.length - 1,
                        perkUsed: _usedPerks.contains(step.id),
                        ticketBought: _boughtTickets.contains(step.id),
                        sentToChat: _sentToChat.contains(step.id),
                        onOpen: () => _openStepDetails(step),
                        onUsePerk: () => _openPerkForStep(step),
                        onBuyTicket: () => _markTicketBought(step.id),
                        onSendToChat: () => _sendStepToChat(step),
                      );
                    },
                  ),
                ),
            ],
          ),
          if (!locked)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _StickyPlanCta(
                totalTickets: totalTickets,
                totalSavings: route.totalSavings,
                onTap: _openLaunchSheet,
              ),
            ),
        ],
      ),
    );
  }
}

bool _hasFrendlyPlusAccess(SubscriptionStateData? subscription) {
  return subscription?.status == 'trial' || subscription?.status == 'active';
}

class _PlanHero extends StatelessWidget {
  const _PlanHero({
    required this.route,
    required this.onEdit,
  });

  final EveningRouteData route;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final safeTop = MediaQuery.paddingOf(context).top;

    return SizedBox(
      height: 176 + safeTop,
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    colors.primary.withValues(alpha: 0.3),
                    colors.warmStart,
                    colors.secondary.withValues(alpha: 0.2),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: safeTop + 12,
            left: 16,
            child: _CircleIconButton(
              icon: LucideIcons.chevron_left,
              tooltip: 'Назад',
              onTap: () => Navigator.of(context).maybePop(),
              background: colors.background.withValues(alpha: 0.85),
            ),
          ),
          Positioned(
            top: safeTop + 12,
            right: 16,
            child: Row(
              children: [
                _CircleIconButton(
                  icon: LucideIcons.pencil,
                  tooltip: 'Редактировать вечер',
                  onTap: onEdit,
                  background: colors.background.withValues(alpha: 0.85),
                  iconSize: 16,
                ),
                const SizedBox(width: AppSpacing.xs),
                _CircleIconButton(
                  icon: LucideIcons.share_2,
                  tooltip: 'Поделиться',
                  onTap: () {},
                  background: colors.background.withValues(alpha: 0.85),
                  iconSize: 18,
                ),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 16,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                _HeroLabel(
                  icon: LucideIcons.sparkles,
                  label: 'Frendly Plan',
                  foreground: colors.foreground,
                  background: colors.background.withValues(alpha: 0.85),
                ),
                if (route.premium) ...[
                  const SizedBox(width: AppSpacing.xs),
                  _HeroLabel(
                    icon: LucideIcons.crown,
                    label: 'Frendly+',
                    foreground: colors.background,
                    background: colors.foreground,
                  ),
                ],
                const Spacer(),
                Flexible(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: colors.background.withValues(alpha: 0.7),
                      borderRadius: AppRadii.pillBorder,
                    ),
                    child: Text(
                      route.area,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkSoft,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineStepTile extends StatelessWidget {
  const _TimelineStepTile({
    required this.step,
    required this.index,
    required this.isLast,
    required this.perkUsed,
    required this.ticketBought,
    required this.sentToChat,
    required this.onOpen,
    required this.onUsePerk,
    required this.onBuyTicket,
    required this.onSendToChat,
  });

  final EveningRouteStep step;
  final int index;
  final bool isLast;
  final bool perkUsed;
  final bool ticketBought;
  final bool sentToChat;
  final VoidCallback onOpen;
  final VoidCallback onUsePerk;
  final VoidCallback onBuyTicket;
  final VoidCallback onSendToChat;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: index == 0 ? colors.foreground : colors.card,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: index == 0 ? colors.foreground : colors.border,
                      width: 2,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${index + 1}',
                    style: AppTextStyles.itemTitle.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: index == 0 ? colors.background : colors.foreground,
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: colors.border,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 4 : 20),
              child: Column(
                children: [
                  SizedBox(
                    height: 40,
                    child: Row(
                      children: [
                        Text(
                          step.time,
                          style: AppTextStyles.meta.copyWith(
                            fontFamily: 'Sora',
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: colors.foreground,
                          ),
                        ),
                        if (step.endTime != null) ...[
                          const SizedBox(width: 6),
                          Text(
                            '— ${step.endTime}',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                        const SizedBox(width: 6),
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                fit: FlexFit.loose,
                                child: ConstrainedBox(
                                  constraints:
                                      const BoxConstraints(maxWidth: 120),
                                  child: _TinyPill(
                                    label: eveningKindLabel(step.kind),
                                    foreground: colors.inkMute,
                                    background: colors.muted,
                                  ),
                                ),
                              ),
                              if (step.sponsored) ...[
                                const SizedBox(width: 6),
                                Flexible(
                                  fit: FlexFit.loose,
                                  child: _TinyPill(
                                    label: 'Sponsored',
                                    foreground: colors.secondary,
                                    background: colors.secondary
                                        .withValues(alpha: 0.15),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (step.hasShareable) ...[
                          const SizedBox(width: 6),
                          _ChatButton(
                            sent: sentToChat,
                            onTap: sentToChat ? null : onSendToChat,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  InkWell(
                    onTap: onOpen,
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                        boxShadow: AppShadows.soft,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [colors.warmStart, colors.warmEnd],
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  step.emoji,
                                  style: const TextStyle(fontSize: 24),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      step.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTextStyles.itemTitle.copyWith(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                        color: colors.foreground,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      '${step.venue} · ${step.address}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTextStyles.meta.copyWith(
                                        color: colors.inkMute,
                                      ),
                                    ),
                                    if (step.walkMin != null) ...[
                                      const SizedBox(height: 3),
                                      Row(
                                        children: [
                                          Icon(
                                            LucideIcons.map_pin,
                                            size: 12,
                                            color: colors.inkMute,
                                          ),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              '${step.distance} · ${step.walkMin} мин пешком',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: AppTextStyles.caption
                                                  .copyWith(
                                                color: colors.inkMute,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              _QuickActions(
                                step: step,
                                perkUsed: perkUsed,
                                ticketBought: ticketBought,
                                onUsePerk: onUsePerk,
                                onBuyTicket: onBuyTicket,
                              ),
                            ],
                          ),
                          if (step.perk != null &&
                              step.ticketPrice != null) ...[
                            const SizedBox(height: AppSpacing.sm),
                            _WidePerkAction(
                              step: step,
                              perkUsed: perkUsed,
                              onUsePerk: onUsePerk,
                            ),
                          ] else if (step.perk != null) ...[
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Icon(
                                  LucideIcons.sparkles,
                                  size: 12,
                                  color: colors.secondary,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    step.perkShort ?? step.perk!,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTextStyles.caption.copyWith(
                                      color: colors.inkMute,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
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

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.step,
    required this.perkUsed,
    required this.ticketBought,
    required this.onUsePerk,
    required this.onBuyTicket,
  });

  final EveningRouteStep step;
  final bool perkUsed;
  final bool ticketBought;
  final VoidCallback onUsePerk;
  final VoidCallback onBuyTicket;

  @override
  Widget build(BuildContext context) {
    if (step.ticketPrice == null && step.perk == null) {
      return const SizedBox.shrink();
    }

    final hasTicket = step.ticketPrice != null;
    final done = hasTicket ? ticketBought : perkUsed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (hasTicket)
          _SmallActionButton(
            icon: done ? LucideIcons.circle_check : LucideIcons.ticket,
            label: done ? 'Куплено' : '${step.ticketPrice} ₽',
            done: done,
            onTap: done ? null : onBuyTicket,
          )
        else
          _SmallActionButton(
            icon: done ? LucideIcons.circle_check : LucideIcons.sparkles,
            label: done ? 'Использован' : 'Перк',
            done: done,
            warm: !done,
            onTap: done ? null : onUsePerk,
          ),
        const SizedBox(height: 4),
        _StatusPill(
          state: hasTicket
              ? done
                  ? _ActionState.doneTicket
                  : _ActionState.available
              : done
                  ? _ActionState.donePerk
                  : _ActionState.available,
        ),
      ],
    );
  }
}

class _SmallActionButton extends StatelessWidget {
  const _SmallActionButton({
    required this.icon,
    required this.label,
    required this.done,
    this.warm = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool done;
  final bool warm;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    final background = done
        ? colors.secondary.withValues(alpha: 0.15)
        : warm
            ? colors.warmStart
            : colors.foreground;
    final foreground = done
        ? colors.secondary
        : warm
            ? colors.foreground
            : colors.background;

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.pillBorder,
      child: Container(
        height: 40,
        padding: const EdgeInsets.only(left: 10, right: 12),
        decoration: BoxDecoration(
          color: background,
          borderRadius: AppRadii.pillBorder,
          border: Border.all(
            color: done
                ? colors.secondary.withValues(alpha: 0.4)
                : warm
                    ? colors.border.withValues(alpha: 0.6)
                    : colors.foreground,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: warm && !done ? colors.secondary : foreground,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: AppTextStyles.meta.copyWith(
                fontFamily: 'Sora',
                fontWeight: FontWeight.w600,
                color: foreground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WidePerkAction extends StatelessWidget {
  const _WidePerkAction({
    required this.step,
    required this.perkUsed,
    required this.onUsePerk,
  });

  final EveningRouteStep step;
  final bool perkUsed;
  final VoidCallback onUsePerk;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: perkUsed ? null : onUsePerk,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: perkUsed
              ? colors.secondary.withValues(alpha: 0.1)
              : colors.warmStart,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: perkUsed
                ? colors.secondary.withValues(alpha: 0.4)
                : colors.border.withValues(alpha: 0.6),
          ),
        ),
        child: Row(
          children: [
            Icon(
              perkUsed ? LucideIcons.circle_check : LucideIcons.sparkles,
              size: 14,
              color: colors.secondary,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                step.perkShort ?? step.perk!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.meta.copyWith(color: colors.foreground),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              perkUsed ? 'Использован' : 'Перк',
              style: AppTextStyles.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: perkUsed ? colors.secondary : colors.foreground,
              ),
            ),
            if (!perkUsed) ...[
              const SizedBox(width: 4),
              Icon(LucideIcons.arrow_right, size: 12, color: colors.foreground),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChatButton extends StatelessWidget {
  const _ChatButton({
    required this.sent,
    required this.onTap,
  });

  final bool sent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.pillBorder,
      child: Container(
        height: 28,
        padding: const EdgeInsets.only(left: 8, right: 10),
        decoration: BoxDecoration(
          color: sent ? colors.secondary.withValues(alpha: 0.15) : colors.card,
          borderRadius: AppRadii.pillBorder,
          border: Border.all(
            color:
                sent ? colors.secondary.withValues(alpha: 0.4) : colors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              sent ? LucideIcons.circle_check : LucideIcons.send,
              size: 12,
              color: sent ? colors.secondary : colors.foreground,
            ),
            const SizedBox(width: 4),
            Text(
              sent ? 'В чате' : 'В чат',
              style: AppTextStyles.caption.copyWith(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: sent ? colors.secondary : colors.foreground,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepDetailSheet extends StatelessWidget {
  const _StepDetailSheet({
    required this.step,
    required this.stepIndex,
    required this.totalSteps,
    required this.kindLabel,
    required this.perkUsed,
    required this.ticketBought,
    required this.onUsePerk,
    required this.onBuyTicket,
  });

  final EveningRouteStep step;
  final int stepIndex;
  final int totalSteps;
  final String kindLabel;
  final bool perkUsed;
  final bool ticketBought;
  final VoidCallback onUsePerk;
  final VoidCallback onBuyTicket;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return DraggableScrollableSheet(
      initialChildSize: 0.72,
      minChildSize: 0.42,
      maxChildSize: 0.88,
      expand: false,
      builder: (context, controller) {
        return Container(
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: AppRadii.pillBorder,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [colors.warmStart, colors.warmEnd],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        step.emoji,
                        style: const TextStyle(fontSize: 30),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              _TinyPill(
                                label: kindLabel,
                                foreground: colors.inkMute,
                                background: colors.muted,
                              ),
                              Text(
                                'Шаг ${stepIndex + 1} / $totalSteps',
                                style: AppTextStyles.caption.copyWith(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkMute,
                                  letterSpacing: 0,
                                ),
                              ),
                              if (step.sponsored)
                                _TinyPill(
                                  label: 'Sponsored',
                                  foreground: colors.secondary,
                                  background:
                                      colors.secondary.withValues(alpha: 0.15),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            step.title,
                            style: AppTextStyles.cardTitle.copyWith(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: colors.foreground,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            step.venue,
                            style: AppTextStyles.meta.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Tooltip(
                      message: 'Закрыть',
                      child: InkWell(
                        onTap: () => Navigator.of(context).pop(),
                        borderRadius: AppRadii.pillBorder,
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: colors.muted,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            LucideIcons.x,
                            size: 16,
                            color: colors.inkSoft,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  children: [
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        _InfoPill(
                          icon: LucideIcons.clock,
                          label:
                              '${step.time}${step.endTime != null ? ' — ${step.endTime}' : ''}',
                        ),
                        _InfoPill(
                          icon: LucideIcons.map_pin,
                          label:
                              '${step.distance}${step.walkMin != null ? ' · ${step.walkMin} мин' : ''}',
                        ),
                        if (step.vibeTag != null)
                          _InfoPill(label: step.vibeTag!),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            LucideIcons.map_pin,
                            size: 16,
                            color: colors.inkSoft,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Адрес',
                                  style: AppTextStyles.caption.copyWith(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: colors.inkMute,
                                    letterSpacing: 0,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  step.address,
                                  style: AppTextStyles.meta.copyWith(
                                    fontSize: 13,
                                    color: colors.foreground,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: colors.foreground,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Icon(
                              LucideIcons.navigation,
                              size: 16,
                              color: colors.background,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (step.description != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        step.description!,
                        style: AppTextStyles.meta.copyWith(
                          fontSize: 13,
                          height: 1.45,
                          color: colors.inkSoft,
                        ),
                      ),
                    ],
                    if (step.perk != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: perkUsed
                              ? colors.secondary.withValues(alpha: 0.1)
                              : colors.warmStart,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: perkUsed
                                ? colors.secondary.withValues(alpha: 0.4)
                                : colors.border.withValues(alpha: 0.6),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  LucideIcons.sparkles,
                                  size: 12,
                                  color: colors.secondary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Перк партнёра',
                                  style: AppTextStyles.caption.copyWith(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: colors.secondary,
                                    letterSpacing: 0,
                                  ),
                                ),
                                const Spacer(),
                                _DetailStatusChip(
                                  used: perkUsed,
                                  kind: _DetailStatusKind.perk,
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              step.perk!,
                              style: AppTextStyles.meta.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: colors.foreground,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (step.ticketPrice != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: ticketBought
                              ? colors.secondary.withValues(alpha: 0.1)
                              : colors.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: ticketBought
                                ? colors.secondary.withValues(alpha: 0.4)
                                : colors.border,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              LucideIcons.ticket,
                              size: 16,
                              color: colors.inkSoft,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                'Билет ${step.ticketPrice} ₽',
                                style: AppTextStyles.meta.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: colors.foreground,
                                ),
                              ),
                            ),
                            _DetailStatusChip(
                              used: ticketBought,
                              kind: _DetailStatusKind.ticket,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (step.perk != null || step.ticketPrice != null)
                Padding(
                  padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + bottomInset),
                  child: Column(
                    children: [
                      if (step.ticketPrice != null)
                        _SheetActionButton(
                          icon: ticketBought
                              ? LucideIcons.circle_check
                              : LucideIcons.ticket,
                          trailingIcon:
                              ticketBought ? null : LucideIcons.arrow_right,
                          label: ticketBought
                              ? 'Билет куплен'
                              : 'Купить билет ${step.ticketPrice} ₽',
                          done: ticketBought,
                          onTap: ticketBought ? null : onBuyTicket,
                        ),
                      if (step.ticketPrice != null && step.perk != null)
                        const SizedBox(height: AppSpacing.xs),
                      if (step.perk != null)
                        _SheetActionButton(
                          icon: perkUsed
                              ? LucideIcons.circle_check
                              : LucideIcons.sparkles,
                          label: perkUsed
                              ? 'Перк использован'
                              : 'Использовать перк',
                          done: perkUsed,
                          secondary: step.ticketPrice != null,
                          onTap: perkUsed ? null : onUsePerk,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _PerkRedeemSheet extends StatefulWidget {
  const _PerkRedeemSheet({
    required this.partner,
    required this.eventTitle,
    required this.eventTime,
  });

  final _PerkPartner partner;
  final String eventTitle;
  final String eventTime;

  @override
  State<_PerkRedeemSheet> createState() => _PerkRedeemSheetState();
}

class _PerkRedeemSheetState extends State<_PerkRedeemSheet> {
  _RedeemStep _step = _RedeemStep.intro;
  int _people = 4;
  String _name = 'Ты';
  String _phone = '+7 ';
  bool _copied = false;

  String get _code {
    final suffix = widget.partner.id.length > 4
        ? widget.partner.id.substring(widget.partner.id.length - 4)
        : widget.partner.id;
    return 'FRD-${suffix.toUpperCase()}-4821';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.88,
      ),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.border,
              borderRadius: AppRadii.pillBorder,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [colors.warmStart, colors.warmEnd],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    widget.partner.emoji,
                    style: const TextStyle(fontSize: 24),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Перк партнёра',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              widget.partner.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.itemTitle.copyWith(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: colors.foreground,
                              ),
                            ),
                          ),
                          Icon(
                            LucideIcons.shield_check,
                            size: 16,
                            color: colors.secondary,
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(
                            LucideIcons.map_pin,
                            size: 12,
                            color: colors.inkMute,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              widget.partner.address,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.caption.copyWith(
                                color: colors.inkMute,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Tooltip(
                  message: 'Закрыть',
                  child: InkWell(
                    onTap: () => Navigator.of(context).pop(),
                    borderRadius: AppRadii.pillBorder,
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: colors.muted,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        LucideIcons.x,
                        size: 16,
                        color: colors.inkSoft,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Flexible(
            child: ListView(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 24 + bottomInset),
              shrinkWrap: true,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [colors.warmStart, colors.background],
                    ),
                    borderRadius: AppRadii.cardBorder,
                    border: Border.all(color: colors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            LucideIcons.sparkles,
                            size: 14,
                            color: colors.inkSoft,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Твой бонус',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.inkSoft,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        widget.partner.perk,
                        style: AppTextStyles.cardTitle.copyWith(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: colors.foreground,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_step == _RedeemStep.intro)
                  _buildIntro(context)
                else if (_step == _RedeemStep.form)
                  _buildForm(context)
                else
                  _buildSuccess(context),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIntro(BuildContext context) {
    final colors = AppColors.of(context);
    final items = [
      'Бронируем в приложении — стол держим до начала встречи',
      'Покажи код или экран на месте',
      'Перк действует только на участников встречи',
    ];

    return Column(
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  LucideIcons.check,
                  size: 16,
                  color: colors.secondary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    item,
                    style: AppTextStyles.meta.copyWith(
                      color: colors.inkSoft,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: AppSpacing.sm),
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: colors.muted.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Icon(LucideIcons.calendar, size: 14, color: colors.inkSoft),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      widget.eventTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const SizedBox(width: 22),
                  Expanded(
                    child: Text(
                      widget.eventTime,
                      style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _SheetActionButton(
          label: 'Забронировать с перком',
          trailingIcon: LucideIcons.arrow_right,
          onTap: () => setState(() {
            _step = _RedeemStep.form;
          }),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Бесплатная отмена за 2 часа до начала',
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(color: colors.inkMute),
        ),
      ],
    );
  }

  Widget _buildForm(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Детали брони',
          style: AppTextStyles.caption.copyWith(
            color: AppColors.of(context).inkMute,
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 10),
        _RedeemField(
          label: 'Имя для брони',
          child: TextFormField(
            initialValue: _name,
            onChanged: (value) => _name = value,
            decoration: const InputDecoration.collapsed(
              hintText: 'Как обратиться',
            ),
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        _RedeemField(
          label: 'Телефон',
          child: TextFormField(
            initialValue: _phone,
            onChanged: (value) => _phone = value,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration.collapsed(
              hintText: '+7 999 000 00 00',
            ),
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        _RedeemField(
          label: 'Гостей',
          child: Row(
            children: [
              Icon(
                LucideIcons.users,
                size: 16,
                color: AppColors.of(context).inkSoft,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  '$_people ${_people == 1 ? 'гость' : _people < 5 ? 'гостя' : 'гостей'}',
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _StepperButton(
                label: '-',
                onTap: () => setState(() {
                  if (_people > 1) {
                    _people -= 1;
                  }
                }),
              ),
              const SizedBox(width: AppSpacing.xs),
              _StepperButton(
                label: '+',
                onTap: () => setState(() {
                  if (_people < 20) {
                    _people += 1;
                  }
                }),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _SheetActionButton(
          label: 'Подтвердить бронь',
          onTap: () => setState(() {
            _step = _RedeemStep.success;
          }),
        ),
        TextButton(
          onPressed: () => setState(() {
            _step = _RedeemStep.intro;
          }),
          child: const Text('Назад'),
        ),
      ],
    );
  }

  Widget _buildSuccess(BuildContext context) {
    final colors = AppColors.of(context);

    return Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: colors.secondary.withValues(alpha: 0.2),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(
            LucideIcons.check,
            size: 28,
            color: colors.secondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Бронь подтверждена',
          textAlign: TextAlign.center,
          style: AppTextStyles.sectionTitle.copyWith(
            fontWeight: FontWeight.w600,
            color: colors.foreground,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Покажи код на входе — перк применят автоматически',
          textAlign: TextAlign.center,
          style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
        ),
        const SizedBox(height: AppSpacing.md),
        InkWell(
          onTap: () async {
            await Clipboard.setData(ClipboardData(text: _code));
            setState(() {
              _copied = true;
            });
          },
          borderRadius: BorderRadius.circular(16),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: _copied
                  ? colors.secondary.withValues(alpha: 0.1)
                  : colors.muted.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _copied ? colors.secondary : colors.border,
                style: BorderStyle.solid,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Промокод',
                  style: AppTextStyles.caption.copyWith(
                    color: colors.inkMute,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _code,
                        style: AppTextStyles.sectionTitle.copyWith(
                          fontSize: 22,
                          fontWeight: FontWeight.w600,
                          color: colors.foreground,
                        ),
                      ),
                    ),
                    Icon(
                      _copied ? LucideIcons.check : LucideIcons.copy,
                      size: 20,
                      color: _copied ? colors.secondary : colors.inkSoft,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        _SheetActionButton(
          label: 'Готово',
          onTap: () => Navigator.of(context).pop(),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Перк действует на встречу «${widget.eventTitle}»',
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(color: colors.inkMute),
        ),
      ],
    );
  }
}

class _LaunchEveningChoice {
  const _LaunchEveningChoice({
    required this.privacy,
  });

  final EveningPrivacy privacy;
}

class _LaunchEveningSheet extends StatefulWidget {
  const _LaunchEveningSheet({required this.route});

  final EveningRouteData route;

  @override
  State<_LaunchEveningSheet> createState() => _LaunchEveningSheetState();
}

class _LaunchEveningSheetState extends State<_LaunchEveningSheet> {
  EveningPrivacy _privacy = EveningPrivacy.open;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final route = widget.route;

    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.9,
        ),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: AppShadows.card,
        ),
        child: ListView(
          shrinkWrap: true,
          padding: EdgeInsets.fromLTRB(20, 10, 20, 24 + bottomInset),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [colors.primary, colors.secondary],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    LucideIcons.sparkles,
                    color: colors.primaryForeground,
                    size: 16,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Опубликовать вечер?',
                        style:
                            AppTextStyles.sectionTitle.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Соберём людей, потом запустим live',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Закрыть',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(LucideIcons.x, color: colors.inkSoft),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: colors.border),
                boxShadow: AppShadows.soft,
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [colors.warmStart, colors.warmEnd],
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      route.steps.isEmpty ? '✨' : route.steps.first.emoji,
                      style: const TextStyle(fontSize: 24),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          route.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${route.durationLabel} · ${route.area}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _TinyPill(
                    label: '${route.steps.length} шагов',
                    foreground: colors.inkMute,
                    background: colors.muted,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 116,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: route.steps.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final step = route.steps[index];
                  return Container(
                    width: 120,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              step.emoji,
                              style: const TextStyle(fontSize: 20),
                            ),
                            const Spacer(),
                            Text(
                              '${index + 1}/${route.steps.length}',
                              style: AppTextStyles.caption.copyWith(
                                color: colors.inkMute,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          step.venue,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.itemTitle.copyWith(
                            fontSize: 12,
                            height: 1.15,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          step.time,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            const _LaunchSectionTitle('Кто может вписаться'),
            const SizedBox(height: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                children: [
                  _PrivacyOptionTile(
                    icon: LucideIcons.globe,
                    title: 'Открытый',
                    text: 'Любой может вписаться одним тапом',
                    active: _privacy == EveningPrivacy.open,
                    onTap: () => setState(() => _privacy = EveningPrivacy.open),
                  ),
                  _PrivacyOptionTile(
                    icon: LucideIcons.user_check,
                    title: 'По заявке',
                    text: 'Ты подтверждаешь каждого гостя',
                    active: _privacy == EveningPrivacy.request,
                    onTap: () =>
                        setState(() => _privacy = EveningPrivacy.request),
                  ),
                  _PrivacyOptionTile(
                    icon: LucideIcons.lock,
                    title: 'По приглашениям',
                    text: 'Видят только те, кому ты отправил инвайт',
                    active: _privacy == EveningPrivacy.invite,
                    onTap: () =>
                        setState(() => _privacy = EveningPrivacy.invite),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            const _LaunchSectionTitle('Сбор участников'),
            const SizedBox(height: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.users, color: colors.inkSoft, size: 18),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Пока только ты',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.meta.copyWith(
                            color: colors.foreground,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'После публикации гости попадут сюда из preview',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Container(
                    height: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: colors.muted,
                      borderRadius: AppRadii.pillBorder,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'После публикации',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.foreground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _SheetActionButton(
              label: 'Опубликовать и собрать людей',
              trailingIcon: LucideIcons.arrow_right,
              onTap: () => Navigator.of(context).pop(
                _LaunchEveningChoice(
                  privacy: _privacy,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Изменить план',
                style: AppTextStyles.meta.copyWith(
                  color: colors.inkSoft,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              'Live-сценарий запустишь из чата вечера, когда соберётесь',
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(
                color: colors.inkMute,
                height: 1.25,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrivacyOptionTile extends StatelessWidget {
  const _PrivacyOptionTile({
    required this.icon,
    required this.title,
    required this.text,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String text;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final foreground = active ? colors.background : colors.foreground;
    final secondary =
        active ? colors.background.withValues(alpha: 0.72) : colors.inkMute;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: active ? colors.foreground : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: active
                      ? colors.background.withValues(alpha: 0.14)
                      : colors.muted,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 17, color: foreground),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTextStyles.itemTitle.copyWith(
                        fontSize: 13,
                        color: foreground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      text,
                      style: AppTextStyles.caption.copyWith(color: secondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: active ? colors.background : Colors.transparent,
                  border: Border.all(
                    color: active ? colors.background : colors.border,
                    width: 2,
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

class _LaunchSectionTitle extends StatelessWidget {
  const _LaunchSectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Text(
      label,
      style: AppTextStyles.caption.copyWith(
        color: colors.inkMute,
        letterSpacing: 1,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _StickyPlanCta extends StatelessWidget {
  const _StickyPlanCta({
    required this.totalTickets,
    required this.totalSavings,
    required this.onTap,
  });

  final int totalTickets;
  final int totalSavings;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 32 + bottomInset),
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  totalTickets > 0
                      ? 'Билеты от $totalTickets ₽ внутри'
                      : 'Бесплатный вход',
                  style: AppTextStyles.meta.copyWith(color: colors.inkMute),
                ),
              ),
              Icon(LucideIcons.sparkles, size: 12, color: colors.secondary),
              const SizedBox(width: 4),
              Text(
                'экономия −$totalSavings ₽',
                style: AppTextStyles.meta.copyWith(
                  color: colors.secondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          _SheetActionButton(
            label: 'Поехали по маршруту',
            trailingIcon: LucideIcons.arrow_right,
            onTap: onTap,
          ),
        ],
      ),
    );
  }
}

class _LockedOverlay extends StatelessWidget {
  const _LockedOverlay({required this.onUnlock});

  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.warmStart, colors.background],
        ),
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: colors.foreground.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(LucideIcons.lock, size: 24, color: colors.foreground),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Премиум-маршрут Frendly+',
            style: AppTextStyles.cardTitle.copyWith(
              fontWeight: FontWeight.w600,
              color: colors.foreground,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Лучшие маршруты, приоритетная бронь и закрытые места доступны подписчикам Frendly+',
            textAlign: TextAlign.center,
            style: AppTextStyles.meta.copyWith(
              color: colors.inkSoft,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _SheetActionButton(
            icon: LucideIcons.crown,
            label: 'Открыть Frendly+',
            onTap: onUnlock,
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.check, size: 12, color: colors.secondary),
              const SizedBox(width: 4),
              Text(
                'Первая неделя бесплатно',
                style: AppTextStyles.caption.copyWith(color: colors.inkMute),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SheetActionButton extends StatelessWidget {
  const _SheetActionButton({
    required this.label,
    this.icon,
    this.trailingIcon,
    this.done = false,
    this.secondary = false,
    this.onTap,
  });

  final String label;
  final IconData? icon;
  final IconData? trailingIcon;
  final bool done;
  final bool secondary;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final background = done
        ? colors.secondary.withValues(alpha: 0.15)
        : secondary
            ? colors.card
            : colors.foreground;
    final foreground = done
        ? colors.secondary
        : secondary
            ? colors.foreground
            : colors.background;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        height: 48,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: done
                ? colors.secondary.withValues(alpha: 0.4)
                : secondary
                    ? colors.border
                    : colors.foreground,
          ),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 16, color: foreground),
              const SizedBox(width: AppSpacing.xs),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.button.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: foreground,
                ),
              ),
            ),
            if (trailingIcon != null) ...[
              const SizedBox(width: AppSpacing.xs),
              Icon(trailingIcon, size: 16, color: foreground),
            ],
          ],
        ),
      ),
    );
  }
}

class _RedeemField extends StatelessWidget {
  const _RedeemField({
    required this.label,
    required this.child,
  });

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: colors.inkMute,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.pillBorder,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: colors.muted,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.body.copyWith(
            fontWeight: FontWeight.w700,
            color: colors.foreground,
          ),
        ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.icon,
    required this.label,
    this.accent = false,
    this.highlight = false,
  });

  final IconData icon;
  final String label;
  final bool accent;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final background = highlight
        ? colors.secondary.withValues(alpha: 0.15)
        : accent
            ? colors.foreground
            : colors.muted;
    final foreground = highlight
        ? colors.secondary
        : accent
            ? colors.background
            : colors.foreground;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontWeight: FontWeight.w700,
              color: foreground,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({
    required this.label,
    this.icon,
  });

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: colors.foreground),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontWeight: FontWeight.w700,
              color: colors.foreground,
            ),
          ),
        ],
      ),
    );
  }
}

class _TinyPill extends StatelessWidget {
  const _TinyPill({
    required this.label,
    required this.foreground,
    required this.background,
  });

  final String label;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.caption.copyWith(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: foreground,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _HeroLabel extends StatelessWidget {
  const _HeroLabel({
    required this.icon,
    required this.label,
    required this.foreground,
    required this.background,
  });

  final IconData icon;
  final String label;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: foreground),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: foreground,
              letterSpacing: 0,
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    required this.background,
    this.iconSize = 20,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final Color background;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: background,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: iconSize, color: colors.foreground),
        ),
      ),
    );
  }
}

enum _ActionState { available, donePerk, doneTicket }

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.state});

  final _ActionState state;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final done = state != _ActionState.available;
    final label = switch (state) {
      _ActionState.available => 'Доступно',
      _ActionState.donePerk => 'Использовано',
      _ActionState.doneTicket => 'Куплено',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: done ? colors.secondary.withValues(alpha: 0.15) : colors.muted,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: done ? colors.secondary : colors.inkMute,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

enum _DetailStatusKind { perk, ticket }

class _DetailStatusChip extends StatelessWidget {
  const _DetailStatusChip({
    required this.used,
    required this.kind,
  });

  final bool used;
  final _DetailStatusKind kind;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final label = used
        ? kind == _DetailStatusKind.perk
            ? 'Использован'
            : 'Куплено'
        : 'Доступно';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: used ? colors.secondary.withValues(alpha: 0.15) : colors.muted,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (used) ...[
            Icon(LucideIcons.circle_check, size: 12, color: colors.secondary),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: used ? colors.secondary : colors.inkMute,
              letterSpacing: 0,
            ),
          ),
        ],
      ),
    );
  }
}

class _PerkPartner {
  const _PerkPartner({
    required this.id,
    required this.name,
    required this.emoji,
    required this.address,
    required this.perk,
  });

  factory _PerkPartner.fromStep(EveningRouteStep step) {
    return _PerkPartner(
      id: step.partnerId ?? step.id,
      name: step.venue,
      emoji: step.emoji,
      address: '${step.address} · ${step.distance}',
      perk: step.perk ?? 'Бонус для участников маршрута',
    );
  }

  final String id;
  final String name;
  final String emoji;
  final String address;
  final String perk;
}

enum _RedeemStep { intro, form, success }
