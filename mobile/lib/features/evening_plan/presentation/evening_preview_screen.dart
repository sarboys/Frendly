import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EveningPreviewScreen extends ConsumerStatefulWidget {
  const EveningPreviewScreen({
    required this.sessionId,
    super.key,
  });

  final String sessionId;

  @override
  ConsumerState<EveningPreviewScreen> createState() =>
      _EveningPreviewScreenState();
}

class _EveningPreviewScreenState extends ConsumerState<EveningPreviewScreen> {
  _JoinState _joinState = _JoinState.idle;

  String? _inviteTokenFromRoute() {
    try {
      final token =
          GoRouterState.of(context).uri.queryParameters['inviteToken']?.trim();
      return token == null || token.isEmpty ? null : token;
    } catch (_) {
      return null;
    }
  }

  Future<void> _handleCta(EveningSessionDetail session) async {
    final inviteToken = _inviteTokenFromRoute();
    final joinState = _effectiveJoinState(session);
    final alreadyJoined = joinState == _JoinState.joined;
    if (joinState == _JoinState.requested) {
      return;
    }

    if (alreadyJoined) {
      _cacheSessionMeetupChat(session);
      await context.pushRoute(
        session.isLive ? AppRoute.eveningLive : AppRoute.meetupChat,
        pathParameters: session.isLive
            ? {'routeId': session.routeId}
            : {'chatId': session.chatId},
        queryParameters: session.isLive ? {'sessionId': session.id} : const {},
      );
      return;
    }

    if (session.privacy == EveningPrivacy.invite && inviteToken == null) {
      return;
    }

    if (session.privacy == EveningPrivacy.request) {
      try {
        await ref.read(backendRepositoryProvider).requestEveningSession(
              session.id,
            );
      } catch (_) {
        if (mounted) {
          _showError('Не удалось отправить заявку. Попробуй ещё раз');
        }
        return;
      }
      if (mounted) {
        setState(() => _joinState = _JoinState.requested);
      }
      return;
    }

    try {
      final result =
          await ref.read(backendRepositoryProvider).joinEveningSession(
                session.id,
                inviteToken: inviteToken,
              );
      final chatId = result.chatId ?? session.chatId;
      if (mounted && chatId.isNotEmpty) {
        _cacheSessionMeetupChat(session, chatId: chatId);
        await context.pushRoute(
          AppRoute.meetupChat,
          pathParameters: {'chatId': chatId},
        );
        return;
      }
    } catch (_) {
      if (mounted) {
        _showError('Не удалось вступить в вечер. Попробуй ещё раз');
      }
      return;
    }
    if (mounted) {
      setState(() => _joinState = _JoinState.joined);
    }
  }

  void _cacheSessionMeetupChat(
    EveningSessionDetail session, {
    String? chatId,
  }) {
    final targetChatId = chatId ?? session.chatId;
    final currentUserId = ref.read(currentUserIdProvider);
    final existingChats = ref.read(meetupChatsProvider).valueOrNull ??
        ref.read(meetupChatsLocalStateProvider);

    if (existingChats == null || targetChatId.isEmpty) {
      ref.read(meetupChatsLocalStateProvider.notifier).state = null;
      ref.invalidate(meetupChatsProvider);
      return;
    }

    final members = session.participants
        .where((participant) => participant.status == 'joined')
        .map((participant) {
      if (participant.userId == currentUserId) {
        return 'Ты';
      }
      return participant.name;
    }).toList(growable: false);

    final summary = MeetupChat(
      id: targetChatId,
      eventId: null,
      title: session.title,
      emoji: session.emoji,
      time: session.startsAt ?? '',
      lastMessage: session.isLive
          ? 'Live · шаг ${session.currentStep ?? 1}/${session.totalSteps ?? session.steps.length}'
          : 'Вечер опубликован',
      lastAuthor: 'Frendly',
      lastTime: 'сейчас',
      unread: 0,
      members: members.isEmpty ? const ['Ты'] : members,
      status: session.isLive ? 'Live' : 'Сбор участников',
      phase: session.chatPhase,
      currentStep: session.currentStep,
      totalSteps: session.totalSteps ?? session.steps.length,
      currentPlace: session.currentPlace,
      endTime: session.endTime,
      routeId: session.routeId,
      routeTemplateId: session.routeTemplateId,
      isCurated: session.isCurated,
      badgeLabel: session.badgeLabel,
      sessionId: session.id,
      privacy: session.privacy,
      joinedCount: session.joinedCount,
      maxGuests: session.maxGuests,
      hostUserId: session.hostUserId,
      hostName: session.hostName,
      area: session.area,
    );

    ref.read(meetupChatsLocalStateProvider.notifier).state =
        upsertMeetupChat(existingChats, summary);
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  _JoinState _effectiveJoinState(EveningSessionDetail session) {
    if (_joinState != _JoinState.idle) {
      return _joinState;
    }
    if (session.isJoined) {
      return _JoinState.joined;
    }
    if (session.isRequested) {
      return _JoinState.requested;
    }
    return _JoinState.idle;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final inviteToken = _inviteTokenFromRoute();
    final sessionAsync = ref.watch(eveningSessionProvider(widget.sessionId));

    return Scaffold(
      backgroundColor: colors.background,
      body: sessionAsync.when(
        data: (session) {
          final joinState = _effectiveJoinState(session);
          return Stack(
            children: [
              Positioned.fill(
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: _Header(
                        onBack: _pop,
                        onShare: () => _openShare(session),
                      ),
                    ),
                    SliverToBoxAdapter(child: _Hero(session: session)),
                    SliverToBoxAdapter(child: _HostCard(session: session)),
                    SliverToBoxAdapter(
                      child: _Timeline(
                        session: session,
                        onShowQr: session.isJoined ? _openOfferQr : null,
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _PrivacyHint(
                        privacy: session.privacy,
                        joinState: joinState,
                      ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 132)),
                  ],
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _StickyCta(
                  session: session,
                  joinState: joinState,
                  inviteToken: inviteToken,
                  onTap: () => _handleCta(session),
                ),
              ),
            ],
          );
        },
        loading: () => Center(
          child: CircularProgressIndicator(color: colors.primary),
        ),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Не получилось загрузить вечер',
              style: AppTextStyles.body.copyWith(color: colors.inkSoft),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }

  void _pop() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
    }
  }

  Future<void> _openShare(EveningSessionDetail session) {
    return context.pushRoute(
      AppRoute.eveningShareCard,
      pathParameters: {'sessionId': session.id},
    );
  }

  Future<void> _openOfferQr(EveningSessionStep step) async {
    final offerId = step.partnerOfferId;
    if (offerId == null || offerId.isEmpty) {
      return;
    }
    try {
      final code =
          await ref.read(backendRepositoryProvider).issuePartnerOfferCode(
                sessionId: widget.sessionId,
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
        _showError('Не получилось открыть QR. Попробуй ещё раз');
      }
    }
  }
}

enum _JoinState { idle, joined, requested }

class _Header extends StatelessWidget {
  const _Header({
    required this.onBack,
    required this.onShare,
  });

  final VoidCallback onBack;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
        child: Row(
          children: [
            _CircleButton(icon: LucideIcons.chevron_left, onTap: onBack),
            const Spacer(),
            _CircleButton(icon: LucideIcons.share_2, onTap: onShare),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.session});

  final EveningSessionDetail session;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final meta = _privacyMeta(session.privacy, colors);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colors.warmStart,
              colors.card,
              colors.secondarySoft,
            ],
          ),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      _Badge(
                        icon: meta.icon,
                        label: meta.label,
                        foreground: meta.foreground,
                        background: meta.background,
                      ),
                      if (session.isCurated)
                        _Badge(
                          icon: LucideIcons.route,
                          label: 'Маршрут от команды Frendly',
                          foreground: colors.primary,
                          background: colors.primarySoft,
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                if (session.isLive)
                  _Badge(
                    icon: LucideIcons.radio,
                    label:
                        'Live · шаг ${session.currentStep}/${session.totalSteps}',
                    foreground: colors.primaryForeground,
                    background: colors.primary,
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: colors.background,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: AppShadows.soft,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    session.emoji,
                    style: const TextStyle(fontSize: 30),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.screenTitle.copyWith(
                          fontSize: 22,
                          color: colors.foreground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        session.vibe,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style:
                            AppTextStyles.meta.copyWith(color: colors.inkSoft),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: _HeroStat(
                    icon: LucideIcons.clock,
                    title: _sessionDurationLabel(session),
                    text: _stepsCountLabel(
                      session.totalSteps ?? session.steps.length,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: _HeroStat(
                    icon: LucideIcons.map_pin,
                    title: session.area ?? 'Рядом',
                    text: 'район старта',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HostCard extends StatelessWidget {
  const _HostCard({required this.session});

  final EveningSessionDetail session;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            icon: LucideIcons.sparkles,
            label: 'Хост и компания',
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              children: [
                BbAvatar(
                    name: session.hostName ?? 'Хост', size: BbAvatarSize.md),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Хост: ${session.hostName ?? 'Хост вечера'}',
                        style: AppTextStyles.itemTitle.copyWith(
                          color: colors.foreground,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        session.isCurated
                            ? 'Команда подготовила маршрут, хост ведёт встречу'
                            : 'Ведёт этот вечер',
                        style: AppTextStyles.caption
                            .copyWith(color: colors.inkMute),
                      ),
                    ],
                  ),
                ),
                Text(
                  '${session.joinedCount ?? session.participants.length}'
                  '${session.maxGuests == null ? '' : '/${session.maxGuests}'}',
                  style: AppTextStyles.meta.copyWith(
                    color: colors.inkSoft,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({
    required this.session,
    this.onShowQr,
  });

  final EveningSessionDetail session;
  final ValueChanged<EveningSessionStep>? onShowQr;

  @override
  Widget build(BuildContext context) {
    final currentIndex = (session.currentStep ?? 1) - 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            icon: LucideIcons.map_pin,
            label: 'Маршрут вечера',
          ),
          const SizedBox(height: AppSpacing.xs),
          for (var index = 0; index < session.steps.length; index++) ...[
            _TimelineTile(
              step: session.steps[index],
              index: index,
              total: session.steps.length,
              isCurrent: session.isLive && index == currentIndex,
              isPast: session.isLive && index < currentIndex,
              onShowQr: onShowQr,
            ),
            if (index != session.steps.length - 1)
              const SizedBox(height: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({
    required this.step,
    required this.index,
    required this.total,
    required this.isCurrent,
    required this.isPast,
    this.onShowQr,
  });

  final EveningSessionStep step;
  final int index;
  final int total;
  final bool isCurrent;
  final bool isPast;
  final ValueChanged<EveningSessionStep>? onShowQr;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Opacity(
      opacity: isPast ? 0.55 : 1,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isCurrent ? colors.primary : colors.border,
            width: isCurrent ? 2 : 1,
          ),
          boxShadow: isCurrent ? AppShadows.soft : null,
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: isCurrent ? colors.primary : colors.warmStart,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    step.emoji,
                    style: const TextStyle(fontSize: 18),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step.venue,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.itemTitle.copyWith(fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${step.time} · ${step.address}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption
                            .copyWith(color: colors.inkMute),
                      ),
                    ],
                  ),
                ),
                if (isCurrent)
                  _Badge(
                    icon: LucideIcons.radio,
                    label: 'Сейчас',
                    foreground: colors.primary,
                    background: colors.primarySoft,
                  )
                else
                  Text(
                    '${index + 1}/$total',
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
            if (step.partnerOfferId != null && onShowQr != null) ...[
              const SizedBox(height: AppSpacing.xs),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => onShowQr!(step),
                  icon: const Icon(LucideIcons.qr_code, size: 16),
                  label: const Text('Показать QR'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PrivacyHint extends StatelessWidget {
  const _PrivacyHint({
    required this.privacy,
    required this.joinState,
  });

  final EveningPrivacy privacy;
  final _JoinState joinState;

  @override
  Widget build(BuildContext context) {
    if (privacy == EveningPrivacy.open || joinState != _JoinState.idle) {
      return const SizedBox.shrink();
    }
    final colors = AppColors.of(context);
    final isRequest = privacy == EveningPrivacy.request;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isRequest ? colors.warmStart : colors.muted,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isRequest ? LucideIcons.user_check : LucideIcons.lock,
              size: 18,
              color: isRequest ? colors.secondary : colors.inkSoft,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isRequest ? 'Хост подтверждает каждого' : 'Закрытый вечер',
                    style: AppTextStyles.meta.copyWith(
                      color: colors.foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isRequest
                        ? 'Отправь заявку. Решение придёт уведомлением.'
                        : 'Попасть можно только по инвайту от хоста.',
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      height: 1.25,
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

class _StickyCta extends StatelessWidget {
  const _StickyCta({
    required this.session,
    required this.joinState,
    required this.inviteToken,
    required this.onTap,
  });

  final EveningSessionDetail session;
  final _JoinState joinState;
  final String? inviteToken;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final hasInviteToken = inviteToken != null && inviteToken!.isNotEmpty;
    final alreadyJoined = joinState == _JoinState.joined || session.isJoined;
    final disabled = (!alreadyJoined &&
            session.privacy == EveningPrivacy.invite &&
            !hasInviteToken) ||
        joinState == _JoinState.requested;
    final label = _ctaLabel(session, joinState, hasInviteToken);

    return Container(
      padding: EdgeInsets.fromLTRB(20, 14, 20, 22 + bottomInset),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            colors.background.withValues(alpha: 0),
            colors.background,
            colors.background,
          ],
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: disabled ? null : onTap,
              style: ElevatedButton.styleFrom(
                elevation: 0,
                backgroundColor: joinState == _JoinState.joined
                    ? colors.primary
                    : colors.foreground,
                disabledBackgroundColor: colors.muted,
                foregroundColor: colors.background,
                disabledForegroundColor: colors.inkMute,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.button.copyWith(fontSize: 15),
              ),
            ),
          ),
          if (session.privacy != EveningPrivacy.invite &&
              joinState == _JoinState.idle &&
              !session.isJoined) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'После вступления попадёшь в чат вечера',
              style: AppTextStyles.caption.copyWith(color: colors.inkMute),
            ),
          ],
        ],
      ),
    );
  }

  String _ctaLabel(
    EveningSessionDetail session,
    _JoinState joinState,
    bool hasInviteToken,
  ) {
    if (session.privacy == EveningPrivacy.invite) {
      if (joinState == _JoinState.joined || session.isJoined) {
        return session.isLive ? 'Открыть live' : 'Открыть чат вечера';
      }
      return hasInviteToken ? 'Вписаться по инвайту' : 'Только по инвайту';
    }
    if (joinState == _JoinState.joined || session.isJoined) {
      return session.isLive ? 'Открыть live' : 'Открыть чат вечера';
    }
    if (joinState == _JoinState.requested) {
      return 'Заявка отправлена';
    }
    if (session.privacy == EveningPrivacy.request) {
      return 'Отправить заявку хосту';
    }
    return session.isLive ? 'Вписаться сейчас' : 'Вписаться в вечер';
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.background.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: colors.inkSoft),
          const SizedBox(height: 4),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.meta.copyWith(
              color: colors.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            text,
            style: AppTextStyles.caption.copyWith(color: colors.inkMute),
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
        Icon(icon, size: 13, color: colors.inkMute),
        const SizedBox(width: 5),
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

class _Badge extends StatelessWidget {
  const _Badge({
    required this.icon,
    required this.label,
    required this.foreground,
    required this.background,
  });

  final IconData icon;
  final String label;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: foreground),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: foreground,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: colors.card,
            shape: BoxShape.circle,
            border: Border.all(color: colors.border),
          ),
          child: Icon(icon, size: 20, color: colors.foreground),
        ),
      ),
    );
  }
}

_PrivacyMeta _privacyMeta(EveningPrivacy privacy, BigBreakThemeColors colors) {
  switch (privacy) {
    case EveningPrivacy.request:
      return _PrivacyMeta(
        label: 'По заявке',
        icon: LucideIcons.user_check,
        foreground: colors.foreground,
        background: colors.warmStart,
      );
    case EveningPrivacy.invite:
      return _PrivacyMeta(
        label: 'Только по приглашениям',
        icon: LucideIcons.lock,
        foreground: colors.inkSoft,
        background: colors.muted,
      );
    case EveningPrivacy.open:
      return _PrivacyMeta(
        label: 'Открытый вечер',
        icon: LucideIcons.globe,
        foreground: colors.secondary,
        background: colors.secondarySoft,
      );
  }
}

String _sessionDurationLabel(EveningSessionDetail session) {
  if (session.steps.isEmpty) {
    return _stepsCountLabel(session.totalSteps ?? 0);
  }

  final start = session.steps.first.time.trim();
  var end = '';
  for (final step in session.steps.reversed) {
    final candidate = (step.endTime == null || step.endTime!.trim().isEmpty)
        ? step.time.trim()
        : step.endTime!.trim();
    if (candidate.isNotEmpty) {
      end = candidate;
      break;
    }
  }

  if (start.isEmpty) {
    return end.isEmpty ? _stepsCountLabel(session.steps.length) : end;
  }
  if (end.isEmpty || end == start) {
    return start;
  }
  return '$start - $end';
}

String _stepsCountLabel(int count) {
  final mod10 = count % 10;
  final mod100 = count % 100;
  final word = mod10 == 1 && mod100 != 11
      ? 'шаг'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'шага'
          : 'шагов';
  return '$count $word';
}

class _PrivacyMeta {
  const _PrivacyMeta({
    required this.label,
    required this.icon,
    required this.foreground,
    required this.background,
  });

  final String label;
  final IconData icon;
  final Color foreground;
  final Color background;
}
