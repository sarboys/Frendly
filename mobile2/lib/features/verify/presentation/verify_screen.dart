import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class VerifyScreen extends ConsumerStatefulWidget {
  const VerifyScreen({super.key});

  @override
  ConsumerState<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends ConsumerState<VerifyScreen> {
  int _step = 0;
  bool _busy = false;
  String? _error;

  Future<void> _nextStep(int visibleStep) async {
    if (visibleStep >= 3) {
      return;
    }
    if (visibleStep == 0) {
      setState(() => _step = 1);
      return;
    }
    final backendStep = visibleStep == 1 ? 'selfie' : 'document';
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state =
          await ref.read(verificationActionsProvider).submitStep(backendStep);
      if (!mounted) {
        return;
      }
      setState(() {
        _busy = false;
        _step = _stepFromVerification(state);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _busy = false;
        _error = 'Не удалось отправить шаг';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final verification = ref.watch(verificationProvider);
    final backendStep = _stepFromVerification(verification.valueOrNull);
    final visibleStep = _step > backendStep ? _step : backendStep;
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 126,
            ),
            children: [
              _Header(step: visibleStep),
              _Progress(step: visibleStep),
              if (verification.isLoading && verification.valueOrNull == null)
                const _InlineState(text: 'Загружаем статус')
              else if (verification.hasError)
                const _InlineState(text: 'Не удалось загрузить статус'),
              if (_error != null) _InlineState(text: _error!),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: switch (visibleStep) {
                  0 => const _TrustStep(),
                  1 => const _SelfieStep(),
                  2 => _DocumentStep(
                      busy: _busy,
                      onSkip: () => _nextStep(visibleStep),
                    ),
                  _ => _DoneStep(state: verification.valueOrNull),
                },
              ),
            ],
          ),
          _BottomAction(
            step: visibleStep,
            busy: _busy,
            onNext: () => _nextStep(visibleStep),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/profile'),
          ),
          Expanded(
            child: Text(
              'Верификация',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          SizedBox(
            width: 44,
            child: Text(
              '${step + 1}/4',
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        children: [
          for (var index = 0; index < 4; index++) ...[
            Expanded(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  gradient: index <= step ? dateasyLimeGradient : null,
                  color: index <= step
                      ? null
                      : Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            if (index != 3) const SizedBox(width: 6),
          ],
        ],
      ),
    );
  }
}

class _TrustStep extends StatelessWidget {
  const _TrustStep();

  @override
  Widget build(BuildContext context) {
    return _StepSection(
      key: const ValueKey('trust'),
      top: 32,
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: dateasyLimeGradient,
              borderRadius: BorderRadius.circular(24),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x66BEFF67),
                  blurRadius: 30,
                  spreadRadius: -14,
                  offset: Offset(0, 18),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.shieldCheck,
              color: DateasyColors.backgroundDeep,
              size: 36,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Подними доверие',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Text(
              'Верифицированные профили получают на 3× больше мэтчей и приглашений на встречи',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
          const SizedBox(height: 24),
          for (var index = 0; index < _introItems.length; index++) ...[
            _IntroRow(index: index, label: _introItems[index]),
            if (index != _introItems.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _IntroRow extends StatelessWidget {
  const _IntroRow({
    required this.index,
    required this.label,
  });

  final int index;
  final String label;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: dateasyLimeGradient,
            ),
            child: Center(
              child: Text(
                '${index + 1}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelfieStep extends StatelessWidget {
  const _SelfieStep();

  @override
  Widget build(BuildContext context) {
    return _StepSection(
      key: const ValueKey('selfie'),
      top: 32,
      child: Column(
        children: [
          Text(
            'Селфи-челлендж',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Text(
              'Повтори позу с экрана — это займёт 10 секунд',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
          const SizedBox(height: 24),
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              CustomPaint(
                foregroundPainter: _DashedBorderPainter(
                  shape: _DashedShape.circle,
                  color: DateasyColors.lime.withValues(alpha: 0.4),
                  strokeWidth: 2,
                ),
                child: const SizedBox(
                  width: 256,
                  height: 256,
                  child: Center(
                    child: Icon(
                      LucideIcons.camera,
                      color: DateasyColors.muted,
                      size: 48,
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -14,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: dateasyLimeGradient,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '✌️ V знак',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DocumentStep extends StatelessWidget {
  const _DocumentStep({
    required this.busy,
    required this.onSkip,
  });

  final bool busy;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return _StepSection(
      key: const ValueKey('document'),
      top: 32,
      child: Column(
        children: [
          Text.rich(
            TextSpan(
              text: 'Документ ',
              children: [
                TextSpan(
                  text: '(опционально)',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 14,
                      ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Text(
              'Покажем только галочку «18+», скан не хранится',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
          const SizedBox(height: 24),
          CustomPaint(
            foregroundPainter: _DashedBorderPainter(
              shape: _DashedShape.rrect,
              color: Colors.white.withValues(alpha: 0.15),
              strokeWidth: 2,
              radius: 24,
            ),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
              child: Column(
                children: [
                  const Icon(
                    LucideIcons.idCard,
                    color: DateasyColors.muted,
                    size: 48,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Загрузить документ',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'JPG, PNG · до 10 МБ',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: busy ? null : onSkip,
            child: Text(
              'Пропустить шаг',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DoneStep extends StatelessWidget {
  const _DoneStep({required this.state});

  final VerificationStateData? state;

  @override
  Widget build(BuildContext context) {
    final verified = state?.status == 'verified';
    return _StepSection(
      key: const ValueKey('done'),
      top: 40,
      child: Column(
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: dateasyLimeGradient,
              boxShadow: [
                BoxShadow(
                  color: Color(0x66BEFF67),
                  blurRadius: 30,
                  spreadRadius: -14,
                  offset: Offset(0, 18),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.check,
              color: DateasyColors.backgroundDeep,
              size: 48,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Готово',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 30,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Text(
              verified
                  ? 'Галочка уже в профиле. Можно возвращаться к встречам'
                  : 'Проверка займёт до 2 часов. Пришлём пуш, как только дадим галочку',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
          const SizedBox(height: 24),
          _GlassPanel(
            borderRadius: 24,
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(
                  LucideIcons.sparkles,
                  color: DateasyColors.lime,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Подари себе +7 дней Plus бесплатно за прохождение',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
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

class _StepSection extends StatelessWidget {
  const _StepSection({
    super.key,
    required this.child,
    required this.top,
  });

  final Widget child;
  final double top;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, top, 20, 0),
      child: child,
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _BottomAction extends StatelessWidget {
  const _BottomAction({
    required this.step,
    required this.busy,
    required this.onNext,
  });

  final int step;
  final bool busy;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final label = switch (step) {
      0 => 'Начать',
      1 => 'Сделать селфи',
      2 => 'Загрузить',
      _ => 'В профиль',
    };

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              DateasyColors.background.withValues(alpha: 0),
              DateasyColors.background.withValues(alpha: 0.92),
              DateasyColors.background,
            ],
          ),
        ),
        child: GestureDetector(
          onTap: busy
              ? null
              : step < 3
                  ? onNext
                  : () => context.go('/profile'),
          child: Container(
            width: double.infinity,
            height: 54,
            decoration: BoxDecoration(
              gradient: dateasyLimeGradient,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x66BEFF67),
                  blurRadius: 30,
                  spreadRadius: -14,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Center(
              child: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      label,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.backgroundDeep,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
            ),
          ),
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
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 20),
        ),
      ),
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

enum _DashedShape { circle, rrect }

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({
    required this.shape,
    required this.color,
    required this.strokeWidth,
    this.radius = 0,
  });

  final _DashedShape shape;
  final Color color;
  final double strokeWidth;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final path = Path();

    switch (shape) {
      case _DashedShape.circle:
        path.addOval(rect.deflate(strokeWidth / 2));
      case _DashedShape.rrect:
        path.addRRect(
          RRect.fromRectAndRadius(
            rect.deflate(strokeWidth / 2),
            Radius.circular(radius),
          ),
        );
    }

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      const dash = 10.0;
      const gap = 8.0;

      while (distance < metric.length) {
        final end = (distance + dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) {
    return shape != oldDelegate.shape ||
        color != oldDelegate.color ||
        strokeWidth != oldDelegate.strokeWidth ||
        radius != oldDelegate.radius;
  }
}

const _introItems = [
  'Фото со специальной позой',
  'Проверка документа (по желанию)',
  'Подтверждение телефона',
  'Получи синюю галочку',
];

int _stepFromVerification(VerificationStateData? state) {
  if (state == null) {
    return 0;
  }
  if (state.status == 'verified' ||
      state.status == 'under_review' ||
      state.documentDone) {
    return 3;
  }
  if (state.selfieDone || state.status == 'selfie_submitted') {
    return 2;
  }
  return 0;
}
