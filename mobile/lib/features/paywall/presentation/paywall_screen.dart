import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  String _plan = 'year';
  bool _subscribing = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final plansAsync = ref.watch(subscriptionPlansProvider);
    final stateAsync = ref.watch(subscriptionStateProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: plansAsync.when(
          data: (plans) => stateAsync.when(
            data: (_) {
              final year = plans.firstWhere((plan) => plan.id == 'year');
              final month = plans.firstWhere((plan) => plan.id == 'month');
              final yearlyFullPrice = year.priceRub * 2;

              return Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                      children: [
                        Row(
                          children: [
                            IconButton(
                              onPressed: () => context.pop(),
                              icon: const Icon(
                                Icons.chevron_left_rounded,
                                size: 28,
                              ),
                            ),
                            const Spacer(),
                            TextButton(
                              onPressed: () async {
                                try {
                                  await ref
                                      .read(backendRepositoryProvider)
                                      .restoreSubscription();
                                  ref.invalidate(subscriptionStateProvider);
                                } catch (_) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Восстановление пока недоступно',
                                        ),
                                      ),
                                    );
                                  }
                                }
                              },
                              child: Text(
                                'Восстановить',
                                style: AppTextStyles.meta
                                    .copyWith(color: colors.inkSoft),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: colors.foreground,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Frendly+',
                              textAlign: TextAlign.center,
                              style: AppTextStyles.caption.copyWith(
                                color: colors.primaryForeground,
                                letterSpacing: 1,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Больше встреч, своих людей.',
                          textAlign: TextAlign.center,
                          style:
                              AppTextStyles.sectionTitle.copyWith(fontSize: 28),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'Чтобы ни один интересный вечер не прошёл мимо тебя.',
                          textAlign: TextAlign.center,
                          style: AppTextStyles.bodySoft.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        Container(
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: colors.border),
                          ),
                          child: Column(
                            children: [
                              const _FeatureRow(
                                title: 'Доступен дейтинг',
                                subtitle:
                                    'Свайпы, лайки и отдельная лента знакомств',
                                icon: Icons.favorite_border_rounded,
                              ),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: colors.border,
                              ),
                              const _FeatureRow(
                                title: 'Подборка свиданий',
                                subtitle:
                                    'Идеи для первого мэтча и быстрый переход к свиданию',
                                icon: Icons.local_activity_outlined,
                              ),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: colors.border,
                              ),
                              const _FeatureRow(
                                title: 'Расширенные фильтры',
                                subtitle:
                                    'Возраст, верификация, вайб, общие интересы',
                                icon: Icons.filter_alt_outlined,
                              ),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: colors.border,
                              ),
                              const _FeatureRow(
                                title: 'Приоритет в заявках',
                                subtitle: 'Хосты видят твою заявку первой',
                                icon: Icons.flash_on_outlined,
                              ),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: colors.border,
                              ),
                              const _FeatureRow(
                                title: 'Безлимит встреч',
                                subtitle:
                                    'Создавай и присоединяйся без ограничений',
                                icon: Icons.calendar_month_outlined,
                              ),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: colors.border,
                              ),
                              const _FeatureRow(
                                title: 'Кто смотрел профиль',
                                subtitle: 'Видишь, кому ты понравился',
                                icon: Icons.remove_red_eye_outlined,
                              ),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: colors.border,
                              ),
                              const _FeatureRow(
                                title: 'Только проверенные',
                                subtitle: 'Фильтр по синей галочке',
                                icon: Icons.auto_awesome_outlined,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        _PlanTile(
                          plan: year,
                          active: _plan == 'year',
                          summary: '399 ₽/мес · списание раз в год',
                          strikePrice: yearlyFullPrice,
                          onTap: () => setState(() => _plan = 'year'),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _PlanTile(
                          plan: month,
                          active: _plan == 'month',
                          summary: 'Можно отменить в любой момент',
                          onTap: () => setState(() => _plan = 'month'),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Text(
                          'Авто-продление можно отключить в настройках Apple ID. Условия и приватность.',
                          textAlign: TextAlign.center,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SafeArea(
                    top: false,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.background.withValues(alpha: 0.92),
                        border: Border(
                          top: BorderSide(
                            color: colors.border.withValues(alpha: 0.6),
                          ),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                        child: SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: colors.primary,
                            ),
                            onPressed: _subscribing
                                ? null
                                : () async {
                                    setState(() {
                                      _subscribing = true;
                                    });
                                    try {
                                      await ref
                                          .read(backendRepositoryProvider)
                                          .subscribe(_plan);
                                      ref.invalidate(subscriptionStateProvider);
                                      ref.invalidate(afterDarkAccessProvider);
                                    } catch (_) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Не получилось подключить подписку',
                                            ),
                                          ),
                                        );
                                      }
                                    } finally {
                                      if (mounted) {
                                        setState(() {
                                          _subscribing = false;
                                        });
                                      }
                                    }
                                  },
                            child: Text(
                              _plan == 'year'
                                  ? 'Попробовать 7 дней бесплатно'
                                  : 'Подключить за ${month.priceRub} ₽/мес',
                              style: AppTextStyles.button.copyWith(
                                color: colors.primaryForeground,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
            loading: () => Center(
              child: CircularProgressIndicator(color: colors.primary),
            ),
            error: (error, _) => Center(child: Text(error.toString())),
          ),
          loading: () => Center(
            child: CircularProgressIndicator(color: colors.primary),
          ),
          error: (error, _) => Center(child: Text(error.toString())),
        ),
      ),
    );
  }
}

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.plan,
    required this.active,
    required this.summary,
    required this.onTap,
    this.strikePrice,
  });

  final SubscriptionPlanData plan;
  final bool active;
  final String summary;
  final VoidCallback onTap;
  final int? strikePrice;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? colors.foreground : colors.border,
            width: active ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (plan.badge != null)
              Align(
                alignment: Alignment.topRight,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: colors.primary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    plan.badge!,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.primaryForeground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            Text(plan.label,
                style: AppTextStyles.itemTitle.copyWith(fontSize: 15)),
            const SizedBox(height: 4),
            Text(
              summary,
              style: AppTextStyles.meta,
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                RichText(
                  text: TextSpan(
                    style: AppTextStyles.sectionTitle,
                    children: [
                      TextSpan(text: '${plan.priceRub} ₽'),
                      if (plan.id == 'month')
                        TextSpan(
                          text: '/мес',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                    ],
                  ),
                ),
                if (strikePrice != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    '$strikePrice ₽',
                    style: AppTextStyles.meta.copyWith(
                      color: colors.inkMute,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ],
              ],
            ),
            if (plan.id == 'year' && plan.trialDays > 0) ...[
              const SizedBox(height: 6),
              Text(
                '${plan.trialDays} дней бесплатно',
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 18, color: colors.primary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: AppTextStyles.itemTitle.copyWith(fontSize: 14)),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppTextStyles.meta.copyWith(color: colors.inkMute),
                ),
              ],
            ),
          ),
          Icon(Icons.check_rounded, color: colors.secondary),
        ],
      ),
    );
  }
}
