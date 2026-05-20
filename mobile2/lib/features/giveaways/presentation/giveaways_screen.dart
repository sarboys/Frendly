import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class GiveawaysScreen extends ConsumerStatefulWidget {
  const GiveawaysScreen({super.key});

  @override
  ConsumerState<GiveawaysScreen> createState() => _GiveawaysScreenState();
}

class _GiveawaysScreenState extends ConsumerState<GiveawaysScreen> {
  bool _actionBusy = false;

  @override
  Widget build(BuildContext context) {
    final homeState = ref.watch(dropsHomeProvider);
    return DateasyPhoneFrame(
      child: homeState.when(
        loading: () => const _GiveawaysShell(
          child: _CenteredState(
            icon: LucideIcons.loaderCircle,
            title: 'Загружаем Drops',
            message: 'Проверяем билеты и задания месяца.',
          ),
        ),
        error: (error, _) => _GiveawaysShell(
          child: _CenteredState(
            icon: LucideIcons.circleAlert,
            title: 'Не удалось загрузить Drops',
            message: error.toString(),
            actionLabel: 'Повторить',
            onAction: () => ref.invalidate(dropsHomeProvider),
          ),
        ),
        data: _buildHome,
      ),
    );
  }

  Widget _buildHome(DropsHomeData home) {
    final drops = _mapDrops(home);
    final tasks = _mapTasks(home.tasks);
    final history = _mapHistory(home.history);
    final winners = _mapWinners(home.pastWinners);
    final progress = home.ticketProgress;

    if (drops.isEmpty) {
      return const _GiveawaysShell(
        child: _CenteredState(
          icon: LucideIcons.gift,
          title: 'Пока нет активных Drops',
          message: 'Когда появится новый розыгрыш, он будет здесь.',
        ),
      );
    }

    final featuredDrop = drops.firstWhere(
        (drop) => drop.id == home.mainDrop?.id,
        orElse: () => drops.first);
    final visibleDrops =
        drops.where((drop) => drop.id != featuredDrop.id).toList();

    return _GiveawaysShell(
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.paddingOf(context).top + 16,
          bottom: 144,
        ),
        children: [
          _Header(totalTickets: progress.earned),
          _HeroIntro(dropCount: drops.length),
          _FeaturedDrop(
            drop: featuredDrop,
            maxTicketsPerMonth: progress.max,
            availableTickets: progress.availableTickets,
            onTasks: () => _showTasksSheet(
              context,
              tasks: tasks,
              maxTicketsPerMonth: progress.max,
              onClaim: _claimTask,
            ),
            onApply: () => _showApplyTicketsSheet(
              context,
              drop: featuredDrop,
              availableTickets: progress.availableTickets,
            ),
          ),
          _DropsSection(
            drops: visibleDrops,
            availableTickets: progress.availableTickets,
            onTasks: () => _showTasksSheet(
              context,
              tasks: tasks,
              maxTicketsPerMonth: progress.max,
              onClaim: _claimTask,
            ),
            onApply: (drop) => _showApplyTicketsSheet(
              context,
              drop: drop,
              availableTickets: progress.availableTickets,
            ),
          ),
          _TasksSection(
            tasks: tasks,
            progress: progress,
            onClaim: _claimTask,
          ),
          _HistorySection(history: history),
          _PastWinnersSection(winners: winners),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Text(
              'Frendly Drops, программа лояльности компании Frendly. Участие бесплатное, билеты начисляются за активность. Призы вручаются победителю после подтверждения личности. Организатор вправе заменить приз на аналогичный по стоимости. Полные правила доступны в разделе «Документы».',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 10,
                    height: 1.45,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _claimTask(_GiveawayTask task) async {
    if (!task.canClaim || _actionBusy) {
      return;
    }
    if (task.action == null && task.route != null) {
      context.go(task.route!);
      return;
    }

    setState(() => _actionBusy = true);
    try {
      final actions = ref.read(dropsActionsProvider);
      if (task.action == 'claim_daily_login') {
        await actions.claimDailyLogin();
      } else if (task.action == 'claim_verification') {
        await actions.claimVerification();
      } else if (task.action == 'create_referral_link') {
        await actions.createReferralLink();
        if (task.route != null && mounted) {
          context.go(task.route!);
        }
      } else if (task.route != null && mounted) {
        context.go(task.route!);
      }
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${task.title}: запрос отправлен'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _actionBusy = false);
      }
    }
  }

  Future<void> _showApplyTicketsSheet(
    BuildContext context, {
    required _GiveawayDrop drop,
    required int availableTickets,
  }) async {
    final maxCount = math.min(availableTickets, drop.remainingTickets);
    if (maxCount < 1 || !drop.eligible) {
      return;
    }
    var count = 1;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return _ApplyTicketsSheet(
              drop: drop,
              count: count,
              maxCount: maxCount,
              onIncrement: () {
                if (count < maxCount) {
                  setSheetState(() => count += 1);
                }
              },
              onDecrement: () {
                if (count > 1) {
                  setSheetState(() => count -= 1);
                }
              },
              onApply: () async {
                if (_actionBusy) {
                  return;
                }
                final navigator = Navigator.of(sheetContext);
                final messenger = ScaffoldMessenger.of(context);
                setState(() => _actionBusy = true);
                try {
                  await ref.read(dropsActionsProvider).applyTickets(
                        drop.id,
                        count,
                      );
                  if (!mounted) {
                    return;
                  }
                  navigator.pop();
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text('Применили билетов: $count'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                } on BackendActionException catch (error) {
                  if (!mounted) {
                    return;
                  }
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(error.message),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                } finally {
                  if (mounted) {
                    setState(() => _actionBusy = false);
                  }
                }
              },
            );
          },
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.totalTickets});

  final int totalTickets;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            semanticLabel: 'Назад',
            onTap: () => context.go('/'),
          ),
          Expanded(
            child: Text(
              'Frendly Drops',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          _GlassPanel(
            borderRadius: 16,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: SizedBox(
              height: 44,
              child: Row(
                children: [
                  const Icon(
                    LucideIcons.ticket,
                    color: DateasyColors.lime,
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$totalTickets',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
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

class _GiveawaysShell extends StatelessWidget {
  const _GiveawaysShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        const DateasyBottomNav(),
      ],
    );
  }
}

class _CenteredState extends StatelessWidget {
  const _CenteredState({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: _GlassPanel(
          borderRadius: 24,
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: DateasyColors.lime, size: 32),
              const SizedBox(height: 12),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      height: 1.35,
                    ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: 14),
                _SmallActionButton(
                  label: actionLabel!,
                  lime: true,
                  onTap: onAction!,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroIntro extends StatelessWidget {
  const _HeroIntro({required this.dropCount});

  final int dropCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: _GradientFrame(
        borderRadius: 28,
        child: Stack(
          children: [
            const Positioned.fill(
              child: DecoratedBox(
                  decoration: BoxDecoration(gradient: dateasyHeroGradient)),
            ),
            const Positioned(
              top: -80,
              right: -64,
              child: _BlurBlob(
                size: 224,
                colors: [DateasyColors.lime, DateasyColors.lime2],
                opacity: 0.4,
                sigma: 48,
              ),
            ),
            const Positioned(
              left: -64,
              bottom: -96,
              child: _BlurBlob(
                size: 224,
                colors: [DateasyColors.lilac, DateasyColors.pink],
                opacity: 0.3,
                sigma: 48,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _GlassChip(
                    icon: LucideIcons.gift,
                    label: 'сезон · июнь',
                    iconColor: DateasyColors.lime,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Подарки для активных пользователей',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontSize: 26,
                          height: 1.08,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 6),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 300),
                    child: Text(
                      'Каждый месяц мы дарим призы тем, кто живёт в Frendly: ходит на встречи, приглашает друзей и держит профиль настоящим.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.muted,
                            height: 1.35,
                          ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _MiniStat(
                          label: 'Дропов',
                          value: '$dropCount',
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: _MiniStat(
                          label: 'Билеты',
                          value: 'за дела',
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: _MiniStat(label: 'Участие', value: 'бесплатно'),
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

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Column(
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontFamily: 'Sora',
                  fontSize: 16,
                  height: 1,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 5),
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 10,
                  height: 1.1,
                  letterSpacing: 1.2,
                ),
          ),
        ],
      ),
    );
  }
}

class _FeaturedDrop extends StatelessWidget {
  const _FeaturedDrop({
    required this.drop,
    required this.maxTicketsPerMonth,
    required this.availableTickets,
    required this.onTasks,
    required this.onApply,
  });

  final _GiveawayDrop drop;
  final int maxTicketsPerMonth;
  final int availableTickets;
  final VoidCallback onTasks;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final eligible = drop.eligible;
    final canApply =
        eligible && availableTickets > 0 && drop.remainingTickets > 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            gradient: dateasyLimeGradient,
            boxShadow: const [
              BoxShadow(
                color: Color(0x66BEFF67),
                blurRadius: 60,
                spreadRadius: -20,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: Stack(
            children: [
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.transparent,
                        Color(0xB3000000),
                      ],
                    ),
                  ),
                ),
              ),
              const Positioned(
                top: -96,
                left: 70,
                right: 70,
                child: _BlurBlob(
                  size: 320,
                  colors: [Colors.white, Colors.white],
                  opacity: 0.3,
                  sigma: 48,
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: _DarkChip(
                            icon: LucideIcons.gift,
                            label: drop.badge,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          LucideIcons.clock,
                          color: DateasyColors.backgroundDeep
                              .withValues(alpha: 0.9),
                          size: 12,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            'до розыгрыша ${drop.daysLeft} дней',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.right,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.backgroundDeep
                                          .withValues(alpha: 0.9),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 128,
                      width: double.infinity,
                      child: CustomPaint(
                        painter: _PhonesStackPainter(
                          color: DateasyColors.backgroundDeep
                              .withValues(alpha: 0.95),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      drop.title,
                      style:
                          Theme.of(context).textTheme.headlineMedium?.copyWith(
                                color: DateasyColors.backgroundDeep,
                                fontSize: 22,
                                height: 1.1,
                                fontWeight: FontWeight.w600,
                              ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${drop.subtitle} · ${drop.prize}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.backgroundDeep
                                .withValues(alpha: 0.78),
                            fontSize: 12,
                          ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _LimeMeta(
                            icon: LucideIcons.users,
                            label: '${_formatRu(drop.participants)} участников',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _LimeMeta(
                            icon: LucideIcons.clock,
                            label: drop.drawDate,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 292, 16, 16),
                child: Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                        child: Container(
                          decoration: BoxDecoration(
                            color: DateasyColors.background
                                .withValues(alpha: 0.85),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.1)),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Твои билеты',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: DateasyColors.muted,
                                            fontSize: 11,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(
                                          LucideIcons.ticket,
                                          color: DateasyColors.lime,
                                          size: 16,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '${drop.myTickets}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleLarge
                                              ?.copyWith(
                                                fontFamily: 'Manrope',
                                                fontSize: 18,
                                                height: 1,
                                                fontWeight: FontWeight.w800,
                                              ),
                                        ),
                                        const SizedBox(width: 6),
                                        Flexible(
                                          child: Text(
                                            '/ $maxTicketsPerMonth макс',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(
                                                  color: DateasyColors.muted,
                                                  fontWeight: FontWeight.w500,
                                                ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (!eligible) ...[
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          const Icon(
                                            LucideIcons.lock,
                                            color: DateasyColors.pink,
                                            size: 12,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            drop.eligibilityLabel,
                                            style: const TextStyle(
                                              color: DateasyColors.pink,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: 10),
                              _TasksButton(
                                label: canApply
                                    ? 'Применить билеты'
                                    : 'Получить билеты',
                                onTap: canApply ? onApply : onTasks,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(
                          LucideIcons.shield,
                          color: Colors.white.withValues(alpha: 0.8),
                          size: 12,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            drop.rulesLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.8),
                                  fontSize: 10,
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
    );
  }
}

class _DropsSection extends StatelessWidget {
  const _DropsSection({
    required this.drops,
    required this.availableTickets,
    required this.onTasks,
    required this.onApply,
  });

  final List<_GiveawayDrop> drops;
  final int availableTickets;
  final VoidCallback onTasks;
  final ValueChanged<_GiveawayDrop> onApply;

  @override
  Widget build(BuildContext context) {
    if (drops.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  'Активные дропы',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              Row(
                children: [
                  const Icon(
                    LucideIcons.info,
                    color: DateasyColors.muted,
                    size: 12,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'прозрачный seed',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (var index = 0; index < drops.length; index++) ...[
            _DropCard(
              drop: drops[index],
              availableTickets: availableTickets,
              onTasks: onTasks,
              onApply: () => onApply(drops[index]),
            ),
            if (index != drops.length - 1) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _DropCard extends StatelessWidget {
  const _DropCard({
    required this.drop,
    required this.availableTickets,
    required this.onTasks,
    required this.onApply,
  });

  final _GiveawayDrop drop;
  final int availableTickets;
  final VoidCallback onTasks;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final accent = _accentStyle(drop.accent);
    final eligible = drop.eligible;
    final canApply =
        eligible && availableTickets > 0 && drop.remainingTickets > 0;

    return _GlassPanel(
      borderRadius: 24,
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: accent.solidColor,
                    gradient: accent.gradient,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Stack(
                    children: [
                      const Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.all(Radius.circular(16)),
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x4DFFFFFF), Color(0x00FFFFFF)],
                            ),
                          ),
                        ),
                      ),
                      Center(
                        child: Icon(
                          drop.icon,
                          color: accent.foreground,
                          size: 36,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                _AccentBadge(
                                  label: drop.badge,
                                  color: accent.badgeColor,
                                  textColor: accent.badgeText,
                                ),
                                if (drop.plusOnly) const _PlusBadge(),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(
                            LucideIcons.clock,
                            color: DateasyColors.muted,
                            size: 12,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              drop.drawDate,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.right,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: DateasyColors.muted,
                                    fontSize: 10,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        drop.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                              height: 1.2,
                            ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        drop.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 11,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                const Icon(
                                  LucideIcons.users,
                                  color: DateasyColors.muted,
                                  size: 12,
                                ),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    _formatRu(drop.participants),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: DateasyColors.muted,
                                          fontSize: 11,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Row(
                            children: [
                              const Icon(
                                LucideIcons.ticket,
                                color: DateasyColors.lime,
                                size: 12,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'твоих: ${drop.myTickets}',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: DateasyColors.lime,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                if (!eligible)
                  Expanded(
                    child: Row(
                      children: [
                        const Icon(
                          LucideIcons.lock,
                          color: DateasyColors.muted,
                          size: 12,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            drop.plusOnly
                                ? 'Только Frendly+'
                                : drop.eligibilityLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.muted,
                                      fontSize: 11,
                                    ),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  const Spacer(),
                _TasksButton(
                  label: canApply ? 'Применить билеты' : 'Получить билеты',
                  onTap: canApply ? onApply : onTasks,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TasksSection extends StatelessWidget {
  const _TasksSection({
    required this.tasks,
    required this.progress,
    required this.onClaim,
  });

  final List<_GiveawayTask> tasks;
  final DropTicketProgressData progress;
  final ValueChanged<_GiveawayTask> onClaim;

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionTitle(
                      icon: LucideIcons.listChecks,
                      title: 'Задания месяца',
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Получено ${progress.earned} из ${progress.max} билетов · обнуляется ${_formatResetDate(progress.nextResetAt)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                            fontSize: 11,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _GlassPanel(
            borderRadius: 24,
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var index = 0; index < tasks.length; index++) ...[
                  _TaskRow(
                    task: tasks[index],
                    onClaim: () => onClaim(tasks[index]),
                  ),
                  if (index != tasks.length - 1) const _ThinDivider(),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Максимум ${progress.max} билетов на пользователя в месяц. Билеты нельзя купить, их получают только за реальную активность.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 10,
                  height: 1.3,
                ),
          ),
        ],
      ),
    );
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({
    required this.task,
    required this.onClaim,
  });

  final _GiveawayTask task;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final done = task.status == 'completed';
    final pending = task.status == 'pending';
    final disabled = task.status == 'limited' ||
        task.status == 'locked' ||
        task.status == 'not_eligible' ||
        pending;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: done
                  ? DateasyColors.lime.withValues(alpha: 0.18)
                  : DateasyColors.surface2,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              done ? LucideIcons.check : task.icon,
              color: done ? DateasyColors.lime : DateasyColors.foreground,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  '+${task.reward} ${task.reward > 1 ? 'билета' : 'билет'}${task.cap == null ? '' : ' · ${task.cap}'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          if (done)
            const Row(
              children: [
                Icon(
                  LucideIcons.check,
                  color: DateasyColors.lime,
                  size: 14,
                ),
                SizedBox(width: 4),
                Text(
                  'готово',
                  style: TextStyle(
                    color: DateasyColors.lime,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            )
          else if (pending)
            const Text(
              'ожидает',
              style: TextStyle(
                color: DateasyColors.muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            )
          else if (disabled)
            Text(
              task.statusLabel,
              style: const TextStyle(
                color: DateasyColors.muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            )
          else if (task.route != null)
            _SmallActionButton(
              label: task.cta,
              onTap: () => onClaim(),
            )
          else
            _SmallActionButton(
              label: task.cta,
              lime: true,
              onTap: onClaim,
            ),
        ],
      ),
    );
  }
}

class _HistorySection extends StatelessWidget {
  const _HistorySection({required this.history});

  final List<_TicketHistory> history;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            icon: LucideIcons.history,
            title: 'История билетов',
          ),
          const SizedBox(height: 12),
          _GlassPanel(
            borderRadius: 24,
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                if (history.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Пока нет начислений',
                      style: TextStyle(
                        color: DateasyColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  )
                else
                  for (var index = 0; index < history.length; index++) ...[
                    _HistoryRow(item: history[index]),
                    if (index != history.length - 1) const _ThinDivider(),
                  ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.item});

  final _TicketHistory item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.date,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          Text(
            item.delta > 0 ? '+${item.delta}' : '${item.delta}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color:
                      item.delta > 0 ? DateasyColors.lime : DateasyColors.muted,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}

class _PastWinnersSection extends StatelessWidget {
  const _PastWinnersSection({required this.winners});

  final List<_PastWinner> winners;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            icon: LucideIcons.trophy,
            title: 'Победители прошлого Drop',
          ),
          const SizedBox(height: 12),
          _GlassPanel(
            borderRadius: 24,
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                if (winners.isEmpty)
                  const Text(
                    'Победители появятся после первого розыгрыша',
                    style: TextStyle(
                      color: DateasyColors.muted,
                      fontSize: 12,
                    ),
                  )
                else
                  for (var index = 0; index < winners.length; index++) ...[
                    _WinnerRow(index: index, winner: winners[index]),
                    if (index != winners.length - 1) const SizedBox(height: 12),
                  ],
                const SizedBox(height: 12),
                const _ThinDivider(),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Розыгрыш по seed-хэшу · публичная запись',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 11,
                            ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Смотреть',
                      style: TextStyle(
                        color: DateasyColors.lime,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      LucideIcons.chevronRight,
                      color: DateasyColors.lime,
                      size: 12,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WinnerRow extends StatelessWidget {
  const _WinnerRow({
    required this.index,
    required this.winner,
  });

  final int index;
  final _PastWinner winner;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: dateasyLimeGradient,
          ),
          child: Text(
            '${index + 1}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.backgroundDeep,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${winner.name}, ${winner.city}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 3),
              Text(
                '${winner.prize} · билет #${winner.ticket}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 11,
                    ),
              ),
            ],
          ),
        ),
        const Icon(
          LucideIcons.check,
          color: DateasyColors.lime,
          size: 16,
        ),
      ],
    );
  }
}

class _TasksButton extends StatelessWidget {
  const _TasksButton({
    required this.onTap,
    this.label = 'Получить билеты',
  });

  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        constraints: const BoxConstraints(maxWidth: 160),
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.all(Radius.circular(12)),
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
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.ticket,
              color: DateasyColors.backgroundDeep,
              size: 16,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlusBadge extends StatelessWidget {
  const _PlusBadge();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          LucideIcons.crown,
          color: DateasyColors.pink,
          size: 12,
        ),
        SizedBox(width: 3),
        Text(
          'Plus',
          style: TextStyle(
            color: DateasyColors.pink,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _SmallActionButton extends StatelessWidget {
  const _SmallActionButton({
    required this.label,
    required this.onTap,
    this.lime = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool lime;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: lime ? null : DateasyColors.surface2,
          gradient: lime ? dateasyLimeGradient : null,
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: lime
                    ? DateasyColors.backgroundDeep
                    : DateasyColors.foreground,
                fontSize: 12,
                fontWeight: lime ? FontWeight.w800 : FontWeight.w700,
              ),
        ),
      ),
    );
  }
}

void _showTasksSheet(
  BuildContext context, {
  required List<_GiveawayTask> tasks,
  required int maxTicketsPerMonth,
  required ValueChanged<_GiveawayTask> onClaim,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _TasksSheet(
      tasks: tasks,
      maxTicketsPerMonth: maxTicketsPerMonth,
      onClaim: onClaim,
    ),
  );
}

class _TasksSheet extends StatelessWidget {
  const _TasksSheet({
    required this.tasks,
    required this.maxTicketsPerMonth,
    required this.onClaim,
  });

  final List<_GiveawayTask> tasks;
  final int maxTicketsPerMonth;
  final ValueChanged<_GiveawayTask> onClaim;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: DecoratedBox(
        decoration: const BoxDecoration(color: DateasyColors.background),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.paddingOf(context).bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle(
                icon: LucideIcons.listChecks,
                title: 'Как получить больше билетов',
                titleSize: 20,
              ),
              const SizedBox(height: 12),
              Text(
                'Билеты нельзя купить. Их получают за реальную активность в Frendly.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                    ),
              ),
              const SizedBox(height: 16),
              _GlassPanel(
                borderRadius: 16,
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (var index = 0; index < tasks.length; index++) ...[
                      _SheetTaskRow(
                        task: tasks[index],
                        onTap: () => onClaim(tasks[index]),
                      ),
                      if (index != tasks.length - 1) const _ThinDivider(),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
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
                  child: const Text(
                    'Понятно',
                    style: TextStyle(
                      color: DateasyColors.backgroundDeep,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  'Максимум $maxTicketsPerMonth билетов в месяц. Полные правила, в разделе «Документы».',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 10,
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

class _SheetTaskRow extends StatelessWidget {
  const _SheetTaskRow({
    required this.task,
    required this.onTap,
  });

  final _GiveawayTask task;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: task.status == 'completed'
                  ? DateasyColors.lime.withValues(alpha: 0.18)
                  : DateasyColors.surface2,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              task.icon,
              color: task.status == 'completed'
                  ? DateasyColors.lime
                  : DateasyColors.foreground,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (task.cap != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    task.cap!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 10,
                        ),
                  ),
                ],
              ],
            ),
          ),
          Text(
            '+${task.reward}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.lime,
                  fontWeight: FontWeight.w800,
                ),
          ),
          if (task.canClaim) ...[
            const SizedBox(width: 10),
            _SmallActionButton(
              label: task.cta,
              onTap: onTap,
              lime: task.action != null,
            ),
          ],
        ],
      ),
    );
  }
}

class _ApplyTicketsSheet extends StatelessWidget {
  const _ApplyTicketsSheet({
    required this.drop,
    required this.count,
    required this.maxCount,
    required this.onIncrement,
    required this.onDecrement,
    required this.onApply,
  });

  final _GiveawayDrop drop;
  final int count;
  final int maxCount;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: DecoratedBox(
        decoration: const BoxDecoration(color: DateasyColors.background),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.paddingOf(context).bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle(
                icon: LucideIcons.ticket,
                title: 'Применить билеты',
                titleSize: 20,
              ),
              const SizedBox(height: 12),
              Text(
                drop.title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                'Свободные билеты попадут только в этот Drop. Доступно сейчас: $maxCount.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                    ),
              ),
              const SizedBox(height: 18),
              _GlassPanel(
                borderRadius: 18,
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    _StepperButton(
                      icon: LucideIcons.minus,
                      onTap: count > 1 ? onDecrement : null,
                    ),
                    Expanded(
                      child: Text(
                        '$count',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              fontFamily: 'Sora',
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                    _StepperButton(
                      icon: LucideIcons.plus,
                      onTap: count < maxCount ? onIncrement : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: onApply,
                child: Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
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
                  child: Text(
                    'Применить $count',
                    style: const TextStyle(
                      color: DateasyColors.backgroundDeep,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
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

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.45 : 1,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: DateasyColors.surface2,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, size: 18),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.title,
    this.titleSize = 18,
  });

  final IconData icon;
  final String title;
  final double titleSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: DateasyColors.lime, size: 20),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: titleSize,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
      ],
    );
  }
}

class _LimeMeta extends StatelessWidget {
  const _LimeMeta({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon,
            size: 14,
            color: DateasyColors.backgroundDeep.withValues(alpha: 0.9)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.backgroundDeep.withValues(alpha: 0.9),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ),
      ],
    );
  }
}

class _DarkChip extends StatelessWidget {
  const _DarkChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(999),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 12),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                height: 1.1,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassChip extends StatelessWidget {
  const _GlassChip({
    required this.icon,
    required this.label,
    required this.iconColor,
  });

  final IconData icon;
  final String label;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: DateasyColors.surface.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: iconColor),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: DateasyColors.foreground,
                  fontSize: 10,
                  height: 1.1,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccentBadge extends StatelessWidget {
  const _AccentBadge({
    required this.label,
    required this.color,
    required this.textColor,
  });

  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(6),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          height: 1.1,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
    required this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      button: true,
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: GestureDetector(
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 20),
          ),
        ),
      ),
    );
  }
}

class _GradientFrame extends StatelessWidget {
  const _GradientFrame({
    required this.child,
    required this.borderRadius,
  });

  final Widget child;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(borderRadius),
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
        child: child,
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
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: DateasyColors.surface.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

class _BlurBlob extends StatelessWidget {
  const _BlurBlob({
    required this.size,
    required this.colors,
    required this.opacity,
    required this.sigma,
  });

  final double size;
  final List<Color> colors;
  final double opacity;
  final double sigma;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: opacity,
        child: ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: colors),
            ),
          ),
        ),
      ),
    );
  }
}

class _ThinDivider extends StatelessWidget {
  const _ThinDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      color: Colors.white.withValues(alpha: 0.05),
    );
  }
}

class _PhonesStackPainter extends CustomPainter {
  const _PhonesStackPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / 240, size.height / 120);
    final dx = (size.width - 240 * scale) / 2;
    final dy = (size.height - 120 * scale) / 2;
    canvas.save();
    canvas.translate(dx, dy);
    canvas.scale(scale);
    for (final phone in _phones) {
      _drawPhone(canvas, phone.$1, phone.$2);
    }
    canvas.restore();
  }

  void _drawPhone(Canvas canvas, double x, double rotation) {
    canvas.save();
    canvas.translate(x, 14);
    canvas.rotate(rotation * math.pi / 180);
    final bodyPaint = Paint()..color = color;
    final blackPaint = Paint()..color = Colors.black.withValues(alpha: 0.85);
    final glassPaint = Paint()..color = Colors.white.withValues(alpha: 0.08);
    final notchPaint = Paint()..color = Colors.white.withValues(alpha: 0.2);
    final barPaint = Paint()..color = Colors.white.withValues(alpha: 0.3);

    canvas.drawRRect(
      RRect.fromRectAndRadius(
          const Rect.fromLTWH(0, 0, 40, 92), const Radius.circular(10)),
      bodyPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          const Rect.fromLTWH(3, 3, 34, 86), const Radius.circular(7)),
      blackPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          const Rect.fromLTWH(14, 6, 12, 3), const Radius.circular(1.5)),
      notchPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          const Rect.fromLTWH(6, 14, 28, 60), const Radius.circular(4)),
      glassPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          const Rect.fromLTWH(11, 80, 18, 2), const Radius.circular(1)),
      barPaint,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _PhonesStackPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

const _phones = [
  (30.0, -12.0),
  (100.0, 0.0),
  (170.0, 12.0),
];

class _GiveawayDrop {
  const _GiveawayDrop({
    required this.id,
    required this.type,
    required this.badge,
    required this.title,
    required this.subtitle,
    required this.prize,
    required this.drawDate,
    required this.daysLeft,
    required this.participants,
    required this.myTickets,
    required this.accent,
    required this.icon,
    required this.requiresVerified,
    required this.eligible,
    required this.eligibilityLabel,
    required this.rulesLabel,
    this.maxTicketsPerUser,
    this.plusOnly = false,
  });

  final String id;
  final String type;
  final String badge;
  final String title;
  final String subtitle;
  final String prize;
  final String drawDate;
  final int daysLeft;
  final int participants;
  final int myTickets;
  final _DropAccent accent;
  final IconData icon;
  final bool requiresVerified;
  final bool eligible;
  final String eligibilityLabel;
  final String rulesLabel;
  final int? maxTicketsPerUser;
  final bool plusOnly;

  int get remainingTickets {
    final max = maxTicketsPerUser;
    if (max == null) {
      return 999;
    }
    return math.max(0, max - myTickets);
  }
}

class _GiveawayTask {
  const _GiveawayTask({
    required this.id,
    required this.title,
    required this.reward,
    required this.status,
    required this.icon,
    required this.cta,
    this.cap,
    this.route,
    this.action,
  });

  final String id;
  final String title;
  final int reward;
  final String? cap;
  final String status;
  final IconData icon;
  final String cta;
  final String? route;
  final String? action;

  bool get canClaim {
    return status == 'available' && (action != null || route != null);
  }

  String get statusLabel {
    return switch (status) {
      'limited' => 'лимит',
      'locked' => 'закрыто',
      'not_eligible' => 'нельзя',
      _ => 'готово',
    };
  }
}

class _TicketHistory {
  const _TicketHistory({
    required this.label,
    required this.delta,
    required this.date,
  });

  final String label;
  final int delta;
  final String date;
}

class _PastWinner {
  const _PastWinner({
    required this.name,
    required this.city,
    required this.prize,
    required this.ticket,
  });

  final String name;
  final String city;
  final String prize;
  final String ticket;
}

enum _DropAccent { lime, pink, lilac }

class _AccentStyle {
  const _AccentStyle({
    required this.foreground,
    required this.badgeColor,
    required this.badgeText,
    this.gradient,
    this.solidColor,
  });

  final Color foreground;
  final Color badgeColor;
  final Color badgeText;
  final Gradient? gradient;
  final Color? solidColor;
}

_AccentStyle _accentStyle(_DropAccent accent) {
  return switch (accent) {
    _DropAccent.pink => _AccentStyle(
        gradient: dateasyPinkGradient,
        foreground: DateasyColors.foreground,
        badgeColor: DateasyColors.pink.withValues(alpha: 0.2),
        badgeText: DateasyColors.pink,
      ),
    _DropAccent.lilac => _AccentStyle(
        solidColor: DateasyColors.lilac,
        foreground: DateasyColors.backgroundDeep,
        badgeColor: DateasyColors.lilac.withValues(alpha: 0.3),
        badgeText: DateasyColors.lilac,
      ),
    _DropAccent.lime => _AccentStyle(
        gradient: dateasyLimeGradient,
        foreground: DateasyColors.backgroundDeep,
        badgeColor: DateasyColors.lime.withValues(alpha: 0.2),
        badgeText: DateasyColors.lime,
      ),
  };
}

String _formatRu(int value) {
  final text = value.toString();
  final buffer = StringBuffer();
  for (var index = 0; index < text.length; index++) {
    final fromEnd = text.length - index;
    buffer.write(text[index]);
    if (fromEnd > 1 && fromEnd % 3 == 1) {
      buffer.write(' ');
    }
  }
  return buffer.toString();
}

List<_GiveawayDrop> _mapDrops(DropsHomeData home) {
  return home.drops.map((drop) {
    final type = _dropTypeMeta(drop.type);
    final prize = drop.prizeSummary.isEmpty ? 'Призы' : drop.prizeSummary;
    return _GiveawayDrop(
      id: drop.id,
      type: drop.type,
      badge: type.label,
      title: drop.title,
      subtitle: drop.description,
      prize: prize,
      drawDate:
          drop.drawDate.isEmpty ? _formatResetDate(drop.drawAt) : drop.drawDate,
      daysLeft: drop.daysLeft,
      participants: drop.participantCount,
      myTickets: drop.myTickets,
      accent: type.accent,
      icon: type.icon,
      requiresVerified: drop.requiresVerified,
      eligible: drop.eligibility.canParticipate,
      eligibilityLabel: _eligibilityLabel(drop.eligibility.missing),
      rulesLabel: _rulesLabel(drop),
      maxTicketsPerUser: drop.maxTicketsPerUser,
      plusOnly: drop.requiresFrendlyPlus,
    );
  }).toList(growable: false);
}

List<_GiveawayTask> _mapTasks(List<DropTaskData> tasks) {
  const mvpSources = {
    'verification',
    'daily_login',
    'host_meeting',
    'visit_meeting',
    'referral',
    'subscription',
    'boost',
  };
  return tasks
      .where((task) => mvpSources.contains(task.source))
      .map((task) => _GiveawayTask(
            id: task.id,
            title: task.title,
            reward: task.rewardTickets,
            status: task.status,
            icon: _taskIcon(task.source),
            cta: task.cta.label.isEmpty ? 'Открыть' : task.cta.label,
            cap: _taskCap(task),
            route: task.cta.route,
            action: task.cta.action,
          ))
      .toList(growable: false);
}

List<_TicketHistory> _mapHistory(List<DropHistoryData> history) {
  return history
      .map((item) => _TicketHistory(
            label: item.cancellationReason == null
                ? item.title
                : '${item.title}: ${item.cancellationReason}',
            delta: item.ticketCount,
            date: _formatResetDate(item.createdAt),
          ))
      .toList(growable: false);
}

List<_PastWinner> _mapWinners(List<DropWinnerData> winners) {
  return winners
      .map((winner) => _PastWinner(
            name: winner.name,
            city: winner.city,
            prize: winner.prize,
            ticket: winner.ticket,
          ))
      .toList(growable: false);
}

({String label, _DropAccent accent, IconData icon}) _dropTypeMeta(String type) {
  return switch (type) {
    'free' => (
        label: 'Free Drop',
        accent: _DropAccent.lilac,
        icon: LucideIcons.coins,
      ),
    'frendly_plus' => (
        label: 'Frendly+ Drop',
        accent: _DropAccent.pink,
        icon: LucideIcons.crown,
      ),
    'partner' => (
        label: 'Partner Drop',
        accent: _DropAccent.lime,
        icon: LucideIcons.gift,
      ),
    'special' => (
        label: 'Special Drop',
        accent: _DropAccent.pink,
        icon: LucideIcons.sparkles,
      ),
    _ => (
        label: 'Monthly Drop',
        accent: _DropAccent.lime,
        icon: LucideIcons.smartphone,
      ),
  };
}

IconData _taskIcon(String source) {
  return switch (source) {
    'verification' => LucideIcons.shield,
    'daily_login' => LucideIcons.sparkles,
    'host_meeting' => LucideIcons.calendarPlus,
    'visit_meeting' => LucideIcons.users,
    'referral' => LucideIcons.userPlus,
    'subscription' => LucideIcons.crown,
    'boost' => LucideIcons.rocket,
    _ => LucideIcons.ticket,
  };
}

String? _taskCap(DropTaskData task) {
  final parts = <String>[];
  if (task.monthlyLimit != null) {
    parts.add('до ${task.monthlyLimit} в месяц');
  }
  if (task.description.isNotEmpty) {
    parts.add(task.description);
  }
  return parts.isEmpty ? null : parts.join(' · ');
}

String _rulesLabel(DropData drop) {
  final parts = <String>['Бесплатно'];
  if (drop.requiresVerified) {
    parts.add('для верифицированных');
  }
  if (drop.requiresFrendlyPlus) {
    parts.add('Frendly+');
  }
  return parts.join(' · ');
}

String _eligibilityLabel(List<String> missing) {
  if (missing.contains('frendly_plus')) {
    return 'Только Frendly+';
  }
  if (missing.contains('verification')) {
    return 'Нужна верификация';
  }
  if (missing.contains('age')) {
    return 'Есть ограничение по возрасту';
  }
  if (missing.contains('region')) {
    return 'Недоступно в регионе';
  }
  return 'Недоступно';
}

String _formatResetDate(DateTime? date) {
  if (date == null) {
    return '';
  }
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  return '${date.day} ${months[date.month - 1]}';
}
