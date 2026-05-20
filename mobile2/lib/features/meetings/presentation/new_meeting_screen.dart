import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class NewMeetingScreen extends StatefulWidget {
  const NewMeetingScreen({
    super.key,
    this.editEventId,
    this.afficheEventId,
    this.inviteeUserId,
    this.sourceChatId,
    this.communityId,
    this.routeId,
  });

  final String? editEventId;
  final String? afficheEventId;
  final String? inviteeUserId;
  final String? sourceChatId;
  final String? communityId;
  final String? routeId;

  @override
  State<NewMeetingScreen> createState() => _NewMeetingScreenState();
}

class _NewMeetingScreenState extends State<NewMeetingScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _dateController = TextEditingController();
  final _timeController = TextEditingController();
  final _imagePicker = ImagePicker();

  String _vibe = 'Кофе';
  String _place = '';
  String _address = '';
  String? _coverPath;
  int _capacity = 6;
  String _gender = 'any';
  bool _verifiedOnly = false;
  bool _plusOnly = false;
  String _visibility = 'public';
  bool _boost = false;
  _AttachItem? _attached;
  bool _publishing = false;
  bool _loadingInitialHostEvent = false;
  bool _loadingInitialAffiche = false;
  bool _loadingInitialRoute = false;
  final _createIdempotency = NewMeetingCreateIdempotency();

  bool get _isEditing => widget.editEventId?.trim().isNotEmpty == true;

  @override
  void initState() {
    super.initState();
    final editEventId = widget.editEventId?.trim();
    if (editEventId != null && editEventId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          unawaited(_loadInitialHostEvent(editEventId));
        }
      });
      return;
    }
    final eventId = widget.afficheEventId?.trim();
    if (eventId != null && eventId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          unawaited(_loadInitialAffiche(eventId));
        }
      });
      return;
    }
    final routeId = widget.routeId?.trim();
    if (routeId != null && routeId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          unawaited(_loadInitialRoute(routeId));
        }
      });
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _dateController.dispose();
    _timeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 168,
            ),
            children: [
              _Header(onBack: () => context.go('/meetings')),
              const SizedBox(height: 20),
              _CoverPicker(
                coverPath: _coverPath,
                onPick: _pickCover,
              ),
              const SizedBox(height: 20),
              _TitleBlock(
                titleController: _titleController,
                descriptionController: _descriptionController,
              ),
              const SizedBox(height: 22),
              _VibePills(
                active: _vibe,
                onChanged: (value) => setState(() => _vibe = value),
              ),
              const SizedBox(height: 18),
              _FieldsBlock(
                dateController: _dateController,
                timeController: _timeController,
                place: _place,
                address: _address,
                capacity: _capacity,
                onDate: _pickDate,
                onTime: _pickTime,
                onPlace: () => _openSheet(_SheetKind.place),
                onMinus: () => setState(() {
                  _capacity = (_capacity - 1).clamp(2, 50);
                }),
                onPlus: () => setState(() {
                  _capacity = (_capacity + 1).clamp(2, 50);
                }),
              ),
              const SizedBox(height: 22),
              _AttachBlock(
                attached: _attached,
                loading: _loadingInitialHostEvent ||
                    _loadingInitialAffiche ||
                    _loadingInitialRoute,
                onOpen: _openSheet,
                onClear: () => setState(() => _attached = null),
              ),
              const SizedBox(height: 22),
              _AudienceBlock(
                gender: _gender,
                verifiedOnly: _verifiedOnly,
                plusOnly: _plusOnly,
                onGender: (value) => setState(() => _gender = value),
                onVerified: () {
                  if (!_verifiedOnly) {
                    _showNotice('Сначала пройди верификацию');
                    return;
                  }
                  setState(() => _verifiedOnly = false);
                },
                onPlus: () {
                  if (!_plusOnly) {
                    _showNotice('Frendly+ доступен только подписчикам');
                    return;
                  }
                  setState(() => _plusOnly = false);
                },
              ),
              const SizedBox(height: 22),
              _VisibilityBlock(
                visibility: _visibility,
                onChanged: (value) => setState(() => _visibility = value),
              ),
              const SizedBox(height: 20),
              _BoostCard(
                active: _boost,
                onTap: () => setState(() => _boost = !_boost),
              ),
              const SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  children: [
                    _GradientButton(
                      label: _publishing
                          ? 'Публикуем'
                          : _isEditing
                              ? 'Сохранить изменения'
                              : 'Опубликовать встречу${_boost ? ' · −50 FT' : ''}',
                      onTap: _publishing ? null : _publishMeeting,
                    ),
                    const SizedBox(height: 10),
                    Consumer(
                      builder: (context, ref, _) {
                        final balance = ref
                                .watch(tokenWalletProvider)
                                .valueOrNull
                                ?.balance ??
                            0;
                        return Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(text: 'Баланс: $balance FT · '),
                              const TextSpan(
                                text: 'пополнить',
                                style: TextStyle(color: DateasyColors.lime),
                              ),
                            ],
                          ),
                          textAlign: TextAlign.center,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DateasyColors.muted,
                                    fontSize: 11,
                                  ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }

  Future<void> _loadInitialHostEvent(String eventId) async {
    setState(() => _loadingInitialHostEvent = true);
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final event = await container
          .read(meetingActionsProvider)
          .fetchHostedEvent(eventId);
      if (!mounted) {
        return;
      }
      setState(() {
        _applyHostedEvent(event);
        _loadingInitialHostEvent = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _loadingInitialHostEvent = false);
      _showNotice('Не удалось загрузить встречу');
    }
  }

  void _applyHostedEvent(BackendCardItem event) {
    _titleController.text = event.title;
    _descriptionController.text = event.subtitle ?? '';
    final startsAt = event.startsAt;
    if (startsAt != null) {
      _dateController.text = _formatDateInput(startsAt);
      _timeController.text = _formatTimeInput(startsAt);
    }

    _place = _stringValue(event.raw['place']);
    _address = _stringValue(event.raw['address']);
    if (_place.isEmpty && event.city?.isNotEmpty == true) {
      _place = event.city!;
    }

    final capacity = _intValue(event.raw['capacity']);
    if (capacity != null) {
      _capacity = capacity.clamp(2, 50);
    }

    final genderMode = _stringValue(event.raw['genderMode']);
    _gender = switch (genderMode) {
      'male' => 'male',
      'female' => 'female',
      _ => 'any',
    };

    final visibilityMode = _stringValue(
      event.raw['visibilityMode'] ?? event.raw['visibility'],
    );
    _visibility = visibilityMode == 'public' || visibilityMode.isEmpty
        ? 'public'
        : 'link';
    _attached = null;
  }

  Future<void> _loadInitialAffiche(String eventId) async {
    setState(() => _loadingInitialAffiche = true);
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final event = await container.read(posterDetailProvider(eventId).future);
      if (!mounted) {
        return;
      }
      setState(() {
        _applyAfficheEvent(event);
        _loadingInitialAffiche = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _loadingInitialAffiche = false);
      _showNotice('Не удалось загрузить афишу');
    }
  }

  void _applyAfficheEvent(BackendCardItem event) {
    final draft = buildNewMeetingAffichePrefill(event);

    _attached = _AttachItem(
      id: draft.id,
      kind: _SheetKind.afisha,
      title: draft.attachedTitle,
      sub: draft.attachedSubtitle,
      icon: LucideIcons.ticket,
    );
    if (draft.title.isNotEmpty && _titleController.text.trim().isEmpty) {
      _titleController.text = draft.title;
    }
    if (draft.description.isNotEmpty &&
        _descriptionController.text.trim().isEmpty) {
      _descriptionController.text = draft.description;
    }
    if (draft.dateInput.isNotEmpty && _dateController.text.trim().isEmpty) {
      _dateController.text = draft.dateInput;
    }
    if (draft.timeInput.isNotEmpty && _timeController.text.trim().isEmpty) {
      _timeController.text = draft.timeInput;
    }
    if (draft.place.isNotEmpty && _place.trim().isEmpty) {
      _place = draft.place;
    }
    if (draft.address.isNotEmpty && _address.trim().isEmpty) {
      _address = draft.address;
    }
  }

  Future<void> _loadInitialRoute(String routeId) async {
    setState(() => _loadingInitialRoute = true);
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final route = await container.read(routeDetailProvider(routeId).future);
      if (!mounted) {
        return;
      }
      setState(() {
        _applyRouteTemplate(route);
        _loadingInitialRoute = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _loadingInitialRoute = false);
      _showNotice('Не удалось загрузить маршрут');
    }
  }

  void _applyRouteTemplate(BackendCardItem route) {
    final draft = buildNewMeetingRoutePrefill(route);
    final item = _AttachItem(
      id: draft.id,
      kind: _SheetKind.route,
      title: draft.attachedTitle,
      sub: draft.attachedSubtitle,
      icon: LucideIcons.route,
      description: draft.description,
      place: draft.place,
      address: draft.address,
    );

    _attached = item;
    _applyAttachedItem(item);
  }

  Future<void> _openSheet(_SheetKind kind) async {
    final item = await showModalBottomSheet<_AttachItem>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: DateasyColors.background.withValues(alpha: 0.78),
      builder: (context) => _AttachSheet(kind: kind),
    );

    if (item == null || !mounted) return;

    setState(() {
      if (kind == _SheetKind.place) {
        _place = item.title;
        _address = item.sub.split(' · ').first;
      } else {
        _attached = item;
        _applyAttachedItem(item);
      }
    });
  }

  Future<void> _pickCover() async {
    final picked = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 90,
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() => _coverPath = picked.path);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_dateController.text.trim()) ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: current.isBefore(now) ? now : current,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: DateasyTheme.theme,
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() => _dateController.text = _formatDateInput(picked));
  }

  Future<void> _pickTime() async {
    final currentParts = _timeController.text.trim().split(':');
    final initial = currentParts.length == 2
        ? TimeOfDay(
            hour: int.tryParse(currentParts[0])?.clamp(0, 23) ?? 19,
            minute: int.tryParse(currentParts[1])?.clamp(0, 59) ?? 0,
          )
        : const TimeOfDay(hour: 19, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        return Theme(
          data: DateasyTheme.theme,
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      _timeController.text =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    });
  }

  void _applyAttachedItem(_AttachItem item) {
    if (_titleController.text.trim().isEmpty) {
      _titleController.text = switch (item.kind) {
        _SheetKind.afisha => 'Идем на ${item.title}',
        _SheetKind.promo => 'Встречаемся в ${item.place ?? item.title}',
        _SheetKind.route => item.title,
        _SheetKind.place => _titleController.text,
      };
    }
    if (_descriptionController.text.trim().isEmpty) {
      final description = item.description;
      if (description != null && description.trim().isNotEmpty) {
        _descriptionController.text = description.trim();
      }
    }
    final startsAt = item.startsAt ?? _defaultMeetingStart();
    if (_dateController.text.trim().isEmpty) {
      _dateController.text = _formatDateInput(startsAt);
    }
    if (_timeController.text.trim().isEmpty) {
      _timeController.text = _formatTimeInput(startsAt);
    }
    final place = item.place ?? item.title;
    if (place.trim().isNotEmpty && _place.trim().isEmpty) {
      _place = place.trim();
    }
    final address = item.address;
    if (address != null &&
        address.trim().isNotEmpty &&
        _address.trim().isEmpty) {
      _address = address.trim();
    }
  }

  void _showNotice(String message) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _publishMeeting() async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();
    final place = _place.trim();
    final startsAt = _parseStartsAt();

    final validation = validateNewMeetingDraft(
      title: title,
      description: description,
      place: place,
      startsAt: startsAt,
    );
    if (validation != NewMeetingDraftValidation.valid) {
      _showNotice(validation.message);
      return;
    }

    setState(() => _publishing = true);
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final payload = {
        ...buildNewMeetingBasePayload(
          title: title,
          description: description,
          vibe: _vibe,
          place: place,
          address: _address,
          startsAt: startsAt!,
          capacity: _capacity,
          gender: _gender,
          visibility: _visibility,
        ),
        if (_attached?.kind == _SheetKind.afisha && _attached?.id != null)
          'afficheEventId': _attached?.id,
        ...buildNewMeetingSourcePayload(
          inviteeUserId: widget.inviteeUserId,
          sourceChatId: widget.sourceChatId,
          communityId: widget.communityId,
          routeId: widget.routeId,
          attachedRouteId:
              _attached?.kind == _SheetKind.route ? _attached?.id : null,
        ),
        if (_attached?.kind == _SheetKind.promo &&
            _attached?.externalPlaceId != null)
          'externalPlaceId': _attached?.externalPlaceId,
        if (_attached?.kind == _SheetKind.place && _attached?.id != null)
          'externalPlaceId': _attached?.id,
      };
      final editEventId = widget.editEventId?.trim();
      final event = editEventId != null && editEventId.isNotEmpty
          ? await container.read(meetingActionsProvider).updateHostedEvent(
                eventId: editEventId,
                data: payload,
              )
          : await container.read(meetingActionsProvider).createEvent(
                idempotencyKey: _ensureCreateIdempotencyKey(),
                data: payload,
              );
      if (!mounted) {
        return;
      }
      context.go('/meetings/${event.id}');
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showNotice('Backend не создал встречу');
    } finally {
      if (mounted) {
        setState(() => _publishing = false);
      }
    }
  }

  DateTime? _parseStartsAt() {
    final date = _dateController.text.trim();
    final time = _timeController.text.trim();
    if (date.isEmpty || time.isEmpty) {
      return null;
    }
    return DateTime.tryParse('${date}T$time:00');
  }

  String _ensureCreateIdempotencyKey() {
    return _createIdempotency.currentKey();
  }
}

String _stringValue(Object? value) {
  return value is String ? value.trim() : '';
}

int? _intValue(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.round();
  }
  if (value is String) {
    return int.tryParse(value.trim());
  }
  return null;
}

Map<String, Object?> buildNewMeetingSourcePayload({
  String? inviteeUserId,
  String? sourceChatId,
  String? communityId,
  String? routeId,
  String? attachedRouteId,
}) {
  String? clean(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  final attachedRoute = clean(attachedRouteId);
  return {
    if (clean(inviteeUserId) case final value?) 'inviteeUserId': value,
    if (clean(sourceChatId) case final value?) 'sourceChatId': value,
    if (clean(communityId) case final value?) 'communityId': value,
    if (attachedRoute ?? clean(routeId) case final value?) 'routeId': value,
  };
}

Map<String, Object?> buildNewMeetingBasePayload({
  required String title,
  required String description,
  required String vibe,
  required String place,
  required String address,
  required DateTime startsAt,
  required int capacity,
  required String gender,
  required String visibility,
}) {
  final cleanAddress = address.trim();
  final privateVisibility = visibility == 'private' || visibility == 'link';
  return {
    'title': title,
    'description': description,
    'vibe': vibe,
    'place': [
      place,
      if (cleanAddress.isNotEmpty) cleanAddress,
    ].join(', '),
    'startsAt': startsAt.toIso8601String(),
    'capacity': capacity,
    'genderMode': gender == 'any' ? 'all' : gender,
    'visibility': privateVisibility ? 'private' : 'public',
    'accessMode': privateVisibility ? 'request' : 'open',
    'priceMode': 'free',
  };
}

enum NewMeetingDraftValidation {
  valid(''),
  missingRequired('Заполни название, описание и место'),
  invalidDateTime('Укажи дату и время в формате YYYY-MM-DD и HH:mm');

  const NewMeetingDraftValidation(this.message);

  final String message;
}

NewMeetingDraftValidation validateNewMeetingDraft({
  required String title,
  required String description,
  required String place,
  required DateTime? startsAt,
}) {
  if (title.isEmpty || description.isEmpty || place.isEmpty) {
    return NewMeetingDraftValidation.missingRequired;
  }
  if (startsAt == null) {
    return NewMeetingDraftValidation.invalidDateTime;
  }
  return NewMeetingDraftValidation.valid;
}

class NewMeetingRoutePrefill {
  const NewMeetingRoutePrefill({
    required this.id,
    required this.attachedTitle,
    required this.attachedSubtitle,
    required this.title,
    required this.description,
    required this.place,
    required this.address,
  });

  final String id;
  final String attachedTitle;
  final String attachedSubtitle;
  final String title;
  final String description;
  final String place;
  final String address;
}

class NewMeetingAffichePrefill {
  const NewMeetingAffichePrefill({
    required this.id,
    required this.attachedTitle,
    required this.attachedSubtitle,
    required this.title,
    required this.description,
    required this.dateInput,
    required this.timeInput,
    required this.place,
    required this.address,
  });

  final String id;
  final String attachedTitle;
  final String attachedSubtitle;
  final String title;
  final String description;
  final String dateInput;
  final String timeInput;
  final String place;
  final String address;
}

typedef NewMeetingTimerFactory = Timer Function(
  Duration delay,
  void Function() callback,
);

class NewMeetingPlaceSearchDebouncer extends ChangeNotifier {
  NewMeetingPlaceSearchDebouncer({
    this.delay = const Duration(milliseconds: 300),
    NewMeetingTimerFactory? timerFactory,
  }) : _timerFactory = timerFactory ?? Timer.new;

  final Duration delay;
  final NewMeetingTimerFactory _timerFactory;
  Timer? _timer;
  String _query = '';

  String get query => _query;

  void update(String value) {
    final nextQuery = value.trim();
    _timer?.cancel();
    _timer = _timerFactory(delay, () {
      if (_query == nextQuery) {
        return;
      }
      _query = nextQuery;
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

class NewMeetingCreateIdempotency {
  NewMeetingCreateIdempotency({
    int Function()? timestampFactory,
  }) : _timestampFactory =
            timestampFactory ?? (() => DateTime.now().microsecondsSinceEpoch);

  final int Function() _timestampFactory;
  String? _key;

  String currentKey() {
    return _key ??= 'mobile2-${_timestampFactory()}';
  }
}

NewMeetingAffichePrefill buildNewMeetingAffichePrefill(
  BackendCardItem event,
) {
  final title = event.title.trim();
  final startsAt = event.startsAt?.toLocal();
  final place = _affichePlace(event);
  final address = _afficheAddress(event);

  return NewMeetingAffichePrefill(
    id: event.id,
    attachedTitle: title.isEmpty ? 'Афиша' : title,
    attachedSubtitle: [
      _formatAttachDate(startsAt),
      place.isEmpty ? null : place,
    ].whereType<String>().where((part) => part.isNotEmpty).join(' · '),
    title: title.isEmpty ? '' : 'Идем на $title',
    description: _afficheDescription(event),
    dateInput: startsAt == null ? '' : _formatDateInput(startsAt),
    timeInput: startsAt == null ? '' : _formatTimeInput(startsAt),
    place: place,
    address: address,
  );
}

NewMeetingRoutePrefill buildNewMeetingRoutePrefill(BackendCardItem route) {
  final title = route.title.trim().isEmpty ? 'Маршрут' : route.title.trim();
  final raw = route.raw;
  final attachedSubtitle = [
    raw['area']?.toString(),
    raw['durationLabel']?.toString(),
  ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' · ');

  return NewMeetingRoutePrefill(
    id: route.id,
    attachedTitle: title,
    attachedSubtitle: attachedSubtitle,
    title: title,
    description: _rawString(raw, const ['blurb', 'description']) ??
        'Маршрут для встречи',
    place: title,
    address: route.subtitle ?? route.city ?? '',
  );
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _GlassIconButton(icon: LucideIcons.arrowLeft, onTap: onBack),
          const Spacer(),
          Text(
            'Новая встреча',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontFamily: 'Sora',
                  fontSize: 18,
                ),
          ),
          const Spacer(),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: dateasyLimeGradient,
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55BEFF67),
                  blurRadius: 24,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.sparkles,
              color: DateasyColors.backgroundDeep,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }
}

class _CoverPicker extends StatelessWidget {
  const _CoverPicker({
    required this.coverPath,
    required this.onPick,
  });

  final String? coverPath;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: onPick,
        child: Container(
          height: 176,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            color: DateasyColors.surface.withValues(alpha: 0.58),
            border: Border.all(color: DateasyColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Positioned.fill(
                child: coverPath == null
                    ? DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              DateasyColors.lime.withValues(alpha: 0.18),
                              DateasyColors.pink.withValues(alpha: 0.08),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      )
                    : Image.file(
                        File(coverPath!),
                        fit: BoxFit.cover,
                      ),
              ),
              if (coverPath != null)
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Color(0xAA15082C),
                          Color(0x0015082C),
                        ],
                      ),
                    ),
                  ),
                ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      LucideIcons.image,
                      size: 28,
                      color: DateasyColors.muted,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      coverPath == null
                          ? 'Добавить обложку'
                          : 'Сменить обложку',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
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

class _TitleBlock extends StatelessWidget {
  const _TitleBlock({
    required this.titleController,
    required this.descriptionController,
  });

  final TextEditingController titleController;
  final TextEditingController descriptionController;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          TextField(
            controller: titleController,
            maxLines: 2,
            minLines: 1,
            decoration: const InputDecoration(
              border: InputBorder.none,
              hintText: 'Название встречи',
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontFamily: 'Sora',
                  fontSize: 26,
                  height: 1.1,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: descriptionController,
            maxLines: 2,
            decoration: const InputDecoration(
              border: InputBorder.none,
              hintText: 'Короткое описание',
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
        ],
      ),
    );
  }
}

class _VibePills extends StatelessWidget {
  const _VibePills({required this.active, required this.onChanged});

  final String active;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel('Категория'),
        const SizedBox(height: 10),
        SizedBox(
          height: 40,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemBuilder: (context, index) {
              final item = _vibes[index];
              final selected = item.label == active;
              return GestureDetector(
                onTap: () => onChanged(item.label),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    gradient: selected ? dateasyLimeGradient : null,
                    color: selected
                        ? null
                        : DateasyColors.surface.withValues(alpha: 0.7),
                    border: Border.all(
                      color:
                          selected ? Colors.transparent : DateasyColors.border,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        item.icon,
                        size: 16,
                        color: selected
                            ? DateasyColors.backgroundDeep
                            : DateasyColors.foreground,
                      ),
                      const SizedBox(width: 7),
                      Text(
                        item.label,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: selected
                                  ? DateasyColors.backgroundDeep
                                  : DateasyColors.foreground,
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                    ],
                  ),
                ),
              );
            },
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemCount: _vibes.length,
          ),
        ),
      ],
    );
  }
}

class _FieldsBlock extends StatelessWidget {
  const _FieldsBlock({
    required this.dateController,
    required this.timeController,
    required this.place,
    required this.address,
    required this.capacity,
    required this.onDate,
    required this.onTime,
    required this.onPlace,
    required this.onMinus,
    required this.onPlus,
  });

  final TextEditingController dateController;
  final TextEditingController timeController;
  final String place;
  final String address;
  final int capacity;
  final VoidCallback onDate;
  final VoidCallback onTime;
  final VoidCallback onPlace;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          _GlassCard(
            child: Row(
              children: [
                const _FieldIcon(LucideIcons.calendar),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _TinyLabel('Когда'),
                      const SizedBox(height: 7),
                      Row(
                        children: [
                          Expanded(
                            child: _SmallField(
                              controller: dateController,
                              onTap: onDate,
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            width: 86,
                            child: _SmallField(
                              controller: timeController,
                              onTap: onTime,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: onPlace,
            child: _GlassCard(
              child: Row(
                children: [
                  const _FieldIcon(LucideIcons.mapPin),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _TinyLabel('Где'),
                        const SizedBox(height: 4),
                        Text(
                          place.isEmpty ? 'Выбери место' : place,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        Text(
                          address.isEmpty
                              ? 'Адрес появится после выбора'
                              : address,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  const _GhostPill('Сменить'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          _GlassCard(
            child: Row(
              children: [
                const _FieldIcon(LucideIcons.users),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _TinyLabel('Сколько людей'),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _RoundCounterButton(label: '−', onTap: onMinus),
                          SizedBox(
                            width: 58,
                            child: Text(
                              'до $capacity',
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                          _RoundCounterButton(label: '+', onTap: onPlus),
                        ],
                      ),
                    ],
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

class _AttachBlock extends StatelessWidget {
  const _AttachBlock({
    required this.attached,
    required this.loading,
    required this.onOpen,
    required this.onClear,
  });

  final _AttachItem? attached;
  final bool loading;
  final ValueChanged<_SheetKind> onOpen;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel('Прикрепить'),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(
                child: _AttachButton(
                  icon: LucideIcons.ticket,
                  label: 'Афиша',
                  active: attached?.kind == _SheetKind.afisha,
                  onTap: () => onOpen(_SheetKind.afisha),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _AttachButton(
                  icon: LucideIcons.percent,
                  label: 'Промо',
                  active: attached?.kind == _SheetKind.promo,
                  onTap: () => onOpen(_SheetKind.promo),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _AttachButton(
                  icon: LucideIcons.route,
                  label: 'Маршрут',
                  active: attached?.kind == _SheetKind.route,
                  onTap: () => onOpen(_SheetKind.route),
                ),
              ),
            ],
          ),
        ),
        if (loading) ...[
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _GlassCard(
              child: Row(
                children: [
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: DateasyColors.lime,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Загружаю афишу',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (attached != null) ...[
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _GlassCard(
              borderColor: DateasyColors.lime.withValues(alpha: 0.35),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      gradient: dateasyLimeGradient,
                    ),
                    child: Icon(
                      attached!.icon,
                      size: 18,
                      color: DateasyColors.backgroundDeep,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          attached!.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        Text(
                          attached!.sub,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: onClear,
                    icon: const Icon(LucideIcons.x, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _AudienceBlock extends StatelessWidget {
  const _AudienceBlock({
    required this.gender,
    required this.verifiedOnly,
    required this.plusOnly,
    required this.onGender,
    required this.onVerified,
    required this.onPlus,
  });

  final String gender;
  final bool verifiedOnly;
  final bool plusOnly;
  final ValueChanged<String> onGender;
  final VoidCallback onVerified;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel('Кому доступно'),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _Segmented(
            value: gender,
            items: const [
              _SegmentItem('any', 'Любой', null),
              _SegmentItem('m', 'Парни', null),
              _SegmentItem('f', 'Девушки', null),
            ],
            onChanged: onGender,
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              _ToggleRow(
                icon: LucideIcons.shieldCheck,
                title: 'Только верифицированные',
                subtitle: 'Прошли проверку Frendly',
                value: verifiedOnly,
                onTap: onVerified,
              ),
              const SizedBox(height: 8),
              _ToggleRow(
                icon: LucideIcons.crown,
                title: 'Только Frendly+',
                subtitle: 'Подписчики премиум',
                value: plusOnly,
                onTap: onPlus,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _VisibilityBlock extends StatelessWidget {
  const _VisibilityBlock({
    required this.visibility,
    required this.onChanged,
  });

  final String visibility;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel('Кто может видеть'),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _Segmented(
            value: visibility,
            items: const [
              _SegmentItem('public', 'Все рядом', LucideIcons.globe),
              _SegmentItem('link', 'По ссылке', LucideIcons.lock),
            ],
            onChanged: onChanged,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(21, 8, 21, 0),
          child: Text(
            visibility == 'public'
                ? 'Появится в радаре у людей рядом'
                : 'Видят только те, кому отправишь ссылку',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 11,
                ),
          ),
        ),
      ],
    );
  }
}

class _BoostCard extends StatelessWidget {
  const _BoostCard({required this.active, required this.onTap});

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: active ? dateasyPinkGradient : null,
            color:
                active ? null : DateasyColors.surface.withValues(alpha: 0.72),
            border: active ? null : Border.all(color: DateasyColors.border),
            boxShadow: active
                ? [
                    BoxShadow(
                      color: DateasyColors.pink.withValues(alpha: 0.22),
                      blurRadius: 28,
                      offset: const Offset(0, 14),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: active
                      ? DateasyColors.background.withValues(alpha: 0.24)
                      : DateasyColors.surface2,
                ),
                child: Icon(
                  LucideIcons.zap,
                  color: active ? DateasyColors.foreground : DateasyColors.pink,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Продвинуть встречу',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    Text(
                      'Топ радара · 24 часа',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: active
                                ? DateasyColors.foreground
                                    .withValues(alpha: 0.8)
                                : DateasyColors.muted,
                          ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: active
                      ? DateasyColors.background.withValues(alpha: 0.24)
                      : DateasyColors.foreground,
                ),
                child: Row(
                  children: [
                    Icon(
                      LucideIcons.coins,
                      size: 13,
                      color: active
                          ? DateasyColors.foreground
                          : DateasyColors.backgroundDeep,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '50 FT',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: active
                                ? DateasyColors.foreground
                                : DateasyColors.backgroundDeep,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                    ),
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

class _AttachSheet extends ConsumerStatefulWidget {
  const _AttachSheet({required this.kind});

  final _SheetKind kind;

  @override
  ConsumerState<_AttachSheet> createState() => _AttachSheetState();
}

class _AttachSheetState extends ConsumerState<_AttachSheet> {
  final _placeQueryController = TextEditingController();
  final _placeSearchDebouncer = NewMeetingPlaceSearchDebouncer();
  int? _afishaDayOffset;
  String _afishaCategory = 'Все';

  @override
  void initState() {
    super.initState();
    _placeSearchDebouncer.addListener(_onPlaceSearchChanged);
  }

  @override
  void dispose() {
    _placeSearchDebouncer.removeListener(_onPlaceSearchChanged);
    _placeSearchDebouncer.dispose();
    _placeQueryController.dispose();
    super.dispose();
  }

  void _onPlaceSearchChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.kind) {
      _SheetKind.afisha => 'Прикрепить из афиши',
      _SheetKind.promo => 'Промо · заведения со скидками',
      _SheetKind.route => 'Прикрепить маршрут',
      _SheetKind.place => 'Выбери место встречи',
    };
    final query = _placeSearchDebouncer.query;
    final listState = switch (widget.kind) {
      _SheetKind.afisha => ref.watch(
          postersQueryProvider(
            PostersQuery(
              limit: 20,
              date: _afishaDayOffset == null
                  ? null
                  : _dateQueryForOffset(_afishaDayOffset!),
              category: _afishaCategory == 'Все' ? null : _afishaCategory,
            ),
          ),
        ),
      _SheetKind.promo => ref.watch(perksProvider),
      _SheetKind.route => ref.watch(routeTemplatesProvider),
      _SheetKind.place => query.length < 2
          ? const AsyncValue<CardPage>.data(BackendPage(items: []))
          : ref.watch(placeSearchProvider(query)),
    };
    final items = listState.valueOrNull?.items ?? const <BackendCardItem>[];
    final attachItems = items.isEmpty && widget.kind == _SheetKind.promo
        ? _fallbackPromoItems
        : items.map((item) => _attachFromBackend(widget.kind, item)).toList();
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final bottomPadding = MediaQuery.paddingOf(context).bottom;
    final sheetMaxHeight = viewportHeight * 0.88;
    final listMaxHeight = viewportHeight * 0.66;

    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 430,
          maxHeight: sheetMaxHeight,
        ),
        child: Container(
          padding: EdgeInsets.fromLTRB(20, 10, 20, bottomPadding + 24),
          decoration: const BoxDecoration(
            color: DateasyColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            border: Border(top: BorderSide(color: DateasyColors.border)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 48,
                  height: 5,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    color: Colors.white.withValues(alpha: 0.16),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    _GlassIconButton(
                      icon: LucideIcons.x,
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (widget.kind == _SheetKind.afisha) ...[
                  _AfishaFilters(
                    dayOffset: _afishaDayOffset,
                    category: _afishaCategory,
                    onDayChanged: (value) => setState(() {
                      _afishaDayOffset = value;
                    }),
                    onCategoryChanged: (value) => setState(() {
                      _afishaCategory = value;
                    }),
                  ),
                  const SizedBox(height: 12),
                ],
                if (widget.kind == _SheetKind.place) ...[
                  _GlassCard(
                    child: TextField(
                      controller: _placeQueryController,
                      onChanged: _placeSearchDebouncer.update,
                      decoration: const InputDecoration(
                        hintText: 'Введите название или адрес',
                        border: InputBorder.none,
                      ),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                Flexible(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: listMaxHeight),
                    child: _SheetList(
                      listState: listState,
                      items: attachItems,
                      emptyText: _emptyText(widget.kind, query),
                      onTap: (item) => Navigator.of(context).pop(item),
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

  _AttachItem _attachFromBackend(_SheetKind kind, BackendCardItem item) {
    return _AttachItem(
      id: item.id,
      kind: kind,
      title: item.title.isEmpty ? 'Без названия' : item.title,
      sub: _attachSubtitle(kind, item),
      icon: switch (kind) {
        _SheetKind.afisha => LucideIcons.ticket,
        _SheetKind.promo => LucideIcons.percent,
        _SheetKind.route => LucideIcons.route,
        _SheetKind.place => LucideIcons.mapPin,
      },
      description: _attachDescription(kind, item),
      place: _attachPlace(kind, item),
      address: _attachAddress(kind, item),
      startsAt: item.startsAt,
      externalPlaceId: _attachExternalPlaceId(kind, item),
    );
  }

  String _attachSubtitle(_SheetKind kind, BackendCardItem item) {
    final raw = item.raw;
    return switch (kind) {
      _SheetKind.afisha => [
          _formatAttachDate(item.startsAt),
          item.subtitle ?? item.city,
        ].whereType<String>().where((part) => part.isNotEmpty).join(' · '),
      _SheetKind.promo => [
          item.subtitle,
          raw['validUntil'] == null ? null : 'до ${raw['validUntil']}',
        ].whereType<String>().where((part) => part.isNotEmpty).join(' · '),
      _SheetKind.route => [
          raw['area']?.toString(),
          raw['durationLabel']?.toString(),
        ].whereType<String>().where((part) => part.isNotEmpty).join(' · '),
      _SheetKind.place => [
          item.subtitle,
          item.city,
        ].whereType<String>().where((part) => part.isNotEmpty).join(' · '),
    };
  }

  String _emptyText(_SheetKind kind, String query) {
    if (kind == _SheetKind.place && query.length < 2) {
      return 'Введите минимум 2 символа';
    }
    return 'Backend вернул пустой список';
  }
}

String? _attachDescription(_SheetKind kind, BackendCardItem item) {
  final raw = item.raw;
  return switch (kind) {
    _SheetKind.afisha => _afficheDescription(item),
    _SheetKind.promo =>
      _rawString(raw, const ['description', 'shortSummary']) ?? item.subtitle,
    _SheetKind.route =>
      _rawString(raw, const ['blurb', 'description']) ?? 'Маршрут для встречи',
    _SheetKind.place => null,
  };
}

String? _attachPlace(_SheetKind kind, BackendCardItem item) {
  final raw = item.raw;
  return switch (kind) {
    _SheetKind.afisha => _affichePlace(item),
    _SheetKind.promo => _rawString(
          raw,
          const ['venueName', 'placeName', 'partnerName'],
        ) ??
        item.title,
    _SheetKind.route => item.title,
    _SheetKind.place => item.title,
  };
}

String? _attachAddress(_SheetKind kind, BackendCardItem item) {
  final raw = item.raw;
  return switch (kind) {
    _SheetKind.afisha => _afficheAddress(item),
    _SheetKind.promo =>
      _rawString(raw, const ['address', 'placeAddress']) ?? item.city,
    _SheetKind.route => item.subtitle ?? item.city,
    _SheetKind.place => item.subtitle ?? item.city,
  };
}

String? _attachExternalPlaceId(_SheetKind kind, BackendCardItem item) {
  if (kind != _SheetKind.promo) {
    return null;
  }
  return _rawString(item.raw, const ['placeId', 'externalPlaceId']);
}

class _SheetList extends StatelessWidget {
  const _SheetList({
    required this.listState,
    required this.items,
    required this.emptyText,
    required this.onTap,
  });

  final AsyncValue<CardPage> listState;
  final List<_AttachItem> items;
  final String emptyText;
  final ValueChanged<_AttachItem> onTap;

  @override
  Widget build(BuildContext context) {
    if (listState.isLoading && items.isEmpty) {
      return const _SheetStatus(text: 'Загружаем из backend');
    }
    if (listState.hasError && items.isEmpty) {
      return const _SheetStatus(text: 'Backend список недоступен');
    }
    if (items.isEmpty) {
      return _SheetStatus(text: emptyText);
    }

    return ListView.separated(
      padding: EdgeInsets.zero,
      shrinkWrap: true,
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        return GestureDetector(
          key: ValueKey('attach-${item.kind.name}-${item.id}'),
          onTap: () => onTap(item),
          child: _GlassCard(
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(15),
                    gradient: dateasyLimeGradient,
                  ),
                  child: Icon(
                    item.icon,
                    color: DateasyColors.backgroundDeep,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      Text(
                        item.sub,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                            ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  LucideIcons.plus,
                  size: 18,
                  color: DateasyColors.muted,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _AfishaFilters extends StatelessWidget {
  const _AfishaFilters({
    required this.dayOffset,
    required this.category,
    required this.onDayChanged,
    required this.onCategoryChanged,
  });

  final int? dayOffset;
  final String category;
  final ValueChanged<int?> onDayChanged;
  final ValueChanged<String> onCategoryChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 34,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 12,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (context, index) {
              final value = index == 0 ? null : index - 1;
              final selected = dayOffset == value;
              return _SheetChip(
                label: value == null ? 'Все' : _dayChipLabel(value),
                selected: selected,
                gradient: true,
                onTap: () => onDayChanged(value),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 34,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _afishaCategories.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (context, index) {
              final item = _afishaCategories[index];
              return _SheetChip(
                label: item,
                selected: category == item,
                gradient: false,
                onTap: () => onCategoryChanged(item),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SheetChip extends StatelessWidget {
  const _SheetChip({
    required this.label,
    required this.selected,
    required this.gradient,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool gradient;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: selected && gradient ? dateasyLimeGradient : null,
          color: selected && !gradient
              ? DateasyColors.foreground
              : selected
                  ? null
                  : DateasyColors.glass,
          border: selected ? null : Border.all(color: DateasyColors.border),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected
                    ? gradient
                        ? DateasyColors.backgroundDeep
                        : DateasyColors.background
                    : DateasyColors.foreground,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
        ),
      ),
    );
  }
}

class _SheetStatus extends StatelessWidget {
  const _SheetStatus({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
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

class _GradientButton extends StatelessWidget {
  const _GradientButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.55 : 1,
        child: Container(
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: dateasyLimeGradient,
            boxShadow: const [
              BoxShadow(
                color: Color(0x55BEFF67),
                blurRadius: 26,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: DateasyColors.backgroundDeep,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ),
    );
  }
}

class _AttachButton extends StatelessWidget {
  const _AttachButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 82,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: active ? dateasyLimeGradient : null,
          color: active ? null : DateasyColors.surface.withValues(alpha: 0.7),
          border: active ? null : Border.all(color: DateasyColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: active
                  ? DateasyColors.backgroundDeep
                  : DateasyColors.foreground,
              size: 22,
            ),
            const SizedBox(height: 7),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: active
                        ? DateasyColors.backgroundDeep
                        : DateasyColors.foreground,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassCard(
        child: Row(
          children: [
            _FieldIcon(icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 48,
              height: 28,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: value ? dateasyLimeGradient : null,
                color: value ? null : DateasyColors.surface2,
                border: value ? null : Border.all(color: DateasyColors.border),
              ),
              child: AnimatedAlign(
                duration: const Duration(milliseconds: 180),
                alignment: value ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: DateasyColors.background,
                  ),
                  child: value
                      ? const Icon(
                          LucideIcons.check,
                          size: 13,
                          color: DateasyColors.lime,
                        )
                      : null,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Segmented extends StatelessWidget {
  const _Segmented({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String value;
  final List<_SegmentItem> items;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: DateasyColors.surface.withValues(alpha: 0.7),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Row(
        children: items.map((item) {
          final selected = value == item.value;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(item.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: selected ? dateasyLimeGradient : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (item.icon != null) ...[
                      Icon(
                        item.icon,
                        size: 15,
                        color: selected
                            ? DateasyColors.backgroundDeep
                            : DateasyColors.muted,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Flexible(
                      child: Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: selected
                                  ? DateasyColors.backgroundDeep
                                  : DateasyColors.muted,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _SmallField extends StatelessWidget {
  const _SmallField({required this.controller, this.onTap});

  final TextEditingController controller;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      readOnly: onTap != null,
      onTap: onTap,
      decoration: InputDecoration(
        isDense: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        filled: true,
        fillColor: DateasyColors.surface2.withValues(alpha: 0.7),
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
          ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({
    required this.child,
    this.borderColor = DateasyColors.border,
  });

  final Widget child;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: DateasyColors.surface.withValues(alpha: 0.7),
        border: Border.all(color: borderColor),
      ),
      child: child,
    );
  }
}

class _FieldIcon extends StatelessWidget {
  const _FieldIcon(this.icon);

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: DateasyColors.surface2,
      ),
      child: Icon(icon, size: 20, color: DateasyColors.lime),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, size: 20, color: DateasyColors.foreground),
      ),
    );
  }
}

class _RoundCounterButton extends StatelessWidget {
  const _RoundCounterButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: DateasyColors.surface2,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w500,
              ),
        ),
      ),
    );
  }
}

class _GhostPill extends StatelessWidget {
  const _GhostPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: DateasyColors.surface2.withValues(alpha: 0.72),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
              fontSize: 11,
            ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
              fontSize: 11,
              letterSpacing: 1.2,
            ),
      ),
    );
  }
}

class _TinyLabel extends StatelessWidget {
  const _TinyLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: DateasyColors.muted,
            fontSize: 10,
            letterSpacing: 1.1,
          ),
    );
  }
}

class _VibeItem {
  const _VibeItem(this.label, this.icon);

  final String label;
  final IconData icon;
}

class _SegmentItem {
  const _SegmentItem(this.value, this.label, this.icon);

  final String value;
  final String label;
  final IconData? icon;
}

class _AttachItem {
  const _AttachItem({
    required this.kind,
    required this.title,
    required this.sub,
    required this.icon,
    this.id,
    this.description,
    this.place,
    this.address,
    this.startsAt,
    this.externalPlaceId,
  });

  final _SheetKind kind;
  final String title;
  final String sub;
  final IconData icon;
  final String? id;
  final String? description;
  final String? place;
  final String? address;
  final DateTime? startsAt;
  final String? externalPlaceId;
}

enum _SheetKind { afisha, promo, route, place }

const _fallbackPromoItems = [
  _AttachItem(
    id: 'fallback-promo-surf',
    kind: _SheetKind.promo,
    title: 'Surf Coffee',
    sub: '−15% по Frendly · Покровка 17',
    icon: LucideIcons.percent,
    description: '−15% по Frendly',
    place: 'Surf Coffee',
    address: 'Покровка 17',
  ),
  _AttachItem(
    id: 'fallback-promo-brew',
    kind: _SheetKind.promo,
    title: 'Brew Lab',
    sub: '−20% по Frendly · Патрики',
    icon: LucideIcons.percent,
    description: '−20% по Frendly',
    place: 'Brew Lab',
    address: 'Патрики',
  ),
];

String _formatAttachDate(DateTime? value) {
  if (value == null) {
    return 'Время уточняется';
  }
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.day}.${local.month} · $hour:$minute';
}

String _formatDateInput(DateTime value) {
  final local = value.toLocal();
  return '${local.year.toString().padLeft(4, '0')}-'
      '${local.month.toString().padLeft(2, '0')}-'
      '${local.day.toString().padLeft(2, '0')}';
}

String _formatTimeInput(DateTime value) {
  final local = value.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
}

DateTime _defaultMeetingStart() {
  final now = DateTime.now();
  final todayAtSeven = DateTime(now.year, now.month, now.day, 19);
  if (todayAtSeven.isAfter(now.add(const Duration(minutes: 30)))) {
    return todayAtSeven;
  }
  final tomorrow = now.add(const Duration(days: 1));
  return DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 19);
}

String? _rawString(Map<String, Object?> raw, List<String> keys) {
  for (final key in keys) {
    final value = raw[key]?.toString().trim();
    if (value != null && value.isNotEmpty) {
      return value;
    }
  }
  return null;
}

String _affichePlace(BackendCardItem event) {
  return _rawString(event.raw, const ['venue', 'venueName', 'placeName']) ??
      _nestedRawString(event.raw, 'place', const ['name', 'title']) ??
      event.subtitle ??
      '';
}

String _afficheAddress(BackendCardItem event) {
  return _rawString(event.raw, const ['address', 'locationAddress']) ??
      _nestedRawString(event.raw, 'place', const ['address']) ??
      event.city ??
      '';
}

String _afficheDescription(BackendCardItem event) {
  return _rawString(event.raw, const ['description', 'body', 'details']) ?? '';
}

String? _nestedRawString(
  Map<String, Object?> raw,
  String key,
  List<String> fields,
) {
  final nested = raw[key];
  if (nested is! Map) {
    return null;
  }
  return _rawString(
    nested.map((key, value) => MapEntry('$key', value)),
    fields,
  );
}

String _dateQueryForOffset(int offset) {
  final day = DateTime.now().add(Duration(days: offset));
  return '${day.year.toString().padLeft(4, '0')}-'
      '${day.month.toString().padLeft(2, '0')}-'
      '${day.day.toString().padLeft(2, '0')}';
}

String _dayChipLabel(int offset) {
  if (offset == 0) {
    return 'Сегодня';
  }
  if (offset == 1) {
    return 'Завтра';
  }
  final day = DateTime.now().add(Duration(days: offset));
  return '${_weekdays[day.weekday % 7]} ${day.day}';
}

const _weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const _afishaCategories = [
  'Все',
  'Музыка',
  'Бар',
  'Арт',
  'Стендап',
  'Спорт',
  'Кино'
];

const _vibes = [
  _VibeItem('Кофе', LucideIcons.coffee),
  _VibeItem('Музыка', LucideIcons.music2),
  _VibeItem('Спорт', LucideIcons.dumbbell),
  _VibeItem('Бар', LucideIcons.wine),
  _VibeItem('Арт', LucideIcons.palette),
  _VibeItem('Прогулка', LucideIcons.footprints),
  _VibeItem('Гастро', LucideIcons.pizza),
  _VibeItem('Кино', LucideIcons.film),
  _VibeItem('Книги', LucideIcons.bookOpen),
  _VibeItem('Фото', LucideIcons.camera),
  _VibeItem('Игры', LucideIcons.gamepad2),
  _VibeItem('Outdoor', LucideIcons.mountain),
  _VibeItem('Вело', LucideIcons.bike),
  _VibeItem('Свидание', LucideIcons.heart),
];
