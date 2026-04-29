import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

Future<DateTime?> showDateTimeSheet(
  BuildContext context, {
  required DateTime initialValue,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _DateTimeSheet(initialValue: initialValue),
  );
}

class _DateTimeSheet extends StatefulWidget {
  const _DateTimeSheet({
    required this.initialValue,
  });

  final DateTime initialValue;

  @override
  State<_DateTimeSheet> createState() => _DateTimeSheetState();
}

class _DateTimeSheetState extends State<_DateTimeSheet> {
  late DateTime _date = DateTime(
    widget.initialValue.year,
    widget.initialValue.month,
    widget.initialValue.day,
  );
  late int _hour = widget.initialValue.hour;
  late int _minute = _nearestMinute(widget.initialValue.minute);

  static const _minutes = [0, 15, 30, 45];

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final today = DateTime.now();
    final normalizedToday = DateTime(today.year, today.month, today.day);
    return SafeArea(
      top: false,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
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
                  const SizedBox(width: 40),
                  Expanded(
                    child: Text(
                      'Когда',
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
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CalendarDatePicker(
                      initialDate: _date,
                      firstDate: normalizedToday,
                      lastDate: normalizedToday.add(const Duration(days: 365)),
                      onDateChanged: (value) => setState(() => _date = value),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Время',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                        letterSpacing: 1,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: _WheelPicker(
                            values: List.generate(24, (index) => index),
                            currentValue: _hour,
                            format: (value) => value.toString().padLeft(2, '0'),
                            onChanged: (value) => setState(() => _hour = value),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            ':',
                            style: AppTextStyles.sectionTitle.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ),
                        Expanded(
                          child: _WheelPicker(
                            values: _minutes,
                            currentValue: _minute,
                            format: (value) => value.toString().padLeft(2, '0'),
                            onChanged: (value) =>
                                setState(() => _minute = value),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Center(
                      child: Text(
                        '${MaterialLocalizations.of(context).formatFullDate(_date)} · ${_hour.toString().padLeft(2, '0')}:${_minute.toString().padLeft(2, '0')}',
                        style: AppTextStyles.body.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: colors.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        onPressed: () {
                          Navigator.of(context).pop(
                            DateTime(
                              _date.year,
                              _date.month,
                              _date.day,
                              _hour,
                              _minute,
                            ),
                          );
                        },
                        child: Text(
                          'Готово',
                          style: AppTextStyles.button.copyWith(
                            color: colors.primaryForeground,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static int _nearestMinute(int value) {
    var closest = _minutes.first;
    var distance = (closest - value).abs();
    for (final minute in _minutes) {
      final nextDistance = (minute - value).abs();
      if (nextDistance < distance) {
        closest = minute;
        distance = nextDistance;
      }
    }
    return closest;
  }
}

class _WheelPicker extends StatelessWidget {
  const _WheelPicker({
    required this.values,
    required this.currentValue,
    required this.format,
    required this.onChanged,
  });

  final List<int> values;
  final int currentValue;
  final String Function(int value) format;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      height: 128,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.border),
      ),
      child: ListWheelScrollView.useDelegate(
        itemExtent: 36,
        diameterRatio: 1.4,
        physics: const FixedExtentScrollPhysics(),
        controller: FixedExtentScrollController(
          initialItem: values.indexOf(currentValue).clamp(0, values.length - 1),
        ),
        onSelectedItemChanged: (index) => onChanged(values[index]),
        childDelegate: ListWheelChildBuilderDelegate(
          childCount: values.length,
          builder: (context, index) {
            final value = values[index];
            final active = value == currentValue;
            return Center(
              child: Text(
                format(value),
                style: AppTextStyles.sectionTitle.copyWith(
                  fontSize: 20,
                  color: active ? colors.foreground : colors.inkMute,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
