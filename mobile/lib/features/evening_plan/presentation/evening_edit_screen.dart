import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_providers.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_edit_state.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EveningEditScreen extends ConsumerStatefulWidget {
  const EveningEditScreen({
    required this.routeId,
    this.chatId,
    super.key,
  });

  final String routeId;
  final String? chatId;

  @override
  ConsumerState<EveningEditScreen> createState() => _EveningEditScreenState();
}

class _EveningEditScreenState extends ConsumerState<EveningEditScreen> {
  late final EveningRouteData _initialRoute;
  late final TextEditingController _titleController;
  late final TextEditingController _blurbController;
  late final TextEditingController _areaController;
  late final TextEditingController _durationController;
  late List<EveningRouteStep> _steps;
  late bool _premium;
  EveningPrivacy _privacy = EveningPrivacy.open;
  EveningPrivacy _initialPrivacy = EveningPrivacy.open;
  int? _maxGuests;
  int? _initialMaxGuests;
  String? _syncedChatId;
  String? _openStepId;

  @override
  void initState() {
    super.initState();
    _initialRoute = readEveningRoute(ref, widget.routeId);
    _titleController = TextEditingController(text: _initialRoute.title);
    _blurbController = TextEditingController(text: _initialRoute.blurb);
    _areaController = TextEditingController(text: _initialRoute.area);
    _durationController =
        TextEditingController(text: _initialRoute.durationLabel);
    _steps = [..._initialRoute.steps];
    _premium = _initialRoute.premium;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _blurbController.dispose();
    _areaController.dispose();
    _durationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final chat = _resolveChat();
    _syncChatMeta(chat);
    final policy = EveningEditPolicy.forPhase(chat?.phase);
    final canSave = chat?.phase != MeetupPhase.done;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 112),
              children: [
                _Header(
                  canSave: canSave,
                  phase: chat?.phase,
                  onBack: _pop,
                  onSave: _save,
                ),
                if (chat?.phase == MeetupPhase.live)
                  const _PhaseBanner(
                    icon: LucideIcons.circle_alert,
                    text: 'Вечер уже идёт. Можно править только будущие шаги',
                  ),
                if (chat?.phase == MeetupPhase.done)
                  const _PhaseBanner(
                    icon: LucideIcons.lock,
                    text: 'Вечер завершён. Редактирование закрыто',
                  ),
                _Section(
                  title: 'Основное',
                  disabled: !policy.meta,
                  children: [
                    _Field(
                      label: 'Название',
                      child: _TextInput(
                        controller: _titleController,
                        enabled: policy.meta,
                      ),
                    ),
                    _Field(
                      label: 'Описание',
                      child: _TextInput(
                        controller: _blurbController,
                        enabled: policy.meta,
                        maxLines: 2,
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: _Field(
                            label: 'Район',
                            child: _TextInput(
                              controller: _areaController,
                              enabled: policy.meta,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _Field(
                            label: 'Время',
                            child: _TextInput(
                              controller: _durationController,
                              enabled: policy.meta,
                            ),
                          ),
                        ),
                      ],
                    ),
                    _PremiumToggle(
                      value: _premium,
                      enabled: policy.meta,
                      onChanged: (value) => setState(() => _premium = value),
                    ),
                  ],
                ),
                _Section(
                  title: 'Кто может вписаться',
                  disabled: !policy.meta,
                  children: [
                    _PrivacyOption(
                      icon: LucideIcons.globe,
                      label: 'Открытый',
                      hint: 'Любой может присоединиться',
                      active: _privacy == EveningPrivacy.open,
                      enabled: policy.meta,
                      onTap: () =>
                          setState(() => _privacy = EveningPrivacy.open),
                    ),
                    _PrivacyOption(
                      icon: LucideIcons.user_plus,
                      label: 'По заявке',
                      hint: 'Хост одобряет каждую заявку',
                      active: _privacy == EveningPrivacy.request,
                      enabled: policy.meta,
                      onTap: () =>
                          setState(() => _privacy = EveningPrivacy.request),
                    ),
                    _PrivacyOption(
                      icon: LucideIcons.lock,
                      label: 'По приглашениям',
                      hint: 'Только приглашённые видят встречу',
                      active: _privacy == EveningPrivacy.invite,
                      enabled: policy.meta,
                      onTap: () =>
                          setState(() => _privacy = EveningPrivacy.invite),
                    ),
                    _GuestLimitControl(
                      value: _maxGuests,
                      enabled: policy.meta,
                      onChanged: (value) => setState(() => _maxGuests = value),
                    ),
                  ],
                ),
                _Section(
                  title: 'Маршрут',
                  children: [
                    for (var i = 0; i < _steps.length; i++)
                      _StepEditorCard(
                        key: ValueKey(_steps[i].id),
                        step: _steps[i],
                        index: i,
                        total: _steps.length,
                        editable: policy.stepEditable(
                          i,
                          currentStep: chat?.currentStep,
                        ),
                        passed: chat?.phase == MeetupPhase.live &&
                            !policy.stepEditable(
                              i,
                              currentStep: chat?.currentStep,
                            ),
                        expanded: _openStepId == _steps[i].id,
                        canMoveUp: policy.reorderStep && i > 0,
                        canMoveDown:
                            policy.reorderStep && i < _steps.length - 1,
                        canRemove: policy.removeStep,
                        onToggle: () => setState(() {
                          _openStepId =
                              _openStepId == _steps[i].id ? null : _steps[i].id;
                        }),
                        onChanged: (step) => _replaceStep(i, step),
                        onMoveUp: () => _moveStep(i, -1, policy, chat),
                        onMoveDown: () => _moveStep(i, 1, policy, chat),
                        onRemove: () => _removeStep(i, policy, chat),
                      ),
                    if (policy.addStep) _AddStepButton(onTap: _addStep),
                  ],
                ),
              ],
            ),
            if (canSave)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _StickySave(onTap: _save),
              ),
          ],
        ),
      ),
    );
  }

  MeetupChat? _resolveChat() {
    final chatId = widget.chatId;
    if (chatId != null && chatId.isNotEmpty) {
      return ref.watch(meetupChatSummaryProvider(chatId));
    }

    final chats = ref.watch(meetupChatsProvider).valueOrNull ??
        ref.watch(meetupChatsLocalStateProvider);
    if (chats == null) {
      return null;
    }
    for (final chat in chats) {
      if (chat.routeId == widget.routeId) {
        return chat;
      }
    }
    return null;
  }

  void _syncChatMeta(MeetupChat? chat) {
    if (chat == null || _syncedChatId == chat.id) {
      return;
    }
    _syncedChatId = chat.id;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _privacy = chat.privacy;
        _initialPrivacy = chat.privacy;
        _maxGuests = chat.maxGuests;
        _initialMaxGuests = chat.maxGuests;
      });
    });
  }

  void _replaceStep(int index, EveningRouteStep step) {
    setState(() {
      _steps = [
        for (var i = 0; i < _steps.length; i++) i == index ? step : _steps[i],
      ];
    });
  }

  void _moveStep(
    int index,
    int direction,
    EveningEditPolicy policy,
    MeetupChat? chat,
  ) {
    final target = index + direction;
    if (target < 0 || target >= _steps.length) {
      return;
    }
    if (!policy.stepEditable(index, currentStep: chat?.currentStep) ||
        !policy.stepEditable(target, currentStep: chat?.currentStep)) {
      return;
    }
    setState(() {
      final next = [..._steps];
      final item = next.removeAt(index);
      next.insert(target, item);
      _steps = next;
    });
  }

  void _removeStep(int index, EveningEditPolicy policy, MeetupChat? chat) {
    if (!policy.stepEditable(index, currentStep: chat?.currentStep)) {
      return;
    }
    setState(() {
      _steps = [..._steps]..removeAt(index);
    });
  }

  void _addStep() {
    final last = _steps.isEmpty ? null : _steps.last;
    final step = EveningRouteStep(
      id: 'local-step-${DateTime.now().microsecondsSinceEpoch}',
      time: nextEveningStepTime(last?.endTime ?? last?.time ?? '21:00'),
      kind: EveningStepKind.bar,
      title: 'Новый шаг',
      venue: 'Выбери место',
      address: _areaController.text.trim().isEmpty
          ? _initialRoute.area
          : _areaController.text.trim(),
      emoji: '✨',
      distance: '—',
      lat: 0.5,
      lng: 0.5,
    );
    setState(() {
      _steps = [..._steps, step];
      _openStepId = step.id;
    });
  }

  void _save() {
    final chat = _readChat();
    if (chat?.phase == MeetupPhase.done) {
      return;
    }

    final totalTickets = _steps.fold<int>(
      0,
      (sum, step) => sum + (step.ticketPrice ?? 0),
    );
    final nextRoute = _initialRoute.copyWith(
      title: _fallbackTrim(_titleController.text, _initialRoute.title),
      blurb: _fallbackTrim(_blurbController.text, _initialRoute.blurb),
      area: _fallbackTrim(_areaController.text, _initialRoute.area),
      durationLabel:
          _fallbackTrim(_durationController.text, _initialRoute.durationLabel),
      premium: _premium,
      totalPriceFrom:
          totalTickets == 0 ? _initialRoute.totalPriceFrom : totalTickets,
      steps: _steps,
    );
    final diff = buildEveningEditDiff(
      previous: EveningEditSnapshot(
        route: _initialRoute,
        privacy: _initialPrivacy,
        maxGuests: _initialMaxGuests,
      ),
      next: EveningEditSnapshot(
        route: nextRoute,
        privacy: _privacy,
        maxGuests: _maxGuests,
      ),
    );

    ref.read(eveningRouteOverridesProvider.notifier).state = {
      ...ref.read(eveningRouteOverridesProvider),
      nextRoute.id: nextRoute,
    };

    final chatId = widget.chatId ?? chat?.id;
    if (chatId != null) {
      _patchChatSummary(
        chatId: chatId,
        route: nextRoute,
        diff: diff,
      );
      if (diff.isNotEmpty) {
        ref
            .read(chatThreadProvider(chatId).notifier)
            .addLocalSystemMessage(_diffMessage(diff));
      }
    }

    _pop();
  }

  MeetupChat? _readChat() {
    final chatId = widget.chatId;
    if (chatId != null && chatId.isNotEmpty) {
      final chats = ref.read(meetupChatsLocalStateProvider) ??
          ref.read(meetupChatsProvider).valueOrNull;
      if (chats != null) {
        for (final chat in chats) {
          if (chat.id == chatId) {
            return chat;
          }
        }
      }
      return ref.read(meetupChatSummaryProvider(chatId));
    }

    final chats = ref.read(meetupChatsLocalStateProvider) ??
        ref.read(meetupChatsProvider).valueOrNull;
    if (chats == null) {
      return null;
    }
    for (final chat in chats) {
      if (chat.routeId == widget.routeId) {
        return chat;
      }
    }
    return null;
  }

  void _patchChatSummary({
    required String chatId,
    required EveningRouteData route,
    required List<String> diff,
  }) {
    final local = ref.read(meetupChatsLocalStateProvider);
    final remote = ref.read(meetupChatsProvider).valueOrNull;
    final chats = local ?? remote;
    if (chats == null) {
      ref.invalidate(meetupChatsProvider);
      return;
    }

    ref.read(meetupChatsLocalStateProvider.notifier).state = [
      for (final chat in chats)
        chat.id == chatId
            ? chat.copyWith(
                title: route.title,
                time: route.durationLabel,
                privacy: _privacy,
                maxGuests: _maxGuests,
                clearMaxGuests: _maxGuests == null,
                area: route.area,
                lastAuthor: diff.isEmpty ? chat.lastAuthor : 'Frendly',
                lastMessage:
                    diff.isEmpty ? chat.lastMessage : _diffHeadline(diff),
                lastTime: diff.isEmpty ? chat.lastTime : 'сейчас',
              )
            : chat,
    ];
  }

  String _diffMessage(List<String> diff) {
    if (diff.length == 1) {
      return '✏️ План обновлён · ${diff.first}';
    }
    return '✏️ План обновлён · ${diff.length} изменений\n— ${diff.join('\n— ')}';
  }

  String _diffHeadline(List<String> diff) {
    return diff.length == 1
        ? '✏️ План обновлён · ${diff.first}'
        : '✏️ План обновлён · ${diff.length} изменений';
  }

  String _fallbackTrim(String value, String fallback) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? fallback : trimmed;
  }

  void _pop() {
    if (context.canPop()) {
      context.pop();
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.canSave,
    required this.onBack,
    required this.onSave,
    this.phase,
  });

  final bool canSave;
  final MeetupPhase? phase;
  final VoidCallback onBack;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final subtitle = phase == MeetupPhase.live
        ? 'Live · правка только будущих шагов'
        : 'Изменения уйдут в чат участников';
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(LucideIcons.chevron_left, size: 22),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Редактировать вечер', style: AppTextStyles.itemTitle),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(color: colors.inkMute),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            onPressed: canSave ? onSave : null,
            icon: const Icon(LucideIcons.check, size: 16),
            label: const Text('Сохранить'),
          ),
        ],
      ),
    );
  }
}

class _PhaseBanner extends StatelessWidget {
  const _PhaseBanner({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.xs),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.warmStart,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: colors.secondary),
          const SizedBox(width: AppSpacing.xs),
          Expanded(child: Text(text, style: AppTextStyles.meta)),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.children,
    this.disabled = false,
  });

  final String title;
  final bool disabled;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: AppTextStyles.caption.copyWith(
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (disabled)
                Row(
                  children: [
                    Icon(LucideIcons.lock, size: 12, color: colors.inkMute),
                    const SizedBox(width: 4),
                    Text(
                      'заморожено',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ...children.expand(
            (child) => [child, const SizedBox(height: AppSpacing.sm)],
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.child,
  });

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: colors.inkMute,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        child,
      ],
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    required this.controller,
    this.enabled = true,
    this.maxLines = 1,
  });

  final TextEditingController controller;
  final bool enabled;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return TextField(
      controller: controller,
      enabled: enabled,
      maxLines: maxLines,
      style: AppTextStyles.body,
      decoration: InputDecoration(
        filled: true,
        fillColor: colors.card,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.border),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.border),
        ),
      ),
    );
  }
}

class _PremiumToggle extends StatelessWidget {
  const _PremiumToggle({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: enabled ? () => onChanged(!value) : null,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: value ? colors.foreground : colors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: value ? colors.foreground : colors.border),
        ),
        child: Row(
          children: [
            Icon(
              LucideIcons.crown,
              size: 16,
              color: value ? colors.background : colors.inkSoft,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                'Frendly+ маршрут',
                style: AppTextStyles.meta.copyWith(
                  color: value ? colors.background : colors.foreground,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              value ? 'Вкл' : 'Выкл',
              style: AppTextStyles.caption.copyWith(
                color: value ? colors.background : colors.inkMute,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrivacyOption extends StatelessWidget {
  const _PrivacyOption({
    required this.icon,
    required this.label,
    required this.hint,
    required this.active,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String hint;
  final bool active;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: active ? colors.foreground : colors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? colors.foreground : colors.border),
        ),
        child: Row(
          children: [
            Icon(icon,
                size: 17, color: active ? colors.background : colors.inkSoft),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppTextStyles.meta.copyWith(
                      color: active ? colors.background : colors.foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    hint,
                    style: AppTextStyles.caption.copyWith(
                      color: active
                          ? colors.background.withValues(alpha: 0.72)
                          : colors.inkMute,
                    ),
                  ),
                ],
              ),
            ),
            if (active)
              Icon(LucideIcons.check, size: 16, color: colors.background),
          ],
        ),
      ),
    );
  }
}

class _GuestLimitControl extends StatelessWidget {
  const _GuestLimitControl({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final int? value;
  final bool enabled;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return _Field(
      label: 'Лимит мест',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _SquareButton(
                label: '−',
                enabled: enabled,
                onTap: () =>
                    onChanged((value ?? 6) <= 2 ? 2 : (value ?? 6) - 1),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.muted,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    value == null ? 'без лимита' : '$value мест',
                    style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              _SquareButton(
                label: '+',
                enabled: enabled,
                onTap: () =>
                    onChanged((value ?? 6) >= 50 ? 50 : (value ?? 6) + 1),
              ),
            ],
          ),
          if (value != null && enabled)
            TextButton(
              onPressed: () => onChanged(null),
              child: const Text('Убрать лимит'),
            ),
        ],
      ),
    );
  }
}

class _SquareButton extends StatelessWidget {
  const _SquareButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colors.border),
        ),
        alignment: Alignment.center,
        child: Text(label, style: AppTextStyles.itemTitle),
      ),
    );
  }
}

class _StepEditorCard extends StatelessWidget {
  const _StepEditorCard({
    required this.step,
    required this.index,
    required this.total,
    required this.editable,
    required this.passed,
    required this.expanded,
    required this.canMoveUp,
    required this.canMoveDown,
    required this.canRemove,
    required this.onToggle,
    required this.onChanged,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onRemove,
    super.key,
  });

  final EveningRouteStep step;
  final int index;
  final int total;
  final bool editable;
  final bool passed;
  final bool expanded;
  final bool canMoveUp;
  final bool canMoveDown;
  final bool canRemove;
  final VoidCallback onToggle;
  final ValueChanged<EveningRouteStep> onChanged;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Opacity(
      opacity: editable ? 1 : 0.62,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.xs),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: colors.border,
            style: editable ? BorderStyle.solid : BorderStyle.solid,
          ),
        ),
        child: Column(
          children: [
            InkWell(
              onTap: editable ? onToggle : null,
              borderRadius: BorderRadius.circular(18),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: colors.muted,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text('${index + 1}', style: AppTextStyles.meta),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Text(step.emoji, style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            step.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                AppTextStyles.itemTitle.copyWith(fontSize: 14),
                          ),
                          Text(
                            '${step.time}${step.endTime == null ? '' : ' — ${step.endTime}'} · ${step.venue}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.caption.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (passed)
                      Text(
                        'пройден',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (expanded && editable)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _MiniField(
                            label: 'Старт',
                            value: step.time,
                            onChanged: (value) =>
                                onChanged(step.copyWith(time: value)),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _MiniField(
                            label: 'Конец',
                            value: step.endTime ?? '',
                            onChanged: (value) => onChanged(
                              step.copyWith(
                                endTime: value,
                                clearEndTime: value.trim().isEmpty,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    _MiniField(
                      label: 'Название',
                      value: step.title,
                      onChanged: (value) =>
                          onChanged(step.copyWith(title: value)),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: _MiniField(
                            label: 'Место',
                            value: step.venue,
                            onChanged: (value) =>
                                onChanged(step.copyWith(venue: value)),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _MiniField(
                            label: 'Адрес',
                            value: step.address,
                            onChanged: (value) =>
                                onChanged(step.copyWith(address: value)),
                          ),
                        ),
                      ],
                    ),
                    _MiniField(
                      label: 'Перк',
                      value: step.perk ?? '',
                      onChanged: (value) => onChanged(
                        step.copyWith(
                          perk: value,
                          clearPerk: value.trim().isEmpty,
                          perkShort: value.trim().isEmpty
                              ? null
                              : step.perkShort ?? value.trim(),
                          clearPerkShort: value.trim().isEmpty,
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: _MiniField(
                            label: 'Билет, ₽',
                            value: step.ticketPrice?.toString() ?? '',
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            onChanged: (value) => onChanged(
                              step.copyWith(
                                ticketPrice: int.tryParse(value),
                                clearTicketPrice: value.trim().isEmpty,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: _MiniField(
                            label: 'Эмодзи',
                            value: step.emoji,
                            textAlign: TextAlign.center,
                            onChanged: (value) => onChanged(
                              step.copyWith(
                                emoji: value.characters.take(2).toString(),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: canMoveUp ? onMoveUp : null,
                          icon: const Icon(LucideIcons.arrow_up, size: 16),
                        ),
                        IconButton(
                          onPressed: canMoveDown ? onMoveDown : null,
                          icon: const Icon(LucideIcons.arrow_down, size: 16),
                        ),
                        const Spacer(),
                        TextButton.icon(
                          onPressed: canRemove && total > 1 ? onRemove : null,
                          icon: const Icon(LucideIcons.trash_2, size: 16),
                          label: const Text('Удалить'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MiniField extends StatelessWidget {
  const _MiniField({
    required this.label,
    required this.value,
    required this.onChanged,
    this.keyboardType,
    this.inputFormatters,
    this.textAlign = TextAlign.start,
  });

  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: TextFormField(
        initialValue: value,
        onChanged: onChanged,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        textAlign: textAlign,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: AppTextStyles.caption.copyWith(color: colors.inkMute),
          filled: true,
          fillColor: colors.background,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: colors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: colors.border),
          ),
        ),
      ),
    );
  }
}

class _AddStepButton extends StatelessWidget {
  const _AddStepButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: colors.card.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.border, width: 2),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.plus, size: 16, color: colors.inkSoft),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'Добавить шаг',
              style: AppTextStyles.itemTitle.copyWith(
                fontSize: 13,
                color: colors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StickySave extends StatelessWidget {
  const _StickySave({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        20 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.96),
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: FilledButton.icon(
        onPressed: onTap,
        icon: const Icon(LucideIcons.sparkles, size: 17),
        label: const Text('Сохранить и уведомить чат'),
      ),
    );
  }
}
