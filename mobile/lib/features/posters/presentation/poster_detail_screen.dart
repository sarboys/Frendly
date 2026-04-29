import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

class PosterDetailScreen extends ConsumerWidget {
  const PosterDetailScreen({
    required this.posterId,
    super.key,
  });

  final String posterId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final posterAsync = ref.watch(posterDetailProvider(posterId));

    return Scaffold(
      backgroundColor: colors.background,
      body: posterAsync.when(
        data: (poster) => _PosterDetailBody(poster: poster),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.chevron_left_rounded, size: 28),
                ),
              ),
              Expanded(
                child: Center(
                  child: Text(
                    'Событие не найдено',
                    style: AppTextStyles.body,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PosterDetailBody extends StatelessWidget {
  const _PosterDetailBody({
    required this.poster,
  });

  final Poster poster;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return SafeArea(
      bottom: false,
      child: Stack(
        children: [
          Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                decoration: BoxDecoration(
                  gradient: _gradientFor(context, poster.tone),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon:
                              const Icon(Icons.chevron_left_rounded, size: 28),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: colors.background.withValues(alpha: 0.72),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'Афиша · ${poster.provider}',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.foreground,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                poster.emoji,
                                style: const TextStyle(fontSize: 64),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                poster.title,
                                style: AppTextStyles.screenTitle,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            backgroundColor: colors.foreground,
                            foregroundColor: colors.primaryForeground,
                            side: BorderSide.none,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                          ),
                          onPressed: () =>
                              _openTickets(context, poster.ticketUrl),
                          icon: const Icon(
                            Icons.confirmation_number_outlined,
                            size: 18,
                          ),
                          label: const Text('Купить'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 132),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _InfoTile(
                            label: 'Когда',
                            value: '${poster.dateLabel} · ${poster.timeLabel}',
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _InfoTile(
                            label: 'Где',
                            value: poster.venue,
                            subtitle: poster.address,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Row(
                      children: [
                        Expanded(
                          child: _InfoTile(
                            label: 'Билеты',
                            value: poster.priceLabel,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _InfoTile(
                            label: 'Расстояние',
                            value: poster.distance,
                          ),
                        ),
                      ],
                    ),
                    if (poster.tags.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: poster.tags
                            .map(
                              (tag) => Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: colors.card,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: colors.border),
                                ),
                                child: Text(tag, style: AppTextStyles.meta),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'О событии',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      poster.description,
                      style: AppTextStyles.bodySoft.copyWith(
                        color: colors.inkSoft,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Идти веселее вместе',
                              style: AppTextStyles.itemTitle),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Создай встречу из этого события. Компания соберётся быстрее, чем в ручном поиске.',
                            style: AppTextStyles.bodySoft.copyWith(
                              color: colors.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              decoration: BoxDecoration(
                color: colors.background.withValues(alpha: 0.96),
                border: Border(top: BorderSide(color: colors.border)),
              ),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: () => context.pushRoute(
                        AppRoute.createMeetup,
                        queryParameters: {'posterId': poster.id},
                      ),
                      child: const Text('Собрать компанию'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: colors.primary,
                        foregroundColor: colors.primaryForeground,
                      ),
                      onPressed: () => _openTickets(context, poster.ticketUrl),
                      child: Text('Купить билет · ${poster.priceLabel}'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Откроется сайт ${poster.provider}',
                    style: AppTextStyles.meta.copyWith(color: colors.inkMute),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openTickets(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (opened || !context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Не получилось открыть сайт с билетами.')),
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

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.label,
    required this.value,
    this.subtitle,
  });

  final String label;
  final String value;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: colors.inkMute,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(value,
              style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600)),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
