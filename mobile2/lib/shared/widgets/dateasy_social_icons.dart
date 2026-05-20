import 'dart:math' as math;

import 'package:flutter/material.dart';

class DateasyGoogleIcon extends StatelessWidget {
  const DateasyGoogleIcon({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _GoogleIconPainter(),
    );
  }
}

class DateasyTelegramIcon extends StatelessWidget {
  const DateasyTelegramIcon({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _TelegramIconPainter(),
    );
  }
}

class DateasyYandexIcon extends StatelessWidget {
  const DateasyYandexIcon({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: Color(0xFFFC3F1D),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        'Я',
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.62,
          height: 1,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _GoogleIconPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.2;
    final rect = Rect.fromLTWH(
        stroke / 2, stroke / 2, size.width - stroke, size.height - stroke);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    void arc(Color color, double start, double sweep) {
      paint.color = color;
      canvas.drawArc(rect, start, sweep, false, paint);
    }

    arc(const Color(0xFF4285F4), -0.05 * math.pi, 0.48 * math.pi);
    arc(const Color(0xFF34A853), 0.43 * math.pi, 0.47 * math.pi);
    arc(const Color(0xFFFBBC05), 0.9 * math.pi, 0.48 * math.pi);
    arc(const Color(0xFFEA4335), 1.38 * math.pi, 0.55 * math.pi);

    final barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.square;
    canvas.drawLine(
      Offset(size.width * 0.54, size.height * 0.5),
      Offset(size.width * 0.95, size.height * 0.5),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _TelegramIconPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final circlePaint = Paint()..color = const Color(0xFF229ED9);
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      size.width * 0.48,
      circlePaint,
    );

    final path = Path()
      ..moveTo(size.width * 0.76, size.height * 0.31)
      ..lineTo(size.width * 0.64, size.height * 0.78)
      ..quadraticBezierTo(size.width * 0.62, size.height * 0.86,
          size.width * 0.55, size.height * 0.81)
      ..lineTo(size.width * 0.4, size.height * 0.69)
      ..lineTo(size.width * 0.31, size.height * 0.78)
      ..quadraticBezierTo(size.width * 0.27, size.height * 0.82,
          size.width * 0.28, size.height * 0.75)
      ..lineTo(size.width * 0.3, size.height * 0.63)
      ..lineTo(size.width * 0.56, size.height * 0.4)
      ..quadraticBezierTo(size.width * 0.6, size.height * 0.36,
          size.width * 0.53, size.height * 0.39)
      ..lineTo(size.width * 0.24, size.height * 0.58)
      ..quadraticBezierTo(size.width * 0.15, size.height * 0.55,
          size.width * 0.24, size.height * 0.51)
      ..lineTo(size.width * 0.71, size.height * 0.3)
      ..quadraticBezierTo(size.width * 0.78, size.height * 0.27,
          size.width * 0.76, size.height * 0.31)
      ..close();

    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
