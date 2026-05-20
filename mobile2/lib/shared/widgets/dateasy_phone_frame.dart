import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

class DateasyPhoneFrame extends StatelessWidget {
  const DateasyPhoneFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!_hasProviderScope(context)) {
      return ProviderScope(child: DateasyPhoneFrame(child: child));
    }
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final width =
              constraints.maxWidth > 420 ? 420.0 : constraints.maxWidth;

          return Center(
            child: SizedBox(
              width: width,
              height: constraints.maxHeight,
              child: DecoratedBox(
                decoration: const BoxDecoration(gradient: dateasyHeroGradient),
                child: Stack(
                  children: [
                    const Positioned(
                      top: -96,
                      left: -80,
                      child: _GlowBlob(
                        colorA: DateasyColors.lime,
                        colorB: DateasyColors.lime2,
                        opacity: 0.4,
                      ),
                    ),
                    const Positioned(
                      top: 160,
                      right: -96,
                      child: _GlowBlob(
                        colorA: DateasyColors.lilac,
                        colorB: DateasyColors.pink,
                        opacity: 0.3,
                      ),
                    ),
                    Positioned.fill(child: child),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  bool _hasProviderScope(BuildContext context) {
    try {
      ProviderScope.containerOf(context, listen: false);
      return true;
    } catch (_) {
      return false;
    }
  }
}

class _GlowBlob extends StatelessWidget {
  const _GlowBlob({
    required this.colorA,
    required this.colorB,
    required this.opacity,
  });

  final Color colorA;
  final Color colorB;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: opacity,
        child: ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 64, sigmaY: 64),
          child: Container(
            width: 288,
            height: 288,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [colorA, colorB]),
            ),
          ),
        ),
      ),
    );
  }
}
