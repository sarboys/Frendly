import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:big_break_mobile/shared/widgets/bb_profile_photo_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class EveningRouteCard extends StatelessWidget {
  const EveningRouteCard({
    required this.route,
    required this.onTap,
    super.key,
  });

  final EveningRouteTemplateSummary route;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final offer = route.partnerOffersPreview.isEmpty
        ? null
        : route.partnerOffersPreview.first;
    final sessionsCount = route.nearestSessions.length;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Ink(
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: AppRadii.card,
                ),
                child: SizedBox(
                  height: 128,
                  width: double.infinity,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      BbProfilePhotoImage(
                        imageUrl: route.coverUrl,
                        fallbackText: _coverFallback,
                        usageProfile: BbImageUsageProfile.card,
                        fallbackFontSize: 46,
                      ),
                      Positioned(
                        left: AppSpacing.md,
                        top: AppSpacing.md,
                        child: _Badge(
                          label: route.badgeLabel ?? 'Маршрут Frendly',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      route.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.cardTitle,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _metaLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                    if (offer != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      _OfferPreview(offer: offer),
                    ],
                    if (sessionsCount > 0) ...[
                      const SizedBox(height: AppSpacing.sm),
                      _NearestSessionsBadge(count: sessionsCount),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String get _coverFallback {
    final emoji =
        route.stepsPreview.isEmpty ? null : route.stepsPreview.first.emoji;
    if (emoji != null && emoji.trim().isNotEmpty) {
      return emoji;
    }
    return '✨';
  }

  String get _metaLine {
    return [
      route.area,
      route.budget,
      route.durationLabel,
    ].whereType<String>().where((item) => item.trim().isNotEmpty).join(' · ');
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.card.withValues(alpha: 0.92),
        borderRadius: AppRadii.pillBorder,
        border: Border.all(color: colors.border),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          color: colors.inkSoft,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _OfferPreview extends StatelessWidget {
  const _OfferPreview({required this.offer});

  final EveningPartnerOfferPreview offer;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final label = offer.shortLabel?.trim().isNotEmpty == true
        ? offer.shortLabel!.trim()
        : offer.title;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            LucideIcons.badge_percent,
            size: 14,
            color: colors.primary,
          ),
          const SizedBox(width: AppSpacing.xxs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NearestSessionsBadge extends StatelessWidget {
  const _NearestSessionsBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          LucideIcons.users,
          size: 14,
          color: colors.inkMute,
        ),
        const SizedBox(width: AppSpacing.xxs),
        Text(
          '$count ${_pluralizeMeetings(count)} уже рядом',
          style: AppTextStyles.caption.copyWith(
            color: colors.inkMute,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  String _pluralizeMeetings(int count) {
    final mod10 = count % 10;
    final mod100 = count % 100;
    if (mod10 == 1 && mod100 != 11) {
      return 'встреча';
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'встречи';
    }
    return 'встреч';
  }
}
