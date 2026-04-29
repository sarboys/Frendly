import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/evening_route_card.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const _routeFilters = ['Свидание', 'Друзья', 'Недорого', 'Центр', 'Сегодня'];

class EveningRoutesScreen extends ConsumerStatefulWidget {
  const EveningRoutesScreen({super.key});

  @override
  ConsumerState<EveningRoutesScreen> createState() =>
      _EveningRoutesScreenState();
}

class _EveningRoutesScreenState extends ConsumerState<EveningRoutesScreen> {
  String? _activeFilter;

  @override
  Widget build(BuildContext context) {
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
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
                child: _CityHeader(city: city),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: _RouteFilterChips(
                  activeFilter: _activeFilter,
                  onTap: (filter) {
                    setState(() {
                      _activeFilter = _activeFilter == filter ? null : filter;
                    });
                  },
                ),
              ),
            ),
            routesAsync.when(
              data: (routes) {
                final visibleRoutes = _applyFilter(routes);
                if (visibleRoutes.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: _RouteCatalogEmpty(
                      city: city,
                      filtered: _activeFilter != null,
                    ),
                  );
                }

                return SliverList.separated(
                  itemBuilder: (context, index) {
                    final route = visibleRoutes[index];
                    return Padding(
                      padding: EdgeInsets.fromLTRB(
                        20,
                        index == 0 ? 0 : AppSpacing.md,
                        20,
                        0,
                      ),
                      child: EveningRouteCard(
                        route: route,
                        onTap: () => context.pushRoute(
                          AppRoute.eveningRouteDetail,
                          pathParameters: {'templateId': route.id},
                        ),
                      ),
                    );
                  },
                  separatorBuilder: (_, __) => const SizedBox.shrink(),
                  itemCount: visibleRoutes.length,
                );
              },
              loading: () => const SliverToBoxAdapter(
                child: _RouteListLoading(),
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

  List<EveningRouteTemplateSummary> _applyFilter(
    List<EveningRouteTemplateSummary> routes,
  ) {
    final filter = _activeFilter;
    if (filter == null) {
      return routes;
    }

    return routes.where((route) {
      final text = [
        route.title,
        route.blurb,
        route.vibe,
        route.area,
        route.budget,
      ].whereType<String>().join(' ').toLowerCase();

      switch (filter) {
        case 'Свидание':
          return text.contains('свид') || text.contains('date');
        case 'Друзья':
          return text.contains('друз') || text.contains('company');
        case 'Недорого':
          return route.totalPriceFrom <= 2500 || text.contains('недор');
        case 'Центр':
          return text.contains('центр') ||
              text.contains('покров') ||
              text.contains('чистые');
        case 'Сегодня':
          return route.nearestSessions.any(_isTodaySession);
        default:
          return true;
      }
    }).toList(growable: false);
  }

  bool _isTodaySession(EveningRouteTemplateSession session) {
    final startsAt = DateTime.tryParse(session.startsAt);
    if (startsAt == null) {
      return false;
    }
    final now = DateTime.now();
    final local = startsAt.toLocal();
    return local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
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

class _CityHeader extends StatelessWidget {
  const _CityHeader({required this.city});

  final String city;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Командные маршруты в городе',
            style: AppTextStyles.caption.copyWith(
              color: colors.inkMute,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            city,
            style: AppTextStyles.sectionTitle,
          ),
        ],
      ),
    );
  }
}

class _RouteFilterChips extends StatelessWidget {
  const _RouteFilterChips({
    required this.activeFilter,
    required this.onTap,
  });

  final String? activeFilter;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final filter in _routeFilters) ...[
            _RouteFilterChip(
              label: filter,
              selected: activeFilter == filter,
              onTap: () => onTap(filter),
            ),
            if (filter != _routeFilters.last)
              const SizedBox(width: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}

class _RouteFilterChip extends StatelessWidget {
  const _RouteFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? colors.primary : colors.card,
            borderRadius: AppRadii.pillBorder,
            border: Border.all(
              color: selected ? colors.primary : colors.border,
            ),
          ),
          child: Text(
            label,
            style: AppTextStyles.meta.copyWith(
              color: selected ? colors.primaryForeground : colors.inkSoft,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}

class _RouteListLoading extends StatelessWidget {
  const _RouteListLoading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          _RouteSkeletonCard(),
          SizedBox(height: AppSpacing.md),
          _RouteSkeletonCard(),
          SizedBox(height: AppSpacing.md),
          _RouteSkeletonCard(),
        ],
      ),
    );
  }
}

class _RouteSkeletonCard extends StatelessWidget {
  const _RouteSkeletonCard();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      height: 206,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
        boxShadow: AppShadows.soft,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 82,
            decoration: BoxDecoration(
              color: colors.muted,
              borderRadius: BorderRadius.circular(18),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            height: 16,
            width: 180,
            decoration: BoxDecoration(
              color: colors.muted,
              borderRadius: AppRadii.pillBorder,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            height: 12,
            width: 240,
            decoration: BoxDecoration(
              color: colors.muted,
              borderRadius: AppRadii.pillBorder,
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteCatalogEmpty extends StatelessWidget {
  const _RouteCatalogEmpty({
    required this.city,
    required this.filtered,
  });

  final String city;
  final bool filtered;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final message = filtered
        ? 'Под этот фильтр маршрутов пока нет'
        : 'Маршруты пока недоступны для города $city';
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message,
                style: AppTextStyles.body.copyWith(color: colors.inkMute),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
