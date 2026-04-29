import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/evening_nearest_sessions.dart';
import 'package:big_break_mobile/features/evening_routes/presentation/evening_route_step_list.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EveningRouteDetailScreen extends ConsumerWidget {
  const EveningRouteDetailScreen({
    required this.templateId,
    super.key,
  });

  final String templateId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final detailAsync = ref.watch(eveningRouteTemplateProvider(templateId));
    final sessionsAsync =
        ref.watch(eveningRouteTemplateSessionsProvider(templateId));

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: detailAsync.when(
          data: (route) {
            final nearestSessions =
                sessionsAsync.valueOrNull ?? route.nearestSessions;
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 20, 120),
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.chevron_left_rounded, size: 28),
                    ),
                    Expanded(
                      child: Text(
                        route.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                const _TeamRouteBadge(),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  route.title,
                  style: AppTextStyles.screenTitle,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  route.blurb,
                  style: AppTextStyles.body.copyWith(color: colors.inkSoft),
                ),
                const SizedBox(height: AppSpacing.lg),
                _RouteMetaGrid(route: route),
                if ((route.recommendedFor ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  _RecommendedFor(value: route.recommendedFor!.trim()),
                ],
                const SizedBox(height: AppSpacing.lg),
                _NoChatNotice(
                  onCreate: () => context.pushRoute(
                    AppRoute.createEveningSession,
                    pathParameters: {'templateId': templateId},
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                EveningRouteStepList(steps: route.steps),
                const SizedBox(height: AppSpacing.xl),
                EveningNearestSessions(
                  sessions: nearestSessions,
                  onOpenSession: (sessionId) => context.pushRoute(
                    AppRoute.eveningPreview,
                    pathParameters: {'sessionId': sessionId},
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                FilledButton.icon(
                  onPressed: () => context.pushRoute(
                    AppRoute.createEveningSession,
                    pathParameters: {'templateId': templateId},
                  ),
                  icon: const Icon(LucideIcons.calendar_plus, size: 18),
                  label: const Text('Создать встречу'),
                ),
                if (nearestSessions.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  OutlinedButton.icon(
                    onPressed: () => context.pushRoute(
                      AppRoute.eveningPreview,
                      pathParameters: {
                        'sessionId': nearestSessions.first.sessionId,
                      },
                    ),
                    icon: const Icon(LucideIcons.users, size: 18),
                    label: const Text('Вписаться в ближайшую'),
                  ),
                ],
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text(
                'Не получилось загрузить маршрут',
                style: AppTextStyles.body,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TeamRouteBadge extends StatelessWidget {
  const _TeamRouteBadge();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: colors.primarySoft,
          borderRadius: AppRadii.pillBorder,
        ),
        child: Text(
          'Маршрут от команды Frendly',
          style: AppTextStyles.caption.copyWith(
            color: colors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _RouteMetaGrid extends StatelessWidget {
  const _RouteMetaGrid({required this.route});

  final EveningRouteTemplateDetail route;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        _MetaChip(icon: LucideIcons.map_pin, label: route.area ?? route.city),
        _MetaChip(icon: LucideIcons.wallet, label: route.budget),
        _MetaChip(icon: LucideIcons.clock_3, label: route.durationLabel),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.pillBorder,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.inkMute),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: colors.inkSoft,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _RecommendedFor extends StatelessWidget {
  const _RecommendedFor({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
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
          Text(
            'Кому зайдет',
            style: AppTextStyles.caption.copyWith(
              color: colors.inkMute,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(value, style: AppTextStyles.body),
        ],
      ),
    );
  }
}

class _NoChatNotice extends StatelessWidget {
  const _NoChatNotice({required this.onCreate});

  final VoidCallback onCreate;

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
      child: Row(
        children: [
          Icon(
            LucideIcons.message_circle,
            size: 19,
            color: colors.inkMute,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'У маршрута нет чата. Чат появится после создания встречи.',
              style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
            ),
          ),
          TextButton(
            onPressed: onCreate,
            child: const Text('Создать'),
          ),
        ],
      ),
    );
  }
}
