import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_profile_photo_gallery.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class UserProfileScreen extends ConsumerWidget {
  const UserProfileScreen({
    required this.userId,
    super.key,
  });

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final profileAsync = ref.watch(personProfileProvider(userId));
    final currentProfile = ref.watch(profileProvider).valueOrNull;

    return Scaffold(
      backgroundColor: colors.background,
      body: AsyncValueView(
        value: profileAsync,
        data: (profile) {
          final commonInterests = currentProfile == null
              ? <String>[]
              : profile.interests
                  .where(
                      (interest) => currentProfile.interests.contains(interest))
                  .toList(growable: false);
          const actionButtonHeight = 52.0;

          return SafeArea(
            bottom: false,
            child: Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon:
                              const Icon(Icons.chevron_left_rounded, size: 28),
                        ),
                        const Spacer(),
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(999),
                            onTap: () =>
                                _showProfileActions(context, ref, userId),
                            child: const Padding(
                              padding: EdgeInsets.all(4),
                              child: Icon(Icons.more_horiz_rounded),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Column(
                      children: [
                        Stack(
                          children: [
                            BbProfilePhotoGallery(
                              displayName: profile.displayName,
                              photos: profile.photos,
                              height: 340,
                            ),
                            if (profile.online)
                              Positioned(
                                right: 16,
                                bottom: 16,
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    color: colors.online,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: colors.background,
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              profile.age == null
                                  ? profile.displayName
                                  : '${profile.displayName}, ${profile.age}',
                              style: AppTextStyles.sectionTitle
                                  .copyWith(fontSize: 22),
                            ),
                            if (profile.verified) ...[
                              const SizedBox(width: 6),
                              Icon(
                                Icons.verified_rounded,
                                size: 18,
                                color: colors.secondary,
                              ),
                            ],
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
                              [
                                if ((profile.city ?? '').isNotEmpty)
                                  profile.city!,
                                if ((profile.area ?? '').isNotEmpty)
                                  profile.area!,
                              ].join(' · '),
                              style: AppTextStyles.meta,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            Expanded(
                                child: _TrustCard(
                                    value: '${profile.meetupCount}',
                                    label: 'Встреч')),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                                child: _TrustCard(
                                    value: profile.rating.toStringAsFixed(1),
                                    label: 'Рейтинг')),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: _TrustCard(
                                value: profile.verified ? 'Подтв.' : 'Нет',
                                label: 'Профиль',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    _UserSection(
                      title: 'Настроение',
                      child: Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              size: 16,
                              color: colors.primary,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(profile.vibe ?? 'Спокойно',
                                      style: AppTextStyles.itemTitle),
                                  Text('Камерные встречи без спешки',
                                      style: AppTextStyles.meta),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    _UserSection(
                      title: 'Зачем здесь',
                      child: Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: profile.intent
                            .map(
                              (item) => Container(
                                height: 36,
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 14),
                                decoration: BoxDecoration(
                                  color: colors.card,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: colors.border),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      item == 'Свидания'
                                          ? Icons.favorite_border_rounded
                                          : Icons.groups_rounded,
                                      size: 14,
                                      color: colors.inkSoft,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(item,
                                        style: AppTextStyles.meta.copyWith(
                                            color: colors.inkSoft,
                                            fontSize: 13)),
                                  ],
                                ),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ),
                    _UserSection(
                      title: 'Интересы',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            children: profile.interests
                                .map(
                                  (interest) => Container(
                                    height: 36,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14),
                                    decoration: BoxDecoration(
                                      color: commonInterests.contains(interest)
                                          ? colors.primarySoft
                                          : colors.card,
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                        color:
                                            commonInterests.contains(interest)
                                                ? colors.primary
                                                    .withValues(alpha: 0.3)
                                                : colors.border,
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (commonInterests
                                            .contains(interest)) ...[
                                          Container(
                                            width: 6,
                                            height: 6,
                                            decoration: BoxDecoration(
                                              color: colors.primary,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                        ],
                                        Text(
                                          interest,
                                          style: AppTextStyles.meta.copyWith(
                                            color: colors.inkSoft,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            '${commonInterests.length} общих с тобой',
                            style: AppTextStyles.meta.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _UserSection(
                      title: 'О себе',
                      child: Text(
                        profile.bio ?? '',
                        style: AppTextStyles.bodySoft,
                      ),
                    ),
                  ],
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
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
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        child: Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  backgroundColor: colors.card,
                                  foregroundColor: colors.foreground,
                                  minimumSize:
                                      const Size(0, actionButtonHeight),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12),
                                  side: BorderSide(color: colors.border),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                                onPressed: () => context.pushRoute(
                                  AppRoute.createMeetup,
                                  queryParameters: {'inviteeUserId': userId},
                                ),
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    'Позвать на встречу',
                                    maxLines: 1,
                                    style: AppTextStyles.body.copyWith(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: colors.foreground,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: colors.foreground,
                                  foregroundColor: colors.background,
                                  minimumSize:
                                      const Size(0, actionButtonHeight),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                                onPressed: () async {
                                  final chatId = await ref
                                      .read(backendRepositoryProvider)
                                      .createOrGetDirectChat(userId);
                                  if (context.mounted) {
                                    context.pushRoute(
                                      AppRoute.personalChat,
                                      pathParameters: {'chatId': chatId},
                                    );
                                  }
                                },
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      Icon(
                                        LucideIcons.message_circle,
                                        size: 16,
                                        color: colors.background,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Написать',
                                        maxLines: 1,
                                        style: AppTextStyles.body.copyWith(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: colors.background,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

Future<void> _showProfileActions(
  BuildContext outerContext,
  WidgetRef ref,
  String userId,
) {
  return showModalBottomSheet<void>(
    context: outerContext,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.flag_outlined),
              title: const Text('Пожаловаться'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                outerContext.pushRoute(
                  AppRoute.report,
                  pathParameters: {'userId': userId},
                );
              },
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.block_outlined),
              title: const Text('Заблокировать'),
              onTap: () async {
                Navigator.of(sheetContext).pop();
                await ref.read(backendRepositoryProvider).createBlock(
                      targetUserId: userId,
                    );
                ref.invalidate(peopleProvider);
                ref.invalidate(personProfileProvider(userId));
                ref.invalidate(personalChatsProvider);
                ref.invalidate(meetupChatsProvider);
                ref.invalidate(safetyHubProvider);
                if (outerContext.mounted) {
                  ScaffoldMessenger.of(outerContext).showSnackBar(
                    const SnackBar(content: Text('Пользователь заблокирован')),
                  );
                  outerContext.pop();
                }
              },
            ),
          ],
        ),
      ),
    ),
  );
}

class _UserSection extends StatelessWidget {
  const _UserSection({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.caption.copyWith(letterSpacing: 1),
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _TrustCard extends StatelessWidget {
  const _TrustCard({
    required this.value,
    required this.label,
  });

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          Text(value, style: AppTextStyles.itemTitle),
          const SizedBox(height: 2),
          Text(label, style: AppTextStyles.caption),
        ],
      ),
    );
  }
}
