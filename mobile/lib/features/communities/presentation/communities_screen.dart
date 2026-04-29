import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CommunitiesScreen extends ConsumerWidget {
  const CommunitiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final communitiesAsync = ref.watch(communitiesFeedProvider);
    final subscription = ref.watch(subscriptionStateProvider).valueOrNull;
    final canCreate = hasFrendlyPlusAccess(subscription);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Frendly+ сервис',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkMute,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          'Сообщества',
                          style: AppTextStyles.screenTitle.copyWith(
                            color: colors.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Material(
                    color: colors.foreground,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => _openCreate(context, canCreate),
                      child: SizedBox.square(
                        dimension: 44,
                        child: Icon(
                          LucideIcons.plus,
                          color: colors.background,
                          size: 22,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: communitiesAsync.when(
                data: (feedState) => NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    if (notification.metrics.axis != Axis.vertical) {
                      return false;
                    }

                    final distanceToBottom =
                        notification.metrics.maxScrollExtent -
                            notification.metrics.pixels;
                    if (distanceToBottom <= 600) {
                      ref.read(communitiesFeedProvider.notifier).loadNextPage();
                    }
                    return false;
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 112),
                    itemCount: _communityFeedItemCount(feedState),
                    itemBuilder: (context, index) {
                      final communities = feedState.items;
                      final feedItemCount = communities.length * 2;

                      if (index >= 4 + feedItemCount) {
                        return _CommunitiesPaginationFooter(
                          feedState: feedState,
                          onRetry: () => ref
                              .read(communitiesFeedProvider.notifier)
                              .loadNextPage(),
                        );
                      }

                      return switch (index) {
                        0 => const _CommunitiesIntroCard(),
                        1 => const SizedBox(height: 24),
                        2 => _CommunitiesSectionHeader(
                            count: communities.length,
                          ),
                        3 => const SizedBox(height: 12),
                        _ => _CommunityFeedListItem(
                            index: index - 4,
                            communities: communities,
                          ),
                      };
                    },
                  ),
                ),
                loading: () => Center(
                  child: CircularProgressIndicator(color: colors.primary),
                ),
                error: (_, __) => Center(
                  child: Text(
                    'Не получилось загрузить сообщества',
                    style: AppTextStyles.body.copyWith(color: colors.inkMute),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openCreate(BuildContext context, bool canCreate) {
    if (canCreate) {
      context.pushRoute(AppRoute.createCommunity);
      return;
    }

    context.pushRoute(AppRoute.paywall);
  }
}

int _communityFeedItemCount(CommunitiesFeedState feedState) {
  final hasFooter = feedState.hasMore ||
      feedState.loadingMore ||
      feedState.loadMoreError != null;
  return 4 + feedState.items.length * 2 + (hasFooter ? 1 : 0);
}

class _CommunityFeedListItem extends StatelessWidget {
  const _CommunityFeedListItem({
    required this.index,
    required this.communities,
  });

  final int index;
  final List<Community> communities;

  @override
  Widget build(BuildContext context) {
    if (index.isOdd) {
      return const SizedBox(height: 12);
    }

    return _CommunityListCard(community: communities[index ~/ 2]);
  }
}

class _CommunitiesPaginationFooter extends StatelessWidget {
  const _CommunitiesPaginationFooter({
    required this.feedState,
    required this.onRetry,
  });

  final CommunitiesFeedState feedState;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    if (feedState.loadMoreError != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Center(
          child: TextButton(
            onPressed: onRetry,
            child: Text(
              'Повторить загрузку',
              style: AppTextStyles.meta.copyWith(color: colors.primary),
            ),
          ),
        ),
      );
    }

    if (feedState.loadingMore) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Center(
          child: SizedBox.square(
            dimension: 24,
            child: CircularProgressIndicator(
              color: colors.primary,
              strokeWidth: 2,
            ),
          ),
        ),
      );
    }

    return const SizedBox(height: 24);
  }
}

class _CommunitiesIntroCard extends StatelessWidget {
  const _CommunitiesIntroCard();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return CommunityInfoCard(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.secondarySoft,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                LucideIcons.crown,
                color: colors.secondary,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Новый сервис'.toUpperCase(),
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Клубы, чаты и встречи в одном месте',
                    style: AppTextStyles.itemTitle.copyWith(
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Сообщество живёт как отдельный чат: новости, общее медиа-хранилище и своя вкладка с ближайшими встречами.',
                    style: AppTextStyles.meta.copyWith(
                      color: colors.inkMute,
                      fontSize: 12,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Row(
          children: [
            Expanded(
              child: CommunityStatCard(
                icon: LucideIcons.megaphone,
                value: '2',
              ),
            ),
            SizedBox(width: 8),
            Expanded(
              child: CommunityStatCard(
                icon: LucideIcons.images,
                value: '68',
              ),
            ),
            SizedBox(width: 8),
            Expanded(
              child: CommunityStatCard(
                icon: LucideIcons.users,
                value: '231',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _CommunitiesSectionHeader extends StatelessWidget {
  const _CommunitiesSectionHeader({
    required this.count,
  });

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Твои Frendly+'.toUpperCase(),
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Активные сообщества',
                style: AppTextStyles.sectionTitle.copyWith(
                  color: colors.foreground,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        Text(
          '$count клуба',
          style: AppTextStyles.meta.copyWith(
            color: colors.inkMute,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _CommunityListCard extends StatelessWidget {
  const _CommunityListCard({
    required this.community,
  });

  final Community community;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: AppRadii.cardBorder,
      child: InkWell(
        onTap: () => context.pushRoute(
          AppRoute.communityDetail,
          pathParameters: {'communityId': community.id},
        ),
        borderRadius: AppRadii.cardBorder,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: colors.border),
            borderRadius: AppRadii.cardBorder,
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommunityAvatarBox(emoji: community.avatar),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                community.name,
                                style: AppTextStyles.itemTitle.copyWith(
                                  color: colors.foreground,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              CommunityBadge(
                                icon: LucideIcons.crown,
                                label: 'Frendly+',
                                background: colors.secondarySoft,
                                foreground: colors.secondary,
                              ),
                              if (community.privacy == CommunityPrivacy.private)
                                CommunityBadge(
                                  icon: LucideIcons.lock,
                                  label: 'Закрытое',
                                  background: colors.muted,
                                  foreground: colors.inkSoft,
                                ),
                            ],
                          ),
                        ),
                        Icon(
                          LucideIcons.chevron_right,
                          color: colors.inkMute,
                          size: 16,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${community.members} участников',
                            style: AppTextStyles.meta.copyWith(
                              color: colors.foreground,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (community.unread > 0)
                          Container(
                            constraints: const BoxConstraints(
                              minWidth: 22,
                              minHeight: 22,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            decoration: BoxDecoration(
                              color: colors.primary,
                              borderRadius: AppRadii.pillBorder,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${community.unread}',
                              style: AppTextStyles.caption.copyWith(
                                color: colors.primaryForeground,
                                fontFamily: 'Sora',
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        BbAvatarStack(
                          names: community.memberNames,
                          size: BbAvatarSize.xs,
                          max: 4,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        if (community.nextMeetup case final meetup?)
                          Expanded(
                            child: Text.rich(
                              TextSpan(
                                text: 'Ближайшая: ',
                                children: [
                                  TextSpan(
                                    text: meetup.time,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                              textAlign: TextAlign.right,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.caption.copyWith(
                                color: colors.inkMute,
                                fontSize: 11,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
