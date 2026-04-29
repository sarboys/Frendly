import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:flutter/material.dart';
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

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: detailAsync.when(
          data: (route) {
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
                FilledButton(
                  onPressed: () => context.pushRoute(
                    AppRoute.createEveningSession,
                    pathParameters: {'templateId': templateId},
                  ),
                  child: const Text('Создать встречу'),
                ),
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
