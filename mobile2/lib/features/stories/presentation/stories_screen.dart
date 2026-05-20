import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class StoriesScreen extends ConsumerStatefulWidget {
  const StoriesScreen({super.key, this.eventId});

  final String? eventId;

  @override
  ConsumerState<StoriesScreen> createState() => _StoriesScreenState();
}

class _StoriesScreenState extends ConsumerState<StoriesScreen> {
  int _index = 0;
  double _progress = 0;
  bool _liked = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTicker();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTicker() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 80), (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        if (_progress >= 1) {
          if (_index < _storyCount - 1) {
            _index += 1;
            _progress = 0;
            _liked = false;
          } else {
            _progress = 1;
            _timer?.cancel();
          }
        } else {
          _progress = (_progress + 0.02).clamp(0, 1);
        }
      });
    });
  }

  int _storyCount = 0;

  void _next() {
    setState(() {
      _index = (_index + 1).clamp(0, _storyCount - 1);
      _progress = 0;
      _liked = false;
    });
    _startTicker();
  }

  void _prev() {
    setState(() {
      _index = (_index - 1).clamp(0, _storyCount - 1);
      _progress = 0;
      _liked = false;
    });
    _startTicker();
  }

  void _toggleLike() {
    setState(() => _liked = !_liked);
  }

  void _closeStories() {
    if (context.canPop()) {
      context.pop();
      return;
    }

    final eventId = widget.eventId;
    if (eventId != null && eventId.isNotEmpty) {
      context.go('/meetings/${Uri.encodeComponent(eventId)}');
      return;
    }

    context.go('/meetings');
  }

  @override
  Widget build(BuildContext context) {
    final eventId = widget.eventId;
    if (eventId == null || eventId.isEmpty) {
      return _StoryStatus(
        text: 'Нужен eventId для stories',
        onClose: _closeStories,
      );
    }
    final state = ref.watch(eventStoriesProvider(eventId));
    final stories =
        state.valueOrNull?.items.map(_StoryItem.fromBackend).toList() ??
            const <_StoryItem>[];
    _storyCount = stories.length;
    if (stories.isEmpty) {
      return _StoryStatus(
        text: state.isLoading
            ? 'Загружаем stories'
            : state.hasError
                ? 'Не удалось загрузить stories'
                : 'Stories пока нет',
        onClose: _closeStories,
      );
    }
    final safeIndex = _index.clamp(0, stories.length - 1);
    final story = stories[safeIndex];

    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Stack(
            fit: StackFit.expand,
            children: [
              DateasyRemoteImage(
                imageUrl: story.imageUrl,
                usage: DateasyImageUsage.fullscreen,
              ),
              const _TopShade(),
              const _BottomShade(),
              _ProgressBars(
                count: stories.length,
                index: safeIndex,
                progress: _progress,
              ),
              _Header(story: story, onClose: _closeStories),
              _TapZone(
                alignment: Alignment.centerLeft,
                label: 'prev',
                onTap: _prev,
              ),
              _TapZone(
                alignment: Alignment.centerRight,
                label: 'next',
                onTap: _next,
              ),
              _Caption(text: story.text),
              const _ReactionRow(),
              _ReplyBar(
                story: story,
                liked: _liked,
                onLike: _toggleLike,
                onSend: () {},
              ),
              _StoryTray(stories: stories),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopShade extends StatelessWidget {
  const _TopShade();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.center,
          colors: [Color(0x99000000), Color(0x00000000)],
        ),
      ),
    );
  }
}

class _BottomShade extends StatelessWidget {
  const _BottomShade();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.center,
          colors: [Color(0xCC000000), Color(0x00000000)],
        ),
      ),
    );
  }
}

class _ProgressBars extends StatelessWidget {
  const _ProgressBars({
    required this.count,
    required this.index,
    required this.progress,
  });

  final int count;
  final int index;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 12,
      left: 12,
      right: 12,
      child: Row(
        children: [
          for (var i = 0; i < count; i++) ...[
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: SizedBox(
                  height: 2,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ColoredBox(
                        color: Colors.white.withValues(alpha: 0.2),
                      ),
                      FractionallySizedBox(
                        alignment: Alignment.centerLeft,
                        widthFactor: i < index
                            ? 1
                            : i == index
                                ? progress
                                : 0,
                        child: const ColoredBox(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (i != count - 1) const SizedBox(width: 4),
          ],
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.story, required this.onClose});

  final _StoryItem story;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 28,
      left: 12,
      right: 12,
      child: Row(
        children: [
          ClipOval(
            child: SizedBox(
              width: 34,
              height: 34,
              child: DateasyRemoteImage(
                imageUrl: story.avatarUrl,
                usage: DateasyImageUsage.avatar,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  story.who,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.1,
                      ),
                ),
                Text(
                  story.time,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11,
                        height: 1.1,
                      ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onClose,
            child: const _BlurCircle(
              size: 36,
              child: Icon(
                LucideIcons.x,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TapZone extends StatelessWidget {
  const _TapZone({
    required this.alignment,
    required this.label,
    required this.onTap,
  });

  final Alignment alignment;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: Semantics(
        label: label,
        button: true,
        child: GestureDetector(
          key: ValueKey('story-$label-zone'),
          behavior: HitTestBehavior.translucent,
          onTap: onTap,
          child: SizedBox(
            width: MediaQuery.sizeOf(context).width / 3,
            height: double.infinity,
          ),
        ),
      ),
    );
  }
}

class _Caption extends StatelessWidget {
  const _Caption({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 20,
      right: 20,
      bottom: MediaQuery.paddingOf(context).bottom + 116,
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          shadows: const [
            Shadow(
              color: Colors.black54,
              blurRadius: 10,
              offset: Offset(0, 2),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReactionRow extends StatelessWidget {
  const _ReactionRow();

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 20,
      right: 20,
      bottom: MediaQuery.paddingOf(context).bottom + 70,
      child: Row(
        children: [
          for (var index = 0; index < _reactions.length; index++) ...[
            _BlurCircle(
              size: 40,
              child: Text(
                _reactions[index],
                style: const TextStyle(fontSize: 20),
              ),
            ),
            if (index != _reactions.length - 1) const SizedBox(width: 6),
          ],
        ],
      ),
    );
  }
}

class _ReplyBar extends StatelessWidget {
  const _ReplyBar({
    required this.story,
    required this.liked,
    required this.onLike,
    required this.onSend,
  });

  final _StoryItem story;
  final bool liked;
  final VoidCallback onLike;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 20,
      right: 20,
      bottom: MediaQuery.paddingOf(context).bottom + 14,
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
              ),
              child: Text(
                'Ответить ${story.who}...',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 14,
                    ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onLike,
            child: _BlurCircle(
              size: 44,
              child: Icon(
                liked ? Icons.favorite : LucideIcons.heart,
                color: liked ? DateasyColors.pink : Colors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onSend,
            child: Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: dateasyLimeGradient,
              ),
              child: const Icon(
                LucideIcons.send,
                color: DateasyColors.backgroundDeep,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StoryTray extends StatelessWidget {
  const _StoryTray({required this.stories});

  final List<_StoryItem> stories;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 80,
      right: 12,
      child: Column(
        children: [
          for (var index = 0; index < stories.length && index < 3; index++) ...[
            ClipOval(
              child: SizedBox(
                width: 38,
                height: 38,
                child: DateasyRemoteImage(
                  imageUrl: stories[index].avatarUrl ?? stories[index].imageUrl,
                  usage: DateasyImageUsage.avatar,
                ),
              ),
            ),
            if (index != stories.length - 1 && index != 2)
              const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }
}

class _BlurCircle extends StatelessWidget {
  const _BlurCircle({
    required this.size,
    required this.child,
  });

  final double size;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.1),
      ),
      alignment: Alignment.center,
      child: child,
    );
  }
}

class _StoryItem {
  const _StoryItem({
    required this.imageUrl,
    required this.who,
    required this.time,
    required this.text,
    this.avatarUrl,
  });

  final String? imageUrl;
  final String who;
  final String time;
  final String text;
  final String? avatarUrl;

  factory _StoryItem.fromBackend(BackendCardItem item) {
    return _StoryItem(
      imageUrl: item.imageUrl,
      who: item.raw['authorName']?.toString() ?? 'Участник',
      time: _formatStoryTime(item.startsAt),
      text:
          item.title.isEmpty ? item.raw['emoji']?.toString() ?? '' : item.title,
      avatarUrl: item.raw['avatarUrl']?.toString(),
    );
  }
}

class _StoryStatus extends StatelessWidget {
  const _StoryStatus({required this.text, required this.onClose});

  final String text;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                text,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white70,
                    ),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 16,
            right: 16,
            child: GestureDetector(
              onTap: onClose,
              child: const _BlurCircle(
                size: 40,
                child: Icon(
                  LucideIcons.x,
                  color: Colors.white,
                  size: 22,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatStoryTime(DateTime? value) {
  if (value == null) {
    return '';
  }
  final diff = DateTime.now().difference(value.toLocal());
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes.clamp(1, 59)}м';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours}ч';
  }
  return '${diff.inDays}д';
}

const _reactions = ['🔥', '❤️', '👀', '🍷', '🎶'];
