import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class BbSearchBar extends StatelessWidget {
  const BbSearchBar({
    super.key,
    this.placeholder = 'Поиск встреч и мест',
    this.controller,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
    this.readOnly = false,
  });

  final String placeholder;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onTap;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final content = DecoratedBox(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.inputBorder,
        border: Border.all(color: colors.border),
        boxShadow: AppShadows.soft,
      ),
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            const SizedBox(width: AppSpacing.md),
            Icon(
              LucideIcons.search,
              size: 18,
              color: colors.inkMute,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: readOnly
                  ? Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        controller?.text.isNotEmpty == true
                            ? controller!.text
                            : placeholder,
                        style: AppTextStyles.body.copyWith(
                          color: colors.inkMute,
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    )
                  : TextField(
                      controller: controller,
                      onChanged: onChanged,
                      onSubmitted: onSubmitted,
                      onTap: onTap,
                      maxLines: 1,
                      textAlignVertical: TextAlignVertical.center,
                      style: AppTextStyles.body.copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                      decoration: InputDecoration(
                        hintText: placeholder,
                        hintStyle: AppTextStyles.body.copyWith(
                          color: colors.inkMute,
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                        isCollapsed: true,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        fillColor: Colors.transparent,
                        filled: false,
                      ),
                    ),
            ),
            const SizedBox(width: AppSpacing.md),
          ],
        ),
      ),
    );

    if (readOnly && onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadii.inputBorder,
          child: content,
        ),
      );
    }

    return content;
  }
}
