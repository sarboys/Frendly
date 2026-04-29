import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({
    required this.userId,
    super.key,
  });

  final String userId;

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  String? _reason;
  bool _block = true;
  final _detailsController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final profileAsync = ref.watch(personProfileProvider(widget.userId));
    const reasons = <(String, String, String)>[
      ('fake', 'Фейковый профиль', 'Чужие фото или вымышленная личность'),
      (
        'rude',
        'Грубое поведение',
        'Оскорбления, агрессия в чате или на встрече'
      ),
      ('harass', 'Домогательства', 'Нежелательные действия, преследование'),
      ('spam', 'Спам или реклама', 'Продвижение услуг, рассылки'),
      ('scam', 'Мошенничество', 'Подозрительные просьбы, обман'),
      ('other', 'Другое', 'Опишу подробнее ниже'),
    ];

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: profileAsync.when(
          data: (profile) => Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: colors.border.withValues(alpha: 0.6),
                    ),
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.chevron_left_rounded, size: 28),
                    ),
                    Expanded(
                      child: Text(
                        'Пожаловаться',
                        textAlign: TextAlign.center,
                        style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.destructive.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.flag_outlined,
                            size: 20,
                            color: colors.destructive,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Жалоба на ${profile.displayName}',
                                  style: AppTextStyles.itemTitle
                                      .copyWith(fontSize: 14),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Команда модерации проверит профиль за 24 часа. Это анонимно, пользователь не узнает.',
                                  style: AppTextStyles.bodySoft,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    ...reasons.map(
                      (reason) => _ReasonTile(
                        label: reason.$2,
                        subtitle: reason.$3,
                        selected: _reason == reason.$1,
                        onTap: () => setState(() => _reason = reason.$1),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Подробности (по желанию)',
                            style: AppTextStyles.body.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          TextField(
                            controller: _detailsController,
                            maxLines: 3,
                            maxLength: 500,
                            decoration: InputDecoration(
                              hintText:
                                  'Что произошло? Когда, где, как себя вёл?',
                              hintStyle: AppTextStyles.bodySoft
                                  .copyWith(color: colors.inkMute),
                              border: InputBorder.none,
                              counterText: '',
                              contentPadding: EdgeInsets.zero,
                            ),
                            style: AppTextStyles.bodySoft,
                          ),
                        ],
                      ),
                    ),
                    InkWell(
                      onTap: () => setState(() => _block = !_block),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                color: _block
                                    ? colors.foreground
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: _block
                                      ? colors.foreground
                                      : colors.border,
                                  width: 2,
                                ),
                              ),
                              child: _block
                                  ? Center(
                                      child: Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: colors.primaryForeground,
                                          borderRadius:
                                              BorderRadius.circular(2),
                                        ),
                                      ),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Заблокировать ${profile.displayName}',
                                    style: AppTextStyles.body,
                                  ),
                                  Text(
                                    'Не увидите друг друга в приложении',
                                    style: AppTextStyles.meta,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.background.withValues(alpha: 0.92),
                    border: Border(
                      top: BorderSide(
                        color: colors.border.withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: colors.destructive,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        onPressed: _reason == null || _submitting
                            ? null
                            : () async {
                                setState(() {
                                  _submitting = true;
                                });
                                try {
                                  await ref
                                      .read(backendRepositoryProvider)
                                      .createReport(
                                        targetUserId: widget.userId,
                                        reason: _reason!,
                                        details: _detailsController.text.trim(),
                                        blockRequested: _block,
                                      );
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Жалоба отправлена'),
                                      ),
                                    );
                                    context.pop();
                                  }
                                } catch (_) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Не получилось отправить жалобу',
                                        ),
                                      ),
                                    );
                                  }
                                } finally {
                                  if (mounted) {
                                    setState(() {
                                      _submitting = false;
                                    });
                                  }
                                }
                              },
                        child: Text(
                          'Отправить жалобу',
                          style: AppTextStyles.button.copyWith(
                            color: colors.destructiveForeground,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          loading: () => Center(
            child: CircularProgressIndicator(color: colors.primary),
          ),
          error: (error, _) => Center(child: Text(error.toString())),
        ),
      ),
    );
  }
}

class _ReasonTile extends StatelessWidget {
  const _ReasonTile({
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? colors.foreground : colors.border,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTextStyles.itemTitle),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: AppTextStyles.meta.copyWith(color: colors.inkMute),
            ),
          ],
        ),
      ),
    );
  }
}
