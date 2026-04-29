import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

enum BbImageUsageProfile {
  avatar,
  card,
  hero,
  fullscreen,
}

class BbProfilePhotoImage extends StatelessWidget {
  const BbProfilePhotoImage({
    required this.imageUrl,
    required this.fallbackText,
    required this.usageProfile,
    super.key,
    this.fit = BoxFit.cover,
    this.fallbackFontSize,
  });

  final String? imageUrl;
  final String fallbackText;
  final BbImageUsageProfile usageProfile;
  final BoxFit fit;
  final double? fallbackFontSize;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim();
    if (url == null || url.isEmpty) {
      return _ProfilePhotoFallback(
        text: fallbackText,
        usageProfile: usageProfile,
        fontSize: fallbackFontSize,
      );
    }

    return CachedNetworkImage(
      imageUrl: url,
      cacheKey: _cacheKey(url),
      fit: fit,
      placeholder: (context, _) => _ProfilePhotoFallback(
        text: fallbackText,
        usageProfile: usageProfile,
        fontSize: fallbackFontSize,
      ),
      errorWidget: (context, _, __) => _ProfilePhotoFallback(
        text: fallbackText,
        usageProfile: usageProfile,
        fontSize: fallbackFontSize,
      ),
    );
  }

  String _cacheKey(String url) {
    return 'profile-image-${usageProfile.name}-$url';
  }
}

class _ProfilePhotoFallback extends StatelessWidget {
  const _ProfilePhotoFallback({
    required this.text,
    required this.usageProfile,
    required this.fontSize,
  });

  final String text;
  final BbImageUsageProfile usageProfile;
  final double? fontSize;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final effectiveFontSize =
        fontSize ?? (usageProfile == BbImageUsageProfile.avatar ? 24.0 : 64.0);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: usageProfile == BbImageUsageProfile.avatar
            ? colors.primarySoft
            : null,
        gradient: usageProfile == BbImageUsageProfile.avatar
            ? null
            : LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  colors.primarySoft,
                  colors.background,
                  colors.secondarySoft,
                ],
              ),
      ),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: AppTextStyles.screenTitle.copyWith(
            color: colors.inkSoft,
            fontSize: effectiveFontSize,
          ),
        ),
      ),
    );
  }
}
