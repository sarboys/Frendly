import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_logo.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  Timer? _timer;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) {
        setState(() => _ready = true);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Center(
        child: AnimatedOpacity(
          opacity: 1,
          duration: const Duration(milliseconds: 260),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _SplashMark(),
              const SizedBox(height: 32),
              const _SplashWordmark(),
              const SizedBox(height: 44),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: _ready ? const _ContinueButton() : const _LoadingDots(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SplashMark extends StatelessWidget {
  const _SplashMark();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(32),
            gradient: dateasyLimeGradient,
            boxShadow: const [
              BoxShadow(
                color: Color(0x80BEFF67),
                blurRadius: 42,
                spreadRadius: 12,
              ),
            ],
          ),
        ),
        const DateasyLogoMark(
          key: ValueKey('dateasy-splash-mark'),
          size: 96,
        ),
      ],
    );
  }
}

class _SplashWordmark extends StatelessWidget {
  const _SplashWordmark();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFC4B5FD),
              Color(0xFF8B5CF6),
              Color(0xFF6D28D9),
              Color(0xFF4C1D95),
            ],
          ).createShader(bounds),
          child: Text(
            'frendly',
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
              color: Colors.white,
              fontFamily: 'Sora',
              fontSize: 50,
              height: 1,
              fontWeight: FontWeight.w700,
              shadows: const [
                Shadow(color: Color(0x668B5CF6), blurRadius: 18),
                Shadow(
                  color: Color(0x594C1D95),
                  blurRadius: 6,
                  offset: Offset(0, 2),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'встречайся · собирай вечера',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
                fontSize: 14,
                letterSpacing: 0.4,
              ),
        ),
      ],
    );
  }
}

class _LoadingDots extends StatelessWidget {
  const _LoadingDots();

  @override
  Widget build(BuildContext context) {
    return Row(
      key: const ValueKey('splash-loading'),
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var index = 0; index < 3; index++) ...[
          Container(
            key: ValueKey('splash-dot-$index'),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: DateasyColors.foreground.withValues(
                alpha: 0.35 + index * 0.12,
              ),
              shape: BoxShape.circle,
            ),
          ),
          if (index != 2) const SizedBox(width: 6),
        ],
      ],
    );
  }
}

class _ContinueButton extends StatelessWidget {
  const _ContinueButton();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const ValueKey('splash-continue'),
      onTap: () => context.go('/welcome'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 13),
        decoration: BoxDecoration(
          gradient: dateasyLimeGradient,
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(
              color: Color(0x66BEFF67),
              blurRadius: 28,
              spreadRadius: -12,
              offset: Offset(0, 14),
            ),
          ],
        ),
        child: Text(
          'Продолжить',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.backgroundDeep,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
    );
  }
}
