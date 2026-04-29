import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class EveningNearestSessions extends StatelessWidget {
  const EveningNearestSessions({
    required this.sessions,
    required this.onOpenSession,
    super.key,
  });

  final List<EveningRouteTemplateSession> sessions;
  final ValueChanged<String> onOpenSession;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Ближайшие встречи', style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        if (sessions.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: AppRadii.cardBorder,
              border: Border.all(color: colors.border),
            ),
            child: Text(
              'Пока никто не создал встречу по этому маршруту.',
              style: AppTextStyles.body.copyWith(color: colors.inkMute),
            ),
          )
        else
          for (final session in sessions) ...[
            _NearestSessionTile(
              session: session,
              onTap: () => onOpenSession(session.sessionId),
            ),
            if (session != sessions.last) const SizedBox(height: AppSpacing.xs),
          ],
      ],
    );
  }
}

class _NearestSessionTile extends StatelessWidget {
  const _NearestSessionTile({
    required this.session,
    required this.onTap,
  });

  final EveningRouteTemplateSession session;
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
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: BorderRadius.circular(15),
                ),
                alignment: Alignment.center,
                child: Icon(
                  LucideIcons.calendar_clock,
                  color: colors.primary,
                  size: 19,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatStartsAt(session.startsAt),
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${session.joinedCount}/${session.capacity} участников',
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                'Вписаться',
                style: AppTextStyles.meta.copyWith(
                  color: colors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatStartsAt(String raw) {
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) {
      return 'Скоро';
    }
    final local = parsed.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day.$month · $hour:$minute';
  }
}
