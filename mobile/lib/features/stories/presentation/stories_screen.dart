import 'dart:async';

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class StoriesScreen extends ConsumerStatefulWidget {
  const StoriesScreen({
    required this.eventId,
    super.key,
  });

  final String eventId;

  @override
  ConsumerState<StoriesScreen> createState() => _StoriesScreenState();
}

class _StoriesScreenState extends ConsumerState<StoriesScreen> {
  int _index = 0;
  double _progress = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final storiesAsync = ref.watch(storiesProvider(widget.eventId));
    final event = ref.watch(eventDetailProvider(widget.eventId)).valueOrNull;

    return Scaffold(
      backgroundColor: colors.foreground,
      body: SafeArea(
        child: storiesAsync.when(
          data: (stories) {
            if (stories.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Историй пока нет',
                    style: AppTextStyles.body.copyWith(color: Colors.white),
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }

            _startTicker(stories.length);
            final safeIndex =
                _index >= stories.length ? stories.length - 1 : _index;
            final story = stories[safeIndex];
            final storyGradient = _storyGradient(safeIndex);

            return Stack(
              children: [
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: storyGradient,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        story.emoji,
                        style: const TextStyle(fontSize: 160),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                  child: Column(
                    children: [
                      Row(
                        children: List.generate(
                          stories.length,
                          (index) => Expanded(
                            child: Container(
                              height: 3,
                              margin: const EdgeInsets.symmetric(horizontal: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: FractionallySizedBox(
                                alignment: Alignment.centerLeft,
                                widthFactor: index < _index
                                    ? 1
                                    : index == _index
                                        ? _progress
                                        : 0,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          BbAvatar(
                            name: story.authorName,
                            imageUrl: story.avatarUrl,
                            size: BbAvatarSize.sm,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  story.authorName,
                                  style: AppTextStyles.itemTitle.copyWith(
                                    color: Colors.white,
                                  ),
                                ),
                                Text(
                                  _relativeTime(story.createdAt),
                                  style: AppTextStyles.caption.copyWith(
                                    color: Colors.white.withValues(alpha: 0.8),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: IconButton(
                              onPressed: () => context.pop(),
                              icon: const Icon(
                                Icons.close_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      Text(
                        story.caption,
                        style: AppTextStyles.sectionTitle.copyWith(
                          color: Colors.white,
                        ),
                        textAlign: TextAlign.left,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${event?.emoji ?? '🍷'} ${event?.title ?? 'Встреча'}',
                            style: AppTextStyles.caption.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      const SizedBox.shrink(),
                    ],
                  ),
                ),
                Positioned.fill(
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onTap: () => setState(() {
                            _index = _index == 0 ? 0 : _index - 1;
                            _progress = 0;
                          }),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onTap: () => setState(() {
                            if (_index < stories.length - 1) {
                              _index += 1;
                              _progress = 0;
                            } else {
                              context.pop();
                            }
                          }),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(
            child: CircularProgressIndicator(color: Colors.white),
          ),
          error: (error, _) => Center(child: Text(error.toString())),
        ),
      ),
    );
  }

  void _startTicker(int count) {
    _timer ??= Timer.periodic(const Duration(milliseconds: 80), (timer) {
      if (!mounted) return;
      setState(() {
        _progress += 0.02;
        if (_progress >= 1) {
          if (_index < count - 1) {
            _index += 1;
            _progress = 0;
          } else {
            _timer?.cancel();
            _timer = null;
          }
        }
      });
    });
  }

  String _relativeTime(DateTime value) {
    final now = DateTime.now();
    final diff = now.difference(value.toLocal());
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes.clamp(1, 59)} мин';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours} ч';
    }
    return '${diff.inDays} д';
  }

  List<Color> _storyGradient(int index) {
    switch (index % 3) {
      case 1:
        return const [Color(0xFF35405D), Color(0xFF9E5A55)];
      case 2:
        return const [Color(0xFF6DA37E), Color(0xFFE7C08F)];
      case 0:
      default:
        return const [Color(0xFFE26A52), Color(0xFFB56A48)];
    }
  }
}
