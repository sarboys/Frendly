import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class CreateEveningSessionScreen extends ConsumerStatefulWidget {
  const CreateEveningSessionScreen({
    required this.templateId,
    super.key,
  });

  final String templateId;

  @override
  ConsumerState<CreateEveningSessionScreen> createState() =>
      _CreateEveningSessionScreenState();
}

class _CreateEveningSessionScreenState
    extends ConsumerState<CreateEveningSessionScreen> {
  final _hostNoteController = TextEditingController();
  late DateTime _date = _initialStartsAt();
  late TimeOfDay _time = TimeOfDay.fromDateTime(_date);
  EveningPrivacy _privacy = EveningPrivacy.open;
  int _capacity = 8;
  bool _submitting = false;

  @override
  void dispose() {
    _hostNoteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final detailAsync =
        ref.watch(eveningRouteTemplateProvider(widget.templateId));

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: detailAsync.when(
          data: (route) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 8, 20, 24),
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.chevron_left_rounded, size: 28),
                    ),
                    Expanded(
                      child: Text(
                        'Новая встреча',
                        style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  route.title,
                  style: AppTextStyles.screenTitle,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Создай публичную встречу по командному маршруту.',
                  style: AppTextStyles.body.copyWith(color: colors.inkSoft),
                ),
                const SizedBox(height: AppSpacing.xl),
                _Section(
                  title: 'Когда',
                  child: Row(
                    children: [
                      Expanded(
                        child: _FieldButton(
                          icon: LucideIcons.calendar,
                          label: _formatDate(_date),
                          onTap: _pickDate,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: _FieldButton(
                          icon: LucideIcons.clock_3,
                          label: _formatTime(_time),
                          onTap: _pickTime,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _Section(
                  title: 'Доступ',
                  child: Row(
                    children: [
                      Expanded(
                        child: _PrivacyOption(
                          title: 'Открытая',
                          subtitle: 'Можно вступить сразу',
                          active: _privacy == EveningPrivacy.open,
                          onTap: () => setState(() {
                            _privacy = EveningPrivacy.open;
                          }),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: _PrivacyOption(
                          title: 'По заявке',
                          subtitle: 'Ты подтверждаешь гостей',
                          active: _privacy == EveningPrivacy.request,
                          onTap: () => setState(() {
                            _privacy = EveningPrivacy.request;
                          }),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _Section(
                  title: 'Места',
                  child: _CapacityStepper(
                    value: _capacity,
                    onChanged: (value) => setState(() {
                      _capacity = value.clamp(2, 12);
                    }),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                _Section(
                  title: 'Заметка хоста',
                  child: TextField(
                    controller: _hostNoteController,
                    minLines: 3,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Например, встречаемся у первого места',
                      filled: true,
                      fillColor: colors.card,
                      border: OutlineInputBorder(
                        borderRadius: AppRadii.inputBorder,
                        borderSide: BorderSide(color: colors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: AppRadii.inputBorder,
                        borderSide: BorderSide(color: colors.border),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(LucideIcons.calendar_plus, size: 18),
                  label: Text(_submitting ? 'Создаем...' : 'Создать встречу'),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text(
                'Не получилось загрузить маршрут',
                style: AppTextStyles.body,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }

  static DateTime _initialStartsAt() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day, now.hour + 2, 0);
  }

  DateTime get _startsAt {
    return DateTime(
      _date.year,
      _date.month,
      _date.day,
      _time.hour,
      _time.minute,
    );
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      _date = picked;
    });
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      _time = picked;
    });
  }

  Future<void> _submit() async {
    final startsAt = _startsAt;
    if (!startsAt.isAfter(DateTime.now())) {
      _showError('Выбери будущие дату и время.');
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final result = await ref
          .read(backendRepositoryProvider)
          .createEveningSessionFromTemplate(
            widget.templateId,
            startsAt: startsAt,
            privacy: _privacy,
            capacity: _capacity,
            hostNote: _hostNoteController.text,
          );
      ref.invalidate(eveningSessionsProvider);
      ref.invalidate(eveningRouteTemplateSessionsProvider(widget.templateId));
      ref.invalidate(eveningRouteTemplateProvider(widget.templateId));
      if (!mounted) {
        return;
      }
      context.pushReplacementNamed(
        AppRoute.eveningPreview.name,
        pathParameters: {'sessionId': result.sessionId},
      );
    } on DioException catch (error) {
      if (!mounted) {
        return;
      }
      _showError(_mapBackendError(error));
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showError('Не получилось создать встречу.');
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  String _mapBackendError(DioException error) {
    final data = error.response?.data;
    final code = data is Map ? data['code'] as String? : null;
    switch (code) {
      case 'starts_at_required':
      case 'starts_at_invalid':
      case 'starts_at_in_past':
        return 'Выбери будущие дату и время.';
      case 'evening_host_active_limit_reached':
        return 'У тебя уже есть несколько активных вечеров.';
      case 'route_template_daily_duplicate':
        return 'На этот день такая встреча уже создана.';
      case 'new_account_public_route_daily_limit':
        return 'Новый аккаунт может создать одну открытую встречу в день.';
      default:
        final message = data is Map ? data['message'] as String? : null;
        return message?.trim().isNotEmpty == true
            ? message!.trim()
            : 'Не получилось создать встречу.';
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  String _formatDate(DateTime value) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(value.year, value.month, value.day);
    if (day == today) {
      return 'Сегодня';
    }
    if (day == today.add(const Duration(days: 1))) {
      return 'Завтра';
    }
    return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}';
  }

  String _formatTime(TimeOfDay value) {
    return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    );
  }
}

class _FieldButton extends StatelessWidget {
  const _FieldButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.inputBorder,
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.inputBorder,
            border: Border.all(color: colors.border),
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: colors.primary),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PrivacyOption extends StatelessWidget {
  const _PrivacyOption({
    required this.title,
    required this.subtitle,
    required this.active,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: active ? colors.primarySoft : colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(
              color: active ? colors.primary : colors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTextStyles.itemTitle),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CapacityStepper extends StatelessWidget {
  const _CapacityStepper({
    required this.value,
    required this.onChanged,
  });

  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'От 2 до 12 участников',
              style: AppTextStyles.body.copyWith(color: colors.inkSoft),
            ),
          ),
          _StepperButton(
            icon: Icons.remove_rounded,
            enabled: value > 2,
            onTap: () => onChanged(value - 1),
          ),
          SizedBox(
            width: 42,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: AppTextStyles.itemTitle.copyWith(fontSize: 18),
            ),
          ),
          _StepperButton(
            icon: Icons.add_rounded,
            enabled: value < 12,
            onTap: () => onChanged(value + 1),
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return IconButton.filledTonal(
      onPressed: enabled ? onTap : null,
      icon: Icon(icon),
      style: IconButton.styleFrom(
        backgroundColor: colors.muted,
        foregroundColor: colors.foreground,
        disabledBackgroundColor: colors.muted.withValues(alpha: 0.45),
      ),
    );
  }
}
