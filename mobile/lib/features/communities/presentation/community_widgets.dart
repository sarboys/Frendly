import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:go_router/go_router.dart';

bool hasFrendlyPlusAccess(SubscriptionStateData? subscription) {
  return subscription?.status == 'trial' || subscription?.status == 'active';
}

class CommunityBackHeader extends StatelessWidget {
  const CommunityBackHeader({
    required this.title,
    required this.subtitle,
    super.key,
    this.trailing,
    this.onBack,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 3, 16, 12),
        child: Row(
          children: [
            IconButton(
              onPressed: onBack ??
                  () {
                    if (context.canPop()) {
                      context.pop();
                      return;
                    }
                    context.goRoute(AppRoute.communities);
                  },
              icon: Icon(
                LucideIcons.chevron_left,
                color: colors.foreground,
                size: 28,
              ),
            ),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.meta.copyWith(
                      color: colors.inkMute,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.itemTitle.copyWith(
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            trailing ?? const SizedBox(width: 40),
          ],
        ),
      ),
    );
  }
}

class CommunityRoundButton extends StatelessWidget {
  const CommunityRoundButton({
    required this.icon,
    required this.onTap,
    super.key,
    this.background,
    this.foreground,
    this.borderColor,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color? background;
  final Color? foreground;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: background ?? colors.card,
      shape: CircleBorder(
        side: BorderSide(color: borderColor ?? Colors.transparent),
      ),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox.square(
          dimension: 40,
          child: Icon(
            icon,
            color: foreground ?? colors.foreground,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class CommunityAvatarBox extends StatelessWidget {
  const CommunityAvatarBox({
    required this.emoji,
    super.key,
    this.size = 56,
    this.radius = 18,
    this.fontSize = 30,
  });

  final String emoji;
  final double size;
  final double radius;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.warmStart, colors.warmEnd],
        ),
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Text(
        emoji,
        style: TextStyle(fontSize: fontSize, height: 1),
      ),
    );
  }
}

class CommunityBadge extends StatelessWidget {
  const CommunityBadge({
    required this.label,
    super.key,
    this.icon,
    this.background,
    this.foreground,
  });

  final String label;
  final IconData? icon;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final textColor = foreground ?? colors.secondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background ?? colors.secondarySoft,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: textColor,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class CommunityStatCard extends StatelessWidget {
  const CommunityStatCard({
    required this.icon,
    required this.value,
    super.key,
    this.minHeight = 52,
  });

  final IconData icon;
  final String value;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      height: minHeight,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.background,
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: colors.inkSoft),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.sectionTitle.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: colors.foreground,
                height: 1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class CommunityInfoCard extends StatelessWidget {
  const CommunityInfoCard({
    required this.children,
    super.key,
    this.padding = const EdgeInsets.all(16),
    this.shadow = true,
  });

  final List<Widget> children;
  final EdgeInsetsGeometry padding;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
        boxShadow: shadow ? AppShadows.soft : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }
}

class CommunityMissingState extends StatelessWidget {
  const CommunityMissingState({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Center(
          child: Text(
            'Сообщество не найдено',
            style: AppTextStyles.body.copyWith(color: colors.inkMute),
          ),
        ),
      ),
    );
  }
}

String communityMediaKindLabel(CommunityMediaKind kind) {
  switch (kind) {
    case CommunityMediaKind.photo:
      return 'Фото';
    case CommunityMediaKind.video:
      return 'Видео';
    case CommunityMediaKind.doc:
      return 'Файл';
  }
}

String communityPrivacyLabel(CommunityPrivacy privacy) {
  switch (privacy) {
    case CommunityPrivacy.public:
      return 'Открытое вступление';
    case CommunityPrivacy.private:
      return 'Вступление по заявке';
  }
}
