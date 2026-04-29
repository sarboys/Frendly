import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/event_filters.dart';
import 'package:flutter/material.dart';

Future<EventFilters?> showEventFilterSheet(
  BuildContext context, {
  required EventFilters initialValue,
  int? resultsCount,
  int Function(EventFilters filters)? resultsCountBuilder,
}) {
  return showModalBottomSheet<EventFilters>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _EventFilterSheet(
      initialValue: initialValue,
      resultsCount: resultsCount,
      resultsCountBuilder: resultsCountBuilder,
    ),
  );
}

class _EventFilterSheet extends StatefulWidget {
  const _EventFilterSheet({
    required this.initialValue,
    this.resultsCount,
    this.resultsCountBuilder,
  });

  final EventFilters initialValue;
  final int? resultsCount;
  final int Function(EventFilters filters)? resultsCountBuilder;

  @override
  State<_EventFilterSheet> createState() => _EventFilterSheetState();
}

class _EventFilterSheetState extends State<_EventFilterSheet> {
  late EventFilters _value = widget.initialValue;

  int? get _resultsCount =>
      widget.resultsCountBuilder?.call(_value) ?? widget.resultsCount;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SafeArea(
      top: false,
      bottom: false,
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 18),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  TextButton(
                    onPressed: () => setState(() {
                      _value = EventFilters.defaults;
                    }),
                    child: Text(
                      'Сбросить',
                      style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Фильтры',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionLabel(
                      icon: Icons.eco_outlined,
                      title: 'Образ жизни',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      childAspectRatio: 2.5,
                      children: [
                        _SegmentButton(
                          label: 'Любой',
                          active: _value.lifestyle == 'any',
                          onTap: () => setState(() {
                            _value = _value.copyWith(lifestyle: 'any');
                          }),
                        ),
                        _SegmentButton(
                          label: 'ЗОЖ',
                          icon: Icons.eco_outlined,
                          active: _value.lifestyle == 'zozh',
                          onTap: () => setState(() {
                            _value = _value.copyWith(lifestyle: 'zozh');
                          }),
                        ),
                        _SegmentButton(
                          label: 'Нейтрально',
                          active: _value.lifestyle == 'neutral',
                          onTap: () => setState(() {
                            _value = _value.copyWith(lifestyle: 'neutral');
                          }),
                        ),
                        _SegmentButton(
                          label: 'Не ЗОЖ',
                          icon: Icons.wine_bar_outlined,
                          active: _value.lifestyle == 'anti',
                          onTap: () => setState(() {
                            _value = _value.copyWith(lifestyle: 'anti');
                          }),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const _SectionLabel(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'Стоимость',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ('any', 'Любая'),
                        ('free', 'Бесплатно'),
                        ('cheap', 'до 1 000 ₽'),
                        ('mid', '1–3 тыс ₽'),
                        ('premium', '3 тыс ₽+'),
                      ]
                          .map(
                            (item) => _ChipButton(
                              label: item.$2,
                              active: _value.price == item.$1,
                              onTap: () => setState(() {
                                _value = _value.copyWith(price: item.$1);
                              }),
                            ),
                          )
                          .toList(growable: false),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const _SectionLabel(
                      icon: Icons.person_outline_rounded,
                      title: 'Состав',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: _SegmentButton(
                            label: 'Все',
                            active: _value.gender == 'any',
                            onTap: () => setState(() {
                              _value = _value.copyWith(gender: 'any');
                            }),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _SegmentButton(
                            label: 'Девушки',
                            active: _value.gender == 'female',
                            onTap: () => setState(() {
                              _value = _value.copyWith(gender: 'female');
                            }),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _SegmentButton(
                            label: 'Парни',
                            active: _value.gender == 'male',
                            onTap: () => setState(() {
                              _value = _value.copyWith(gender: 'male');
                            }),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const _SectionLabel(
                      icon: Icons.shield_outlined,
                      title: 'Тип доступа',
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _AccessRow(
                      title: 'Любой',
                      active: _value.access == 'any',
                      icon: Icons.public_rounded,
                      onTap: () => setState(() {
                        _value = _value.copyWith(access: 'any');
                      }),
                    ),
                    _AccessRow(
                      title: 'Открытое вступление',
                      hint: 'Без подтверждения',
                      active: _value.access == 'open',
                      icon: Icons.door_front_door_outlined,
                      onTap: () => setState(() {
                        _value = _value.copyWith(access: 'open');
                      }),
                    ),
                    _AccessRow(
                      title: 'По заявке',
                      hint: 'Хост одобряет каждого',
                      active: _value.access == 'request',
                      icon: Icons.verified_user_outlined,
                      onTap: () => setState(() {
                        _value = _value.copyWith(access: 'request');
                      }),
                    ),
                    _AccessRow(
                      title: 'Свободный приход',
                      hint: 'Можно прийти и уйти',
                      active: _value.access == 'free',
                      icon: Icons.public_rounded,
                      onTap: () => setState(() {
                        _value = _value.copyWith(access: 'free');
                      }),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  onPressed: () => Navigator.of(context).pop(_value),
                  child: Text(
                    _resultsCount != null
                        ? 'Показать $_resultsCount'
                        : 'Применить',
                    style: AppTextStyles.button.copyWith(
                      color: colors.primaryForeground,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.icon,
    required this.title,
  });

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        Icon(icon, size: 16, color: colors.inkMute),
        const SizedBox(width: 8),
        Text(
          title,
          style: AppTextStyles.caption.copyWith(
            color: colors.inkMute,
            letterSpacing: 1,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.label,
    required this.active,
    required this.onTap,
    this.icon,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.foreground : colors.card,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: active ? colors.foreground : colors.border,
            ),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 16,
                  color: active ? colors.primaryForeground : colors.inkSoft,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: AppTextStyles.meta.copyWith(
                  color: active ? colors.primaryForeground : colors.inkSoft,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChipButton extends StatelessWidget {
  const _ChipButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.foreground : colors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active ? colors.foreground : colors.border,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppTextStyles.meta.copyWith(
              color: active ? colors.primaryForeground : colors.inkSoft,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

class _AccessRow extends StatelessWidget {
  const _AccessRow({
    required this.title,
    required this.active,
    required this.icon,
    required this.onTap,
    this.hint,
  });

  final String title;
  final bool active;
  final IconData icon;
  final VoidCallback onTap;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: active ? colors.muted : colors.card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: active ? colors.foreground : colors.border,
              ),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: colors.inkSoft),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTextStyles.body.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (hint != null)
                        Text(
                          hint!,
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                    ],
                  ),
                ),
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: active ? colors.primary : Colors.transparent,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: active ? colors.primary : colors.border,
                      width: 2,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
