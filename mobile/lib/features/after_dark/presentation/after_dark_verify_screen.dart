import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AfterDarkVerifyScreen extends ConsumerWidget {
  const AfterDarkVerifyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verificationAsync = ref.watch(verificationProvider);

    return Scaffold(
      backgroundColor: AppColors.adBg,
      body: SafeArea(
        bottom: false,
        child: verificationAsync.when(
          data: (verification) {
            final verified = verification.status == 'verified';
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(
                      Icons.chevron_left_rounded,
                      size: 28,
                      color: AppColors.adFg,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'After Dark Verify',
                    style: AppTextStyles.screenTitle.copyWith(
                      color: AppColors.adFg,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Для kink и Inner Circle используем ту же общую верификацию. Нужны селфи и документ.',
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.adFgSoft,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  _VerifyStep(
                    title: 'Селфи',
                    done: verification.selfieDone || verified,
                  ),
                  _VerifyStep(
                    title: 'Документ',
                    done: verification.documentDone || verified,
                  ),
                  _VerifyStep(
                    title: 'Проверка',
                    done: verified,
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor:
                            verified ? AppColors.adViolet : AppColors.adMagenta,
                        foregroundColor: AppColors.adFg,
                        shape: const RoundedRectangleBorder(
                          borderRadius: AppRadii.cardBorder,
                        ),
                      ),
                      onPressed: () {
                        if (verified) {
                          context.pushRoute(AppRoute.afterDark);
                          return;
                        }
                        context.pushRoute(AppRoute.verification);
                      },
                      child: Text(
                        verified ? 'Вернуться в After Dark' : 'Пройти проверку',
                        style: AppTextStyles.button.copyWith(
                          color: AppColors.adFg,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.adMagenta),
          ),
          error: (_, __) => Center(
            child: Text(
              'Не получилось загрузить статус верификации',
              style: AppTextStyles.body.copyWith(color: AppColors.adFgSoft),
            ),
          ),
        ),
      ),
    );
  }
}

class _VerifyStep extends StatelessWidget {
  const _VerifyStep({
    required this.title,
    required this.done,
  });

  final String title;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.adSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.adBorder),
      ),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            color: done ? AppColors.adCyan : AppColors.adFgMute,
          ),
          const SizedBox(width: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.body.copyWith(
              color: AppColors.adFg,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
