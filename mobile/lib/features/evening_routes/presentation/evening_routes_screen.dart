import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EveningRoutesScreen extends ConsumerWidget {
  const EveningRoutesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final profile = ref.watch(profileProvider).valueOrNull;
    final onboarding = ref.watch(onboardingProvider).valueOrNull;
    final city = _resolveCity(profile?.city, onboarding?.city);
    final routesAsync = ref.watch(eveningRouteTemplatesProvider(city));

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 20, 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.chevron_left_rounded, size: 28),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Маршруты',
                            style: AppTextStyles.screenTitle,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            city,
                            style: AppTextStyles.meta.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            routesAsync.when(
              data: (routes) {
                if (routes.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: _RouteCatalogEmpty(city: city),
                  );
                }

                return SliverList.separated(
                  itemBuilder: (context, index) {
                    final route = routes[index];
                    return Padding(
                      padding: EdgeInsets.fromLTRB(
                        20,
                        index == 0 ? 0 : AppSpacing.md,
                        20,
                        0,
                      ),
                      child: _RoutePlaceholderCard(
                        route: route,
                        onTap: () => context.pushRoute(
                          AppRoute.eveningRouteDetail,
                          pathParameters: {'templateId': route.id},
                        ),
                      ),
                    );
                  },
                  separatorBuilder: (_, __) => const SizedBox.shrink(),
                  itemCount: routes.length,
                );
              },
              loading: () => const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Text(
                      'Не получилось загрузить маршруты',
                      style: AppTextStyles.body,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 120)),
          ],
        ),
      ),
    );
  }

  String _resolveCity(String? profileCity, String? onboardingCity) {
    final fromProfile = profileCity?.trim();
    if (fromProfile != null && fromProfile.isNotEmpty) {
      return fromProfile;
    }
    final fromOnboarding = onboardingCity?.trim();
    if (fromOnboarding != null && fromOnboarding.isNotEmpty) {
      return fromOnboarding;
    }
    return 'Москва';
  }
}

class _RoutePlaceholderCard extends StatelessWidget {
  const _RoutePlaceholderCard({
    required this.route,
    required this.onTap,
  });

  final EveningRouteTemplateSummary route;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.route,
                  color: colors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      route.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.itemTitle,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        route.area,
                        route.budget,
                        route.durationLabel,
                      ].whereType<String>().where((item) {
                        return item.trim().isNotEmpty;
                      }).join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                Icons.chevron_right_rounded,
                color: colors.inkMute,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RouteCatalogEmpty extends StatelessWidget {
  const _RouteCatalogEmpty({required this.city});

  final String city;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Text(
          'Маршруты пока недоступны для города $city',
          style: AppTextStyles.body.copyWith(color: colors.inkMute),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
