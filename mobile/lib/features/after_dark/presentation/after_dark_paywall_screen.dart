import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AfterDarkPaywallScreen extends ConsumerStatefulWidget {
  const AfterDarkPaywallScreen({super.key});

  @override
  ConsumerState<AfterDarkPaywallScreen> createState() =>
      _AfterDarkPaywallScreenState();
}

class _AfterDarkPaywallScreenState
    extends ConsumerState<AfterDarkPaywallScreen> {
  String _plan = 'year';
  bool _ageConfirmed = false;
  bool _codeAccepted = false;
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    final plans = ref.watch(subscriptionPlansProvider).valueOrNull ?? const [];
    final access = ref.watch(afterDarkAccessProvider).valueOrNull ??
        const AfterDarkAccessData.fallback();
    final yearPlan = _findPlanPrice(plans, 'year', fallback: '10 788 ₽');
    final monthPlan = _findPlanPrice(plans, 'month', fallback: '1 599 ₽');

    return Scaffold(
      backgroundColor: AppColors.adBg,
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
                    icon: const Icon(
                      Icons.chevron_left_rounded,
                      size: 28,
                      color: AppColors.adFg,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () async {
                            try {
                              await ref
                                  .read(backendRepositoryProvider)
                                  .restoreSubscription();
                              ref.invalidate(subscriptionStateProvider);
                              ref.invalidate(afterDarkAccessProvider);
                            } catch (_) {}
                          },
                    child: Text(
                      'Восстановить',
                      style: AppTextStyles.meta.copyWith(
                        color: AppColors.adFgSoft,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 140),
                children: [
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.neonStart, AppColors.neonEnd],
                        ),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: AppShadows.neon,
                      ),
                      child: Text(
                        'Frendly+ 18 · After Dark',
                        style: AppTextStyles.caption.copyWith(
                          color: AppColors.adFg,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Ночной круг для тех, кто живёт интенсивнее.',
                    textAlign: TextAlign.center,
                    style: AppTextStyles.sectionTitle.copyWith(
                      fontSize: 28,
                      color: AppColors.adFg,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Свидания, найтлайф, wellness и Inner Circle в закрытом верифицированном кругу.',
                    textAlign: TextAlign.center,
                    style: AppTextStyles.bodySoft.copyWith(
                      color: AppColors.adFgSoft,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.afterDarkGradientStart,
                          AppColors.afterDarkGradientMid,
                          AppColors.afterDarkGradientEnd,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: AppColors.adBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${access.previewCount} событий сегодня ночью',
                          style: AppTextStyles.cardTitle.copyWith(
                            color: AppColors.adFg,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Открой раздел, чтобы увидеть детали, правила и apply-only встречи.',
                          style: AppTextStyles.bodySoft.copyWith(
                            color: AppColors.adFgSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _PaywallFeature(
                    title: 'Закрытая лента After Dark',
                    subtitle: 'Найтлайф, свидания, wellness и Inner Circle',
                    icon: Icons.nightlight_round,
                  ),
                  const _PaywallFeature(
                    title: 'Только верифицированные',
                    subtitle: 'Все участники проходят базовую проверку',
                    icon: Icons.verified_user_outlined,
                  ),
                  const _PaywallFeature(
                    title: 'Скрытый режим',
                    subtitle: 'Раздел не виден тем, у кого нет подписки',
                    icon: Icons.lock_outline_rounded,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _PlanTile(
                    active: _plan == 'year',
                    title: 'Годовой',
                    subtitle: '899 ₽/мес · списание раз в год',
                    price: yearPlan,
                    badge: '−45%',
                    onTap: () => setState(() => _plan = 'year'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _PlanTile(
                    active: _plan == 'month',
                    title: 'Месячный',
                    subtitle: 'Можно отменить в любой момент',
                    price: monthPlan,
                    onTap: () => setState(() => _plan = 'month'),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _ConsentTile(
                    key: const ValueKey('after-dark-age-consent'),
                    checked: _ageConfirmed,
                    text:
                        'Мне исполнилось 18 лет. Готов(-а) пройти верификацию возраста по селфи и документу.',
                    onTap: () => setState(() {
                      _ageConfirmed = !_ageConfirmed;
                    }),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _ConsentTile(
                    key: const ValueKey('after-dark-code-consent'),
                    checked: _codeAccepted,
                    text:
                        'Принимаю кодекс After Dark: consent-first, без съёмки, ноль толерантности к домогательствам.',
                    onTap: () => setState(() {
                      _codeAccepted = !_codeAccepted;
                    }),
                  ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor:
                          _ctaReady ? AppColors.adMagenta : AppColors.adSurface,
                      foregroundColor:
                          _ctaReady ? AppColors.adFg : AppColors.adFgSoft,
                      disabledBackgroundColor: AppColors.adSurface,
                      shape: const RoundedRectangleBorder(
                        borderRadius: AppRadii.cardBorder,
                      ),
                    ),
                    onPressed: _ctaReady && !_submitting
                        ? () => _unlock(context)
                        : null,
                    child: Text(
                      _ctaReady
                          ? _plan == 'year'
                              ? 'Открыть After Dark · 7 дней бесплатно'
                              : 'Открыть After Dark · $monthPlan/мес'
                          : 'Отметь оба пункта выше',
                      style: AppTextStyles.button.copyWith(
                        color: _ctaReady ? AppColors.adFg : AppColors.adFgSoft,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool get _ctaReady => _ageConfirmed && _codeAccepted;

  String _findPlanPrice(
    List<dynamic> plans,
    String planId, {
    required String fallback,
  }) {
    for (final plan in plans) {
      if (plan.id == planId) {
        return '${plan.priceRub} ₽';
      }
    }
    return fallback;
  }

  Future<void> _unlock(BuildContext context) async {
    setState(() {
      _submitting = true;
    });
    try {
      await ref.read(backendRepositoryProvider).unlockAfterDark(
            plan: _plan,
            ageConfirmed: true,
            codeAccepted: true,
          );
      ref.invalidate(subscriptionStateProvider);
      ref.invalidate(afterDarkAccessProvider);
      ref.invalidate(afterDarkEventsProvider);
      if (!context.mounted) {
        return;
      }
      context.pushReplacementNamed(AppRoute.afterDark.name);
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось открыть After Dark.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }
}

class _PaywallFeature extends StatelessWidget {
  const _PaywallFeature({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.adSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.adBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.adVioletSoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.adViolet, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.itemTitle.copyWith(
                    color: AppColors.adFg,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppTextStyles.meta.copyWith(
                    color: AppColors.adFgSoft,
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

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.active,
    required this.title,
    required this.subtitle,
    required this.price,
    required this.onTap,
    this.badge,
  });

  final bool active;
  final String title;
  final String subtitle;
  final String price;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.adSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? AppColors.adMagenta : AppColors.adBorder,
            width: active ? 2 : 1,
          ),
          boxShadow: active ? AppShadows.neon : null,
        ),
        child: Stack(
          children: [
            if (badge != null)
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.neonStart, AppColors.neonEnd],
                    ),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    badge!,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.adFg,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.itemTitle.copyWith(
                    color: AppColors.adFg,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: AppTextStyles.meta.copyWith(
                    color: AppColors.adFgSoft,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  price,
                  style: AppTextStyles.sectionTitle.copyWith(
                    color: AppColors.adFg,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ConsentTile extends StatelessWidget {
  const _ConsentTile({
    super.key,
    required this.checked,
    required this.text,
    required this.onTap,
  });

  final bool checked;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.adSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.adBorder),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 22,
              height: 22,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: checked ? AppColors.adMagenta : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: checked ? AppColors.adMagenta : AppColors.adBorder,
                  width: 2,
                ),
              ),
              child: checked
                  ? const Icon(
                      Icons.check_rounded,
                      size: 16,
                      color: AppColors.adFg,
                    )
                  : null,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                text,
                style: AppTextStyles.bodySoft.copyWith(
                  color: AppColors.adFgSoft,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
