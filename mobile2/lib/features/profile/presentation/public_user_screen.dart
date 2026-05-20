import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class PublicUserScreen extends ConsumerStatefulWidget {
  const PublicUserScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<PublicUserScreen> createState() => _PublicUserScreenState();
}

class _PublicUserScreenState extends ConsumerState<PublicUserScreen> {
  bool _likeBusy = false;
  bool _chatBusy = false;
  bool _followBusy = false;
  bool _notificationsBusy = false;
  bool _liked = false;
  ProfileSocialData? _socialOverride;

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(publicUserProvider(widget.userId));
    final socialState = ref.watch(profileSocialProvider(widget.userId));
    final profile = profileState.valueOrNull;
    final meeting = _firstPublicMeeting(profile);
    final social =
        _socialOverride ?? socialState.valueOrNull ?? _profileSocial(profile);
    final liked = _liked || social.iLike || _viewerLiked(profile);

    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.only(bottom: 150),
            children: [
              _Hero(
                profile: profile,
                onMore: () => _showProfileMenu(context),
              ),
              if (profileState.isLoading && profile == null)
                const _LoadingSection()
              else if (profileState.hasError && profile == null)
                const _EmptySection(text: 'Профиль не загрузился')
              else ...[
                _Bio(profile: profile),
                _Interests(profile: profile),
                _Gallery(profile: profile),
                if (meeting == null)
                  const _EmptySection(text: 'Ближайших встреч нет')
                else
                  _MeetingCard(
                    meeting: meeting,
                  ),
                _Stats(profile: profile),
              ],
              _ReportLink(userId: widget.userId),
              const SizedBox(height: 80),
            ],
          ),
          _StickyActions(
            liked: liked,
            following: social.iFollow,
            notificationsEnabled: social.followNotifications,
            followers: social.followers,
            likeBusy: _likeBusy,
            chatBusy: _chatBusy,
            followBusy: _followBusy,
            notificationsBusy: _notificationsBusy,
            onLike: _like,
            onChat: _openDirectChat,
            onFollow: () => _setFollow(!social.iFollow),
            onNotifications: social.iFollow
                ? () => _setFollowNotifications(!social.followNotifications)
                : null,
          ),
        ],
      ),
    );
  }

  Future<void> _openDirectChat() async {
    if (_chatBusy) {
      return;
    }
    setState(() => _chatBusy = true);
    try {
      await ref
          .read(publicProfileActionsProvider)
          .createDirectChat(widget.userId);
      if (!mounted) {
        return;
      }
      context.go('/chats');
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось открыть чат')),
      );
    } finally {
      if (mounted) {
        setState(() => _chatBusy = false);
      }
    }
  }

  Future<void> _like() async {
    if (_likeBusy) {
      return;
    }
    setState(() => _likeBusy = true);
    try {
      await ref.read(publicProfileActionsProvider).like(widget.userId);
      if (!mounted) {
        return;
      }
      setState(() => _liked = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Лайк отправлен')),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось отправить лайк')),
      );
    } finally {
      if (mounted) {
        setState(() => _likeBusy = false);
      }
    }
  }

  Future<void> _setFollow(bool active) async {
    if (_followBusy) {
      return;
    }
    setState(() => _followBusy = true);
    try {
      final social = await ref
          .read(publicProfileActionsProvider)
          .setFollow(widget.userId, active);
      if (!mounted) {
        return;
      }
      setState(() => _socialOverride = social);
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось обновить подписку')),
      );
    } finally {
      if (mounted) {
        setState(() => _followBusy = false);
      }
    }
  }

  Future<void> _setFollowNotifications(bool enabled) async {
    if (_notificationsBusy) {
      return;
    }
    setState(() => _notificationsBusy = true);
    try {
      final social = await ref
          .read(publicProfileActionsProvider)
          .setFollowNotifications(widget.userId, enabled);
      if (!mounted) {
        return;
      }
      setState(() => _socialOverride = social);
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось обновить уведомления')),
      );
    } finally {
      if (mounted) {
        setState(() => _notificationsBusy = false);
      }
    }
  }

  void _showProfileMenu(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              decoration: BoxDecoration(
                color: DateasyColors.navSurface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: DateasyColors.border),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _SheetAction(
                    icon: LucideIcons.flag,
                    label: 'Пожаловаться или заблокировать',
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      context.go('/report?targetUserId=${widget.userId}');
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.profile, required this.onMore});

  final BackendCardItem? profile;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final compatibility = _compatibility(profile);
    final verified = profile?.raw['verified'] == true ||
        profile?.raw['isVerified'] == true ||
        profile?.raw['verificationStatus'] == 'verified';
    final frendlyPlus = _isFrendlyPlus(profile);

    return SizedBox(
      height: 420,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DateasyRemoteImage(
            imageUrl: profile?.imageUrl,
            usage: DateasyImageUsage.hero,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x4D1F0C3F),
                  Colors.transparent,
                  DateasyColors.background,
                ],
                stops: [0, 0.52, 1],
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 16,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _GlassIconButton(
                  icon: LucideIcons.chevronLeft,
                  onTap: () => context.go('/dating'),
                ),
                _GlassIconButton(icon: LucideIcons.ellipsis, onTap: onMore),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 18,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile?.title ?? 'Профиль',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              fontFamily: 'Sora',
                              fontSize: 30,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      if (verified || frendlyPlus) ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 7,
                          runSpacing: 7,
                          children: [
                            if (verified)
                              const _ProfileBadge(
                                label: 'Verified',
                                icon: LucideIcons.badgeCheck,
                                color: DateasyColors.lime,
                              ),
                            if (frendlyPlus)
                              const _ProfileBadge(
                                label: 'Frendly+',
                                icon: LucideIcons.crown,
                                color: DateasyColors.pink,
                              ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(
                            LucideIcons.mapPin,
                            size: 14,
                            color: DateasyColors.muted,
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              _publicLocation(profile),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    color: DateasyColors.muted,
                                    fontSize: 13,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (compatibility != null) ...[
                  const SizedBox(width: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      gradient: dateasyLimeGradient,
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x55BEFF67),
                          blurRadius: 22,
                          offset: Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Text(
                      '$compatibility%',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.backgroundDeep,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bio extends StatelessWidget {
  const _Bio({required this.profile});

  final BackendCardItem? profile;

  @override
  Widget build(BuildContext context) {
    final bio = _publicBio(profile);
    if (bio.isEmpty) {
      return const _EmptySection(text: 'Описание не добавлено');
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Text(
        bio,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
              height: 1.42,
            ),
      ),
    );
  }
}

class _Interests extends StatelessWidget {
  const _Interests({required this.profile});

  final BackendCardItem? profile;

  @override
  Widget build(BuildContext context) {
    final interests = _publicInterests(profile);
    return _Section(
      title: 'Интересы',
      top: 22,
      child: interests.isEmpty
          ? const _InlineEmpty(text: 'Интересы не добавлены')
          : Wrap(
              spacing: 8,
              runSpacing: 8,
              children: interests.map((interest) {
                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: DateasyColors.glass,
                    border: Border.all(color: DateasyColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _interestIcon(interest),
                        size: 14,
                        color: DateasyColors.lime,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        interest,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontSize: 13,
                            ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }
}

class _Gallery extends StatelessWidget {
  const _Gallery({required this.profile});

  final BackendCardItem? profile;

  @override
  Widget build(BuildContext context) {
    final photos = _publicPhotos(profile);
    return _Section(
      title: 'Галерея',
      top: 26,
      child: photos.isEmpty
          ? const _InlineEmpty(text: 'Фото не добавлены')
          : GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: photos.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemBuilder: (context, index) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: DateasyColors.border),
                    ),
                    child: DateasyRemoteImage(
                      imageUrl: photos[index],
                      usage: DateasyImageUsage.card,
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _MeetingCard extends StatelessWidget {
  const _MeetingCard({
    required this.meeting,
  });

  final BackendCardItem meeting;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Идёт на встречу',
      top: 26,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          height: 128,
          child: Stack(
            fit: StackFit.expand,
            children: [
              DateasyRemoteImage(
                imageUrl: meeting.imageUrl,
                usage: DateasyImageUsage.card,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, DateasyColors.background],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _formatMeetingDate(meeting.startsAt),
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.muted,
                                      fontSize: 11,
                                    ),
                          ),
                          Text(
                            meeting.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/meetings/${meeting.id}'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: dateasyLimeGradient,
                        ),
                        child: Text(
                          'Открыть',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DateasyColors.backgroundDeep,
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                      ),
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

class _Stats extends StatelessWidget {
  const _Stats({required this.profile});

  final BackendCardItem? profile;

  @override
  Widget build(BuildContext context) {
    final stats = _publicStats(profile);
    if (stats.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 0),
      child: Row(
        children: stats.map((stat) {
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: stat == stats.last ? 0 : 10),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  color: DateasyColors.glass,
                  border: Border.all(color: DateasyColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (stat.icon != null) ...[
                          Icon(stat.icon, size: 14, color: DateasyColors.lime),
                          const SizedBox(width: 4),
                        ],
                        Flexible(
                          child: Text(
                            stat.value,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  fontFamily: 'Sora',
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      stat.label,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                            fontSize: 11,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ReportLink extends StatelessWidget {
  const _ReportLink({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/report?targetUserId=$userId'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
        child: Row(
          children: [
            const Icon(LucideIcons.flag, size: 14, color: DateasyColors.muted),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Пожаловаться или заблокировать',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StickyActions extends StatelessWidget {
  const _StickyActions({
    required this.liked,
    required this.following,
    required this.notificationsEnabled,
    required this.followers,
    required this.likeBusy,
    required this.chatBusy,
    required this.followBusy,
    required this.notificationsBusy,
    required this.onLike,
    required this.onChat,
    required this.onFollow,
    required this.onNotifications,
  });

  final bool liked;
  final bool following;
  final bool notificationsEnabled;
  final int followers;
  final bool likeBusy;
  final bool chatBusy;
  final bool followBusy;
  final bool notificationsBusy;
  final VoidCallback onLike;
  final VoidCallback onChat;
  final VoidCallback onFollow;
  final VoidCallback? onNotifications;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.transparent,
              DateasyColors.background,
              DateasyColors.background,
            ],
          ),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            28,
            20,
            MediaQuery.paddingOf(context).bottom + 18,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: followBusy ? null : onFollow,
                      child: Container(
                        height: 48,
                        decoration: BoxDecoration(
                          color: following
                              ? DateasyColors.glass
                              : DateasyColors.pink,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: DateasyColors.border),
                        ),
                        child: Center(
                          child: followBusy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  following ? 'Вы подписаны' : 'Подписаться',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: following
                                            ? DateasyColors.foreground
                                            : DateasyColors.backgroundDeep,
                                        fontWeight: FontWeight.w800,
                                      ),
                                ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _BellAction(
                    enabled: notificationsEnabled,
                    busy: notificationsBusy,
                    onTap: onNotifications,
                  ),
                  const SizedBox(width: 10),
                  _FollowersCounter(count: followers),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _SquareAction(
                    icon: LucideIcons.sparkles,
                    iconColor: DateasyColors.lime,
                    onTap: () => context.go('/ai-builder'),
                  ),
                  const SizedBox(width: 12),
                  _SquareAction(
                    icon: LucideIcons.messageCircle,
                    busy: chatBusy,
                    onTap: onChat,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: likeBusy ? null : onLike,
                      child: Container(
                        height: 56,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: dateasyLimeGradient,
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x55BEFF67),
                              blurRadius: 26,
                              offset: Offset(0, 12),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (likeBusy)
                              const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            else
                              Icon(
                                liked ? Icons.favorite : Icons.favorite_border,
                                size: 21,
                                color: DateasyColors.backgroundDeep,
                              ),
                            const SizedBox(width: 8),
                            Text(
                              liked ? 'Лайкнут' : 'Лайк',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyLarge
                                  ?.copyWith(
                                    color: DateasyColors.backgroundDeep,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BellAction extends StatelessWidget {
  const _BellAction({
    required this.enabled,
    required this.busy,
    required this.onTap,
  });

  final bool enabled;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: enabled ? DateasyColors.lime : DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DateasyColors.border),
        ),
        child: busy
            ? const Center(
                child: SizedBox(
                  width: 17,
                  height: 17,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : Icon(
                enabled ? LucideIcons.bellRing : LucideIcons.bell,
                color: enabled
                    ? DateasyColors.backgroundDeep
                    : DateasyColors.foreground,
                size: 20,
              ),
      ),
    );
  }
}

class _FollowersCounter extends StatelessWidget {
  const _FollowersCounter({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Center(
        child: Text(
          '$count подписчиков',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.foreground,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

class _SquareAction extends StatelessWidget {
  const _SquareAction({
    required this.icon,
    required this.onTap,
    this.iconColor = DateasyColors.foreground,
    this.busy = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color iconColor;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: busy
            ? const Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : Icon(icon, size: 22, color: iconColor),
      ),
    );
  }
}

class _SheetAction extends StatelessWidget {
  const _SheetAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, size: 18, color: DateasyColors.muted),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.foreground,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    required this.top,
  });

  final String title;
  final Widget child;
  final double top;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, top, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 11,
                  letterSpacing: 1.2,
                ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _LoadingSection extends StatelessWidget {
  const _LoadingSection();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

class _EmptySection extends StatelessWidget {
  const _EmptySection({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
      child: _InlineEmpty(text: text),
    );
  }
}

class _InlineEmpty extends StatelessWidget {
  const _InlineEmpty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, size: 20, color: DateasyColors.foreground),
      ),
    );
  }
}

class _ProfileBadge extends StatelessWidget {
  const _ProfileBadge({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: DateasyColors.backgroundDeep),
          const SizedBox(width: 5),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: DateasyColors.backgroundDeep,
                  fontWeight: FontWeight.w900,
                ),
          ),
        ],
      ),
    );
  }
}

class _Stat {
  const _Stat(this.value, this.label, [this.icon]);

  final String value;
  final String label;
  final IconData? icon;
}

List<String> _publicInterests(BackendCardItem? profile) {
  final interests = profile?.raw['interests'];
  if (interests is! List) {
    return const [];
  }
  return interests
      .map((item) {
        if (item is Map) {
          return item['name'] ?? item['title'] ?? item['label'];
        }
        return item;
      })
      .map((item) => item?.toString().trim() ?? '')
      .where((item) => item.isNotEmpty)
      .toSet()
      .toList(growable: false);
}

String _publicBio(BackendCardItem? profile) {
  final subtitle = profile?.subtitle?.trim();
  if (subtitle != null && subtitle.isNotEmpty) {
    return subtitle;
  }
  return profile?.raw['bio']?.toString().trim() ?? '';
}

String _publicLocation(BackendCardItem? profile) {
  if (profile == null) {
    return '';
  }
  final distanceText = profile.raw['distance']?.toString().trim() ??
      profile.raw['distanceText']?.toString().trim();
  final distanceKm = _double(profile.raw['distanceKm']);
  final area = profile.raw['area']?.toString().trim();
  final city = profile.city?.trim();
  final online = profile.raw['online'] == true;
  final parts = [
    if (distanceText != null && distanceText.isNotEmpty)
      distanceText
    else if (distanceKm != null && distanceKm > 0)
      '${distanceKm.toStringAsFixed(1)} км'
    else if (area != null && area.isNotEmpty)
      area
    else if (city != null && city.isNotEmpty)
      city,
    if (online) 'онлайн',
  ];
  return parts.isEmpty ? (profile.subtitle ?? '') : parts.join(' · ');
}

List<String> _publicPhotos(BackendCardItem? profile) {
  if (profile == null) {
    return const [];
  }
  final photos = profile.raw['photos'];
  if (photos is! List) {
    final imageUrl = profile.imageUrl;
    return imageUrl == null || imageUrl.isEmpty ? const [] : [imageUrl];
  }
  final urls = photos
      .whereType<Map>()
      .map((photo) => photo['url'] ?? (photo['media'] as Map?)?['url'])
      .map((url) => url?.toString() ?? '')
      .where((url) => url.isNotEmpty)
      .toList(growable: false);
  if (urls.isNotEmpty) {
    return urls;
  }
  final imageUrl = profile.imageUrl;
  return imageUrl == null || imageUrl.isEmpty ? const [] : [imageUrl];
}

BackendCardItem? _firstPublicMeeting(BackendCardItem? profile) {
  final meetings = _publicMeetings(profile);
  return meetings.isEmpty ? null : meetings.first;
}

List<BackendCardItem> _publicMeetings(BackendCardItem? profile) {
  final raw = profile?.raw['upcomingEvents'] ??
      profile?.raw['events'] ??
      profile?.raw['meetings'];
  if (raw is! List) {
    return const [];
  }
  return raw
      .whereType<Map>()
      .map((item) => BackendCardItem.fromJson(
            item.map((key, value) => MapEntry('$key', value)),
          ))
      .where((item) => item.id.isNotEmpty)
      .toList(growable: false);
}

List<_Stat> _publicStats(BackendCardItem? profile) {
  if (profile == null) {
    return const [];
  }
  final stats = profile.raw['stats'];
  final meetings = _number(profile.raw['meetingsCount'] ??
      profile.raw['meetupCount'] ??
      profile.raw['eventsCount'] ??
      (stats is Map
          ? stats['meetingsCount'] ??
              stats['meetupCount'] ??
              stats['eventsCount']
          : null));
  final rating = _double(profile.raw['rating'] ??
      profile.raw['score'] ??
      (stats is Map ? stats['rating'] : null));
  final years = _number(profile.raw['yearsOnPlatform'] ??
      profile.raw['yearsInApp'] ??
      (stats is Map ? stats['yearsOnPlatform'] : null));
  return [
    if (meetings != null) _Stat('$meetings', 'Встреч'),
    if (rating != null) _Stat(_formatRating(rating), 'Рейтинг', Icons.star),
    if (years != null) _Stat('$years ${_yearsWord(years)}', 'В Frendly'),
  ];
}

int? _compatibility(BackendCardItem? profile) {
  final value = profile?.raw['compatibility'] ??
      profile?.raw['compatibilityPercent'] ??
      profile?.raw['matchPercent'];
  final parsed = _number(value);
  if (parsed == null || parsed <= 0) {
    return null;
  }
  return parsed.clamp(0, 100);
}

bool _viewerLiked(BackendCardItem? profile) {
  final social = profile?.raw['social'];
  if (social is Map) {
    return social['liked'] == true ||
        social['viewerLiked'] == true ||
        social['hasLike'] == true ||
        social['like'] == true;
  }
  return profile?.raw['liked'] == true ||
      profile?.raw['viewerLiked'] == true ||
      profile?.raw['hasLike'] == true;
}

ProfileSocialData _profileSocial(BackendCardItem? profile) {
  final raw = profile?.raw['social'];
  if (raw is Map) {
    return ProfileSocialData.fromJson(
      raw.map((key, value) => MapEntry('$key', value)),
    );
  }
  return const ProfileSocialData();
}

bool _isFrendlyPlus(BackendCardItem? profile) {
  final raw = profile?.raw;
  if (raw == null) {
    return false;
  }
  final subscription = raw['subscription'];
  final status =
      subscription is Map ? subscription['status']?.toString() : null;
  return raw['frendlyPlus'] == true ||
      raw['isFrendlyPlus'] == true ||
      raw['plus'] == true ||
      status == 'active' ||
      status == 'trial';
}

IconData _interestIcon(String interest) {
  final value = interest.toLowerCase();
  if (value.contains('coffee') || value.contains('коф')) {
    return LucideIcons.coffee;
  }
  if (value.contains('music') || value.contains('винил')) {
    return LucideIcons.music2;
  }
  if (value.contains('art') || value.contains('галер')) {
    return LucideIcons.palette;
  }
  return LucideIcons.sparkles;
}

String _formatMeetingDate(DateTime? date) {
  if (date == null) {
    return 'Дата не указана';
  }
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day.$month · $hour:$minute';
}

int? _number(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '');
}

double? _double(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value?.toString() ?? '');
}

String _formatRating(double rating) {
  return rating.toStringAsFixed(rating.truncateToDouble() == rating ? 0 : 1);
}

String _yearsWord(int years) {
  if (years % 10 == 1 && years % 100 != 11) {
    return 'год';
  }
  if ([2, 3, 4].contains(years % 10) &&
      !(years % 100 >= 12 && years % 100 <= 14)) {
    return 'года';
  }
  return 'лет';
}
