import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class EveningHeroCard extends StatelessWidget {
  const EveningHeroCard({
    required this.onTap,
    super.key,
  });

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.cardBorder,
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: AppRadii.cardBorder,
          border: Border.all(color: colors.border),
          boxShadow: AppShadows.card,
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      colors.primary.withValues(alpha: 0.15),
                      colors.warmStart,
                      colors.secondary.withValues(alpha: 0.2),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Flexible(
                        child: _HeroPill(
                          foreground: colors.background,
                          background: colors.foreground,
                          icon: LucideIcons.sparkles,
                          label: 'Frendly Evening',
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      _HeroPill(
                        foreground: colors.secondary,
                        background: colors.background.withValues(alpha: 0.7),
                        label: 'AI · 60 сек',
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'У тебя нет плана?\nFrendly соберёт.',
                    style: AppTextStyles.sectionTitle.copyWith(
                      fontSize: 22,
                      height: 1.15,
                      fontWeight: FontWeight.w600,
                      color: colors.foreground,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '5 простых вопросов — и готовый маршрут вечера: бар → шоу → afterparty → утренний follow-up.',
                    style: AppTextStyles.meta.copyWith(
                      fontSize: 13,
                      height: 1.35,
                      color: colors.inkSoft,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      _HeroPill(
                        foreground: colors.foreground,
                        background: colors.background.withValues(alpha: 0.7),
                        icon: LucideIcons.clock,
                        label: '19:00 — 00:30',
                        normalCase: true,
                      ),
                      _HeroPill(
                        foreground: colors.secondary,
                        background: colors.background.withValues(alpha: 0.7),
                        icon: LucideIcons.wallet,
                        label: 'экономия −650 ₽',
                        normalCase: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '8 человек уже идут по маршруту',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'Собрать вечер',
                        style: AppTextStyles.meta.copyWith(
                          fontFamily: 'Sora',
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.foreground,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: colors.foreground,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          LucideIcons.arrow_right,
                          size: 15,
                          color: colors.background,
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

class _HeroPill extends StatelessWidget {
  const _HeroPill({
    required this.foreground,
    required this.background,
    required this.label,
    this.icon,
    this.normalCase = false,
  });

  final Color foreground;
  final Color background;
  final String label;
  final IconData? icon;
  final bool normalCase;

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
          if (icon != null) ...[
            Icon(icon, size: 12, color: foreground),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(
                fontSize: normalCase ? 11 : 10,
                fontWeight: FontWeight.w700,
                color: foreground,
                letterSpacing: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
