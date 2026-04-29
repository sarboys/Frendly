import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:flutter/material.dart';

class BbSwipeableMessage extends StatefulWidget {
  const BbSwipeableMessage({
    required this.child,
    required this.onReply,
    required this.onLongPress,
    super.key,
  });

  final Widget child;
  final VoidCallback onReply;
  final VoidCallback onLongPress;

  @override
  State<BbSwipeableMessage> createState() => _BbSwipeableMessageState();
}

class _BbSwipeableMessageState extends State<BbSwipeableMessage> {
  static const _replyTrigger = 60.0;
  static const _maxOffset = -90.0;
  double _dx = 0;

  void _handleUpdate(DragUpdateDetails details) {
    final delta = (_dx + details.delta.dx).clamp(_maxOffset, 0.0);
    if (delta >= 0) {
      if (_dx != 0) {
        setState(() {
          _dx = 0;
        });
      }
      return;
    }

    setState(() {
      _dx = delta;
    });
  }

  void _handleEnd(DragEndDetails details) {
    final shouldReply = _dx <= -_replyTrigger;
    setState(() {
      _dx = 0;
    });
    if (shouldReply) {
      widget.onReply();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final progress = (_dx.abs() / _replyTrigger).clamp(0.0, 1.0);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onLongPress: widget.onLongPress,
      onHorizontalDragUpdate: _handleUpdate,
      onHorizontalDragEnd: _handleEnd,
      onHorizontalDragCancel: () => _handleEnd(
        DragEndDetails(
          velocity: Velocity.zero,
        ),
      ),
      child: Stack(
        alignment: Alignment.centerRight,
        children: [
          Positioned(
            right: 8,
            child: Opacity(
              opacity: progress,
              child: Transform.scale(
                scale: 0.6 + (progress * 0.4),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: progress >= 1 ? colors.primary : colors.muted,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.reply_rounded,
                    size: 16,
                    color: progress >= 1
                        ? colors.primaryForeground
                        : colors.inkSoft,
                  ),
                ),
              ),
            ),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutCubic,
            transform: Matrix4.translationValues(_dx, 0, 0),
            child: widget.child,
          ),
        ],
      ),
    );
  }
}
