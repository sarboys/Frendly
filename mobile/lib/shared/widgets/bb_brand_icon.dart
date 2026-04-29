import 'package:flutter/material.dart';

class BbBrandIcon extends StatelessWidget {
  const BbBrandIcon({
    super.key,
    required this.size,
    this.radius = 24,
    this.boxShadow,
  });

  static const _assetPath = 'assets/images/icon-v5-sage.png';

  final double size;
  final double radius;
  final List<BoxShadow>? boxShadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: boxShadow,
      ),
      child: Image.asset(
        _assetPath,
        fit: BoxFit.cover,
      ),
    );
  }
}
