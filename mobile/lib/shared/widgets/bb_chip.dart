import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

class BbChip extends StatelessWidget {
  const BbChip({
    required this.label,
    super.key,
    this.active = false,
    this.icon,
    this.onTap,
  });

  final String label;
  final bool active;
  final Widget? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadii.pillBorder,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? colors.foreground : colors.card,
          borderRadius: AppRadii.pillBorder,
          border: Border.all(
            color: active ? colors.foreground : colors.border,
          ),
        ),
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (icon != null) ...[
                IconTheme(
                  data: IconThemeData(
                    size: 15,
                    color: active ? colors.background : colors.inkSoft,
                  ),
                  child: icon!,
                ),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: AppTextStyles.body.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  height: 1.0,
                  color: active ? colors.background : colors.inkSoft,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
