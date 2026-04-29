import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:flutter/material.dart';

enum PosterCardVariant { feed, compact }

class PosterCard extends StatelessWidget {
  const PosterCard({
    required this.poster,
    super.key,
    this.onTap,
    this.variant = PosterCardVariant.feed,
  });

  final Poster poster;
  final VoidCallback? onTap;
  final PosterCardVariant variant;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shortTag = poster.tags.isEmpty ? null : poster.tags.first;
    final coverPriceLabel =
        poster.priceFrom == 0 ? 'Free' : 'от ${poster.priceFrom} ₽';

    if (variant == PosterCardVariant.compact) {
      return SizedBox(
        width: 230,
        child: Material(
          color: colors.card,
          borderRadius: AppRadii.cardBorder,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadii.cardBorder,
            child: Container(
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: AppRadii.cardBorder,
                border: Border.all(color: colors.border),
                boxShadow: AppShadows.soft,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 96,
                    decoration: BoxDecoration(
                      gradient: _gradientFor(context, poster.tone),
                      borderRadius: const BorderRadius.vertical(
                        top: AppRadii.card,
                      ),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          left: 14,
                          bottom: 12,
                          child: Text(
                            poster.emoji,
                            style: const TextStyle(fontSize: 40),
                          ),
                        ),
                        Positioned(
                          right: 10,
                          top: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: poster.priceFrom == 0
                                  ? colors.secondary
                                  : colors.background.withValues(alpha: 0.86),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              coverPriceLabel,
                              style: AppTextStyles.caption.copyWith(
                                color: poster.priceFrom == 0
                                    ? colors.secondaryForeground
                                    : colors.foreground,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        if (shortTag != null)
                          Positioned(
                            left: 14,
                            bottom: 10,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color:
                                    colors.background.withValues(alpha: 0.74),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                shortTag,
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.foreground,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          poster.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.itemTitle,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          '${poster.dateLabel} · ${poster.timeLabel}',
                          style: AppTextStyles.meta
                              .copyWith(color: colors.inkMute),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Material(
      color: colors.card,
      borderRadius: AppRadii.cardBorder,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Container(
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 128,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                decoration: BoxDecoration(
                  gradient: _gradientFor(context, poster.tone),
                  borderRadius: const BorderRadius.vertical(top: AppRadii.card),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Text(
                        poster.emoji,
                        style: const TextStyle(fontSize: 44),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.background.withValues(alpha: 0.72),
                          borderRadius: AppRadii.pillBorder,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Text(
                            'Афиша',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.foreground,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Text(
                        '${poster.dateLabel} · ${poster.timeLabel} · ${poster.distance}',
                        style: AppTextStyles.meta.copyWith(
                          color: colors.inkSoft,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(poster.title, style: AppTextStyles.cardTitle),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      poster.venue,
                      style: AppTextStyles.bodySoft.copyWith(
                        color: colors.inkMute,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            poster.priceLabel,
                            style: AppTextStyles.body.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          'Подробнее →',
                          style: AppTextStyles.body.copyWith(
                            color: colors.primary,
                            fontWeight: FontWeight.w600,
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

  LinearGradient _gradientFor(BuildContext context, EventTone tone) {
    final colors = AppColors.of(context);
    switch (tone) {
      case EventTone.evening:
        return LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.eveningStart, colors.eveningEnd],
        );
      case EventTone.sage:
        return LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.secondarySoft,
            colors.secondary.withValues(alpha: 0.22)
          ],
        );
      case EventTone.warm:
        return LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.warmStart, colors.warmEnd],
        );
    }
  }
}
