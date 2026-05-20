import 'package:flutter/material.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

WidgetSpan dateasyHeadlineHighlightSpan({
  required String text,
  required TextStyle? style,
}) {
  return WidgetSpan(
    alignment: PlaceholderAlignment.middle,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: DateasyHeadlineHighlight(
        text: text,
        style: style,
      ),
    ),
  );
}

class DateasyHeadlineHighlight extends StatelessWidget {
  const DateasyHeadlineHighlight({
    super.key,
    required this.text,
    required this.style,
    this.padding = const EdgeInsets.fromLTRB(14, 4, 14, 5),
    this.textHeight = 1,
  });

  final String text;
  final TextStyle? style;
  final EdgeInsetsGeometry padding;
  final double textHeight;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: dateasyLimeGradient,
      ),
      child: Padding(
        padding: padding,
        child: Text(
          text,
          textAlign: TextAlign.center,
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: false,
            applyHeightToLastDescent: false,
          ),
          style: style?.copyWith(
            color: DateasyColors.backgroundDeep,
            height: textHeight,
          ),
        ),
      ),
    );
  }
}
