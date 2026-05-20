import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class StreakScreen extends ConsumerStatefulWidget {
  const StreakScreen({super.key});

  @override
  ConsumerState<StreakScreen> createState() => _StreakScreenState();
}

class _StreakScreenState extends ConsumerState<StreakScreen> {
  String? _claimingKey;

  void _showNotice(String text) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DateasyColors.surface2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final seasonState = ref.watch(frendlySeasonProvider);
    final season = seasonState.valueOrNull;
    final checks = _weekChecks(season);
    final rewards =
        season?.rewards.map(_Reward.fromBackend).toList() ?? const <_Reward>[];
    return DateasyPhoneFrame(
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.paddingOf(context).top + 16,
          bottom: 48,
        ),
        children: [
          const _Header(),
          _Hero(season: season),
          if (seasonState.isLoading && season == null)
            const _InlineState(text: 'Загружаем streak')
          else if (season == null)
            _InlineState(
              text: seasonState.hasError
                  ? 'Не удалось загрузить streak'
                  : 'Streak пока пустой',
            )
          else ...[
            _WeekSection(
              checks: checks,
              checkedToday: checks.last,
              onCheckIn: () => _showNotice(
                'Check-in засчитывается после реальной встречи',
              ),
            ),
            _RewardsSection(
              rewards: rewards,
              claimingKey: _claimingKey,
              onClaim: _claim,
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _claim(_Reward reward) async {
    if (_claimingKey != null) {
      return;
    }
    setState(() => _claimingKey = reward.key);
    try {
      await ref.read(frendlySeasonActionsProvider).claimReward(reward.key);
      if (mounted) {
        _showNotice('Награда забрана');
      }
    } catch (_) {
      if (mounted) {
        _showNotice('Не удалось забрать награду');
      }
    } finally {
      if (mounted) {
        setState(() => _claimingKey = null);
      }
    }
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/profile'),
          ),
          Text(
            'Streak',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(width: 44, height: 44),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.season});

  final FrendlySeasonData? season;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        children: [
          SizedBox(
            width: 176,
            height: 176,
            child: Stack(
              alignment: Alignment.center,
              children: [
                ImageFiltered(
                  imageFilter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                  child: Opacity(
                    opacity: 0.3,
                    child: Container(
                      width: 176,
                      height: 176,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: dateasyPinkGradient,
                      ),
                    ),
                  ),
                ),
                const Icon(
                  LucideIcons.flame,
                  color: DateasyColors.pink,
                  size: 96,
                  shadows: [
                    Shadow(color: Color(0x99FF639F), blurRadius: 20),
                  ],
                ),
              ],
            ),
          ),
          Text(
            'STREAK',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 14,
                  letterSpacing: 4.2,
                ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 7),
            decoration: BoxDecoration(
              gradient: dateasyLimeGradient,
              borderRadius: BorderRadius.circular(24),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x66BEFF67),
                  blurRadius: 30,
                  spreadRadius: -10,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Text(
              '${season?.checkedInCount ?? 0}',
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    color: DateasyColors.backgroundDeep,
                    fontSize: 58,
                    height: 1,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: 260,
            child: Text(
              season == null
                  ? 'Streak считается по реальным check-in'
                  : '${season!.seasonLabel}: ${season!.checkedInCount} check-in',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WeekSection extends StatelessWidget {
  const _WeekSection({
    required this.checks,
    required this.checkedToday,
    required this.onCheckIn,
  });

  final List<bool> checks;
  final bool checkedToday;
  final VoidCallback onCheckIn;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Эта неделя',
      child: Column(
        children: [
          _GlassPanel(
            borderRadius: 24,
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                for (var index = 0; index < _days.length; index++) ...[
                  Expanded(
                    child: _DayCheck(
                      day: _days[index],
                      checked: checks[index],
                    ),
                  ),
                  if (index != _days.length - 1) const SizedBox(width: 6),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: checkedToday ? null : onCheckIn,
            child: Opacity(
              opacity: checkedToday ? 0.4 : 1,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: checkedToday
                      ? null
                      : const [
                          BoxShadow(
                            color: Color(0x66BEFF67),
                            blurRadius: 24,
                            spreadRadius: -12,
                            offset: Offset(0, 12),
                          ),
                        ],
                ),
                alignment: Alignment.center,
                child: Text(
                  checkedToday ? 'Сегодня отмечено ✓' : 'Check-in сегодня',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DayCheck extends StatelessWidget {
  const _DayCheck({
    required this.day,
    required this.checked,
  });

  final String day;
  final bool checked;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          day,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
                fontSize: 10,
              ),
        ),
        const SizedBox(height: 6),
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: checked ? dateasyLimeGradient : null,
            color: checked ? null : Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: checked
              ? const Icon(
                  LucideIcons.check,
                  color: DateasyColors.backgroundDeep,
                  size: 16,
                )
              : Text(
                  '·',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
        ),
      ],
    );
  }
}

class _RewardsSection extends StatelessWidget {
  const _RewardsSection({
    required this.rewards,
    required this.claimingKey,
    required this.onClaim,
  });

  final List<_Reward> rewards;
  final String? claimingKey;
  final ValueChanged<_Reward> onClaim;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Награды',
      child: Column(
        children: [
          for (var index = 0; index < rewards.length; index++) ...[
            _RewardCard(
              reward: rewards[index],
              busy: claimingKey == rewards[index].key,
              onClaim: () => onClaim(rewards[index]),
            ),
            if (index != rewards.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _RewardCard extends StatelessWidget {
  const _RewardCard({
    required this.reward,
    required this.busy,
    required this.onClaim,
  });

  final _Reward reward;
  final bool busy;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final highlighted = reward.ready;

    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(12),
      borderColor: highlighted
          ? DateasyColors.lime
          : Colors.white.withValues(alpha: 0.1),
      backgroundColor: highlighted
          ? DateasyColors.lime.withValues(alpha: 0.1)
          : DateasyColors.glass,
      shadow: highlighted
          ? const [
              BoxShadow(
                color: Color(0x55BEFF67),
                blurRadius: 24,
                spreadRadius: -14,
                offset: Offset(0, 14),
              ),
            ]
          : null,
      child: Row(
        children: [
          _RewardIcon(reward: reward),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${reward.n} встреч · ${reward.title}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  reward.gift,
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
          const SizedBox(width: 8),
          if (reward.got)
            Text(
              'Получено',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                  ),
            )
          else if (reward.ready)
            GestureDetector(
              onTap: busy ? null : onClaim,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: busy
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        'Забрать',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.backgroundDeep,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
              ),
            )
          else
            const Icon(
              LucideIcons.lock,
              color: DateasyColors.muted,
              size: 16,
            ),
        ],
      ),
    );
  }
}

class _RewardIcon extends StatelessWidget {
  const _RewardIcon({required this.reward});

  final _Reward reward;

  @override
  Widget build(BuildContext context) {
    final Color? color = reward.got
        ? DateasyColors.lime
        : reward.ready
            ? null
            : Colors.white.withValues(alpha: 0.05);

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color,
        gradient: reward.ready ? dateasyLimeGradient : null,
        borderRadius: BorderRadius.circular(16),
      ),
      alignment: Alignment.center,
      child: reward.got
          ? const Icon(
              LucideIcons.check,
              color: DateasyColors.backgroundDeep,
              size: 20,
            )
          : reward.ready
              ? const Icon(
                  LucideIcons.gift,
                  color: DateasyColors.backgroundDeep,
                  size: 20,
                )
              : Text(
                  '${reward.n}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 12,
                  letterSpacing: 1.4,
                ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(14),
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

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 20),
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
    this.borderColor,
    this.backgroundColor,
    this.shadow,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;
  final Color? backgroundColor;
  final List<BoxShadow>? shadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: borderColor ?? Colors.white.withValues(alpha: 0.1),
        ),
        boxShadow: shadow,
      ),
      child: child,
    );
  }
}

class _Reward {
  const _Reward({
    required this.key,
    required this.n,
    required this.title,
    required this.gift,
    required this.got,
    this.ready = false,
    this.ft,
  });

  final String key;
  final int n;
  final String title;
  final String gift;
  final bool got;
  final bool ready;
  final int? ft;

  factory _Reward.fromBackend(FrendlySeasonRewardData reward) {
    return _Reward(
      key: reward.key,
      n: reward.threshold,
      title: reward.title,
      gift: reward.description,
      got: reward.claimed,
      ready: reward.unlocked && !reward.claimed,
      ft: reward.rewardKind == 'tokens' ? reward.rewardAmount : null,
    );
  }
}

const _days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

List<bool> _weekChecks(FrendlySeasonData? season) {
  if (season == null) {
    return List<bool>.filled(7, false);
  }
  final checkedDays = season.calendarDays.toSet();
  final now = DateTime.now();
  final weekStart = now.subtract(Duration(days: now.weekday - 1));
  return [
    for (var index = 0; index < 7; index++)
      checkedDays.contains(weekStart.add(Duration(days: index)).day),
  ];
}
