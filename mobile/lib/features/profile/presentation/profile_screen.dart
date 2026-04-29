import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/utils/location_label.dart';
import 'package:big_break_mobile/shared/widgets/bb_profile_photo_gallery.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final profileAsync = ref.watch(profileProvider);
    final photoPreviews = ref.watch(profilePhotoPreviewProvider);
    final matches = ref.watch(matchesProvider).valueOrNull ?? const [];
    final afterDarkAccess = ref.watch(afterDarkAccessProvider).valueOrNull ??
        const AfterDarkAccessData.fallback();
    final firstMatch = matches.isEmpty ? null : matches.first;
    if (profileAsync.hasError) {
      return Material(
        color: colors.background,
        child: SafeArea(
          bottom: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Не получилось загрузить профиль',
                style: AppTextStyles.body,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      );
    }
    final profile = profileAsync.valueOrNull;
    if (profile == null) {
      return Material(
        color: colors.background,
        child: SafeArea(
          bottom: false,
          child: Center(
            child: CircularProgressIndicator(color: colors.primary),
          ),
        ),
      );
    }
    final shortName = profile.displayName.split(' ').first;
    final locationLabel = composeLocationLabel(profile.city, profile.area);

    return Material(
      color: colors.background,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text('Профиль', style: AppTextStyles.screenTitle),
                    ),
                    InkWell(
                      onTap: () => context.pushRoute(AppRoute.settings),
                      borderRadius: BorderRadius.circular(999),
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: colors.border),
                        ),
                        child: Icon(
                          Icons.settings_outlined,
                          size: 18,
                          color: colors.inkSoft,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: AppRadii.cardBorder,
                    border: Border.all(color: colors.border),
                    boxShadow: AppShadows.soft,
                  ),
                  child: Column(
                    children: [
                      Stack(
                        children: [
                          BbProfilePhotoGallery(
                            displayName: profile.displayName,
                            photos: profile.photos,
                            height: 320,
                            photoPreviews: photoPreviews,
                          ),
                          Positioned(
                            right: 12,
                            bottom: 12,
                            child: InkWell(
                              onTap: () =>
                                  context.pushRoute(AppRoute.editProfile),
                              borderRadius: BorderRadius.circular(999),
                              child: Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: colors.foreground,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: colors.card,
                                    width: 2,
                                  ),
                                ),
                                child: Icon(
                                  Icons.photo_camera_outlined,
                                  size: 16,
                                  color: colors.primaryForeground,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            profile.age == null
                                ? shortName
                                : '$shortName, ${profile.age}',
                            style: AppTextStyles.sectionTitle,
                          ),
                          if (profile.verified)
                            Icon(
                              Icons.verified_rounded,
                              size: 18,
                              color: colors.secondary,
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.place_outlined,
                            size: 12,
                            color: colors.inkMute,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            locationLabel.isEmpty
                                ? 'Москва · Чистые пруды'
                                : locationLabel,
                            style: AppTextStyles.meta,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      InkWell(
                        onTap: () => context.pushRoute(AppRoute.editProfile),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: colors.border),
                          ),
                          child: Text(
                            'Изменить',
                            style: AppTextStyles.meta.copyWith(
                              color: colors.foreground,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Divider(color: colors.border),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          const Expanded(
                            child: _TrustMetric(
                              icon: Icons.verified_outlined,
                              label: 'Фото',
                              value: 'Подтв.',
                            ),
                          ),
                          Expanded(
                            child: _TrustMetric(
                              icon: Icons.groups_outlined,
                              label: 'Встреч',
                              value: '${profile.meetupCount}',
                            ),
                          ),
                          Expanded(
                            child: _TrustMetric(
                              icon: Icons.auto_awesome_outlined,
                              label: 'Рейтинг',
                              value: profile.rating.toStringAsFixed(1),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _ProfileActionCard(
                            title: 'Безопасность',
                            subtitle: 'Контакты, SOS, жалобы',
                            icon: Icons.shield_outlined,
                            onTap: () => context.pushRoute(AppRoute.safetyHub),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _ProfileActionCard(
                            title: 'Верификация',
                            subtitle: 'Подтвердить профиль',
                            icon: Icons.verified_user_outlined,
                            onTap: () =>
                                context.pushRoute(AppRoute.verification),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Row(
                      children: [
                        Expanded(
                          child: _ProfileActionCard(
                            title: 'Frendly+',
                            subtitle: 'Подписка и фильтры',
                            icon: Icons.auto_awesome_outlined,
                            onTap: () => context.pushRoute(AppRoute.paywall),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _ProfileActionCard(
                            title: 'Совпадения',
                            subtitle: firstMatch == null
                                ? 'Появятся после встреч'
                                : 'Открыть текущий матч',
                            icon: Icons.favorite_border_rounded,
                            onTap: firstMatch == null
                                ? null
                                : () => context.pushRoute(
                                      AppRoute.match,
                                      pathParameters: {
                                        'userId': firstMatch.userId,
                                      },
                                    ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    InkWell(
                      onTap: () => openAfterDarkEntry(context, ref),
                      borderRadius: BorderRadius.circular(24),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(AppSpacing.md),
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
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: AppColors.adBg.withValues(alpha: 0.42),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Icon(
                                Icons.nightlight_round,
                                color: AppColors.adMagenta,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Frendly After Dark',
                                    style: AppTextStyles.itemTitle.copyWith(
                                      color: AppColors.adFg,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    afterDarkAccess.unlocked
                                        ? 'Подписка активна · Inner Circle'
                                        : 'Закрытый раздел 18+ по подписке',
                                    style: AppTextStyles.meta.copyWith(
                                      color: AppColors.adFgSoft,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: afterDarkAccess.unlocked
                                  ? AppColors.adFg
                                  : AppColors.adFgSoft,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: _SectionTitle(title: 'Зачем здесь'),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: profile.intent
                      .map(
                        (item) => _Tag(
                          label: item,
                          icon: item == 'Свидания'
                              ? Icons.favorite_border_rounded
                              : Icons.groups_rounded,
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: _SectionTitle(title: 'Настроение'),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: colors.secondarySoft,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(profile.vibe ?? 'Спокойно',
                          style: AppTextStyles.itemTitle),
                      const SizedBox(height: 2),
                      Text('Камерные встречи, разговор без спешки',
                          style: AppTextStyles.meta
                              .copyWith(color: colors.inkSoft)),
                    ],
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: _SectionTitle(title: 'Интересы'),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: profile.interests
                      .map((item) => _Tag(label: item))
                      .toList(growable: false),
                ),
              ),
            ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: _SectionTitle(title: 'О себе'),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 120),
                child: Text(
                  profile.bio ?? '',
                  style: AppTextStyles.bodySoft,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: AppTextStyles.caption.copyWith(
        letterSpacing: 1,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _ProfileActionCard extends StatelessWidget {
  const _ProfileActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          height: 108,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 20, color: colors.primary),
              const SizedBox(height: AppSpacing.sm),
              Text(
                title,
                style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({
    required this.label,
    this.icon,
  });

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: colors.inkSoft),
            const SizedBox(width: 6),
          ],
          Text(label,
              style: AppTextStyles.meta
                  .copyWith(color: colors.inkSoft, fontSize: 13)),
        ],
      ),
    );
  }
}

class _TrustMetric extends StatelessWidget {
  const _TrustMetric({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      children: [
        Icon(icon, size: 16, color: colors.secondary),
        const SizedBox(height: 4),
        Text(value, style: AppTextStyles.itemTitle),
        const SizedBox(height: 2),
        Text(label, style: AppTextStyles.caption),
      ],
    );
  }
}
