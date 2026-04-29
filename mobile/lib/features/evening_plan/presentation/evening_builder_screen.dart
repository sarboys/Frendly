import 'dart:async';

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

enum _BuilderStep { goal, mood, budget, format, area, ready }

class EveningBuilderScreen extends StatefulWidget {
  const EveningBuilderScreen({
    this.onReady,
    super.key,
  });

  final ValueChanged<EveningRouteData>? onReady;

  @override
  State<EveningBuilderScreen> createState() => _EveningBuilderScreenState();
}

class _EveningBuilderScreenState extends State<EveningBuilderScreen> {
  final _scrollController = ScrollController();
  final _messages = <_EveningMessage>[];
  final _timers = <Timer>[];

  _BuilderStep _step = _BuilderStep.goal;
  bool _typing = false;
  EveningGoal? _goal;
  EveningMood? _mood;
  EveningBudget? _budget;
  EveningFormat? _format;
  String? _goalKey;
  String? _moodKey;
  String? _budgetKey;
  String? _formatKey;
  String? _area;
  List<EveningOption> _goalOptions = eveningGoals;
  List<EveningOption> _moodOptions = eveningMoods;
  List<EveningOption> _budgetOptions = eveningBudgets;
  List<EveningOption> _formatOptions = eveningFormats;
  List<EveningOption> _areaOptions = eveningAreas;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadBackendOptions();
    });
    _pushBot(
      step: _BuilderStep.goal,
      text:
          'Привет 👋 Я Frendly. Соберу тебе вечер за минуту. С чего начнём — какой повод?',
      options: _goalOptions,
    );
  }

  @override
  void dispose() {
    for (final timer in _timers) {
      timer.cancel();
    }
    _scrollController.dispose();
    super.dispose();
  }

  void _pushBot({
    required _BuilderStep step,
    required String text,
    List<EveningOption>? options,
  }) {
    setState(() {
      _typing = true;
    });
    final timer = Timer(const Duration(milliseconds: 600), () {
      if (!mounted) {
        return;
      }
      setState(() {
        _typing = false;
        _messages.add(
          _EveningMessage.bot(
            id: 'b-${DateTime.now().microsecondsSinceEpoch}',
            text: text,
            step: step,
            options: options,
          ),
        );
      });
      _scrollToBottom();
    });
    _timers.add(timer);
  }

  void _pushUser(EveningOption option) {
    setState(() {
      _messages.add(
        _EveningMessage.user(
          id: 'u-${DateTime.now().microsecondsSinceEpoch}',
          text: option.label,
          emoji: option.emoji,
        ),
      );
    });
    _scrollToBottom();
  }

  Future<void> _loadBackendOptions() async {
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final json =
          await container.read(backendRepositoryProvider).fetchEveningOptions();
      if (!mounted) {
        return;
      }
      final options = EveningBuilderOptions.fromJson(json);
      setState(() {
        _goalOptions = options.goals;
        _moodOptions = options.moods;
        _budgetOptions = options.budgets;
        _formatOptions = options.formats;
        _areaOptions = options.areas;
      });
    } catch (_) {}
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _handlePick(EveningOption option) {
    _pushUser(option);
    switch (_step) {
      case _BuilderStep.goal:
        _goalKey = option.key;
        _goal = eveningGoalFromKey(option.key);
        break;
      case _BuilderStep.mood:
        _moodKey = option.key;
        _mood = eveningMoodFromKey(option.key);
        break;
      case _BuilderStep.budget:
        _budgetKey = option.key;
        _budget = eveningBudgetFromKey(option.key);
        break;
      case _BuilderStep.format:
        _formatKey = option.key;
        _format = eveningFormatFromKey(option.key);
        break;
      case _BuilderStep.area:
        _area = option.key;
        break;
      case _BuilderStep.ready:
        break;
    }

    final next = _nextStep(_step);
    setState(() {
      _step = next;
    });

    switch (next) {
      case _BuilderStep.mood:
        _pushBot(
          step: _BuilderStep.mood,
          text: 'Лови. А настроение какое сегодня?',
          options: _moodOptions,
        );
        break;
      case _BuilderStep.budget:
        _pushBot(
          step: _BuilderStep.budget,
          text: 'Бюджет на человека — чтобы я не закидывал лишнее',
          options: _budgetOptions,
        );
        break;
      case _BuilderStep.format:
        _pushBot(
          step: _BuilderStep.format,
          text:
              'Что хочется добавить в вечер? Можешь выбрать одно — я подберу остальное',
          options: _formatOptions,
        );
        break;
      case _BuilderStep.area:
        _pushBot(
          step: _BuilderStep.area,
          text: 'Где удобнее стартовать?',
          options: _areaOptions,
        );
        break;
      case _BuilderStep.ready:
        _openReadyRoute();
        break;
      case _BuilderStep.goal:
        break;
    }
  }

  void _openReadyRoute() {
    final fallbackRoute = matchEveningRoute(
      goal: _goal,
      mood: _mood,
      budget: _budget,
      format: _format,
      area: _area,
    );
    unawaited(_finishReadyRoute(fallbackRoute));
  }

  Future<void> _finishReadyRoute(EveningRouteData fallbackRoute) async {
    final route = await _resolveBackendRoute(fallbackRoute);
    if (!mounted) {
      return;
    }
    _pushBot(
      step: _BuilderStep.ready,
      text:
          'Готово ✨ Собрал маршрут «${route.title}» — ${route.durationLabel}, ${route.area}. Сэкономишь ${route.totalSavings} ₽ по перкам.',
    );

    final timer = Timer(const Duration(milliseconds: 1100), () {
      if (!mounted) {
        return;
      }
      final onReady = widget.onReady;
      if (onReady != null) {
        onReady(route);
        return;
      }
      context.pushReplacementNamed(
        AppRoute.eveningPlan.name,
        pathParameters: {'routeId': route.id},
      );
    });
    _timers.add(timer);
  }

  Future<EveningRouteData> _resolveBackendRoute(
    EveningRouteData fallbackRoute,
  ) async {
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final json =
          await container.read(backendRepositoryProvider).resolveEveningRoute(
                goal: _goalKey,
                mood: _moodKey,
                budget: _budgetKey,
                format: _formatKey,
                area: _area,
              );
      return eveningRouteFromJson(json, fallback: fallbackRoute);
    } catch (_) {
      return fallbackRoute;
    }
  }

  void _reset() {
    for (final timer in _timers) {
      timer.cancel();
    }
    _timers.clear();
    setState(() {
      _messages.clear();
      _step = _BuilderStep.goal;
      _typing = false;
      _goal = null;
      _mood = null;
      _budget = null;
      _format = null;
      _goalKey = null;
      _moodKey = null;
      _budgetKey = null;
      _formatKey = null;
      _area = null;
    });
    _pushBot(
      step: _BuilderStep.goal,
      text: 'Окей, начнём заново. Какой повод?',
      options: _goalOptions,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final stepIndex = _BuilderStep.values.indexOf(_step);
    final progress =
        (stepIndex / (_BuilderStep.values.length - 1)).clamp(0, 1).toDouble();
    final last = _messages.isEmpty ? null : _messages.last;
    final showOptions = !_typing &&
        last != null &&
        last.isBot &&
        last.step == _step &&
        last.options != null;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 12, 16, 8),
              child: Row(
                children: [
                  _RoundIconButton(
                    icon: LucideIcons.chevron_left,
                    tooltip: 'Назад',
                    onTap: () => Navigator.of(context).maybePop(),
                    background: Colors.transparent,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const _SparkleBadge(size: 28, iconSize: 14),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Frendly Evening',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.itemTitle.copyWith(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: colors.foreground,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: colors.secondary.withValues(alpha: 0.15),
                                borderRadius: AppRadii.pillBorder,
                              ),
                              child: Text(
                                'AI',
                                style: AppTextStyles.caption.copyWith(
                                  fontSize: 10,
                                  color: colors.secondary,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _step == _BuilderStep.ready
                              ? 'Маршрут готов'
                              : 'Шаг ${stepIndex + 1} из ${_BuilderStep.values.length - 1}',
                          style: AppTextStyles.caption.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _RoundIconButton(
                    icon: LucideIcons.rotate_ccw,
                    tooltip: 'Начать заново',
                    onTap: _reset,
                    background: colors.muted,
                    iconColor: colors.inkSoft,
                    size: 36,
                    iconSize: 16,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: ClipRRect(
                borderRadius: AppRadii.pillBorder,
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 4,
                  backgroundColor: colors.muted,
                  valueColor: AlwaysStoppedAnimation<Color>(colors.primary),
                ),
              ),
            ),
            Expanded(
              child: ListView(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 128),
                children: [
                  for (final message in _messages)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: message.isBot
                          ? _BotBubble(message: message)
                          : _UserBubble(message: message),
                    ),
                  if (_typing)
                    const Padding(
                      padding: EdgeInsets.only(bottom: AppSpacing.sm),
                      child: _TypingBubble(),
                    ),
                ],
              ),
            ),
            if (showOptions && last.options != null)
              _OptionsPanel(
                options: last.options!,
                onPick: _handlePick,
                bottomInset: bottomInset,
              )
            else if (_step == _BuilderStep.ready)
              _ReadyPanel(bottomInset: bottomInset),
          ],
        ),
      ),
    );
  }
}

class _OptionsPanel extends StatelessWidget {
  const _OptionsPanel({
    required this.options,
    required this.onPick,
    required this.bottomInset,
  });

  final List<EveningOption> options;
  final ValueChanged<EveningOption> onPick;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 32 + bottomInset),
        child: GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacing.xs,
          crossAxisSpacing: AppSpacing.xs,
          childAspectRatio: 2.45,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            for (final option in options)
              InkWell(
                onTap: () => onPick(option),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      if (option.emoji != null) ...[
                        Text(
                          option.emoji!,
                          style: const TextStyle(fontSize: 20),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                      ],
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              option.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.meta.copyWith(
                                fontFamily: 'Sora',
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: colors.foreground,
                              ),
                            ),
                            if (option.blurb != null)
                              Text(
                                option.blurb!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.inkMute,
                                ),
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
    );
  }
}

class _ReadyPanel extends StatelessWidget {
  const _ReadyPanel({required this.bottomInset});

  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 32 + bottomInset),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.send, size: 14, color: colors.inkMute),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'Открываю маршрут...',
              style: AppTextStyles.meta.copyWith(color: colors.inkMute),
            ),
          ],
        ),
      ),
    );
  }
}

class _BotBubble extends StatelessWidget {
  const _BotBubble({required this.message});

  final _EveningMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const _SparkleBadge(size: 28, iconSize: 14),
        const SizedBox(width: AppSpacing.xs),
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
                bottomRight: Radius.circular(24),
                bottomLeft: Radius.circular(6),
              ),
              border: Border.all(color: colors.border),
              boxShadow: AppShadows.soft,
            ),
            child: Text(
              message.text,
              style: AppTextStyles.bodySoft.copyWith(
                color: colors.foreground,
                fontSize: 14,
              ),
            ),
          ),
        ),
        const Spacer(flex: 1),
      ],
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.message});

  final _EveningMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        const Spacer(flex: 1),
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: colors.foreground,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(6),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (message.emoji != null) ...[
                  Text(message.emoji!),
                  const SizedBox(width: 6),
                ],
                Flexible(
                  child: Text(
                    message.text,
                    style: AppTextStyles.bodySoft.copyWith(
                      color: colors.background,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const _SparkleBadge(size: 28, iconSize: 14),
        const SizedBox(width: AppSpacing.xs),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(24),
              topRight: Radius.circular(24),
              bottomRight: Radius.circular(24),
              bottomLeft: Radius.circular(6),
            ),
            border: Border.all(color: colors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _TypingDot(color: colors.inkMute),
              const SizedBox(width: 4),
              _TypingDot(color: colors.inkMute),
              const SizedBox(width: 4),
              _TypingDot(color: colors.inkMute),
            ],
          ),
        ),
      ],
    );
  }
}

class _TypingDot extends StatelessWidget {
  const _TypingDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 6,
      height: 6,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _SparkleBadge extends StatelessWidget {
  const _SparkleBadge({
    required this.size,
    required this.iconSize,
  });

  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.primary, colors.secondary],
        ),
      ),
      alignment: Alignment.center,
      child: Icon(
        LucideIcons.sparkles,
        size: iconSize,
        color: colors.primaryForeground,
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    required this.background,
    this.iconColor,
    this.size = 40,
    this.iconSize = 24,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final Color background;
  final Color? iconColor;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: background,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(
            icon,
            size: iconSize,
            color: iconColor ?? colors.foreground,
          ),
        ),
      ),
    );
  }
}

class _EveningMessage {
  const _EveningMessage._({
    required this.id,
    required this.text,
    required this.isBot,
    this.emoji,
    this.step,
    this.options,
  });

  factory _EveningMessage.bot({
    required String id,
    required String text,
    required _BuilderStep step,
    List<EveningOption>? options,
  }) {
    return _EveningMessage._(
      id: id,
      text: text,
      isBot: true,
      step: step,
      options: options,
    );
  }

  factory _EveningMessage.user({
    required String id,
    required String text,
    String? emoji,
  }) {
    return _EveningMessage._(
      id: id,
      text: text,
      isBot: false,
      emoji: emoji,
    );
  }

  final String id;
  final String text;
  final bool isBot;
  final String? emoji;
  final _BuilderStep? step;
  final List<EveningOption>? options;
}

_BuilderStep _nextStep(_BuilderStep step) {
  switch (step) {
    case _BuilderStep.goal:
      return _BuilderStep.mood;
    case _BuilderStep.mood:
      return _BuilderStep.budget;
    case _BuilderStep.budget:
      return _BuilderStep.format;
    case _BuilderStep.format:
      return _BuilderStep.area;
    case _BuilderStep.area:
    case _BuilderStep.ready:
      return _BuilderStep.ready;
  }
}
