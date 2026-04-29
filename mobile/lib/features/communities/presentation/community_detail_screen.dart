import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum _CommunityTab { overview, meetups }

class CommunityDetailScreen extends ConsumerStatefulWidget {
  const CommunityDetailScreen({
    required this.communityId,
    super.key,
  });

  final String communityId;

  @override
  ConsumerState<CommunityDetailScreen> createState() =>
      _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends ConsumerState<CommunityDetailScreen> {
  _CommunityTab _tab = _CommunityTab.overview;
  bool _joined = false;

  @override
  void didUpdateWidget(covariant CommunityDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.communityId != widget.communityId) {
      _joined = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final communityAsync = ref.watch(communityProvider(widget.communityId));

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
        final joined = community.joined || _joined;

        return Scaffold(
          backgroundColor: colors.background,
          body: SafeArea(
            bottom: false,
            child: Column(
              children: [
                CommunityBackHeader(
                  title: community.name,
                  subtitle: 'Сообщество',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (community.isOwner) ...[
                        CommunityRoundButton(
                          key: const Key('community-detail-chat-button'),
                          icon: LucideIcons.message_circle,
                          background: colors.card,
                          borderColor: colors.border,
                          onTap: () => context.pushRoute(
                            AppRoute.communityChat,
                            pathParameters: {'communityId': community.id},
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      CommunityRoundButton(
                        icon: LucideIcons.plus,
                        background: colors.foreground,
                        foreground: colors.background,
                        onTap: () => context.pushRoute(
                          AppRoute.createMeetup,
                          queryParameters: {'communityId': community.id},
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                    children: [
                      _CommunityHeroCard(
                        community: community,
                        joined: joined,
                        onJoin: () {
                          if (community.privacy == CommunityPrivacy.public) {
                            setState(() {
                              _joined = true;
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 20),
                      _CommunityTabs(
                        selected: _tab,
                        onChanged: (value) {
                          setState(() {
                            _tab = value;
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      if (_tab == _CommunityTab.overview)
                        _CommunityOverview(community: community)
                      else
                        _CommunityMeetups(community: community),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CommunityHeroCard extends StatelessWidget {
  const _CommunityHeroCard({
    required this.community,
    required this.joined,
    required this.onJoin,
  });

  final Community community;
  final bool joined;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final private = community.privacy == CommunityPrivacy.private;
    final showJoinStatus = !community.isOwner && !joined;
    return CommunityInfoCard(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CommunityAvatarBox(
              emoji: community.avatar,
              size: 64,
              radius: 22,
              fontSize: 34,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        community.name,
                        style: AppTextStyles.sectionTitle.copyWith(
                          color: colors.foreground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      CommunityBadge(
                        label: 'Frendly+',
                        background: colors.secondarySoft,
                        foreground: colors.secondary,
                      ),
                      if (private)
                        CommunityBadge(
                          icon: LucideIcons.lock,
                          label: 'Закрытое',
                          background: colors.muted,
                          foreground: colors.inkSoft,
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      BbAvatarStack(
                        names: community.memberNames,
                        size: BbAvatarSize.sm,
                        max: 4,
                      ),
                      const Spacer(),
                      Text(
                        '${community.members} участников',
                        style: AppTextStyles.meta.copyWith(
                          color: colors.foreground,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          community.description,
          style: AppTextStyles.meta.copyWith(
            color: colors.inkMute,
            fontSize: 12,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: CommunityStatCard(
                icon: LucideIcons.megaphone,
                value: '${community.news.length}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: () => context.pushRoute(
                    AppRoute.communityMedia,
                    pathParameters: {'communityId': community.id},
                  ),
                  borderRadius: BorderRadius.circular(16),
                  child: CommunityStatCard(
                    icon: LucideIcons.images,
                    value: community.sharedMediaLabel.split(' ').first,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CommunityStatCard(
                icon: LucideIcons.users,
                value: '${community.members}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _SocialPill(
              icon: LucideIcons.send,
              label: 'Telegram',
              value: community.socialLinks[0].handle,
            ),
            const SizedBox(width: 8),
            _SocialPill(
              icon: LucideIcons.camera,
              label: 'Instagram',
              value: community.socialLinks[1].handle,
            ),
            const SizedBox(width: 8),
            _SocialPill(
              icon: LucideIcons.music_2,
              label: 'TikTok',
              value: community.socialLinks[2].handle,
            ),
          ],
        ),
        if (showJoinStatus) ...[
          const SizedBox(height: 12),
          _JoinStatusButton(
            privacy: community.privacy,
            joined: joined,
            onTap: onJoin,
          ),
        ],
      ],
    );
  }
}

class _SocialPill extends StatelessWidget {
  const _SocialPill({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colors.background,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: colors.inkSoft),
            const SizedBox(height: 8),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: colors.inkMute),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.meta.copyWith(
                color: colors.foreground,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _JoinStatusButton extends StatelessWidget {
  const _JoinStatusButton({
    required this.privacy,
    required this.joined,
    required this.onTap,
  });

  final CommunityPrivacy privacy;
  final bool joined;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final private = privacy == CommunityPrivacy.private;
    final label = private
        ? 'Вступление по заявке'
        : joined
            ? 'Ты в сообществе'
            : 'Вступить в сообщество';
    final icon = private
        ? LucideIcons.lock
        : joined
            ? LucideIcons.check
            : LucideIcons.users;

    return Material(
      color: private || joined ? colors.background : colors.foreground,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: private || joined ? null : onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: private || joined ? colors.border : colors.foreground,
            ),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: private || joined ? colors.inkSoft : colors.background,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: AppTextStyles.meta.copyWith(
                  color:
                      private || joined ? colors.foreground : colors.background,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CommunityTabs extends StatelessWidget {
  const _CommunityTabs({
    required this.selected,
    required this.onChanged,
  });

  final _CommunityTab selected;
  final ValueChanged<_CommunityTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _CommunityTabButton(
              label: 'Обзор',
              active: selected == _CommunityTab.overview,
              onTap: () => onChanged(_CommunityTab.overview),
            ),
          ),
          Expanded(
            child: _CommunityTabButton(
              label: 'Ближайшие встречи',
              active: selected == _CommunityTab.meetups,
              onTap: () => onChanged(_CommunityTab.meetups),
            ),
          ),
        ],
      ),
    );
  }
}

class _CommunityTabButton extends StatelessWidget {
  const _CommunityTabButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.background : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: active ? AppShadows.soft : null,
          ),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.itemTitle.copyWith(
              color: active ? colors.foreground : colors.inkMute,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _CommunityOverview extends StatelessWidget {
  const _CommunityOverview({
    required this.community,
  });

  final Community community;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(LucideIcons.megaphone, size: 16, color: colors.inkSoft),
                const SizedBox(width: 8),
                Text(
                  'Новости',
                  style: AppTextStyles.itemTitle.copyWith(
                    color: colors.foreground,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            if (community.isOwner)
              _PublishNewsButton(
                onTap: () => context.pushRoute(
                  AppRoute.createCommunityPost,
                  pathParameters: {'communityId': community.id},
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        for (final item in community.news) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.card,
              border: Border.all(color: colors.border),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: AppTextStyles.bodySoft.copyWith(
                          color: colors.foreground,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      item.time,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item.blurb,
                  style: AppTextStyles.meta.copyWith(
                    color: colors.inkMute,
                    fontSize: 12,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _PublishNewsButton extends StatelessWidget {
  const _PublishNewsButton({
    required this.onTap,
  });

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.foreground,
      borderRadius: AppRadii.pillBorder,
      child: InkWell(
        key: const Key('community-detail-publish-post-button'),
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                LucideIcons.plus,
                size: 14,
                color: colors.background,
              ),
              const SizedBox(width: 4),
              Text(
                'Опубликовать',
                style: AppTextStyles.meta.copyWith(
                  color: colors.background,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CommunityMeetups extends StatelessWidget {
  const _CommunityMeetups({
    required this.community,
  });

  final Community community;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final meetup in community.meetups) ...[
          _CommunityMeetupCard(meetup: meetup),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _CommunityMeetupCard extends StatelessWidget {
  const _CommunityMeetupCard({
    required this.meetup,
  });

  final CommunityMeetupItem meetup;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Semantics(
      button: true,
      child: InkWell(
        borderRadius: AppRadii.cardBorder,
        onTap: () => context.pushRoute(
          AppRoute.eventDetail,
          pathParameters: {'eventId': meetup.id},
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.card,
            border: Border.all(color: colors.border),
            borderRadius: AppRadii.cardBorder,
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommunityAvatarBox(
                emoji: meetup.emoji,
                size: 48,
                radius: 16,
                fontSize: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            meetup.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.itemTitle.copyWith(
                              color: colors.foreground,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          meetup.time,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      meetup.format,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: colors.secondarySoft,
                            borderRadius: AppRadii.pillBorder,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                LucideIcons.users,
                                size: 14,
                                color: colors.secondary,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                '${meetup.going} идут',
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.secondary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          meetup.place,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                        TextButton(
                          onPressed: () =>
                              context.pushRoute(AppRoute.createMeetup),
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            'Создать похожую',
                            style: AppTextStyles.meta.copyWith(
                              color: colors.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
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
