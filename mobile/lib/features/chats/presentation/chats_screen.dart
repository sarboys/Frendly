import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_style.dart';
import 'package:big_break_mobile/features/chats/presentation/chats_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ChatsScreen extends ConsumerWidget {
  const ChatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final segment = ref.watch(chatSegmentProvider);
    final currentUserId = ref.watch(currentUserIdProvider);
    final meetupChatsAsync = ref.watch(meetupChatsProvider);
    final personalChatsAsync = ref.watch(personalChatsProvider);
    final meetupChats = meetupChatsAsync.valueOrNull ?? const [];
    final personalChats = personalChatsAsync.valueOrNull ?? const [];
    final liveChats = meetupChats
        .where((chat) => chat.phase == MeetupPhase.live)
        .toList(growable: false);
    final soonChats = meetupChats
        .where((chat) => chat.phase == MeetupPhase.soon)
        .toList(growable: false);
    final upcomingChats = meetupChats
        .where((chat) => chat.phase == MeetupPhase.upcoming)
        .toList(growable: false);
    final doneChats = meetupChats
        .where((chat) => chat.phase == MeetupPhase.done)
        .toList(growable: false);
    final hasLive = liveChats.isNotEmpty;
    final meetupUnread =
        meetupChats.fold<int>(0, (sum, item) => sum + item.unread);
    final personalUnread =
        personalChats.fold<int>(0, (sum, item) => sum + item.unread);

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text('Чаты', style: AppTextStyles.screenTitle),
                ),
                _HeaderIconButton(
                  icon: LucideIcons.search,
                  foreground: colors.inkSoft,
                  background: colors.card,
                  borderColor: colors.border,
                  onTap: () => context.pushRoute(AppRoute.search),
                ),
                const SizedBox(width: AppSpacing.xs),
                _HeaderIconButton(
                  icon: LucideIcons.square_pen,
                  foreground: colors.primaryForeground,
                  background: colors.foreground,
                  onTap: () => context.pushRoute(AppRoute.createMeetup),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: colors.muted,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _SegmentButton(
                      active: segment == ChatSegment.meetup,
                      label: 'Встречи',
                      count: meetupUnread,
                      showLiveDot: hasLive,
                      onTap: () => ref
                          .read(chatSegmentProvider.notifier)
                          .state = ChatSegment.meetup,
                    ),
                  ),
                  Expanded(
                    child: _SegmentButton(
                      active: segment == ChatSegment.personal,
                      label: 'Личные',
                      count: personalUnread,
                      showLiveDot: false,
                      onTap: () => ref
                          .read(chatSegmentProvider.notifier)
                          .state = ChatSegment.personal,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: segment == ChatSegment.meetup
                ? meetupChatsAsync.when(
                    data: (_) => ListView(
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 112),
                      children: [
                        for (final chat in liveChats)
                          _LiveChatTile(
                            chat: chat,
                            onTap: () => _openMeetupChat(context, chat),
                          ),
                        if (soonChats.isNotEmpty) ...[
                          const _SectionLabel('Скоро'),
                          for (final chat in soonChats)
                            _SoonChatTile(
                              chat: chat,
                              onTap: () => _openMeetupChat(context, chat),
                              onLaunch: chat.routeId == null ||
                                      chat.sessionId == null ||
                                      chat.hostUserId != currentUserId
                                  ? null
                                  : () => _startEveningFromChatList(
                                        context,
                                        ref,
                                        chat,
                                      ),
                            ),
                        ],
                        if (upcomingChats.isNotEmpty) ...[
                          const _SectionLabel('Предстоящие'),
                          for (final chat in upcomingChats)
                            _MeetupChatTile(
                              title: chat.title,
                              emoji: chat.emoji,
                              lastTime: chat.lastTime,
                              status: '${chat.status ?? ''} · ${chat.time}',
                              preview: chat.typing
                                  ? '${chat.lastAuthor} печатает…'
                                  : '${chat.lastAuthor}: ${chat.lastMessage}',
                              unread: chat.unread,
                              typing: chat.typing,
                              isDone: chat.phase == MeetupPhase.done,
                              isAfterDark: chat.isAfterDark,
                              afterDarkGlow: chat.afterDarkGlow,
                              curatedLabel: _curatedChatLabel(chat),
                              members: chat.members
                                  .where((item) => item != 'Ты')
                                  .toList(growable: false),
                              onTap: () => _openMeetupChat(context, chat),
                            ),
                        ],
                        if (doneChats.isNotEmpty) ...[
                          const _SectionLabel('Архив'),
                          for (final chat in doneChats)
                            _MeetupChatTile(
                              title: chat.title,
                              emoji: chat.emoji,
                              lastTime: chat.lastTime,
                              status: 'Завершено',
                              preview: chat.typing
                                  ? '${chat.lastAuthor} печатает…'
                                  : '${chat.lastAuthor}: ${chat.lastMessage}',
                              unread: chat.unread,
                              typing: chat.typing,
                              isDone: true,
                              isAfterDark: chat.isAfterDark,
                              afterDarkGlow: chat.afterDarkGlow,
                              curatedLabel: _curatedChatLabel(chat),
                              members: chat.members
                                  .where((item) => item != 'Ты')
                                  .toList(growable: false),
                              onTap: () => _openMeetupChat(context, chat),
                            ),
                        ],
                      ],
                    ),
                    loading: () => Center(
                      child: CircularProgressIndicator(color: colors.primary),
                    ),
                    error: (_, __) => Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Не получилось загрузить чаты встреч',
                          style: AppTextStyles.body,
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  )
                : personalChatsAsync.when(
                    data: (_) => ListView.separated(
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 112),
                      itemCount: personalChats.length + 1,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 2),
                      itemBuilder: (context, index) {
                        if (index == personalChats.length) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 28),
                            child: Center(
                              child: Text(
                                'Личные чаты появляются после встреч.',
                                style: AppTextStyles.meta.copyWith(
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          );
                        }

                        final chat = personalChats[index];
                        return _PersonalChatTile(
                          name: chat.name,
                          lastTime: chat.lastTime,
                          preview: chat.lastMessage,
                          unread: chat.unread,
                          online: chat.online,
                          fromMeetup: chat.fromMeetup,
                          onTap: () => context.pushRoute(
                            AppRoute.personalChat,
                            pathParameters: {'chatId': chat.id},
                          ),
                        );
                      },
                    ),
                    loading: () => Center(
                      child: CircularProgressIndicator(color: colors.primary),
                    ),
                    error: (_, __) => Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Не получилось загрузить личные чаты',
                          style: AppTextStyles.body,
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

void _openMeetupChat(BuildContext context, MeetupChat chat) {
  context.pushRoute(
    AppRoute.meetupChat,
    pathParameters: {'chatId': chat.id},
    queryParameters: chat.isAfterDark
        ? {
            'theme': 'after-dark',
            'glow': chat.afterDarkGlow ?? 'magenta',
          }
        : const {},
  );
}

Future<void> _startEveningFromChatList(
  BuildContext context,
  WidgetRef ref,
  MeetupChat chat,
) async {
  final routeId = chat.routeId;
  final sessionId = chat.sessionId;
  if (routeId == null || sessionId == null) {
    return;
  }

  try {
    await ref.read(backendRepositoryProvider).startEveningSession(sessionId);
    ref.invalidate(meetupChatsProvider);
    ref.invalidate(eveningSessionsProvider);
    ref.invalidate(eveningSessionProvider(sessionId));
  } catch (_) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Не получилось запустить live')),
    );
    return;
  }

  if (!context.mounted) {
    return;
  }
  context.pushRoute(
    AppRoute.eveningLive,
    pathParameters: {'routeId': routeId},
    queryParameters: {
      'sessionId': sessionId,
      'mode': chat.mode.name,
    },
  );
}

String? _curatedChatLabel(MeetupChat chat) {
  if (!chat.isCurated && chat.routeTemplateId == null) {
    return null;
  }
  final label = chat.badgeLabel?.trim();
  if (label != null && label.isNotEmpty) {
    return label;
  }
  return 'Маршрут от команды Frendly';
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 6),
      child: Text(
        label.toUpperCase(),
        style: AppTextStyles.caption.copyWith(
          color: colors.inkMute,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.color, this.size = 8});

  final Color color;
  final double size;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final progress = Curves.easeOut.transform(_controller.value);
          final pulseSize = widget.size + widget.size * 1.2 * progress;

          return Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Positioned(
                width: pulseSize,
                height: pulseSize,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: widget.color.withValues(
                      alpha: (1 - progress) * 0.45,
                    ),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  color: widget.color,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: widget.color.withValues(alpha: 0.35),
                      blurRadius: 8,
                      spreadRadius: 2,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.active,
    required this.label,
    required this.count,
    required this.showLiveDot,
    required this.onTap,
  });

  final bool active;
  final String label;
  final int count;
  final bool showLiveDot;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.background : Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            boxShadow: active ? AppShadows.soft : null,
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: AppTextStyles.itemTitle.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: active ? colors.foreground : colors.inkMute,
                ),
              ),
              if (showLiveDot) ...[
                const SizedBox(width: 6),
                _PulseDot(color: colors.destructive),
              ] else if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  constraints: const BoxConstraints(
                    minWidth: 18,
                    minHeight: 18,
                  ),
                  height: 18,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  decoration: BoxDecoration(
                    color: active
                        ? colors.primary
                        : colors.inkMute.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '$count',
                    style: AppTextStyles.caption.copyWith(
                      fontFamily: 'Sora',
                      fontSize: 10,
                      height: 1,
                      fontWeight: FontWeight.w700,
                      color: active ? colors.primaryForeground : colors.inkSoft,
                    ),
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

class _LiveChatTile extends StatelessWidget {
  const _LiveChatTile({
    required this.chat,
    required this.onTap,
  });

  final MeetupChat chat;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final preview = chat.typing
        ? '${chat.lastAuthor} печатает…'
        : '${chat.lastAuthor}: ${chat.lastMessage}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      child: Material(
        color: colors.primarySoft,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: colors.primary.withValues(alpha: 0.3)),
              boxShadow: AppShadows.soft,
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: colors.primary.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          alignment: Alignment.center,
                          child: Text(chat.emoji,
                              style: const TextStyle(fontSize: 28)),
                        ),
                        Positioned(
                          right: -2,
                          top: -2,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: colors.primarySoft,
                              shape: BoxShape.circle,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(2),
                              child: _PulseDot(
                                color: colors.destructive,
                                size: 10,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                '● LIVE',
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.destructive,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1,
                                ),
                              ),
                              if (chat.currentStep != null &&
                                  chat.totalSteps != null) ...[
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    '· Шаг ${chat.currentStep} из ${chat.totalSteps}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTextStyles.meta.copyWith(
                                      color: colors.inkSoft,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                              if (_curatedChatLabel(chat) != null) ...[
                                const SizedBox(width: 6),
                                Flexible(
                                  child: _CuratedChatBadge(
                                    label: _curatedChatLabel(chat)!,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            chat.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                AppTextStyles.itemTitle.copyWith(fontSize: 15),
                          ),
                          if (chat.currentPlace != null) ...[
                            const SizedBox(height: 2),
                            Text.rich(
                              TextSpan(
                                children: [
                                  const TextSpan(text: 'Сейчас: '),
                                  TextSpan(
                                    text: chat.currentPlace!,
                                    style: TextStyle(
                                      color: colors.foreground,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  if (chat.endTime != null)
                                    TextSpan(text: ' · до ${chat.endTime}'),
                                ],
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.meta.copyWith(
                                color: colors.inkSoft,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (chat.unread > 0) _UnreadBadge(count: chat.unread),
                        const SizedBox(height: 6),
                        Icon(
                          LucideIcons.chevron_right,
                          size: 18,
                          color: colors.inkMute,
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Divider(color: colors.primary.withValues(alpha: 0.15)),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        preview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.meta.copyWith(
                          color:
                              chat.typing ? colors.secondary : colors.inkSoft,
                          fontWeight:
                              chat.typing ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      chat.lastTime,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SoonChatTile extends StatelessWidget {
  const _SoonChatTile({
    required this.chat,
    required this.onTap,
    required this.onLaunch,
  });

  final MeetupChat chat;
  final VoidCallback onTap;
  final VoidCallback? onLaunch;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final startsInLabel = (chat.startsInLabel ?? 'Скоро').toUpperCase();
    return Container(
      margin: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.secondarySoft,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: colors.background.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child:
                        Text(chat.emoji, style: const TextStyle(fontSize: 24)),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '⏰ $startsInLabel',
                          style: AppTextStyles.caption.copyWith(
                            color: colors.secondary,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                        if (_curatedChatLabel(chat) != null) ...[
                          const SizedBox(height: 3),
                          _CuratedChatBadge(label: _curatedChatLabel(chat)!),
                        ],
                        const SizedBox(height: 2),
                        Text(
                          chat.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.itemTitle.copyWith(fontSize: 15),
                        ),
                        Text(
                          '${chat.lastAuthor}: ${chat.lastMessage}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.meta
                              .copyWith(color: colors.inkMute),
                        ),
                      ],
                    ),
                  ),
                  if (chat.unread > 0) _UnreadBadge(count: chat.unread),
                ],
              ),
            ),
          ),
          if (onLaunch != null) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              height: 40,
              child: FilledButton.icon(
                onPressed: onLaunch,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.foreground,
                  foregroundColor: colors.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: const Icon(LucideIcons.play, size: 14),
                label: Text(
                  'Поехали',
                  style: AppTextStyles.button.copyWith(
                    fontSize: 13,
                    color: colors.background,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: colors.primary,
        borderRadius: BorderRadius.circular(999),
      ),
      alignment: Alignment.center,
      child: Text(
        '$count',
        style: AppTextStyles.caption.copyWith(
          color: colors.primaryForeground,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CuratedChatBadge extends StatelessWidget {
  const _CuratedChatBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.caption.copyWith(
            color: colors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _MeetupChatTile extends StatelessWidget {
  const _MeetupChatTile({
    required this.title,
    required this.emoji,
    required this.lastTime,
    required this.status,
    required this.preview,
    required this.unread,
    required this.typing,
    required this.isDone,
    required this.isAfterDark,
    required this.afterDarkGlow,
    required this.curatedLabel,
    required this.members,
    required this.onTap,
  });

  final String title;
  final String emoji;
  final String lastTime;
  final String status;
  final String preview;
  final int unread;
  final bool typing;
  final bool isDone;
  final bool isAfterDark;
  final String? afterDarkGlow;
  final String? curatedLabel;
  final List<String> members;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final glowColor = afterDarkGlowColor(afterDarkGlow);
    final glowSurface = afterDarkGlowSurface(afterDarkGlow);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: isAfterDark ? glowSurface : Colors.transparent,
            borderRadius: AppRadii.cardBorder,
            border: isAfterDark
                ? Border.all(color: glowColor.withValues(alpha: 0.4))
                : null,
          ),
          foregroundDecoration: isDone
              ? BoxDecoration(
                  color: colors.background.withValues(alpha: 0.4),
                  borderRadius: AppRadii.cardBorder,
                )
              : null,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: isAfterDark ? glowSurface : colors.warmStart,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: Text(emoji, style: const TextStyle(fontSize: 24)),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: AppTextStyles.itemTitle.copyWith(
                              fontSize: 15,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          lastTime,
                          style: AppTextStyles.meta.copyWith(
                            fontSize: 11,
                            fontWeight: FontWeight.w400,
                            color: isAfterDark ? glowColor : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: isAfterDark
                                ? glowSurface
                                : colors.secondarySoft,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            child: Text(
                              status,
                              style: AppTextStyles.caption.copyWith(
                                color:
                                    isAfterDark ? glowColor : colors.secondary,
                              ),
                            ),
                          ),
                        ),
                        if (isAfterDark)
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: AppColors.adSurface,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: glowColor.withValues(alpha: 0.5),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              child: Text(
                                'After Dark',
                                style: AppTextStyles.caption.copyWith(
                                  color: glowColor,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        if (curatedLabel != null)
                          _CuratedChatBadge(label: curatedLabel!),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Text(
                            preview,
                            style: AppTextStyles.meta.copyWith(
                              fontSize: 13,
                              color: isAfterDark
                                  ? (typing ? glowColor : colors.inkSoft)
                                  : (typing
                                      ? colors.secondary
                                      : colors.inkMute),
                              fontWeight:
                                  typing ? FontWeight.w500 : FontWeight.w400,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (unread > 0)
                          Container(
                            constraints: const BoxConstraints(
                                minWidth: 20, minHeight: 20),
                            padding: const EdgeInsets.symmetric(horizontal: 5),
                            decoration: BoxDecoration(
                              color: isAfterDark ? glowColor : colors.primary,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '$unread',
                              style: AppTextStyles.caption.copyWith(
                                color: isAfterDark
                                    ? AppColors.adFg
                                    : colors.primaryForeground,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    BbAvatarStack(
                        names: members, size: BbAvatarSize.xs, max: 4),
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

class _PersonalChatTile extends StatelessWidget {
  const _PersonalChatTile({
    required this.name,
    required this.lastTime,
    required this.preview,
    required this.unread,
    required this.online,
    required this.onTap,
    this.fromMeetup,
  });

  final String name;
  final String lastTime;
  final String preview;
  final int unread;
  final bool online;
  final String? fromMeetup;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          child: Row(
            children: [
              BbAvatar(name: name, size: BbAvatarSize.lg, online: online),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: AppTextStyles.itemTitle.copyWith(
                              fontSize: 15,
                            ),
                          ),
                        ),
                        Text(
                          lastTime,
                          style: AppTextStyles.meta.copyWith(
                            fontSize: 11,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            preview,
                            style: AppTextStyles.meta.copyWith(
                              fontSize: 13,
                              color: unread > 0
                                  ? colors.foreground
                                  : colors.inkMute,
                              fontWeight: unread > 0
                                  ? FontWeight.w500
                                  : FontWeight.w400,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (unread > 0)
                          Container(
                            constraints: const BoxConstraints(
                                minWidth: 20, minHeight: 20),
                            padding: const EdgeInsets.symmetric(horizontal: 5),
                            decoration: BoxDecoration(
                              color: colors.primary,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '$unread',
                              style: AppTextStyles.caption
                                  .copyWith(color: colors.primaryForeground),
                            ),
                          ),
                      ],
                    ),
                    if (fromMeetup != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'из встречи · $fromMeetup',
                        style: AppTextStyles.meta.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w400,
                          color: colors.inkMute,
                        ),
                      ),
                    ],
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

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.foreground,
    required this.background,
    required this.onTap,
    this.borderColor,
  });

  final IconData icon;
  final Color foreground;
  final Color background;
  final VoidCallback onTap;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border:
                borderColor == null ? null : Border.all(color: borderColor!),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 18, color: foreground),
        ),
      ),
    );
  }
}
