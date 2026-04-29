import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

enum BbEventCardVariant { feed, compact }

class BbEventCard extends StatelessWidget {
  const BbEventCard({
    required this.event,
    super.key,
    this.onTap,
    this.variant = BbEventCardVariant.feed,
  });

  final Event event;
  final VoidCallback? onTap;
  final BbEventCardVariant variant;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    if (variant == BbEventCardVariant.compact) {
      return SizedBox(
        width: 260,
        child: Material(
          color: colors.card,
          borderRadius: AppRadii.cardBorder,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadii.cardBorder,
            child: Container(
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
                  Container(
                    height: 80,
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      gradient: _gradientFor(context, event.tone),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    alignment: Alignment.bottomLeft,
                    child: Text(
                      event.emoji,
                      style: const TextStyle(fontSize: 32),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    event.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.itemTitle,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.clock_3,
                        size: 14,
                        color: colors.inkMute,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          event.time,
                          style: AppTextStyles.meta,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
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
                  gradient: _gradientFor(context, event.tone),
                  borderRadius: const BorderRadius.vertical(top: AppRadii.card),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      left: 0,
                      top: 0,
                      child: Text(event.emoji,
                          style: const TextStyle(fontSize: 44)),
                    ),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.background.withValues(alpha: 0.7),
                          borderRadius: AppRadii.pillBorder,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          child: Text(
                            event.vibe,
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
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.clock_3,
                            size: 14,
                            color: colors.inkSoft,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              '${event.time} · ${event.distance}',
                              style: AppTextStyles.meta
                                  .copyWith(color: colors.inkSoft),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
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
                    Text(event.title, style: AppTextStyles.cardTitle),
                    const SizedBox(height: AppSpacing.xs),
                    Row(
                      children: [
                        Icon(
                          LucideIcons.map_pin,
                          size: 14,
                          color: colors.inkMute,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Text(
                            event.place,
                            style:
                                AppTextStyles.bodySoft.copyWith(fontSize: 14),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              BbAvatarStack(
                                names: event.attendees,
                                size: BbAvatarSize.sm,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Text(
                                  '${event.going} из ${event.capacity}',
                                  style: AppTextStyles.bodySoft
                                      .copyWith(fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Flexible(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Text(
                              'Подробнее →',
                              style: AppTextStyles.body.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: colors.primary,
                              ),
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

  LinearGradient _gradientFor(BuildContext context, EventTone tone) {
    final colors = AppColors.of(context);

    switch (tone) {
      case EventTone.evening:
        return LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.eveningStart,
            colors.eveningEnd,
          ],
        );
      case EventTone.sage:
        return LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.secondarySoft,
            colors.secondary.withValues(alpha: colors.isDark ? 0.35 : 0.25),
          ],
        );
      case EventTone.warm:
        return LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.warmStart,
            colors.warmEnd,
          ],
        );
    }
  }
}
