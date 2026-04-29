import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_edit_state.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

enum _EveningStepStatus { done, current, upcoming, skipped }

class _EveningLiveStep {
  const _EveningLiveStep({
    required this.data,
    required this.status,
    required this.checkedIn,
  });

  final EveningRouteStep data;
  final _EveningStepStatus status;
  final bool checkedIn;

  _EveningLiveStep copyWith({
    _EveningStepStatus? status,
    bool? checkedIn,
  }) {
    return _EveningLiveStep(
      data: data,
      status: status ?? this.status,
      checkedIn: checkedIn ?? this.checkedIn,
    );
  }
}

class EveningLiveMeetupScreen extends ConsumerStatefulWidget {
  const EveningLiveMeetupScreen({
    required this.routeId,
    required this.mode,
    this.sessionId,
    super.key,
  });

  final String routeId;
  final EveningLaunchMode mode;
  final String? sessionId;

  @override
  ConsumerState<EveningLiveMeetupScreen> createState() =>
      _EveningLiveMeetupScreenState();
}

class _EveningLiveMeetupScreenState
    extends ConsumerState<EveningLiveMeetupScreen> {
  late final EveningRouteData _baseRoute;
  String? _sessionTitle;
  String? _sessionChatId;
  String? _sessionHostUserId;
  String? _appliedSessionKey;
  List<EveningSessionParticipant> _participants = const [];
  late List<_EveningLiveStep> _steps;

  EveningRouteData get _route => readEveningRoute(
        ref,
        widget.routeId,
        fallback: _baseRoute,
      );

  int get _currentIndex =>
      _steps.indexWhere((step) => step.status == _EveningStepStatus.current);

  _EveningLiveStep? get _current =>
      _currentIndex < 0 ? null : _steps[_currentIndex];

  String? get _sessionId =>
      widget.sessionId == null || widget.sessionId!.isEmpty
          ? null
          : widget.sessionId;

  @override
  void initState() {
    super.initState();
    _baseRoute = findEveningRoute(widget.routeId);
    _steps = _stepsFromRoute(_route);
  }

  List<_EveningLiveStep> _stepsFromRoute(EveningRouteData route) {
    return route.steps
        .asMap()
        .entries
        .map(
          (entry) => _EveningLiveStep(
            data: entry.value,
            status: entry.key == 0
                ? _EveningStepStatus.current
                : _EveningStepStatus.upcoming,
            checkedIn: false,
          ),
        )
        .toList(growable: false);
  }

  void _queueSessionSync(EveningSessionDetail session) {
    final key = [
      session.id,
      session.phase.name,
      session.hostUserId ?? '',
      session.currentStep ?? 0,
      session.steps.map((step) => step.id).join(','),
    ].join(':');
    if (_appliedSessionKey == key) {
      return;
    }
    _appliedSessionKey = key;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _sessionTitle = session.title;
        _sessionChatId = session.chatId;
        _sessionHostUserId = session.hostUserId;
        _participants = session.participants
            .where((participant) => participant.status == 'joined')
            .toList(growable: false);
        _steps = _stepsFromSession(session);
      });
    });
  }

  List<_EveningLiveStep> _stepsFromSession(EveningSessionDetail session) {
    final currentIndex = (session.currentStep ?? 1) - 1;
    final override = ref.read(eveningRouteOverridesProvider)[widget.routeId];
    if (override != null) {
      final sessionStepsById = {
        for (final step in session.steps) step.id: step
      };
      return override.steps.asMap().entries.map((entry) {
        final sessionStep = sessionStepsById[entry.value.id];
        return _EveningLiveStep(
          data: entry.value,
          status: _statusFromSessionStep(
            step: sessionStep,
            phase: session.phase,
            index: entry.key,
            currentIndex: currentIndex,
          ),
          checkedIn: sessionStep?.checkedIn ?? false,
        );
      }).toList(growable: false);
    }
    return session.steps.asMap().entries.map((entry) {
      return _EveningLiveStep(
        data: _routeStepFromSession(entry.value),
        status: _statusFromSessionStep(
          step: entry.value,
          phase: session.phase,
          index: entry.key,
          currentIndex: currentIndex,
        ),
        checkedIn: entry.value.checkedIn,
      );
    }).toList(growable: false);
  }

  _EveningStepStatus _statusFromSessionStep({
    required EveningSessionStep? step,
    required EveningSessionPhase phase,
    required int index,
    required int currentIndex,
  }) {
    switch (step?.status) {
      case 'done':
        return _EveningStepStatus.done;
      case 'current':
        return _EveningStepStatus.current;
      case 'skipped':
        return _EveningStepStatus.skipped;
      case 'upcoming':
        return _EveningStepStatus.upcoming;
    }

    if (phase == EveningSessionPhase.done) {
      return _EveningStepStatus.done;
    }
    if (phase == EveningSessionPhase.live && index < currentIndex) {
      return _EveningStepStatus.done;
    }
    if (phase == EveningSessionPhase.live && index == currentIndex) {
      return _EveningStepStatus.current;
    }
    return _EveningStepStatus.upcoming;
  }

  EveningRouteStep _routeStepFromSession(EveningSessionStep step) {
    return EveningRouteStep(
      id: step.id,
      time: step.time,
      endTime: step.endTime,
      kind: _parseStepKind(step.kind),
      title: step.title,
      venue: step.venue,
      address: step.address,
      emoji: step.emoji,
      distance: step.distance ?? '',
      walkMin: step.walkMin,
      perk: step.perk,
      perkShort: step.perkShort,
      ticketPrice: step.ticketPrice,
      ticketCommission: step.ticketCommission,
      sponsored: step.sponsored,
      premium: step.premium,
      partnerId: step.partnerId,
      venueId: step.venueId,
      partnerOfferId: step.partnerOfferId,
      offerTitle: step.offerTitle,
      offerDescription: step.offerDescription,
      offerTerms: step.offerTerms,
      offerShortLabel: step.offerShortLabel,
      description: step.description,
      vibeTag: step.vibeTag,
      lat: step.lat ?? 0,
      lng: step.lng ?? 0,
    );
  }

  EveningStepKind _parseStepKind(String value) {
    return EveningStepKind.values.firstWhere(
      (kind) => kind.name == value,
      orElse: () => EveningStepKind.followup,
    );
  }

  bool _canManageSession(String? currentUserId) {
    if (_sessionId == null) {
      return true;
    }
    final hostUserId = _sessionHostUserId;
    return hostUserId != null && hostUserId == currentUserId;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    ref.watch(eveningRouteOverridesProvider);
    final currentUserId = ref.watch(currentUserIdProvider);
    final sessionId = _sessionId;
    if (sessionId != null) {
      ref.watch(eveningSessionProvider(sessionId)).whenData(_queueSessionSync);
    }
    final current = _current;
    final title = _sessionTitle ?? _route.title;
    final chatId = _sessionChatId ?? 'evening-chat-${_route.id}';
    final canManageSession = _canManageSession(currentUserId);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 128),
              children: [
                _Header(
                  title: title,
                  subtitle: current == null
                      ? 'Вечер завершён'
                      : 'Шаг ${_currentIndex + 1} из ${_steps.length} · ${current.data.venue}',
                  onBack: () => context.pop(),
                ),
                const SizedBox(height: AppSpacing.md),
                if (current != null)
                  _CurrentStepCard(
                    step: current,
                    index: _currentIndex,
                    total: _steps.length,
                    onCheckIn: _checkIn,
                    onOpenDetail: () => _openStepDetail(current),
                    onShowQr: _sessionId != null &&
                            current.data.partnerOfferId != null
                        ? () => _openOfferQr(current.data)
                        : null,
                  ),
                const SizedBox(height: AppSpacing.lg),
                const _SectionTitle(
                  icon: LucideIcons.clock,
                  label: 'Маршрут вечера',
                ),
                const SizedBox(height: AppSpacing.sm),
                _Timeline(
                  steps: _steps,
                  onOpen: _openStepDetail,
                ),
                const SizedBox(height: AppSpacing.lg),
                const _SectionTitle(
                  icon: LucideIcons.users,
                  label: 'Участники',
                ),
                const SizedBox(height: AppSpacing.sm),
                _ParticipantsRow(participants: _participants),
              ],
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _StickyActions(
                chatId: chatId,
                showAdvance: canManageSession &&
                    widget.mode != EveningLaunchMode.auto &&
                    current != null,
                canAdvance: canManageSession &&
                    widget.mode != EveningLaunchMode.auto &&
                    current != null,
                onAdvance: _advance,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _checkIn() async {
    final current = _current;
    if (current == null) {
      return;
    }
    final previousSteps = _steps;
    setState(() {
      _steps = [
        for (final step in _steps)
          step.data.id == current.data.id
              ? step.copyWith(checkedIn: true)
              : step,
      ];
    });
    final synced = await _syncCheckIn(current.data.id);
    if (!synced && mounted) {
      setState(() => _steps = previousSteps);
      _showStepSyncError('Не получилось отметить чек-ин');
    }
  }

  Future<void> _advance() async {
    if (!_canManageSession(ref.read(currentUserIdProvider))) {
      return;
    }
    final index = _currentIndex;
    if (index < 0) {
      return;
    }
    final stepId = _steps[index].data.id;

    if (index == _steps.length - 1) {
      _finish();
      return;
    }

    final previousSteps = _steps;
    setState(() {
      _steps = [
        for (var i = 0; i < _steps.length; i++)
          if (i == index)
            _steps[i].copyWith(status: _EveningStepStatus.done)
          else if (i == index + 1)
            _steps[i].copyWith(status: _EveningStepStatus.current)
          else
            _steps[i],
      ];
    });
    final synced = await _syncAdvance(stepId);
    if (!synced && mounted) {
      setState(() => _steps = previousSteps);
      _showStepSyncError('Не получилось обновить шаг');
    }
  }

  Future<void> _skipStep(_EveningLiveStep step) async {
    if (!_canManageSession(ref.read(currentUserIdProvider))) {
      return;
    }
    final index = _steps.indexWhere((item) => item.data.id == step.data.id);
    if (index < 0) {
      return;
    }

    if (index == _steps.length - 1) {
      setState(() {
        _steps = [
          for (var i = 0; i < _steps.length; i++)
            i == index
                ? _steps[i].copyWith(status: _EveningStepStatus.skipped)
                : _steps[i],
        ];
      });
      _finish();
      return;
    }

    final previousSteps = _steps;
    setState(() {
      _steps = [
        for (var i = 0; i < _steps.length; i++)
          if (i == index)
            _steps[i].copyWith(status: _EveningStepStatus.skipped)
          else if (i == index + 1)
            _steps[i].copyWith(status: _EveningStepStatus.current)
          else
            _steps[i],
      ];
    });
    final synced = await _syncSkip(step.data.id);
    if (!synced && mounted) {
      setState(() => _steps = previousSteps);
      _showStepSyncError('Не получилось пропустить шаг');
    }
  }

  Future<void> _finish() async {
    try {
      final sessionId = _sessionId;
      if (sessionId == null) {
        await ref.read(backendRepositoryProvider).finishEveningRoute(_route.id);
      } else {
        await ref
            .read(backendRepositoryProvider)
            .finishEveningSession(sessionId);
        ref.invalidate(eveningSessionProvider(sessionId));
        ref.invalidate(eveningSessionsProvider);
        ref.invalidate(meetupChatsProvider);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось завершить вечер')),
        );
      }
      return;
    }

    if (!mounted) {
      return;
    }
    context.pushReplacementNamed(
      AppRoute.eveningAfterParty.name,
      pathParameters: {'routeId': _route.id},
      queryParameters: {
        if (_sessionId != null) 'sessionId': _sessionId!,
      },
    );
  }

  Future<bool> _syncCheckIn(String stepId) async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      return true;
    }
    try {
      await ref.read(backendRepositoryProvider).checkInEveningStep(
            sessionId,
            stepId,
          );
      ref.invalidate(eveningSessionProvider(sessionId));
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _syncAdvance(String stepId) async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      return true;
    }
    try {
      await ref.read(backendRepositoryProvider).advanceEveningStep(
            sessionId,
            stepId,
          );
      ref.invalidate(eveningSessionProvider(sessionId));
      ref.invalidate(eveningSessionsProvider);
      ref.invalidate(meetupChatsProvider);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _syncSkip(String stepId) async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      return true;
    }
    try {
      await ref.read(backendRepositoryProvider).skipEveningStep(
            sessionId,
            stepId,
          );
      ref.invalidate(eveningSessionProvider(sessionId));
      ref.invalidate(eveningSessionsProvider);
      ref.invalidate(meetupChatsProvider);
      return true;
    } catch (_) {
      return false;
    }
  }

  void _showStepSyncError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _openOfferQr(EveningRouteStep step) async {
    final sessionId = _sessionId;
    final offerId = step.partnerOfferId;
    if (sessionId == null || offerId == null || offerId.isEmpty) {
      return;
    }
    try {
      final code =
          await ref.read(backendRepositoryProvider).issuePartnerOfferCode(
                sessionId: sessionId,
                stepId: step.id,
                offerId: offerId,
              );
      if (!mounted) {
        return;
      }
      await context.pushRoute(
        AppRoute.offerCode,
        pathParameters: {'codeId': code.id},
      );
    } catch (_) {
      if (mounted) {
        _showStepSyncError('Не получилось открыть QR');
      }
    }
  }

  Future<void> _openStepDetail(_EveningLiveStep step) {
    final colors = AppColors.of(context);
    final isCurrent = step.status == _EveningStepStatus.current;
    final canManageSession = _canManageSession(ref.read(currentUserIdProvider));
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.border,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [colors.warmStart, colors.warmEnd],
                        ),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        step.data.emoji,
                        style: const TextStyle(fontSize: 28),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(step.data.title,
                              style: AppTextStyles.sectionTitle
                                  .copyWith(fontSize: 18)),
                          Text(
                            step.data.venue,
                            style: AppTextStyles.meta
                                .copyWith(color: colors.inkSoft),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Закрыть',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                _DetailRow(
                  icon: LucideIcons.clock,
                  label: 'Время',
                  value:
                      '${step.data.time}${step.data.endTime == null ? '' : ' · ${step.data.endTime}'}',
                ),
                _DetailRow(
                  icon: LucideIcons.map_pin,
                  label: 'Адрес',
                  value: step.data.address,
                ),
                if (step.data.perk != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.warmStart,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        Icon(LucideIcons.sparkles,
                            color: colors.secondary, size: 18),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            step.data.perk!,
                            style: AppTextStyles.meta.copyWith(
                              color: colors.foreground,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_sessionId != null && step.data.partnerOfferId != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _openOfferQr(step.data);
                      },
                      icon: const Icon(LucideIcons.qr_code, size: 16),
                      label: const Text('Показать QR'),
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {},
                        icon: const Icon(LucideIcons.navigation, size: 16),
                        label: const Text('Построить маршрут'),
                      ),
                    ),
                    if (isCurrent) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () {
                            Navigator.of(context).pop();
                            _checkIn();
                          },
                          icon: const Icon(LucideIcons.flag, size: 16),
                          label: const Text('Чек-ин'),
                        ),
                      ),
                    ],
                  ],
                ),
                if (isCurrent && canManageSession) ...[
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    width: double.infinity,
                    child: TextButton.icon(
                      onPressed: () {
                        Navigator.of(context).pop();
                        _skipStep(step);
                      },
                      icon: const Icon(LucideIcons.step_forward, size: 16),
                      label: const Text('Пропустить шаг'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.subtitle,
    required this.onBack,
  });

  final String title;
  final String subtitle;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        IconButton(
          onPressed: onBack,
          icon: const Icon(LucideIcons.chevron_left),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.itemTitle,
              ),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
              ),
            ],
          ),
        ),
        const SizedBox(width: 48),
      ],
    );
  }
}

class _CurrentStepCard extends StatelessWidget {
  const _CurrentStepCard({
    required this.step,
    required this.index,
    required this.total,
    required this.onCheckIn,
    required this.onOpenDetail,
    this.onShowQr,
  });

  final _EveningLiveStep step;
  final int index;
  final int total;
  final VoidCallback onCheckIn;
  final VoidCallback onOpenDetail;
  final VoidCallback? onShowQr;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [colors.warmStart, colors.card],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: colors.foreground,
                  borderRadius: AppRadii.pillBorder,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: colors.background,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      'Сейчас',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.background,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                'Шаг ${index + 1} из $total',
                style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          InkWell(
            onTap: onOpenDetail,
            borderRadius: BorderRadius.circular(18),
            child: Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: colors.background,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  alignment: Alignment.center,
                  child: Text(step.data.emoji,
                      style: const TextStyle(fontSize: 30)),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step.data.title,
                        style:
                            AppTextStyles.sectionTitle.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${step.data.venue} · ${step.data.address}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.meta.copyWith(
                          color: colors.inkSoft,
                        ),
                      ),
                      Text(
                        '${step.data.time}${step.data.endTime == null ? '' : ' · ${step.data.endTime}'}',
                        style: AppTextStyles.meta.copyWith(
                          color: colors.inkMute,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: step.checkedIn ? null : onCheckIn,
                  icon: Icon(
                    step.checkedIn
                        ? LucideIcons.circle_check
                        : LucideIcons.flag,
                    size: 16,
                  ),
                  label: Text(step.checkedIn ? 'На месте' : 'Я на месте'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onOpenDetail,
                  icon: const Icon(LucideIcons.navigation, size: 16),
                  label: const Text('Маршрут'),
                ),
              ),
            ],
          ),
          if (onShowQr != null) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onShowQr,
                icon: const Icon(LucideIcons.qr_code, size: 16),
                label: const Text('Показать QR'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({
    required this.steps,
    required this.onOpen,
  });

  final List<_EveningLiveStep> steps;
  final ValueChanged<_EveningLiveStep> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          _TimelineRow(
            step: steps[i],
            index: i,
            isLast: i == steps.length - 1,
            colors: colors,
            onTap: () => onOpen(steps[i]),
          ),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.step,
    required this.index,
    required this.isLast,
    required this.colors,
    required this.onTap,
  });

  final _EveningLiveStep step;
  final int index;
  final bool isLast;
  final BigBreakThemeColors colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDone = step.status == _EveningStepStatus.done;
    final isCurrent = step.status == _EveningStepStatus.current;
    final isSkipped = step.status == _EveningStepStatus.skipped;
    return IntrinsicHeight(
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: isDone
                        ? colors.secondary.withValues(alpha: 0.14)
                        : isSkipped
                            ? colors.destructive.withValues(alpha: 0.1)
                            : isCurrent
                                ? colors.foreground
                                : colors.card,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDone
                          ? colors.secondary.withValues(alpha: 0.3)
                          : isSkipped
                              ? colors.destructive.withValues(alpha: 0.24)
                              : isCurrent
                                  ? colors.foreground
                                  : colors.border,
                      width: 2,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: isDone
                      ? Icon(LucideIcons.circle_check,
                          color: colors.secondary, size: 20)
                      : isSkipped
                          ? Icon(
                              LucideIcons.circle_slash,
                              color: colors.destructive,
                              size: 20,
                            )
                          : Text(
                              '${index + 1}',
                              style: AppTextStyles.itemTitle.copyWith(
                                color: isCurrent
                                    ? colors.background
                                    : colors.inkMute,
                              ),
                            ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: isDone
                          ? colors.secondary.withValues(alpha: 0.3)
                          : isSkipped
                              ? colors.destructive.withValues(alpha: 0.18)
                              : colors.border,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 40,
                    child: Row(
                      children: [
                        Text(
                          step.data.time,
                          style: AppTextStyles.meta.copyWith(
                            fontFamily: 'Sora',
                            fontWeight: FontWeight.w700,
                            color: isDone || isSkipped
                                ? colors.inkMute
                                : colors.foreground,
                            decoration: isDone || isSkipped
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                        if (isCurrent) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: colors.foreground,
                              borderRadius: AppRadii.pillBorder,
                            ),
                            child: Text(
                              'Сейчас',
                              style: AppTextStyles.caption.copyWith(
                                color: colors.background,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: onTap,
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: isSkipped
                              ? colors.destructive.withValues(alpha: 0.24)
                              : isCurrent
                                  ? colors.foreground.withValues(alpha: 0.4)
                                  : colors.border,
                        ),
                        boxShadow: AppShadows.soft,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [colors.warmStart, colors.warmEnd],
                              ),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            alignment: Alignment.center,
                            child: Text(step.data.emoji,
                                style: const TextStyle(fontSize: 22)),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  step.data.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTextStyles.itemTitle
                                      .copyWith(fontSize: 14),
                                ),
                                Text(
                                  '${step.data.venue} · ${step.data.address}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTextStyles.meta
                                      .copyWith(color: colors.inkMute),
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
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        Icon(icon, size: 14, color: colors.inkMute),
        const SizedBox(width: 6),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: colors.inkMute,
            letterSpacing: 1,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _ParticipantsRow extends StatelessWidget {
  const _ParticipantsRow({required this.participants});

  final List<EveningSessionParticipant> participants;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final visible = participants.take(3).toList(growable: false);
    final participantLabel = participants.isEmpty
        ? 'Участники появятся после входа'
        : participants.length <= 3
            ? participants.map((participant) => participant.name).join(', ')
            : '${participants.first.name} и ещё ${participants.length - 1}';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          if (visible.isEmpty)
            Icon(LucideIcons.users, color: colors.inkSoft, size: 22)
          else
            for (final participant in visible) ...[
              BbAvatar(
                name: participant.name,
                size: BbAvatarSize.md,
                online: participant.role == 'host',
              ),
              const SizedBox(width: 8),
            ],
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              participantLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.meta.copyWith(
                color: colors.foreground,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StickyActions extends StatelessWidget {
  const _StickyActions({
    required this.chatId,
    required this.showAdvance,
    required this.canAdvance,
    required this.onAdvance,
  });

  final String chatId;
  final bool showAdvance;
  final bool canAdvance;
  final VoidCallback onAdvance;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.95),
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.pushRoute(
                    AppRoute.meetupChat,
                    pathParameters: {'chatId': chatId},
                  ),
                  icon: const Icon(LucideIcons.message_circle, size: 16),
                  label: const Text('Чат'),
                ),
              ),
              if (showAdvance) ...[
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canAdvance ? onAdvance : null,
                    icon: const Icon(LucideIcons.arrow_right, size: 16),
                    label: const Text('Дальше'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.border),
        ),
        child: Row(
          children: [
            Icon(icon, color: colors.inkSoft, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    value,
                    style: AppTextStyles.meta.copyWith(
                      color: colors.foreground,
                      fontWeight: FontWeight.w600,
                    ),
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
