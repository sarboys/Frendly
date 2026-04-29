import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class BbPinnedMeetupCard extends StatelessWidget {
  const BbPinnedMeetupCard({
    required this.chat,
    required this.place,
    super.key,
    this.onTap,
  });

  final MeetupChat chat;
  final String place;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(color: colors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.warmStart,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Text(chat.emoji, style: const TextStyle(fontSize: 18)),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          LucideIcons.clock_3,
                          size: 12,
                          color: colors.inkSoft,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Сегодня · ${chat.time}',
                          style: AppTextStyles.meta
                              .copyWith(color: colors.inkSoft),
                        ),
                        const SizedBox(width: 8),
                        Text('·', style: TextStyle(color: colors.inkMute)),
                        const SizedBox(width: 8),
                        Icon(
                          LucideIcons.map_pin,
                          size: 12,
                          color: colors.inkSoft,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            place,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.meta
                                .copyWith(color: colors.inkSoft),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Тапни, чтобы открыть встречу',
                      style: AppTextStyles.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
