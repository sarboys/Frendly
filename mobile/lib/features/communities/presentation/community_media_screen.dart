import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CommunityMediaScreen extends ConsumerWidget {
  const CommunityMediaScreen({
    required this.communityId,
    super.key,
  });

  final String communityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final communityAsync = ref.watch(communityProvider(communityId));
    final mediaAsync = ref.watch(communityMediaFeedProvider(communityId));

    return communityAsync.when(
      loading: () => Scaffold(
        backgroundColor: colors.background,
        body: Center(
          child: CircularProgressIndicator(color: colors.primary),
        ),
      ),
      error: (_, __) => const CommunityMissingState(),
      data: (community) {
        if (community == null) {
          return const CommunityMissingState();
        }

        return Scaffold(
          backgroundColor: colors.background,
          body: SafeArea(
            bottom: false,
            child: Column(
              children: [
                CommunityBackHeader(
                  title: community.name,
                  subtitle: 'Медиа сообщества',
                ),
                Expanded(
                  child: NotificationListener<ScrollNotification>(
                    onNotification: (notification) {
                      if (notification.metrics.extentAfter <= 600) {
                        ref
                            .read(
                              communityMediaFeedProvider(communityId).notifier,
                            )
                            .loadNextPage();
                      }
                      return false;
                    },
                    child: CustomScrollView(
                      slivers: [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                          sliver: SliverToBoxAdapter(
                            child: _MediaSummaryCard(community: community),
                          ),
                        ),
                        ..._buildMediaSlivers(colors, mediaAsync),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildMediaSlivers(
    BigBreakThemeColors colors,
    AsyncValue<CommunityMediaFeedState> mediaAsync,
  ) {
    return mediaAsync.when(
      loading: () => [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: CircularProgressIndicator(color: colors.primary),
          ),
        ),
      ],
      error: (_, __) => [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text(
              'Не удалось загрузить медиа',
              style: AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
            ),
          ),
        ),
      ],
      data: (feed) => [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.12,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return _MediaItemCard(item: feed.items[index]);
              },
              childCount: feed.items.length,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 32,
            child: feed.loadingMore
                ? Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: colors.primary,
                        strokeWidth: 2,
                      ),
                    ),
                  )
                : null,
          ),
        ),
      ],
    );
  }
}

class _MediaSummaryCard extends StatelessWidget {
  const _MediaSummaryCard({
    required this.community,
  });

  final Community community;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.images, size: 16, color: colors.inkSoft),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  community.sharedMediaLabel,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.itemTitle.copyWith(
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Общий архив',
            style: AppTextStyles.meta.copyWith(
              color: colors.inkMute,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaItemCard extends StatelessWidget {
  const _MediaItemCard({
    required this.item,
  });

  final CommunityMediaItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.emoji, style: const TextStyle(fontSize: 32, height: 1)),
          const Spacer(),
          Text(
            item.label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodySoft.copyWith(
              color: colors.foreground,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            communityMediaKindLabel(item.kind),
            style: AppTextStyles.caption.copyWith(
              color: colors.inkMute,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
