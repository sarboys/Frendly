import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class MatchScreen extends ConsumerWidget {
  const MatchScreen({
    required this.userId,
    super.key,
  });

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final matchesAsync = ref.watch(matchesProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: matchesAsync.when(
          data: (matches) {
            if (matches.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Совпадений пока нет',
                    style: AppTextStyles.body,
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }

            final match = matches.firstWhere(
              (item) => item.userId == userId,
              orElse: () => matches.first,
            );

            if (match.userId != userId) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Совпадение не найдено',
                    style: AppTextStyles.body,
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }
            final shortName = match.displayName.split(' ').first;

            return Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                    children: [
                      IconButton(
                        onPressed: () => context.pop(),
                        icon: const Icon(Icons.chevron_left_rounded, size: 28),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const BbAvatar(name: 'Ты', size: BbAvatarSize.lg),
                          const SizedBox(width: AppSpacing.md),
                          Icon(
                            Icons.auto_awesome_rounded,
                            size: 20,
                            color: colors.primary,
                          ),
                          const SizedBox(width: AppSpacing.md),
                          BbAvatar(
                            name: match.displayName,
                            imageUrl: match.avatarUrl,
                            size: BbAvatarSize.lg,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Ты и $shortName',
                        textAlign: TextAlign.center,
                        style: AppTextStyles.itemTitle.copyWith(
                          color: colors.inkMute,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Center(
                        child: SizedBox(
                          width: 160,
                          height: 160,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              SizedBox(
                                width: 160,
                                height: 160,
                                child: CircularProgressIndicator(
                                  value: match.score / 100,
                                  strokeWidth: 10,
                                  backgroundColor: colors.muted,
                                  color: colors.primary,
                                ),
                              ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${match.score}%',
                                    textAlign: TextAlign.center,
                                    style: AppTextStyles.screenTitle
                                        .copyWith(fontSize: 44),
                                  ),
                                  Text(
                                    'совпадение',
                                    textAlign: TextAlign.center,
                                    style: AppTextStyles.caption.copyWith(
                                      letterSpacing: 1,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Высокая совместимость. Похожий вайб и ${match.commonInterests.length} общих интересов.',
                        textAlign: TextAlign.center,
                        style: AppTextStyles.bodySoft,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'Что совпадает',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: colors.border),
                        ),
                        child: Column(
                          children: [
                            _MatchTraitRow(
                              label: 'Вайб',
                              you: 'Спокойно',
                              them: match.vibe ?? 'Спокойно',
                              match: true,
                            ),
                            if (match.area != null)
                              _MatchTraitRow(
                                label: 'Район',
                                you: 'Твой район',
                                them: match.area!,
                                match: true,
                              ),
                            _MatchTraitRow(
                              label: 'Общие интересы',
                              you: '${match.commonInterests.length}',
                              them: match.commonInterests.join(', '),
                              match: match.commonInterests.isNotEmpty,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'Интересы · ${match.commonInterests.length} общих',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: match.commonInterests
                            .map(
                              (interest) => Container(
                                height: 36,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                ),
                                decoration: BoxDecoration(
                                  color: colors.primarySoft,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color:
                                        colors.primary.withValues(alpha: 0.3),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: colors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      interest,
                                      style: AppTextStyles.meta.copyWith(
                                        color: colors.foreground,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ],
                  ),
                ),
                SafeArea(
                  top: false,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          colors.background.withValues(alpha: 0),
                          colors.background,
                          colors.background,
                        ],
                      ),
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: colors.foreground,
                        ),
                        onPressed: () async {
                          final chatId = await ref
                              .read(backendRepositoryProvider)
                              .createOrGetDirectChat(match.userId);
                          if (context.mounted) {
                            context.pushRoute(
                              AppRoute.personalChat,
                              pathParameters: {'chatId': chatId},
                            );
                          }
                        },
                        icon: Icon(
                          Icons.message_outlined,
                          color: colors.primaryForeground,
                        ),
                        label: Text(
                          'Написать $shortName',
                          style: AppTextStyles.button.copyWith(
                            color: colors.primaryForeground,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => Center(
            child: CircularProgressIndicator(color: colors.primary),
          ),
          error: (error, _) => Center(child: Text(error.toString())),
        ),
      ),
    );
  }
}

class _MatchTraitRow extends StatelessWidget {
  const _MatchTraitRow({
    required this.label,
    required this.you,
    required this.them,
    required this.match,
  });

  final String label;
  final String you;
  final String them;
  final bool match;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTextStyles.meta.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          Text(you, style: AppTextStyles.meta),
          const SizedBox(width: 8),
          Text(
            them,
            style: AppTextStyles.meta.copyWith(
              color: match ? colors.secondary : colors.inkMute,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: match ? colors.secondary : colors.muted,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }
}
