import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class EveningRouteStepList extends StatelessWidget {
  const EveningRouteStepList({
    required this.steps,
    super.key,
  });

  final List<EveningRouteTemplateStep> steps;

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Шаги маршрута', style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        for (var index = 0; index < steps.length; index++) ...[
          _RouteStepTile(
            step: steps[index],
            index: index,
            last: index == steps.length - 1,
          ),
        ],
      ],
    );
  }
}

class _RouteStepTile extends StatelessWidget {
  const _RouteStepTile({
    required this.step,
    required this.index,
    required this.last,
  });

  final EveningRouteTemplateStep step;
  final int index;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final offerLabel = _offerLabel;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 58,
            child: Column(
              children: [
                Container(
                  width: 42,
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: colors.primarySoft,
                    borderRadius: AppRadii.inputBorder,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    step.time.isEmpty ? '${index + 1}' : step.time,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 1,
                      margin: const EdgeInsets.symmetric(vertical: 6),
                      color: colors.border,
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              margin: EdgeInsets.only(bottom: last ? 0 : AppSpacing.md),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: AppRadii.cardBorder,
                border: Border.all(color: colors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(step.emoji, style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          step.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.itemTitle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    step.venue,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySoft.copyWith(
                      color: colors.foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    step.address,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.meta.copyWith(
                      color: colors.inkMute,
                    ),
                  ),
                  if (offerLabel != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _OfferBadge(label: offerLabel),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String? get _offerLabel {
    final short = step.offerShortLabel?.trim();
    if (short != null && short.isNotEmpty) {
      return short;
    }
    final title = step.offerTitle?.trim();
    if (title != null && title.isNotEmpty) {
      return title;
    }
    final perk = step.perkShort?.trim();
    if (perk != null && perk.isNotEmpty) {
      return perk;
    }
    return null;
  }
}

class _OfferBadge extends StatelessWidget {
  const _OfferBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: colors.secondarySoft,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            LucideIcons.badge_percent,
            size: 14,
            color: colors.secondary,
          ),
          const SizedBox(width: AppSpacing.xxs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(
                color: colors.secondary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
