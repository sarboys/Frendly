import 'package:flutter/material.dart';

class DateasyKeyboardDismiss extends StatelessWidget {
  const DateasyKeyboardDismiss({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) {
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: child,
    );
  }
}
