import 'dart:ui';

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/dating/presentation/dating_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/dating_profile.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/widgets/bb_profile_photo_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DatingScreen extends ConsumerStatefulWidget {
  const DatingScreen({super.key});

  @override
  ConsumerState<DatingScreen> createState() => _DatingScreenState();
}

class _DatingScreenState extends ConsumerState<DatingScreen> {
  String _tab = 'discover';
  bool _submitting = false;
  final Map<String, int> _photoIndexes = <String, int>{};
  final Set<String> _handledProfileIds = <String>{};
  final Set<String> _savedProfileIds = <String>{};

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final subscription = ref.watch(subscriptionStateProvider).valueOrNull;
    final premium = hasPremiumDatingAccess(subscription);
    final discoverAsync = premium ? ref.watch(datingDiscoverProvider) : null;
    final likesAsync = premium ? ref.watch(datingLikesProvider) : null;
    final likes = likesAsync?.valueOrNull ?? const <DatingProfileData>[];
    final discover = discoverAsync?.valueOrNull ?? const <DatingProfileData>[];
    final current = _currentProfile(discover);

    return Material(
      color: colors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _DatingHeader(
              premium: premium,
              activeTab: _tab,
              onBack: () => _handleBack(context),
              onDate: premium ? () => _openDateCreateRoot(context) : null,
              onTabChanged: (tab) {
                setState(() {
                  _tab = tab;
                });
              },
            ),
            Expanded(
              child: premium
                  ? (_tab == 'discover'
                      ? _buildDiscover(context, current, discoverAsync)
                      : _buildLikes(context, likesAsync, likes))
                  : _buildLocked(context),
            ),
          ],
        ),
      ),
    );
  }

  void _handleBack(BuildContext context) async {
    final popped = await Navigator.of(context).maybePop();
    if (!popped && context.mounted) {
      context.goRoute(AppRoute.tonight);
    }
  }

  Widget _buildLocked(BuildContext context) {
    final colors = AppColors.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: (constraints.maxHeight - 48).clamp(0, double.infinity),
            ),
            child: IntrinsicHeight(
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: colors.border),
                      boxShadow: AppShadows.soft,
                    ),
                    child: Column(
                      children: [
                        AspectRatio(
                          aspectRatio: 0.82,
                          child: Container(
                            width: double.infinity,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  colors.primarySoft,
                                  colors.secondarySoft,
                                  colors.muted,
                                ],
                              ),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 96,
                                  height: 96,
                                  decoration: BoxDecoration(
                                    color: colors.background,
                                    borderRadius: BorderRadius.circular(29),
                                    border: Border.all(color: colors.border),
                                    boxShadow: AppShadows.soft,
                                  ),
                                  alignment: Alignment.center,
                                  child: const Text(
                                    '💘',
                                    style: TextStyle(fontSize: 42),
                                  ),
                                ),
                                const SizedBox(height: 20),
                                Text(
                                  'Отдельный сервис дейтинга внутри Frendly+',
                                  style: AppTextStyles.screenTitle.copyWith(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w600,
                                    height: 1.08,
                                    letterSpacing: 0,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  'Свайпы, входящие лайки и быстрый переход к свиданию, только для подписки.',
                                  style: AppTextStyles.bodySoft.copyWith(
                                    color: colors.inkMute,
                                    fontSize: 14,
                                    height: 1.45,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Row(
                          children: [
                            Expanded(
                              child: _DatingMiniStat(
                                label: 'Свайпы',
                                value: '∞',
                              ),
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: _DatingMiniStat(
                                label: 'Лайки',
                                value: '2',
                              ),
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: _DatingMiniStat(
                                label: 'Date CTA',
                                value: '1 tap',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: colors.border),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _LockedFeatureRow(
                          title: 'Свайп-вправо / влево',
                          subtitle:
                              'Как в Tinder, но внутри текущего профиля Frendly',
                        ),
                        SizedBox(height: 12),
                        _LockedFeatureRow(
                          title: 'Кто лайкнул',
                          subtitle: 'Отдельная вкладка для подписчиков',
                        ),
                        SizedBox(height: 12),
                        _LockedFeatureRow(
                          title: 'Перевести в свидание',
                          subtitle: 'Сразу открыть date-flow с идеями места',
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: FilledButton(
                      onPressed: () => context.pushRoute(AppRoute.paywall),
                      child: Text(
                        'Открыть Frendly+',
                        style: AppTextStyles.button.copyWith(
                          color: colors.primaryForeground,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDiscover(
    BuildContext context,
    DatingProfileData? current,
    AsyncValue<List<DatingProfileData>>? discoverAsync,
  ) {
    final colors = AppColors.of(context);

    return discoverAsync!.when(
      data: (profiles) {
        if (profiles.isEmpty || current == null) {
          return Center(
            child: Text(
              'Пока нет новых профилей',
              style: AppTextStyles.body.copyWith(color: colors.inkMute),
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 112),
          children: [
            _SwipeableDatingCard(
              key: const ValueKey('dating-discover-card'),
              enabled: !_submitting,
              onSwipe: (direction) => _handleAction(
                context,
                current,
                action:
                    direction == DatingSwipeDirection.like ? 'like' : 'pass',
              ),
              child: _DatingProfileCard(
                profile: current,
                saved: _savedProfileIds.contains(current.userId),
                photoIndex: _photoIndexFor(current),
                actionsEnabled: !_submitting,
                onPreviousPhoto:
                    _submitting ? null : () => _showPreviousPhoto(current),
                onNextPhoto: _submitting ? null : () => _showNextPhoto(current),
                onSaveToggle: () {
                  setState(() {
                    if (_savedProfileIds.contains(current.userId)) {
                      _savedProfileIds.remove(current.userId);
                    } else {
                      _savedProfileIds.add(current.userId);
                    }
                  });
                },
                onOpenProfile: () => context.pushRoute(
                  AppRoute.userProfile,
                  pathParameters: {'userId': current.userId},
                ),
                onSkip: () => _handleAction(context, current, action: 'pass'),
                onSuper: () => _handleAction(
                  context,
                  current,
                  action: 'super_like',
                ),
                onLike: () => _handleAction(context, current, action: 'like'),
                onOpenDateCreate: () => _openDateCreate(
                  context,
                  current.userId,
                ),
              ),
            ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Center(
        child: Text(
          'Не получилось загрузить дейтинг',
          style: AppTextStyles.body.copyWith(color: colors.inkMute),
        ),
      ),
    );
  }

  Widget _buildLikes(
    BuildContext context,
    AsyncValue<List<DatingProfileData>>? likesAsync,
    List<DatingProfileData> likes,
  ) {
    final colors = AppColors.of(context);

    return likesAsync!.when(
      data: (_) {
        if (likes.isEmpty) {
          return Center(
            child: Text(
              'Пока нет входящих лайков',
              style: AppTextStyles.body.copyWith(color: colors.inkMute),
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 112),
          itemCount: likes.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final profile = likes[index];
            return InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => context.pushRoute(
                AppRoute.userProfile,
                pathParameters: {'userId': profile.userId},
              ),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: colors.border),
                  boxShadow: AppShadows.soft,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: colors.primarySoft,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      clipBehavior: Clip.antiAlias,
                      alignment: Alignment.center,
                      child: _DatingThumbnail(profile: profile),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  profile.age == null
                                      ? profile.name
                                      : '${profile.name}, ${profile.age}',
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTextStyles.itemTitle.copyWith(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                LucideIcons.eye,
                                size: 12,
                                color: colors.primary,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'лайкнул(а)',
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            profile.about,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.bodySoft.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.favorite_rounded,
                      size: 18,
                      color: colors.primary,
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => Center(
        child: Text(
          'Не получилось загрузить лайки',
          style: AppTextStyles.body.copyWith(color: colors.inkMute),
        ),
      ),
    );
  }

  Future<void> _handleAction(
    BuildContext context,
    DatingProfileData profile, {
    required String action,
  }) async {
    if (_submitting) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final result = await ref.read(backendRepositoryProvider).sendDatingAction(
            targetUserId: profile.userId,
            action: action,
          );

      if (mounted) {
        setState(() {
          _handledProfileIds.add(profile.userId);
          _photoIndexes.remove(profile.userId);
        });
      }

      ref.invalidate(datingDiscoverProvider);
      ref.invalidate(datingLikesProvider);

      if (!context.mounted) {
        return;
      }

      if (result.matched && result.chatId != null) {
        await context.pushRoute(
          AppRoute.personalChat,
          pathParameters: {'chatId': result.chatId!},
        );
      }
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось сохранить действие')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  DatingProfileData? _currentProfile(List<DatingProfileData> profiles) {
    if (profiles.isEmpty) {
      return null;
    }

    for (final profile in profiles) {
      if (!_handledProfileIds.contains(profile.userId)) {
        return profile;
      }
    }

    return null;
  }

  List<ProfilePhoto> _photosFor(DatingProfileData profile) {
    if (profile.photos.isNotEmpty) {
      return profile.photos;
    }
    if (profile.avatarUrl == null || profile.avatarUrl!.isEmpty) {
      return const [];
    }
    return [
      ProfilePhoto(
        id: '${profile.userId}-avatar',
        url: profile.avatarUrl!,
        order: 0,
      ),
    ];
  }

  int _photoIndexFor(DatingProfileData profile) {
    final photos = _photosFor(profile);
    if (photos.isEmpty) {
      return 0;
    }
    final stored = _photoIndexes[profile.userId] ?? 0;
    return stored.clamp(0, photos.length - 1);
  }

  void _showPreviousPhoto(DatingProfileData profile) {
    final photos = _photosFor(profile);
    if (photos.length <= 1) {
      return;
    }
    final currentIndex = _photoIndexFor(profile);
    if (currentIndex == 0) {
      return;
    }
    setState(() {
      _photoIndexes[profile.userId] = currentIndex - 1;
    });
  }

  void _showNextPhoto(DatingProfileData profile) {
    final photos = _photosFor(profile);
    if (photos.length <= 1) {
      return;
    }
    final currentIndex = _photoIndexFor(profile);
    if (currentIndex >= photos.length - 1) {
      return;
    }
    setState(() {
      _photoIndexes[profile.userId] = currentIndex + 1;
    });
  }

  void _openDateCreate(BuildContext context, String inviteeUserId) {
    context.pushRoute(
      AppRoute.createMeetup,
      queryParameters: {
        'mode': 'dating',
        'inviteeUserId': inviteeUserId,
      },
    );
  }

  void _openDateCreateRoot(BuildContext context) {
    context.pushRoute(
      AppRoute.createMeetup,
      queryParameters: const {'mode': 'dating'},
    );
  }
}

class _DatingHeader extends StatelessWidget {
  const _DatingHeader({
    required this.premium,
    required this.activeTab,
    required this.onTabChanged,
    required this.onBack,
    required this.onDate,
  });

  final bool premium;
  final String activeTab;
  final ValueChanged<String> onTabChanged;
  final VoidCallback onBack;
  final VoidCallback? onDate;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(
          bottom: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            height: 40,
            child: IconButton(
              onPressed: onBack,
              padding: EdgeInsets.zero,
              icon: Icon(
                LucideIcons.arrow_left,
                size: 24,
                color: colors.foreground,
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: premium ? _buildTabs(colors) : _buildPremiumBadge(colors),
            ),
          ),
          SizedBox(
            width: 40,
            child: premium
                ? Align(
                    alignment: Alignment.centerRight,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: onDate,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 2,
                          vertical: 8,
                        ),
                        child: Text(
                          'Date',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs(BigBreakThemeColors colors) {
    return Container(
      height: 42,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _HeaderTabButton(
            label: 'Лента',
            active: activeTab == 'discover',
            onTap: () => onTabChanged('discover'),
          ),
          _HeaderTabButton(
            label: 'Лайки',
            active: activeTab == 'likes',
            onTap: () => onTabChanged('likes'),
          ),
        ],
      ),
    );
  }

  Widget _buildPremiumBadge(BigBreakThemeColors colors) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.sparkles, size: 14, color: colors.primary),
          const SizedBox(width: 6),
          Text(
            'Frendly+ Dating',
            style: AppTextStyles.meta.copyWith(
              color: colors.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderTabButton extends StatelessWidget {
  const _HeaderTabButton({
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

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: active ? colors.background : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          boxShadow: active ? AppShadows.soft : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.button.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: active ? colors.foreground : colors.inkMute,
            letterSpacing: 0,
          ),
        ),
      ),
    );
  }
}

class _DatingMiniStat extends StatelessWidget {
  const _DatingMiniStat({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      height: 72,
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: AppTextStyles.cardTitle),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(color: colors.inkMute),
          ),
        ],
      ),
    );
  }
}

class _LockedFeatureRow extends StatelessWidget {
  const _LockedFeatureRow({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: AppTextStyles.meta.copyWith(
            color: colors.inkMute,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}

enum DatingSwipeDirection { pass, like }

class _SwipeableDatingCard extends StatefulWidget {
  const _SwipeableDatingCard({
    required this.child,
    required this.onSwipe,
    super.key,
    this.enabled = true,
  });

  final Widget child;
  final bool enabled;
  final void Function(DatingSwipeDirection direction) onSwipe;

  @override
  State<_SwipeableDatingCard> createState() => _SwipeableDatingCardState();
}

class _SwipeableDatingCardState extends State<_SwipeableDatingCard> {
  final ValueNotifier<double> _dragDx = ValueNotifier<double>(0);

  @override
  void didUpdateWidget(covariant _SwipeableDatingCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.child != widget.child) {
      _dragDx.value = 0;
    }
    if (!widget.enabled && _dragDx.value != 0) {
      _dragDx.value = 0;
    }
  }

  @override
  void dispose() {
    _dragDx.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxVisualDx =
            (constraints.maxWidth * 0.34).clamp(96.0, 132.0).toDouble();
        final swipeThreshold = (maxVisualDx * 0.75).clamp(72.0, 110.0);

        return GestureDetector(
          onHorizontalDragUpdate: widget.enabled
              ? (details) => _handleDragUpdate(details, maxVisualDx)
              : null,
          onHorizontalDragEnd:
              widget.enabled ? (_) => _handleDragEnd(swipeThreshold) : null,
          onHorizontalDragCancel: widget.enabled ? _resetDrag : null,
          child: ValueListenableBuilder<double>(
            valueListenable: _dragDx,
            child: KeyedSubtree(
              key: const ValueKey('dating-swipeable-card-surface'),
              child: RepaintBoundary(child: widget.child),
            ),
            builder: (context, dx, child) {
              final direction = dx == 0
                  ? null
                  : dx > 0
                      ? DatingSwipeDirection.like
                      : DatingSwipeDirection.pass;

              return Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..translateByDouble(dx, 0, 0, 1)
                  ..rotateZ(dx / 1800),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    child!,
                    if (direction != null)
                      Positioned(
                        top: 26,
                        right:
                            direction == DatingSwipeDirection.like ? 26 : null,
                        left:
                            direction == DatingSwipeDirection.pass ? 26 : null,
                        child: _SwipeDecisionPill(direction: direction),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  void _handleDragUpdate(DragUpdateDetails details, double maxVisualDx) {
    final next = (_dragDx.value + details.delta.dx)
        .clamp(-maxVisualDx, maxVisualDx)
        .toDouble();
    if (next != _dragDx.value) {
      _dragDx.value = next;
    }
  }

  void _handleDragEnd(double threshold) {
    final dx = _dragDx.value;
    final direction = dx >= threshold
        ? DatingSwipeDirection.like
        : dx <= -threshold
            ? DatingSwipeDirection.pass
            : null;

    _resetDrag();

    if (direction != null) {
      widget.onSwipe(direction);
    }
  }

  void _resetDrag() {
    if (_dragDx.value != 0) {
      _dragDx.value = 0;
    }
  }
}

class _DatingProfileCard extends StatelessWidget {
  const _DatingProfileCard({
    required this.profile,
    required this.saved,
    required this.photoIndex,
    required this.actionsEnabled,
    required this.onPreviousPhoto,
    required this.onNextPhoto,
    required this.onSaveToggle,
    required this.onOpenProfile,
    required this.onSkip,
    required this.onSuper,
    required this.onLike,
    required this.onOpenDateCreate,
  });

  final DatingProfileData profile;
  final bool saved;
  final int photoIndex;
  final bool actionsEnabled;
  final VoidCallback? onPreviousPhoto;
  final VoidCallback? onNextPhoto;
  final VoidCallback onSaveToggle;
  final VoidCallback onOpenProfile;
  final VoidCallback onSkip;
  final VoidCallback onSuper;
  final VoidCallback onLike;
  final VoidCallback onOpenDateCreate;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final photos = profile.photos.isNotEmpty
        ? profile.photos
        : profile.avatarUrl == null || profile.avatarUrl!.isEmpty
            ? const <ProfilePhoto>[]
            : [
                ProfilePhoto(
                  id: '${profile.userId}-avatar',
                  url: profile.avatarUrl!,
                  order: 0,
                ),
              ];
    final clampedPhotoIndex =
        photos.isEmpty ? 0 : photoIndex.clamp(0, photos.length - 1);

    return Container(
      decoration: BoxDecoration(
        color: colors.foreground,
        borderRadius: BorderRadius.circular(32),
        boxShadow: AppShadows.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 0.62,
            child: Stack(
              children: [
                Positioned.fill(
                  child: BbProfilePhotoImage(
                    imageUrl:
                        photos.isEmpty ? null : photos[clampedPhotoIndex].url,
                    fallbackText: profile.photoEmoji,
                    usageProfile: BbImageUsageProfile.hero,
                    fallbackFontSize: 80,
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 128,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.4),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: const [0, 0.34, 0.62, 1],
                        colors: [
                          Colors.transparent,
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.45),
                          Colors.black.withValues(alpha: 0.85),
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  top: 12,
                  child: _GlassPill(
                    height: 28,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          LucideIcons.sparkles,
                          size: 12,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Premium',
                          style: AppTextStyles.caption.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  right: 12,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _SideAction(
                          label: 'Привет',
                          onTap: actionsEnabled ? onLike : null,
                          child: const Icon(LucideIcons.hand, size: 20),
                        ),
                        const SizedBox(height: 12),
                        _SideAction(
                          label: 'Профиль',
                          onTap: onOpenProfile,
                          child: const Icon(LucideIcons.user, size: 20),
                        ),
                        const SizedBox(height: 12),
                        _SideAction(
                          label: 'Сохранить',
                          active: saved,
                          onTap: onSaveToggle,
                          child: Icon(
                            saved
                                ? Icons.bookmark_rounded
                                : LucideIcons.bookmark,
                            size: 20,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const _SideAction(
                          label: 'Ещё',
                          child: Icon(Icons.more_horiz_rounded, size: 20),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onTap: onPreviousPhoto,
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          key: const ValueKey('dating-photo-next-zone'),
                          behavior: HitTestBehavior.translucent,
                          onTap: onNextPhoto,
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: _DatingPhotoInfoOverlay(profile: profile),
                ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            color: colors.foreground,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Prompt',
                  style: AppTextStyles.caption.copyWith(
                    color: colors.background.withValues(alpha: 0.55),
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  profile.prompt,
                  style: AppTextStyles.bodySoft.copyWith(
                    color: colors.background,
                    height: 1.45,
                  ),
                ),
                if (profile.tags.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: profile.tags
                        .map((tag) => _DatingTag(label: '#$tag'))
                        .toList(growable: false),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _CardActionButton(
                        label: 'Пропустить',
                        icon: LucideIcons.x,
                        onTap: actionsEnabled ? onSkip : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _CardActionButton(
                        label: 'Супер',
                        icon: LucideIcons.star,
                        accent: true,
                        onTap: actionsEnabled ? onSuper : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _CardActionButton(
                        label: 'Лайк',
                        icon: LucideIcons.heart,
                        positive: true,
                        onTap: actionsEnabled ? onLike : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton(
                    onPressed: onOpenDateCreate,
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.15),
                      ),
                      backgroundColor: Colors.white.withValues(alpha: 0.1),
                      foregroundColor: colors.background,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      'При мэтче сразу предложить свидание',
                      style: AppTextStyles.meta.copyWith(
                        color: colors.background,
                        fontSize: 13,
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
    );
  }
}

class _DatingPhotoInfoOverlay extends StatelessWidget {
  const _DatingPhotoInfoOverlay({required this.profile});

  static const _defaultLanguage = DatingLanguageData(
    flag: '🇷🇺',
    label: 'Русский',
  );
  static const _defaultNationality = DatingLanguageData(
    flag: '🇷🇺',
    label: 'Россия',
  );

  final DatingProfileData profile;

  @override
  Widget build(BuildContext context) {
    final location = _locationLabel(profile);
    final languages = profile.languages
        .where(
            (language) => language.flag.isNotEmpty || language.label.isNotEmpty)
        .toList(growable: false);
    final visibleLanguages =
        (languages.isEmpty ? const [_defaultLanguage] : languages)
            .take(2)
            .toList(growable: false);
    final extraLanguages =
        (languages.isEmpty ? 1 : languages.length) - visibleLanguages.length;
    final nationality = profile.nationality ?? _defaultNationality;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.map_pin, size: 14, color: Colors.white),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                location,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.meta.copyWith(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _GlassPill(
              height: 32,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    LucideIcons.languages,
                    size: 14,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _languageLabel(visibleLanguages, extraLanguages),
                    style: AppTextStyles.meta.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            _GlassPill(
              height: 32,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.user, size: 14, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(
                    '${nationality.flag} ${nationality.label}'.trim(),
                    style: AppTextStyles.meta.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          profile.age == null
              ? profile.name
              : '${profile.name}, ${profile.age}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.screenTitle.copyWith(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w600,
            height: 1,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          profile.about,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.meta.copyWith(
            color: Colors.white.withValues(alpha: 0.85),
            fontSize: 13,
            height: 1.25,
          ),
        ),
      ],
    );
  }

  static String _locationLabel(DatingProfileData profile) {
    final city = _firstText([profile.city, 'Москва']);
    final distance = _firstText([profile.distance, 'Рядом']);
    return '$city · $distance';
  }

  static String _firstText(List<String?> values) {
    for (final value in values) {
      final trimmed = value?.trim();
      if (trimmed != null && trimmed.isNotEmpty) {
        return trimmed;
      }
    }
    return '';
  }

  static String _languageLabel(
    List<DatingLanguageData> languages,
    int extraLanguages,
  ) {
    final flags = languages
        .map((language) => language.flag)
        .where((flag) => flag.isNotEmpty)
        .join(' ');
    final firstLabel = languages.firstOrNull?.label ?? '';
    final base =
        [flags, firstLabel].where((part) => part.trim().isNotEmpty).join(' ');
    if (extraLanguages <= 0) {
      return base;
    }
    return '$base +$extraLanguages';
  }
}

class _GlassPill extends StatelessWidget {
  const _GlassPill({
    required this.child,
    required this.height,
    required this.padding,
  });

  final Widget child;
  final double height;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          height: height,
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
          ),
          alignment: Alignment.center,
          child: child,
        ),
      ),
    );
  }
}

class _SideAction extends StatelessWidget {
  const _SideAction({
    required this.label,
    required this.child,
    this.active = false,
    this.onTap,
  });

  final String label;
  final Widget child;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final background = active
        ? AppColors.primary.withValues(alpha: 0.9)
        : Colors.white.withValues(alpha: 0.15);
    final borderColor =
        active ? AppColors.primary : Colors.white.withValues(alpha: 0.25);

    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ClipOval(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: background,
                shape: BoxShape.circle,
                border: Border.all(color: borderColor),
              ),
              alignment: Alignment.center,
              child: IconTheme(
                data: const IconThemeData(color: Colors.white),
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DatingTag extends StatelessWidget {
  const _DatingTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: AppTextStyles.meta.copyWith(
          color: colors.background,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CardActionButton extends StatelessWidget {
  const _CardActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
    this.accent = false,
    this.positive = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool accent;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final background = positive
        ? colors.primary
        : accent
            ? Colors.white.withValues(alpha: 0.1)
            : Colors.white.withValues(alpha: 0.05);
    final border = positive
        ? colors.primary
        : accent
            ? Colors.white.withValues(alpha: 0.15)
            : Colors.white.withValues(alpha: 0.1);
    final foreground = positive
        ? colors.primaryForeground
        : accent
            ? colors.background
            : colors.background.withValues(alpha: 0.85);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: foreground),
            const SizedBox(height: 4),
            Text(
              label,
              style: AppTextStyles.meta.copyWith(
                color: foreground,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DatingThumbnail extends StatelessWidget {
  const _DatingThumbnail({
    required this.profile,
  });

  final DatingProfileData profile;

  @override
  Widget build(BuildContext context) {
    final imageUrl = profile.primaryPhoto?.url ??
        profile.photos.firstOrNull?.url ??
        profile.avatarUrl;

    return BbProfilePhotoImage(
      imageUrl: imageUrl,
      fallbackText: profile.photoEmoji,
      usageProfile: BbImageUsageProfile.avatar,
      fallbackFontSize: 24,
    );
  }
}

class _SwipeDecisionPill extends StatelessWidget {
  const _SwipeDecisionPill({
    required this.direction,
  });

  final DatingSwipeDirection direction;

  @override
  Widget build(BuildContext context) {
    final isLike = direction == DatingSwipeDirection.like;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isLike
            ? AppColors.primary.withValues(alpha: 0.92)
            : Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        isLike ? 'Лайк' : 'Пропустить',
        style: AppTextStyles.meta.copyWith(
          color: isLike ? AppColors.primaryForeground : AppColors.foreground,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
