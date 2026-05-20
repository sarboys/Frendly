import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:url_launcher/url_launcher.dart';

class MeetingDetailScreen extends StatefulWidget {
  const MeetingDetailScreen({
    super.key,
    required this.meetingId,
    this.inviteRequestId,
  });

  final String meetingId;
  final String? inviteRequestId;

  @override
  State<MeetingDetailScreen> createState() => _MeetingDetailScreenState();
}

class _MeetingDetailScreenState extends State<MeetingDetailScreen> {
  bool _saved = false;
  BackendCardItem? _localMeeting;
  bool _joinBusy = false;
  String? _joinError;

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Consumer(
        builder: (context, ref, _) {
          final state = ref.watch(meetingDetailProvider(widget.meetingId));
          final currentUserId = ref.watch(currentUserIdProvider);
          final meeting = _localMeeting ?? state.valueOrNull;
          final isHost = meeting == null
              ? false
              : _isHost(meeting, currentUserId: currentUserId);
          return Stack(
            children: [
              if (state.isLoading && meeting == null)
                const _DetailStatus(message: 'Загружаем встречу')
              else if (meeting == null)
                _DetailStatus(
                  message: state.hasError
                      ? 'Не удалось загрузить встречу'
                      : 'Встреча не найдена',
                )
              else
                _BackendMeetingDetail(
                  meeting: meeting,
                  saved: _saved,
                  currentUserId: currentUserId,
                  onSaved: () => setState(() => _saved = !_saved),
                  onRequirementTap: _openEntryRequirement,
                  onInvite: () => _showMeetingInviteSheet(
                    context,
                    eventId: meeting.id,
                    title: meeting.title,
                  ),
                ),
              if (meeting != null)
                _StickyMeetingActions(
                  meeting: meeting,
                  currentUserId: currentUserId,
                  joined: isHost || _isJoined(meeting),
                  busy: _joinBusy,
                  error: _joinError,
                  onJoin: () => _toggleJoin(ref, meeting),
                  onJoinRequest: () => _setJoinRequested(ref, meeting, true),
                  onCancelJoinRequest: () =>
                      _setJoinRequested(ref, meeting, false),
                  inviteRequestId: widget.inviteRequestId,
                  onAcceptInvite: (requestId) =>
                      _acceptInvite(ref, meeting, requestId),
                  onDeclineInvite: (requestId) =>
                      _declineInvite(ref, meeting, requestId),
                  onRequirementTap: _openEntryRequirement,
                  onInvite: () => _showMeetingInviteSheet(
                    context,
                    eventId: meeting.id,
                    title: meeting.title,
                  ),
                ),
              const _BottomNav(),
            ],
          );
        },
      ),
    );
  }

  Future<void> _toggleJoin(WidgetRef ref, BackendCardItem meeting) async {
    if (_joinBusy || meeting.id.isEmpty) {
      return;
    }
    setState(() {
      _joinBusy = true;
      _joinError = null;
    });
    try {
      final updated = await ref.read(meetingActionsProvider).setJoined(
            eventId: meeting.id,
            joined: !_isJoined(meeting),
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _localMeeting = updated;
        _joinBusy = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _joinBusy = false;
        _joinError = 'Не удалось обновить участие';
      });
    }
  }

  Future<void> _setJoinRequested(
    WidgetRef ref,
    BackendCardItem meeting,
    bool requested,
  ) async {
    if (_joinBusy || meeting.id.isEmpty) {
      return;
    }
    setState(() {
      _joinBusy = true;
      _joinError = null;
    });
    try {
      final updated = await ref.read(meetingActionsProvider).setJoinRequested(
            eventId: meeting.id,
            requested: requested,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _localMeeting = updated;
        _joinBusy = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _joinBusy = false;
        _joinError = requested
            ? 'Не удалось отправить заявку'
            : 'Не удалось отменить заявку';
      });
    }
  }

  Future<void> _acceptInvite(
    WidgetRef ref,
    BackendCardItem meeting,
    String requestId,
  ) async {
    if (_joinBusy || meeting.id.isEmpty || requestId.isEmpty) {
      return;
    }
    setState(() {
      _joinBusy = true;
      _joinError = null;
    });
    try {
      final updated =
          await ref.read(notificationsActionsProvider).acceptEventInvite(
                eventId: meeting.id,
                requestId: requestId,
              );
      if (!mounted) {
        return;
      }
      setState(() {
        _localMeeting = updated;
        _joinBusy = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _joinBusy = false;
        _joinError = 'Не удалось принять';
      });
    }
  }

  Future<void> _declineInvite(
    WidgetRef ref,
    BackendCardItem meeting,
    String requestId,
  ) async {
    if (_joinBusy || meeting.id.isEmpty || requestId.isEmpty) {
      return;
    }
    setState(() {
      _joinBusy = true;
      _joinError = null;
    });
    try {
      await ref.read(notificationsActionsProvider).declineEventInvite(
            eventId: meeting.id,
            requestId: requestId,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _joinBusy = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _joinBusy = false;
        _joinError = 'Не удалось отклонить';
      });
    }
  }

  void _openEntryRequirement(EventEntryRequirement requirement) {
    switch (requirement) {
      case EventEntryRequirement.verification:
        context.go('/verify');
        break;
      case EventEntryRequirement.frendlyPlus:
        context.go('/paywall');
        break;
    }
  }
}

class _BackendMeetingDetail extends StatelessWidget {
  const _BackendMeetingDetail({
    required this.meeting,
    required this.saved,
    required this.currentUserId,
    required this.onSaved,
    required this.onRequirementTap,
    required this.onInvite,
  });

  final BackendCardItem meeting;
  final bool saved;
  final String? currentUserId;
  final VoidCallback onSaved;
  final ValueChanged<EventEntryRequirement> onRequirementTap;
  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    final host = _hostPreview(meeting.raw);
    final attachments = _detailAttachments(meeting);
    final tags = _detailTags(meeting);
    final isHost = _isHost(meeting, currentUserId: currentUserId);
    return ListView(
      padding: const EdgeInsets.only(bottom: 220),
      children: [
        _BackendMeetingHero(
          meeting: meeting,
          saved: saved,
          onSaved: onSaved,
        ),
        if (isHost)
          _HostActionsPanel(
            onInvite: onInvite,
          ),
        if (host != null) _HostCard(host: host),
        if (attachments.isNotEmpty)
          _MeetingAttachmentsSection(attachments: attachments),
        if (_entryLocked(meeting, currentUserId: currentUserId))
          _EntryRequirementsSection(
            requirements: _entryRequirements(meeting.raw),
            onTap: onRequirementTap,
          ),
        _AboutSection(meeting: meeting, tags: tags),
        _PeopleSection(meeting: meeting),
        if (_hasLocation(meeting)) _LocationSection(meeting: meeting),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _StickyMeetingActions extends StatelessWidget {
  const _StickyMeetingActions({
    required this.meeting,
    required this.currentUserId,
    required this.joined,
    required this.busy,
    required this.error,
    required this.onJoin,
    required this.onJoinRequest,
    required this.onCancelJoinRequest,
    required this.inviteRequestId,
    required this.onAcceptInvite,
    required this.onDeclineInvite,
    required this.onRequirementTap,
    required this.onInvite,
  });

  final BackendCardItem meeting;
  final String? currentUserId;
  final bool joined;
  final bool busy;
  final String? error;
  final VoidCallback onJoin;
  final VoidCallback onJoinRequest;
  final VoidCallback onCancelJoinRequest;
  final String? inviteRequestId;
  final ValueChanged<String> onAcceptInvite;
  final ValueChanged<String> onDeclineInvite;
  final ValueChanged<EventEntryRequirement> onRequirementTap;
  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    final chatId = _stringOrNull(meeting.raw['chatId']);
    final canInvite = _canInvite(meeting, currentUserId: currentUserId);
    final pending = _hasPendingJoinRequest(meeting);
    final pendingInviteRequestId = _pendingInviteRequestId(
      meeting,
      explicitRequestId: inviteRequestId,
    );
    final hasPendingInvite = pendingInviteRequestId != null;
    final locked = _entryLocked(meeting, currentUserId: currentUserId);
    final primaryRequirement =
        _entryRequirements(meeting.raw).missing.firstOrNull;
    final primaryTap = locked && primaryRequirement != null
        ? () => onRequirementTap(primaryRequirement)
        : hasPendingInvite
            ? () => onAcceptInvite(pendingInviteRequestId)
            : pending
                ? null
                : _requiresJoinRequest(meeting)
                    ? onJoinRequest
                    : onJoin;
    final secondaryRequirement =
        _entryRequirements(meeting.raw).missing.skip(1).firstOrNull;
    final secondaryLabel = hasPendingInvite
        ? 'Отклонить'
        : pending
            ? 'Отменить заявку'
            : locked && secondaryRequirement != null
                ? _entryRequirementActionLabel(secondaryRequirement)
                : null;
    final secondaryTap = hasPendingInvite
        ? () => onDeclineInvite(pendingInviteRequestId)
        : pending
            ? onCancelJoinRequest
            : locked && secondaryRequirement != null
                ? () => onRequirementTap(secondaryRequirement)
                : null;
    return Positioned(
      left: 16,
      right: 16,
      bottom: 92,
      child: _GlassPanel(
        borderRadius: 28,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            if (chatId != null) ...[
              _StickyIconButton(
                icon: LucideIcons.messageCircle,
                label: 'Чат встречи',
                onTap: () => context.go(
                  '/meetings/${Uri.encodeComponent(chatId)}/chat',
                ),
              ),
              const SizedBox(width: 10),
            ],
            if (canInvite) ...[
              _StickyIconButton(
                icon: LucideIcons.userPlus,
                label: 'Позвать друзей',
                onTap: onInvite,
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: busy ? null : primaryTap,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 160),
                      opacity: busy ? 0.65 : 1,
                      child: Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: joined || pending ? DateasyColors.glass : null,
                          gradient:
                              joined || pending ? null : dateasyLimeGradient,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: joined || pending
                                ? DateasyColors.lime.withValues(alpha: 0.45)
                                : Colors.transparent,
                          ),
                        ),
                        child: busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(
                                error ??
                                    _primaryMeetingActionLabel(
                                      meeting,
                                      joined: joined,
                                      locked: locked,
                                      inviteRequestId: pendingInviteRequestId,
                                    ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .labelLarge
                                    ?.copyWith(
                                      color: joined || pending
                                          ? DateasyColors.lime
                                          : DateasyColors.backgroundDeep,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                      ),
                    ),
                  ),
                  if (secondaryLabel != null && secondaryTap != null) ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: busy ? null : secondaryTap,
                      child: Text(
                        secondaryLabel,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StickyIconButton extends StatelessWidget {
  const _StickyIconButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: DateasyColors.glass,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: DateasyColors.border),
          ),
          child: Icon(
            icon,
            color: DateasyColors.foreground,
            size: 22,
          ),
        ),
      ),
    );
  }
}

class _HostActionsPanel extends StatelessWidget {
  const _HostActionsPanel({
    required this.onInvite,
  });

  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: DateasyColors.lime.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: DateasyColors.lime.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: _HostActionButton(
                icon: LucideIcons.pencil,
                iconColor: DateasyColors.lime,
                label: 'Редактировать',
                onTap: () => context.go('/meetings/new'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _HostActionButton(
                icon: LucideIcons.zap,
                iconColor: DateasyColors.pink,
                label: 'Продвинуть',
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Продвижение встречи скоро будет тут'),
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: DateasyColors.surface2,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _HostActionButton(
                icon: LucideIcons.userPlus,
                iconColor: DateasyColors.lilac,
                label: 'Пригласить',
                onTap: onInvite,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HostActionButton extends StatelessWidget {
  const _HostActionButton({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: iconColor),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.foreground,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _showMeetingInviteSheet(
  BuildContext context, {
  required String eventId,
  required String title,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.5),
    isScrollControlled: true,
    useSafeArea: false,
    builder: (_) => _MeetingInviteSheet(
      eventId: eventId,
      title: title,
    ),
  );
}

class _MeetingInviteSheet extends ConsumerStatefulWidget {
  const _MeetingInviteSheet({
    required this.eventId,
    required this.title,
  });

  final String eventId;
  final String title;

  @override
  ConsumerState<_MeetingInviteSheet> createState() =>
      _MeetingInviteSheetState();
}

class _MeetingInviteSheetState extends ConsumerState<_MeetingInviteSheet> {
  static const _pageLimit = 20;

  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _sentIds = <String>{};
  final _sendingIds = <String>{};

  Timer? _debounce;
  CancelToken? _cancelToken;
  List<BackendCardItem> _people = const [];
  String? _nextCursor;
  bool _loadingInitial = true;
  bool _loadingMore = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    unawaited(_loadFirstPage());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _cancelToken?.cancel('meeting_invite_sheet_disposed');
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      unawaited(_loadFirstPage());
    });
  }

  void _onScroll() {
    if (!_scrollController.hasClients ||
        _loadingInitial ||
        _loadingMore ||
        _nextCursor == null) {
      return;
    }
    final position = _scrollController.position;
    if (position.maxScrollExtent - position.pixels < 240) {
      unawaited(_loadMore());
    }
  }

  Future<void> _loadFirstPage() async {
    _cancelToken?.cancel('meeting_invite_sheet_replaced');
    final cancelToken = CancelToken();
    _cancelToken = cancelToken;
    if (mounted) {
      setState(() {
        _loadingInitial = true;
        _loadingMore = false;
        _failed = false;
        _nextCursor = null;
      });
    }

    try {
      final result =
          await ref.read(backendRepositoryProvider).fetchFollowingPeople(
                eventId: widget.eventId,
                q: _query,
                limit: _pageLimit,
                cancelToken: cancelToken,
              );
      if (!mounted || cancelToken.isCancelled) {
        return;
      }
      setState(() {
        _people = result.items;
        _nextCursor = result.nextCursor;
        _loadingInitial = false;
      });
    } on DioException catch (error) {
      if (error.type == DioExceptionType.cancel) {
        return;
      }
      _markInitialFailed();
    } catch (_) {
      _markInitialFailed();
    }
  }

  Future<void> _loadMore() async {
    final cursor = _nextCursor;
    if (cursor == null || _loadingMore) {
      return;
    }
    final cancelToken = CancelToken();
    _cancelToken = cancelToken;
    setState(() {
      _loadingMore = true;
    });

    try {
      final result =
          await ref.read(backendRepositoryProvider).fetchFollowingPeople(
                eventId: widget.eventId,
                q: _query,
                cursor: cursor,
                limit: _pageLimit,
                cancelToken: cancelToken,
              );
      if (!mounted || cancelToken.isCancelled) {
        return;
      }
      setState(() {
        _people = [..._people, ...result.items];
        _nextCursor = result.nextCursor;
        _loadingMore = false;
      });
    } on DioException catch (error) {
      if (error.type == DioExceptionType.cancel) {
        return;
      }
      _markMoreFailed();
    } catch (_) {
      _markMoreFailed();
    }
  }

  Future<void> _invite(BackendCardItem person) async {
    if (_inviteDisabled(person)) {
      return;
    }
    setState(() {
      _sendingIds.add(person.id);
    });
    try {
      await ref.read(backendRepositoryProvider).inviteUserToEvent(
            widget.eventId,
            person.id,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _sentIds.add(person.id);
        _sendingIds.remove(person.id);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _sendingIds.remove(person.id);
      });
      _showSnackBar('Не получилось отправить приглашение');
    }
  }

  bool _inviteDisabled(BackendCardItem person) {
    return _sendingIds.contains(person.id) ||
        _sentIds.contains(person.id) ||
        _inviteState(person) != 'available';
  }

  void _markInitialFailed() {
    if (!mounted) {
      return;
    }
    setState(() {
      _failed = true;
      _loadingInitial = false;
    });
  }

  void _markMoreFailed() {
    if (!mounted) {
      return;
    }
    setState(() {
      _loadingMore = false;
    });
    _showSnackBar('Не получилось загрузить ещё');
  }

  String? get _query {
    final value = _searchController.text.trim();
    return value.isEmpty ? null : value;
  }

  void _showSnackBar(String text) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(text)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.72;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(12, 0, 12, bottomInset + 12),
        child: _GlassPanel(
          borderRadius: 28,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
          child: SizedBox(
            height: height,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.24),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Кого позвать',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  color: DateasyColors.foreground,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          if (widget.title.trim().isNotEmpty)
                            Text(
                              widget.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: DateasyColors.muted),
                            ),
                        ],
                      ),
                    ),
                    _GlassIconButton(
                      icon: LucideIcons.x,
                      onTap: () => Navigator.of(context).maybePop(),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  style: const TextStyle(color: DateasyColors.foreground),
                  decoration: InputDecoration(
                    hintText: 'Найти друга',
                    hintStyle: const TextStyle(color: DateasyColors.muted),
                    prefixIcon: const Icon(
                      LucideIcons.search,
                      color: DateasyColors.muted,
                      size: 18,
                    ),
                    filled: true,
                    fillColor: DateasyColors.surface2,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(child: _buildBody(context)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loadingInitial) {
      return const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }
    if (_failed) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Не получилось загрузить друзей',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                  ),
            ),
            const SizedBox(height: 10),
            _SmallGlassButton(
              label: 'Повторить',
              onTap: () => unawaited(_loadFirstPage()),
            ),
          ],
        ),
      );
    }
    if (_people.isEmpty) {
      return Center(
        child: Text(
          'Пока некого пригласить',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      );
    }
    return ListView.builder(
      controller: _scrollController,
      itemCount: _people.length + (_loadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= _people.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        final person = _people[index];
        return _InvitePersonRow(
          person: person,
          sending: _sendingIds.contains(person.id),
          sent: _sentIds.contains(person.id),
          disabled: _inviteDisabled(person),
          onInvite: () => unawaited(_invite(person)),
        );
      },
    );
  }
}

class _InvitePersonRow extends StatelessWidget {
  const _InvitePersonRow({
    required this.person,
    required this.sending,
    required this.sent,
    required this.disabled,
    required this.onInvite,
  });

  final BackendCardItem person;
  final bool sending;
  final bool sent;
  final bool disabled;
  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    final label = _inviteButtonLabel(person, sent: sent);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          _SquareAvatar(imageUrl: person.imageUrl, size: 48, radius: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  person.title.isEmpty ? 'Друг' : person.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.foreground,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                if ((person.subtitle ?? '').isNotEmpty)
                  Text(
                    person.subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: disabled ? null : onInvite,
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 150),
              opacity: disabled && !sent ? 0.72 : 1,
              child: Container(
                constraints: const BoxConstraints(minWidth: 112),
                height: 40,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: disabled ? DateasyColors.surface2 : null,
                  gradient: disabled ? null : dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: DateasyColors.border),
                ),
                child: sending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: disabled
                                      ? DateasyColors.muted
                                      : DateasyColors.backgroundDeep,
                                  fontWeight: FontWeight.w800,
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

class _HostCard extends StatelessWidget {
  const _HostCard({required this.host});

  final _PersonPreview host;

  @override
  Widget build(BuildContext context) {
    final rating = host.rating?.toStringAsFixed(1);
    final subtitle = [
      if (rating != null) rating,
      if (host.meetupCount != null) '${host.meetupCount} встреч',
      if (host.verified) 'проверен',
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            _SquareAvatar(imageUrl: host.avatarUrl, size: 62, radius: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Хост',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: DateasyColors.lime,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    host.name.isEmpty ? 'Хост встречи' : host.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: DateasyColors.foreground,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            if (host.userId != null)
              _SmallGlassButton(
                label: 'Профиль',
                onTap: () =>
                    context.go('/u/${Uri.encodeComponent(host.userId!)}'),
              ),
          ],
        ),
      ),
    );
  }
}

class _MeetingAttachmentsSection extends StatelessWidget {
  const _MeetingAttachmentsSection({required this.attachments});

  final List<_AttachmentDetail> attachments;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(
            title: 'Вложено во встречу',
            trailing: '${attachments.length}',
          ),
          const SizedBox(height: 10),
          for (final attachment in attachments) ...[
            _AttachmentCard(attachment: attachment),
            if (attachment != attachments.last) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _EntryRequirementsSection extends StatelessWidget {
  const _EntryRequirementsSection({
    required this.requirements,
    required this.onTap,
  });

  final EventEntryRequirements requirements;
  final ValueChanged<EventEntryRequirement> onTap;

  @override
  Widget build(BuildContext context) {
    if (requirements.missing.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(title: 'Доступ закрыт'),
            const SizedBox(height: 10),
            Text(
              'Эта встреча доступна после проверки условий.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    height: 1.35,
                  ),
            ),
            const SizedBox(height: 14),
            for (final requirement in requirements.missing) ...[
              _RequirementRow(requirement: requirement, onTap: onTap),
              if (requirement != requirements.missing.last)
                const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class _RequirementRow extends StatelessWidget {
  const _RequirementRow({
    required this.requirement,
    required this.onTap,
  });

  final EventEntryRequirement requirement;
  final ValueChanged<EventEntryRequirement> onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: DateasyColors.surface2,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            requirement == EventEntryRequirement.verification
                ? LucideIcons.badgeCheck
                : LucideIcons.sparkles,
            color: DateasyColors.lime,
            size: 18,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            _entryRequirementTitle(requirement),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.foreground,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        const SizedBox(width: 8),
        _SmallGlassButton(
          label: _entryRequirementShortActionLabel(requirement),
          onTap: () => onTap(requirement),
        ),
      ],
    );
  }
}

class _AttachmentCard extends StatelessWidget {
  const _AttachmentCard({required this.attachment});

  final _AttachmentDetail attachment;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: attachment.gradient == null
                ? attachment.foreground.withValues(alpha: 0.18)
                : null,
            gradient: attachment.gradient,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            attachment.icon,
            color: attachment.iconColor,
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                attachment.kindLabel,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: DateasyColors.muted,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                attachment.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: DateasyColors.foreground,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              if (attachment.subtitle != null) ...[
                const SizedBox(height: 3),
                Text(
                  attachment.subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        height: 1.25,
                      ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 10),
        _AttachmentActionButton(attachment: attachment),
      ],
    );

    return _GlassPanel(
      borderRadius: 18,
      padding: const EdgeInsets.all(12),
      child: content,
    );
  }
}

class _AttachmentActionButton extends StatelessWidget {
  const _AttachmentActionButton({required this.attachment});

  final _AttachmentDetail attachment;

  @override
  Widget build(BuildContext context) {
    final hasGradient = attachment.gradient != null;
    final textColor =
        hasGradient ? DateasyColors.backgroundDeep : DateasyColors.background;
    return GestureDetector(
      onTap: () => _openAttachment(context, attachment),
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: hasGradient ? null : DateasyColors.foreground,
          gradient: attachment.gradient,
          borderRadius: BorderRadius.circular(12),
          boxShadow: hasGradient
              ? [
                  BoxShadow(
                    color: attachment.foreground.withValues(alpha: 0.28),
                    blurRadius: 18,
                    spreadRadius: -8,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Text(
          attachment.actionLabel,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: textColor,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

class _AboutSection extends StatelessWidget {
  const _AboutSection({required this.meeting, required this.tags});

  final BackendCardItem meeting;
  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    final text = _detailDescription(meeting);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(title: 'О встрече'),
            const SizedBox(height: 10),
            Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    height: 1.42,
                  ),
            ),
            if (tags.isNotEmpty) ...[
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final tag in tags) _InfoChip(label: tag),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PeopleSection extends StatelessWidget {
  const _PeopleSection({required this.meeting});

  final BackendCardItem meeting;

  @override
  Widget build(BuildContext context) {
    final host = _hostPreview(meeting.raw);
    final attendees = _attendeePreviews(meeting.raw);
    if (host == null && attendees.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionTitle(
              title: 'Кто идёт',
              trailing: _peopleCountLabel(meeting.raw),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 108,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: (host == null ? 0 : 1) + attendees.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final person = host != null && index == 0
                      ? host
                      : attendees[index - (host == null ? 0 : 1)];
                  return _PersonTile(
                    person: person,
                    label: person == host ? 'Хост' : null,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PersonTile extends StatelessWidget {
  const _PersonTile({required this.person, this.label});

  final _PersonPreview person;
  final String? label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 74,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SquareAvatar(imageUrl: person.avatarUrl, size: 64, radius: 18),
          const SizedBox(height: 7),
          Text(
            person.name.isEmpty ? 'Участник' : person.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: DateasyColors.foreground,
                ),
          ),
          if (label != null)
            Text(
              label!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: DateasyColors.lime,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
            ),
        ],
      ),
    );
  }
}

class _LocationSection extends StatelessWidget {
  const _LocationSection({required this.meeting});

  final BackendCardItem meeting;

  @override
  Widget build(BuildContext context) {
    final place = _locationTitle(meeting);
    final city = meeting.city;
    final routeId = _stringOrNull(meeting.raw['routeId']);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: 'Локация'),
          const SizedBox(height: 10),
          Container(
            height: 168,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: DateasyColors.border),
              gradient: RadialGradient(
                center: const Alignment(0.1, -0.2),
                radius: 1.0,
                colors: [
                  DateasyColors.lime.withValues(alpha: 0.34),
                  DateasyColors.pink.withValues(alpha: 0.14),
                  DateasyColors.glass,
                ],
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                Align(
                  alignment: Alignment.center,
                  child: Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      gradient: dateasyLimeGradient,
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: [
                        BoxShadow(
                          color: DateasyColors.lime.withValues(alpha: 0.25),
                          blurRadius: 32,
                          offset: const Offset(0, 14),
                        ),
                      ],
                    ),
                    child: const Icon(
                      LucideIcons.mapPin,
                      color: DateasyColors.backgroundDeep,
                      size: 34,
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: _GlassPanel(
                    borderRadius: 20,
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                place,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleSmall
                                    ?.copyWith(
                                      color: DateasyColors.foreground,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              if (city != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  city,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: DateasyColors.muted,
                                      ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (routeId != null)
                          _SmallGlassButton(
                            label: 'Маршрут',
                            onTap: () => context.go(
                              '/routes/${Uri.encodeComponent(routeId)}',
                            ),
                          ),
                      ],
                    ),
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

class _SquareAvatar extends StatelessWidget {
  const _SquareAvatar({
    required this.imageUrl,
    required this.size,
    required this.radius,
  });

  final String? imageUrl;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: DateasyColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: DateasyRemoteImage(
        imageUrl: imageUrl,
        usage: DateasyImageUsage.avatar,
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: DateasyColors.foreground,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ),
        if (trailing != null)
          Text(
            trailing!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.lime,
                  fontWeight: FontWeight.w800,
                ),
          ),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.foreground,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _SmallGlassButton extends StatelessWidget {
  const _SmallGlassButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: DateasyColors.foreground,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

class _BackendMeetingHero extends StatelessWidget {
  const _BackendMeetingHero({
    required this.meeting,
    required this.saved,
    required this.onSaved,
  });

  final BackendCardItem meeting;
  final bool saved;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 288,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DateasyRemoteImage(
            imageUrl: meeting.imageUrl,
            usage: DateasyImageUsage.hero,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x661F0C3F),
                  Color(0x331F0C3F),
                  DateasyColors.background,
                ],
                stops: [0, 0.52, 1],
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 16,
            left: 20,
            right: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _GlassIconButton(
                  icon: LucideIcons.arrowLeft,
                  onTap: () => context.go('/meetings'),
                ),
                Row(
                  children: [
                    _GlassIconButton(
                      icon: LucideIcons.images,
                      onTap: () => context.go(
                        '/stories?eventId=${Uri.encodeComponent(meeting.id)}',
                      ),
                    ),
                    const SizedBox(width: 8),
                    _GlassIconButton(
                      icon: LucideIcons.share2,
                      onTap: () => context.go(
                        '/share?targetType=event&targetId=${Uri.encodeComponent(meeting.id)}',
                      ),
                    ),
                    const SizedBox(width: 8),
                    _GlassIconButton(
                      icon: LucideIcons.bookmark,
                      active: saved,
                      onTap: onSaved,
                    ),
                  ],
                ),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _LimeBadge(label: _formatDate(meeting.startsAt) ?? 'Встреча'),
                const SizedBox(height: 12),
                Text(
                  meeting.title.isEmpty ? 'Встреча' : meeting.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontSize: 28,
                        height: 1.1,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(
                      LucideIcons.mapPin,
                      size: 13,
                      color: DateasyColors.muted,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        meeting.city ?? meeting.subtitle ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                            ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailStatus extends StatelessWidget {
  const _DetailStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return const DateasyBottomNav();
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: active ? DateasyColors.lime : DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        ),
        child: Icon(
          active && icon == LucideIcons.bookmark ? Icons.bookmark : icon,
          color:
              active ? DateasyColors.backgroundDeep : DateasyColors.foreground,
          size: 20,
        ),
      ),
    );
  }
}

class _LimeBadge extends StatelessWidget {
  const _LimeBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        gradient: dateasyLimeGradient,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.backgroundDeep,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _AttachmentDetail {
  const _AttachmentDetail({
    required this.kindLabel,
    required this.title,
    required this.icon,
    required this.foreground,
    required this.iconColor,
    required this.actionLabel,
    this.subtitle,
    this.gradient,
    this.actionUrl,
    this.route,
  });

  final String kindLabel;
  final String title;
  final String? subtitle;
  final IconData icon;
  final Color foreground;
  final Color iconColor;
  final String actionLabel;
  final Gradient? gradient;
  final String? actionUrl;
  final String? route;
}

String? _formatDate(DateTime? value) {
  if (value == null) {
    return null;
  }
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
}

bool _isJoined(BackendCardItem meeting) {
  final raw = meeting.raw;
  final value = raw['participantState'] ??
      raw['viewerState'] ??
      raw['participationState'] ??
      raw['attendanceState'] ??
      raw['rsvpState'];
  final text = value?.toString().toLowerCase();
  return text == 'joined' ||
      text == 'going' ||
      text == 'approved' ||
      text == 'participant' ||
      text == 'host';
}

bool _isHost(BackendCardItem meeting, {String? currentUserId}) {
  if (meeting.raw['isHost'] == true ||
      meeting.raw['viewerState']?.toString().toLowerCase() == 'host' ||
      meeting.raw['participantState']?.toString().toLowerCase() == 'host') {
    return true;
  }
  final userId = currentUserId?.trim();
  if (userId == null || userId.isEmpty) {
    return false;
  }
  return _hostUserId(meeting.raw) == userId;
}

bool _canInvite(BackendCardItem meeting, {String? currentUserId}) {
  return meeting.id.isNotEmpty &&
      (_isHost(meeting, currentUserId: currentUserId) || _isJoined(meeting));
}

String _inviteState(BackendCardItem person) {
  return _rawLower(person.raw, 'inviteState') ?? 'available';
}

String _inviteButtonLabel(BackendCardItem person, {required bool sent}) {
  if (sent) {
    return 'Отправлено';
  }
  return switch (_inviteState(person)) {
    'already_joined' || 'joined' => 'Уже идёт',
    'pending_invite' || 'invited' => 'Уже приглашён',
    'pending_request' => 'Заявка есть',
    _ => 'Пригласить',
  };
}

bool _requiresJoinRequest(BackendCardItem meeting) {
  final raw = meeting.raw;
  return _rawLower(raw, 'accessMode') == 'request' ||
      _rawLower(raw, 'joinMode') == 'request' ||
      _rawLower(raw, 'visibilityMode') == 'friends';
}

bool _hasPendingJoinRequest(BackendCardItem meeting) {
  final raw = meeting.raw;
  final status = _firstRawLower(raw, const [
    'joinRequestStatus',
    'requestStatus',
    'participantState',
    'viewerState',
  ]);
  return status == 'pending' ||
      status == 'pending_request' ||
      status == 'requested';
}

bool _entryLocked(BackendCardItem meeting, {String? currentUserId}) {
  return !_isHost(meeting, currentUserId: currentUserId) &&
      !_isJoined(meeting) &&
      !_entryRequirements(meeting.raw).canJoin;
}

String _primaryMeetingActionLabel(
  BackendCardItem meeting, {
  required bool joined,
  required bool locked,
  String? inviteRequestId,
}) {
  if (locked) {
    final requirement = _entryRequirements(meeting.raw).missing.firstOrNull;
    return requirement == null
        ? 'Доступ закрыт'
        : _entryRequirementActionLabel(requirement);
  }
  if (_hasPendingJoinRequest(meeting)) {
    if (inviteRequestId != null) {
      return 'Принять';
    }
    return 'Заявка отправлена';
  }
  if (joined) {
    return 'Вы идёте';
  }
  if (_requiresJoinRequest(meeting)) {
    return 'Отправить заявку';
  }
  return 'Присоединиться';
}

String? _pendingInviteRequestId(
  BackendCardItem meeting, {
  String? explicitRequestId,
}) {
  final explicit = explicitRequestId?.trim();
  if (explicit != null &&
      explicit.isNotEmpty &&
      _hasPendingJoinRequest(meeting)) {
    return explicit;
  }
  if (!_hasPendingEventInvite(meeting)) {
    return null;
  }
  return _stringOrNull(
    meeting.raw['joinRequestId'] ??
        meeting.raw['requestId'] ??
        meeting.raw['inviteRequestId'],
  );
}

bool _hasPendingEventInvite(BackendCardItem meeting) {
  if (!_hasPendingJoinRequest(meeting)) {
    return false;
  }
  final raw = meeting.raw;
  if (raw['invite'] == true || raw['isInvite'] == true) {
    return true;
  }
  final kind = _firstRawLower(raw, const [
    'joinRequestKind',
    'requestKind',
    'inviteState',
  ]);
  if (kind == 'invite' || kind == 'pending_invite' || kind == 'invited') {
    return true;
  }
  return _stringOrNull(raw['joinRequestReviewedById']) != null;
}

String _entryRequirementTitle(EventEntryRequirement requirement) {
  return switch (requirement) {
    EventEntryRequirement.verification => 'Нужна верификация',
    EventEntryRequirement.frendlyPlus => 'Нужен Frendly+',
  };
}

String _entryRequirementActionLabel(EventEntryRequirement requirement) {
  return switch (requirement) {
    EventEntryRequirement.verification => 'Пройти верификацию',
    EventEntryRequirement.frendlyPlus => 'Открыть Frendly+',
  };
}

String _entryRequirementShortActionLabel(EventEntryRequirement requirement) {
  return switch (requirement) {
    EventEntryRequirement.verification => 'Проверка',
    EventEntryRequirement.frendlyPlus => 'Frendly+',
  };
}

EventEntryRequirements _entryRequirements(Map<String, Object?> raw) {
  final value = raw['entryRequirements'];
  if (value is Map) {
    final mapped = value.map((key, value) => MapEntry('$key', value));
    return EventEntryRequirements.fromJson(mapped);
  }
  final missing = <EventEntryRequirement>[
    if (raw['requiresVerification'] == true) EventEntryRequirement.verification,
    if (raw['requiresFrendlyPlus'] == true) EventEntryRequirement.frendlyPlus,
  ];
  return EventEntryRequirements(
    canJoin: missing.isEmpty,
    missing: missing,
  );
}

enum EventEntryRequirement { verification, frendlyPlus }

class EventEntryRequirements {
  const EventEntryRequirements({
    required this.canJoin,
    required this.missing,
  });

  final bool canJoin;
  final List<EventEntryRequirement> missing;

  factory EventEntryRequirements.fromJson(Map<String, Object?> json) {
    final rawMissing = json['missing'];
    return EventEntryRequirements(
      canJoin: json['canJoin'] != false,
      missing: rawMissing is List
          ? rawMissing
              .map((item) => item.toString())
              .map(_entryRequirementFromString)
              .whereType<EventEntryRequirement>()
              .toList(growable: false)
          : const [],
    );
  }
}

EventEntryRequirement? _entryRequirementFromString(String value) {
  return switch (value) {
    'verification' || 'verified' => EventEntryRequirement.verification,
    'frendly_plus' ||
    'plus' ||
    'frendlyPlus' =>
      EventEntryRequirement.frendlyPlus,
    _ => null,
  };
}

class _PersonPreview {
  const _PersonPreview({
    required this.name,
    this.avatarUrl,
    this.userId,
    this.rating,
    this.meetupCount,
    this.verified = false,
  });

  final String name;
  final String? avatarUrl;
  final String? userId;
  final double? rating;
  final int? meetupCount;
  final bool verified;
}

_PersonPreview? _hostPreview(Map<String, Object?> raw) {
  final host = raw['host'];
  if (host is! Map) {
    return null;
  }
  final profile = host['profile'];
  final media = host['media'];
  return _PersonPreview(
    name: _string(host['displayName'] ?? host['name']),
    userId: _stringOrNull(host['id'] ?? host['userId']),
    avatarUrl: _stringOrNull(
      host['avatarUrl'] ??
          host['photoUrl'] ??
          host['imageUrl'] ??
          (profile is Map
              ? profile['avatarUrl'] ??
                  profile['photoUrl'] ??
                  profile['imageUrl']
              : null) ??
          (media is Map ? media['url'] ?? media['downloadUrl'] : null),
    ),
    rating: _doubleOrNull(host['rating']),
    meetupCount: _intOrNull(host['meetupCount']),
    verified: host['verified'] == true,
  );
}

String? _hostUserId(Map<String, Object?> raw) {
  final host = raw['host'];
  if (host is Map) {
    return _stringOrNull(host['id'] ?? host['userId']);
  }
  return _stringOrNull(
    raw['hostId'] ?? raw['creatorId'] ?? raw['createdById'] ?? raw['ownerId'],
  );
}

List<_PersonPreview> _attendeePreviews(Map<String, Object?> raw) {
  final source = raw['attendees'] ?? raw['participants'];
  if (source is! List) {
    return const [];
  }
  return source
      .whereType<Map>()
      .map((item) {
        final user = item['user'];
        final profile = item['profile'];
        final userProfile = user is Map ? user['profile'] : null;
        final media = item['media'];
        return _PersonPreview(
          name: _string(
            item['displayName'] ??
                item['name'] ??
                (user is Map ? user['displayName'] ?? user['name'] : null),
          ),
          userId: _stringOrNull(
            item['userId'] ?? (user is Map ? user['id'] : null) ?? item['id'],
          ),
          avatarUrl: _stringOrNull(
            item['avatarUrl'] ??
                item['photoUrl'] ??
                item['imageUrl'] ??
                (profile is Map
                    ? profile['avatarUrl'] ??
                        profile['photoUrl'] ??
                        profile['imageUrl']
                    : null) ??
                (user is Map
                    ? user['avatarUrl'] ?? user['photoUrl'] ?? user['imageUrl']
                    : null) ??
                (userProfile is Map
                    ? userProfile['avatarUrl'] ??
                        userProfile['photoUrl'] ??
                        userProfile['imageUrl']
                    : null) ??
                (media is Map ? media['url'] ?? media['downloadUrl'] : null),
          ),
        );
      })
      .where((person) => person.name.isNotEmpty || person.avatarUrl != null)
      .toList(growable: false);
}

List<_AttachmentDetail> _detailAttachments(BackendCardItem meeting) {
  final raw = meeting.raw;
  final attachments = <_AttachmentDetail>[];
  final ticketUrl = _stringOrNull(raw['ticketUrl']);
  if (ticketUrl != null) {
    attachments.add(
      _AttachmentDetail(
        kindLabel: 'Афиша',
        title: _stringOrNull(raw['ticketVenue']) ?? meeting.title,
        subtitle: _ticketSubtitle(raw),
        icon: LucideIcons.ticket,
        foreground: DateasyColors.pink,
        iconColor: DateasyColors.backgroundDeep,
        gradient: dateasyPinkGradient,
        actionLabel: 'Билет',
        actionUrl: ticketUrl,
      ),
    );
  }

  final bookingUrl = _stringOrNull(raw['bookingUrl']);
  final bookingPromo = _firstBookingPromo(raw);
  final partnerName = _stringOrNull(raw['partnerName']);
  final partnerOffer = _stringOrNull(raw['partnerOffer']);
  if (bookingUrl != null || bookingPromo != null || partnerName != null) {
    attachments.add(
      _AttachmentDetail(
        kindLabel: 'Заведение',
        title: partnerName ?? _locationTitle(meeting),
        subtitle: partnerOffer ??
            _stringOrNull(bookingPromo?['description']) ??
            _stringOrNull(bookingPromo?['title']) ??
            _bookingSubtitle(raw),
        icon: LucideIcons.percent,
        foreground: DateasyColors.lime,
        iconColor: DateasyColors.backgroundDeep,
        gradient: dateasyLimeGradient,
        actionLabel: bookingUrl == null ? 'Промо' : 'Забронировать',
        actionUrl: bookingUrl ?? _stringOrNull(bookingPromo?['bookingUrl']),
      ),
    );
  }

  final routeId = _stringOrNull(raw['routeId']);
  if (routeId != null) {
    final routePointCount = _intOrNull(raw['routePointCount']) ??
        (raw['routePoints'] is List ? (raw['routePoints'] as List).length : 0);
    attachments.add(
      _AttachmentDetail(
        kindLabel: 'Маршрут',
        title: 'Маршрут вечера',
        subtitle: routePointCount > 0
            ? '$routePointCount точки на вечер'
            : 'Готовый маршрут встречи',
        icon: LucideIcons.route,
        foreground: DateasyColors.lilac,
        iconColor: DateasyColors.lilac,
        actionLabel: 'Открыть',
        route: '/routes/${Uri.encodeComponent(routeId)}',
      ),
    );
  }

  return attachments;
}

List<String> _detailTags(BackendCardItem meeting) {
  final raw = meeting.raw;
  final tags = <String>[];
  for (final key in ['vibe', 'lifestyle', 'category', 'priceMode']) {
    final value = _stringOrNull(raw[key]);
    if (value != null && !tags.contains(value)) {
      tags.add(value);
    }
  }
  if (raw['requiresVerification'] == true) {
    tags.add('только verified');
  }
  if (raw['requiresFrendlyPlus'] == true) {
    tags.add('Frendly+');
  }
  return tags.take(5).toList(growable: false);
}

String _detailDescription(BackendCardItem meeting) {
  return _stringOrNull(meeting.raw['description']) ??
      meeting.subtitle ??
      _stringOrNull(meeting.raw['hostNote']) ??
      'Описание появится, когда backend отдаст подробности встречи';
}

String _locationTitle(BackendCardItem meeting) {
  return _stringOrNull(meeting.raw['place']) ??
      _stringOrNull(meeting.raw['address']) ??
      meeting.city ??
      meeting.subtitle ??
      'Место встречи';
}

bool _hasLocation(BackendCardItem meeting) {
  return _stringOrNull(meeting.raw['place']) != null ||
      _stringOrNull(meeting.raw['address']) != null ||
      meeting.latitude != null ||
      meeting.longitude != null;
}

String? _peopleCountLabel(Map<String, Object?> raw) {
  final going = _intOrNull(raw['going'] ?? raw['participantCount']);
  final capacity = _intOrNull(raw['capacity']);
  if (going == null && capacity == null) {
    return null;
  }
  if (going != null && capacity != null) {
    return '$going/$capacity';
  }
  if (going != null) {
    return '$going идут';
  }
  return 'до $capacity';
}

String? _ticketSubtitle(Map<String, Object?> raw) {
  final price = _intOrNull(raw['ticketPriceFrom']);
  final provider = _stringOrNull(raw['ticketProvider']);
  final parts = [
    if (price != null && price > 0) 'от $price ₽',
    if (provider != null) provider,
  ];
  return parts.isEmpty ? null : parts.join(' · ');
}

String? _bookingSubtitle(Map<String, Object?> raw) {
  final averageCheck = _intOrNull(raw['bookingAverageCheck']);
  final provider = _stringOrNull(raw['bookingProvider']);
  final parts = [
    if (averageCheck != null && averageCheck > 0) 'средний чек $averageCheck ₽',
    if (provider != null) provider,
  ];
  return parts.isEmpty ? null : parts.join(' · ');
}

Map? _firstBookingPromo(Map<String, Object?> raw) {
  final promos = raw['bookingPromos'];
  if (promos is List && promos.isNotEmpty && promos.first is Map) {
    return promos.first as Map;
  }
  return null;
}

Future<void> _openAttachment(
  BuildContext context,
  _AttachmentDetail attachment,
) async {
  if (attachment.route != null) {
    context.go(attachment.route!);
    return;
  }
  final url = attachment.actionUrl;
  if (url == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${attachment.kindLabel} пока без ссылки')),
    );
    return;
  }
  final parsed = Uri.tryParse(url);
  if (parsed == null || !parsed.hasScheme) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Не удалось открыть ссылку')),
    );
    return;
  }
  final opened = await launchUrl(parsed, mode: LaunchMode.externalApplication);
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Не удалось открыть ссылку')),
    );
  }
}

String _string(Object? value) => value?.toString() ?? '';

String? _stringOrNull(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

String? _rawLower(Map<String, Object?> raw, String key) {
  return _stringOrNull(raw[key])?.toLowerCase();
}

String? _firstRawLower(Map<String, Object?> raw, List<String> keys) {
  for (final key in keys) {
    final value = _rawLower(raw, key);
    if (value != null) {
      return value;
    }
  }
  return null;
}

int? _intOrNull(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.round();
  }
  return int.tryParse(value?.toString() ?? '');
}

double? _doubleOrNull(Object? value) {
  if (value is double) {
    return value;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value?.toString() ?? '');
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
