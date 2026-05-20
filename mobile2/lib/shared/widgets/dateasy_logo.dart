import 'package:flutter/material.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

class DateasyLogo extends StatelessWidget {
  const DateasyLogo({super.key, this.size = DateasyLogoSize.md});

  final DateasyLogoSize size;

  @override
  Widget build(BuildContext context) {
    final spec = size._spec;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DateasyLogoMark(size: spec.mark),
        SizedBox(width: spec.gap),
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
            style: TextStyle(
              color: Colors.white,
              fontFamily: 'Sora',
              fontSize: spec.text,
              height: 1,
              fontWeight: FontWeight.w600,
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
      ],
    );
  }
}

class DateasyLogoMark extends StatelessWidget {
  const DateasyLogoMark({super.key, required this.size});

  static const assetName = 'assets/images/frendly-logo.png';

  final double size;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: DateasyColors.lime.withValues(alpha: 0.42),
            blurRadius: size * 0.34,
            spreadRadius: -size * 0.03,
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.24),
            blurRadius: size * 0.3,
            spreadRadius: -size * 0.1,
            offset: Offset(0, size * 0.12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.22),
        child: Image.asset(
          assetName,
          width: size,
          height: size,
          fit: BoxFit.cover,
          filterQuality: FilterQuality.medium,
        ),
      ),
    );
  }
}

enum DateasyLogoSize {
  sm,
  md,
  lg,
  xl;

  _LogoSpec get _spec {
    return switch (this) {
      DateasyLogoSize.sm => const _LogoSpec(32, 22, 8),
      DateasyLogoSize.md => const _LogoSpec(44, 30, 10),
      DateasyLogoSize.lg => const _LogoSpec(64, 50, 14),
      DateasyLogoSize.xl => const _LogoSpec(96, 72, 16),
    };
  }
}

class _LogoSpec {
  const _LogoSpec(this.mark, this.text, this.gap);

  final double mark;
  final double text;
  final double gap;
}
