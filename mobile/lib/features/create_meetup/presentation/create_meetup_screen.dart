import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/dating/presentation/dating_providers.dart';
import 'package:big_break_mobile/features/create_meetup/presentation/widgets/date_time_sheet.dart';
import 'package:big_break_mobile/features/create_meetup/presentation/widgets/partner_picker_sheet.dart';
import 'package:big_break_mobile/features/create_meetup/presentation/widgets/place_sheet.dart';
import 'package:big_break_mobile/features/posters/presentation/widgets/poster_picker_sheet.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' show Point;

const _createEmojis = [
  '🍷',
  '☕',
  '🎬',
  '♟️',
  '🌿',
  '🍝',
  '🎨',
  '🎶',
  '📚',
  '🏃'
];
const _createVibes = ['Спокойно', 'Шумно', 'Активно', 'Уютно', 'Свидание'];
const _dateIdeas = [
  ('wine', 'Винный бар', '🍷', 'Я оплачиваю бар или ужин'),
  ('coffee', 'Кофе plus прогулка', '☕', 'Быстро, легко, без долгого сетапа'),
  ('cinema', 'Кино plus разговор', '🎬', 'Сначала фильм, потом обсудить'),
];

enum CreateMeetupMode { meetup, dating, afterdark }

CreateMeetupMode parseCreateMeetupMode(String? raw) {
  switch (raw) {
    case 'dating':
      return CreateMeetupMode.dating;
    case 'afterdark':
      return CreateMeetupMode.afterdark;
    default:
      return CreateMeetupMode.meetup;
  }
}

class CreateMeetupScreen extends ConsumerStatefulWidget {
  const CreateMeetupScreen({
    super.key,
    this.inviteeUserId,
    this.posterId,
    this.communityId,
    this.initialMode = CreateMeetupMode.meetup,
  });

  final String? inviteeUserId;
  final String? posterId;
  final String? communityId;
  final CreateMeetupMode initialMode;

  @override
  ConsumerState<CreateMeetupScreen> createState() => _CreateMeetupScreenState();
}

class _CreateMeetupScreenState extends ConsumerState<CreateMeetupScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _placeController =
      TextEditingController(text: 'Brix Wine, Покровка 12');
  final _priceFromController = TextEditingController();
  final _priceToController = TextEditingController();
  late CreateMeetupMode _mode = widget.initialMode;
  String emoji = '🍷';
  String vibe = 'Спокойно';
  String visibility = 'public';
  String lifestyle = 'neutral';
  String priceMode = 'free';
  String accessMode = 'open';
  String genderMode = 'all';
  String priceFrom = '';
  String priceTo = '';
  String dateIdea = _dateIdeas.first.$1;
  bool unlimited = false;
  PlaceSelection placeSelection = const PlaceSelection(
    name: 'Brix Wine',
    address: 'Покровка 12',
    distance: '1.2 км',
    distanceKm: 1.2,
    emoji: '🍷',
  );
  PartnerVenue? _partnerVenue;
  double capacity = 8;
  DateTime startsAt = DateTime.now().add(const Duration(hours: 2));
  Poster? _poster;
  bool _creating = false;
  bool _loadingPoster = false;
  bool _resolvingPlace = false;
  String? _createIdempotencyKey;

  @override
  void initState() {
    super.initState();
    _applyModeDefaults(widget.initialMode);
    _loadInitialPoster();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _placeController.dispose();
    _priceFromController.dispose();
    _priceToController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialPoster() async {
    final posterId = widget.posterId;
    if (posterId == null || posterId.isEmpty) {
      return;
    }

    setState(() {
      _loadingPoster = true;
    });

    try {
      final poster = await ref.read(posterDetailProvider(posterId).future);
      if (!mounted) {
        return;
      }
      _applyPosterSelection(poster);
    } finally {
      if (mounted) {
        setState(() {
          _loadingPoster = false;
        });
      }
    }
  }

  void _applyModeDefaults(CreateMeetupMode mode) {
    if (mode == CreateMeetupMode.dating) {
      emoji = '💘';
      vibe = 'Свидание';
      visibility = 'friends';
      accessMode = 'request';
      priceMode = 'host_pays';
      capacity = 2;
      _titleController.text = 'Свидание на двоих';
      _descriptionController.text = '';
      placeSelection = const PlaceSelection(
        name: 'Tilda Bistro',
        address: 'Патриаршие, Спиридоньевский 10А',
        distance: '1.4 км',
        distanceKm: 1.4,
        emoji: '🍷',
      );
      _placeController.text = _placeLabel();
      return;
    }

    if (mode == CreateMeetupMode.afterdark) {
      emoji = '🖤';
      vibe = 'Шумно';
      accessMode = 'request';
      startsAt = DateTime.now().add(const Duration(hours: 5));
      placeSelection = const PlaceSelection(
        name: 'Адрес откроется позже',
        address: 'После подтверждения',
        distance: 'Закрытая локация',
        emoji: '🖤',
      );
      _placeController.text = _placeLabel();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final subscription = ref.watch(subscriptionStateProvider).valueOrNull;
    final afterDarkAccess = ref.watch(afterDarkAccessProvider).valueOrNull;
    final isPremium =
        subscription?.status == 'trial' || subscription?.status == 'active';
    final afterDarkUnlocked = afterDarkAccess?.unlocked ?? false;
    final isDatingMode = _mode == CreateMeetupMode.dating;
    final isAfterDarkMode = _mode == CreateMeetupMode.afterdark;
    final titleText = isDatingMode
        ? 'Новое свидание'
        : isAfterDarkMode
            ? 'After Dark'
            : 'Новая встреча';
    final publishText = isDatingMode
        ? 'Отправить приглашение'
        : isAfterDarkMode
            ? 'Создать 18+'
            : 'Создать';
    final canSubmit =
        !isDatingMode ? !isAfterDarkMode || afterDarkUnlocked : isPremium;

    return Scaffold(
      backgroundColor: isAfterDarkMode ? AppColors.adBg : colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color:
                        (isAfterDarkMode ? AppColors.adBorder : colors.border)
                            .withValues(alpha: 0.6),
                  ),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.chevron_left_rounded, size: 28),
                  ),
                  Expanded(
                    child: Text(
                      titleText,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  TextButton(
                    onPressed: _creating || !canSubmit ? null : _submitCreate,
                    child: Text(
                      _creating ? '...' : publishText,
                      style: AppTextStyles.meta.copyWith(
                        color: isAfterDarkMode
                            ? AppColors.adMagenta
                            : colors.primary,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                children: [
                  Container(
                    height: 44,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color:
                          isAfterDarkMode ? AppColors.adSurface : colors.muted,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _TopModeCell(
                            label: 'Встреча',
                            active: _mode == CreateMeetupMode.meetup,
                            onTap: () => setState(() {
                              _mode = CreateMeetupMode.meetup;
                              _applyModeDefaults(_mode);
                            }),
                          ),
                        ),
                        Expanded(
                          child: _TopModeCell(
                            label: 'Свидание',
                            active: _mode == CreateMeetupMode.dating,
                            onTap: () => setState(() {
                              _mode = CreateMeetupMode.dating;
                              _applyModeDefaults(_mode);
                            }),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color:
                          isAfterDarkMode ? AppColors.adSurface : colors.card,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isAfterDarkMode
                            ? AppColors.adBorder
                            : colors.border,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isAfterDarkMode
                                ? AppColors.adSurfaceElev
                                : colors.secondarySoft,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            isDatingMode
                                ? '💘'
                                : isAfterDarkMode
                                    ? '🖤'
                                    : '✨',
                            style: const TextStyle(fontSize: 20),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isDatingMode
                                    ? 'Frendly+ date flow'
                                    : isAfterDarkMode
                                        ? 'Frendly After Dark'
                                        : 'Обычный flow',
                                style: AppTextStyles.caption.copyWith(
                                  color: isAfterDarkMode
                                      ? AppColors.adFgMute
                                      : colors.inkMute,
                                  letterSpacing: 1,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isDatingMode
                                    ? 'Отдельный сценарий свидания'
                                    : isAfterDarkMode
                                        ? 'Закрытая 18+ встреча'
                                        : 'Встреча для людей рядом',
                                style: AppTextStyles.body.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: isAfterDarkMode
                                      ? AppColors.adFg
                                      : colors.foreground,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isDatingMode
                                    ? (isPremium
                                        ? '2 участника, приглашение в личный чат, отдельные правила оплаты.'
                                        : 'Режим свидания доступен только с Frendly+.')
                                    : isAfterDarkMode
                                        ? (afterDarkUnlocked
                                            ? 'Создание идет в закрытую 18+ ленту, с правилами plus consent.'
                                            : 'Сначала открой After Dark.')
                                        : 'Обычный публичный flow для встреч рядом.',
                                style: AppTextStyles.meta.copyWith(
                                  color: isAfterDarkMode
                                      ? AppColors.adFgSoft
                                      : colors.inkMute,
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Stack(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [colors.warmStart, colors.warmEnd],
                              ),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            alignment: Alignment.center,
                            child: Text(emoji,
                                style: const TextStyle(fontSize: 36)),
                          ),
                          Positioned(
                            right: -2,
                            bottom: -2,
                            child: Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                color: colors.foreground,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: colors.background,
                                  width: 2,
                                ),
                              ),
                              child: Icon(
                                Icons.image_outlined,
                                size: 12,
                                color: colors.primaryForeground,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TextField(
                              controller: _titleController,
                              maxLength: 60,
                              decoration: InputDecoration(
                                hintText: 'Название встречи',
                                counterText: '',
                                hintStyle: AppTextStyles.sectionTitle
                                    .copyWith(color: colors.inkMute),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.zero,
                              ),
                              style: AppTextStyles.sectionTitle,
                            ),
                            Text('Коротко и по-человечески',
                                style: AppTextStyles.meta),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SizedBox(
                    height: 44,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemBuilder: (context, index) {
                        final item = _createEmojis[index];
                        final active = emoji == item;
                        return InkWell(
                          onTap: () => setState(() => emoji = item),
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: active ? colors.foreground : colors.card,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                  color: active
                                      ? colors.foreground
                                      : colors.border),
                            ),
                            alignment: Alignment.center,
                            child: Text(item,
                                style: const TextStyle(fontSize: 22)),
                          ),
                        );
                      },
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: 6),
                      itemCount: _createEmojis.length,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _FieldCard(
                    label: 'Когда',
                    value: _formatStartsAt(startsAt),
                    icon: Icons.schedule_rounded,
                    onTap: () async {
                      final next = await showDateTimeSheet(
                        context,
                        initialValue: startsAt,
                      );
                      if (next != null && mounted) {
                        setState(() {
                          startsAt = next;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  _FieldCard(
                    label: 'Где',
                    value: _placeLabel(),
                    icon: Icons.place_outlined,
                    onTap: () async {
                      final next = await showPlaceSheet(
                        context,
                        initialValue: placeSelection,
                        onPickPoster: () async {
                          final poster = await showPosterPickerSheet(
                            context,
                            initialValue: _poster,
                          );
                          if (poster == null || !mounted) {
                            return;
                          }
                          _applyPosterSelection(poster);
                        },
                      );
                      if (next != null && mounted) {
                        setState(() {
                          placeSelection = next;
                          _placeController.text = _placeLabel();
                        });
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (_loadingPoster)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_poster != null)
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: colors.primarySoft,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              _poster!.emoji,
                              style: const TextStyle(fontSize: 24),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Идём на событие',
                                  style: AppTextStyles.caption.copyWith(
                                    color: colors.inkMute,
                                    letterSpacing: 1,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _poster!.title,
                                  style: AppTextStyles.body.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${_poster!.dateLabel} · ${_poster!.timeLabel}',
                                  style: AppTextStyles.meta.copyWith(
                                    color: colors.inkMute,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () async {
                              final poster = await showPosterPickerSheet(
                                context,
                                initialValue: _poster,
                              );
                              if (poster == null || !mounted) {
                                return;
                              }
                              _applyPosterSelection(poster);
                            },
                            child: const Text('Заменить'),
                          ),
                          IconButton(
                            onPressed: () => setState(() {
                              _poster = null;
                            }),
                            icon: Icon(Icons.close_rounded,
                                color: colors.inkMute),
                          ),
                        ],
                      ),
                    )
                  else
                    OutlinedButton(
                      onPressed: () async {
                        final poster = await showPosterPickerSheet(context);
                        if (poster == null || !mounted) {
                          return;
                        }
                        _applyPosterSelection(poster);
                      },
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        side: BorderSide(color: colors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: colors.primarySoft,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.center,
                            child: const Icon(
                              Icons.confirmation_number_outlined,
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Привязать к событию из афиши',
                                  style: AppTextStyles.body.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  'Концерт, матч, выставка, необязательно',
                                  style: AppTextStyles.meta.copyWith(
                                    color: colors.inkMute,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.chevron_right_rounded,
                              color: colors.inkMute),
                        ],
                      ),
                    ),
                  const SizedBox(height: AppSpacing.xs),
                  if (!isDatingMode)
                    _PartnerVenueField(
                      venue: _partnerVenue,
                      dark: isAfterDarkMode,
                      onOpen: () async {
                        final venue = await showPartnerPickerSheet(
                          context,
                          initialValue: _partnerVenue,
                          dark: isAfterDarkMode,
                        );
                        if (venue == null || !mounted) {
                          return;
                        }
                        setState(() {
                          _applyPartnerVenue(venue);
                        });
                      },
                      onClear: () => setState(() {
                        _partnerVenue = null;
                      }),
                    ),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: _resolvingPlace ? null : _fillPlaceFromLocation,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Row(
                        children: [
                          Text(
                            'Можно ввести адрес вручную',
                            style: AppTextStyles.caption,
                          ),
                          const Spacer(),
                          Text(
                            _resolvingPlace
                                ? 'Определяем...'
                                : 'или определить по геолокации',
                            style: AppTextStyles.caption.copyWith(
                              color: colors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (!isDatingMode)
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.groups_rounded,
                                size: 18,
                                color: colors.inkMute,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                  child: Text('Участников',
                                      style: AppTextStyles.body.copyWith(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w500))),
                              unlimited
                                  ? Icon(
                                      Icons.all_inclusive_rounded,
                                      color: colors.foreground,
                                      size: 20,
                                    )
                                  : Text('${capacity.round()}',
                                      style: AppTextStyles.cardTitle),
                            ],
                          ),
                          Slider(
                            value: isDatingMode ? 2 : capacity,
                            min: 2,
                            max: isDatingMode ? 2 : 20,
                            divisions: isDatingMode ? 1 : 18,
                            activeColor: colors.primary,
                            onChanged: unlimited || isDatingMode
                                ? null
                                : (value) => setState(() => capacity = value),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('2', style: AppTextStyles.caption),
                              Text(isDatingMode ? '2' : '20',
                                  style: AppTextStyles.caption),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          if (isDatingMode)
                            Text(
                              'Всегда только 2 участника, ты plus приглашенный человек.',
                              style: AppTextStyles.meta,
                            )
                          else
                            SizedBox(
                              width: double.infinity,
                              height: 40,
                              child: OutlinedButton.icon(
                                onPressed: () => setState(() {
                                  unlimited = !unlimited;
                                }),
                                icon: const Icon(
                                  Icons.all_inclusive_rounded,
                                  size: 18,
                                ),
                                label: const Text('Без ограничения'),
                                style: OutlinedButton.styleFrom(
                                  backgroundColor: unlimited
                                      ? colors.foreground
                                      : colors.background,
                                  foregroundColor: unlimited
                                      ? colors.primaryForeground
                                      : colors.inkSoft,
                                  side: BorderSide(
                                    color: unlimited
                                        ? colors.foreground
                                        : colors.border,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  if (!isDatingMode) const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.eco_outlined,
                              size: 18,
                              color: colors.inkMute,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text('Образ жизни',
                                style: AppTextStyles.body.copyWith(
                                    fontSize: 14, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            Expanded(
                              child: _SegmentCell(
                                label: 'ЗОЖ',
                                icon: Icons.eco_outlined,
                                active: lifestyle == 'zozh',
                                onTap: () => setState(() => lifestyle = 'zozh'),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: _SegmentCell(
                                label: 'Нейтрально',
                                active: lifestyle == 'neutral',
                                onTap: () =>
                                    setState(() => lifestyle = 'neutral'),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: _SegmentCell(
                                label: 'Не ЗОЖ',
                                icon: Icons.wine_bar_outlined,
                                active: lifestyle == 'anti',
                                onTap: () => setState(() => lifestyle = 'anti'),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          _lifestyleHint(),
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (!isDatingMode)
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.account_balance_wallet_outlined,
                                size: 18,
                                color: colors.inkMute,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Text('Стоимость',
                                  style: AppTextStyles.body.copyWith(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500)),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: (isDatingMode
                                    ? [
                                        ('host_pays', 'Я оплачиваю всё'),
                                        ('fifty_fifty', '50/50'),
                                      ]
                                    : [
                                        ('free', 'Бесплатно'),
                                        ('fixed', 'Фикс'),
                                        ('from', 'От'),
                                        ('upto', 'До'),
                                        ('range', 'От–До'),
                                        ('split', 'Скидываемся'),
                                      ])
                                .map(
                                  (item) => _PriceModeChip(
                                    label: item.$2,
                                    active: priceMode == item.$1,
                                    onTap: () => setState(() {
                                      priceMode = item.$1;
                                    }),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                          if (!isDatingMode &&
                              priceMode != 'free' &&
                              priceMode != 'split') ...[
                            const SizedBox(height: AppSpacing.sm),
                            Row(
                              children: [
                                if (priceMode == 'fixed' ||
                                    priceMode == 'from' ||
                                    priceMode == 'range')
                                  Expanded(
                                    child: _PriceInput(
                                      placeholder:
                                          priceMode == 'fixed' ? 'Сумма' : 'От',
                                      controller: _priceFromController,
                                      onChanged: (value) => setState(() {
                                        priceFrom = value;
                                      }),
                                    ),
                                  ),
                                if (priceMode == 'range') ...[
                                  const SizedBox(width: 8),
                                  Text('—', style: AppTextStyles.meta),
                                  const SizedBox(width: 8),
                                ],
                                if (priceMode == 'upto' || priceMode == 'range')
                                  Expanded(
                                    child: _PriceInput(
                                      placeholder: 'До',
                                      controller: _priceToController,
                                      onChanged: (value) => setState(() {
                                        priceTo = value;
                                      }),
                                    ),
                                  ),
                                const SizedBox(width: 8),
                                Text(
                                  '₽',
                                  style: AppTextStyles.body.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            _priceHint(isDatingMode),
                            style: AppTextStyles.meta.copyWith(
                              color: colors.inkMute,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (!isDatingMode) const SizedBox(height: AppSpacing.xs),
                  if (!isDatingMode)
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.person_outline_rounded,
                                size: 18,
                                color: colors.inkMute,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Text('Кого приглашаешь',
                                  style: AppTextStyles.body.copyWith(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500)),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              Expanded(
                                child: _SegmentCell(
                                  label: 'Все',
                                  active: genderMode == 'all',
                                  onTap: () =>
                                      setState(() => genderMode = 'all'),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _SegmentCell(
                                  label: 'Девушки',
                                  active: genderMode == 'female',
                                  onTap: () =>
                                      setState(() => genderMode = 'female'),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _SegmentCell(
                                  label: 'Парни',
                                  active: genderMode == 'male',
                                  onTap: () =>
                                      setState(() => genderMode = 'male'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: AppSpacing.xs),
                  if (isDatingMode)
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Сценарий свидания',
                            style: AppTextStyles.body.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ..._dateIdeas.map((idea) {
                            final active = dateIdea == idea.$1;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: InkWell(
                                onTap: () => setState(() {
                                  dateIdea = idea.$1;
                                  emoji = idea.$3;
                                  if (_titleController.text.trim().isEmpty ||
                                      _titleController.text ==
                                          'Свидание на двоих') {
                                    _titleController.text = idea.$2;
                                  }
                                }),
                                borderRadius: BorderRadius.circular(16),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: active
                                        ? colors.primarySoft
                                        : colors.background,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: active
                                          ? colors.primary
                                          : colors.border,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 44,
                                        height: 44,
                                        decoration: BoxDecoration(
                                          color: colors.card,
                                          borderRadius:
                                              BorderRadius.circular(14),
                                          border:
                                              Border.all(color: colors.border),
                                        ),
                                        alignment: Alignment.center,
                                        child: Text(
                                          idea.$3,
                                          style: const TextStyle(fontSize: 22),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              idea.$2,
                                              style:
                                                  AppTextStyles.body.copyWith(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              idea.$4,
                                              style:
                                                  AppTextStyles.meta.copyWith(
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
                            );
                          }),
                        ],
                      ),
                    ),
                  if (isDatingMode) const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              size: 18,
                              color: colors.inkMute,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text('Настроение',
                                style: AppTextStyles.body.copyWith(
                                    fontSize: 14, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _createVibes
                              .map(
                                (item) => InkWell(
                                  onTap: () => setState(() => vibe = item),
                                  borderRadius: BorderRadius.circular(999),
                                  child: Container(
                                    height: 36,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14),
                                    decoration: BoxDecoration(
                                      color: vibe == item
                                          ? colors.foreground
                                          : colors.background,
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                          color: vibe == item
                                              ? colors.foreground
                                              : colors.border),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      item,
                                      style: AppTextStyles.meta.copyWith(
                                        color: vibe == item
                                            ? colors.primaryForeground
                                            : colors.inkSoft,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Описание',
                            style: AppTextStyles.body.copyWith(
                                fontSize: 14, fontWeight: FontWeight.w500)),
                        const SizedBox(height: AppSpacing.xs),
                        TextField(
                          controller: _descriptionController,
                          maxLines: isAfterDarkMode ? 5 : 3,
                          maxLength: isAfterDarkMode ? 500 : 300,
                          decoration: InputDecoration(
                            hintText: isDatingMode
                                ? 'Как хочешь провести свидание, какой темп, что важно заранее.'
                                : isAfterDarkMode
                                    ? 'Опиши формат, рамки, dress code, правила plus важные условия.'
                                    : 'Что за встреча? Чего ждать?',
                            hintStyle: AppTextStyles.bodySoft
                                .copyWith(color: colors.inkMute),
                            border: InputBorder.none,
                            counterText: '',
                            contentPadding: EdgeInsets.zero,
                          ),
                          style: AppTextStyles.bodySoft,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      children: [
                        if (isDatingMode)
                          _VisibilityRow(
                            active: true,
                            icon: Icons.verified_user_outlined,
                            title: 'Личное приглашение',
                            subtitle:
                                'Свидание доступно только выбранному человеку',
                            onTap: () => setState(() => accessMode = 'request'),
                          )
                        else ...[
                          _VisibilityRow(
                            active: accessMode == 'open',
                            icon: Icons.door_front_door_outlined,
                            title: 'Открытое вступление',
                            subtitle: 'Любой может присоединиться сразу',
                            onTap: () => setState(() => accessMode = 'open'),
                          ),
                          _VisibilityRow(
                            active: accessMode == 'request',
                            icon: Icons.verified_user_outlined,
                            title: 'По заявке',
                            subtitle: 'Ты подтверждаешь каждого участника',
                            onTap: () => setState(() => accessMode = 'request'),
                          ),
                          _VisibilityRow(
                            active: accessMode == 'free',
                            icon: Icons.public_rounded,
                            title: 'Свободный приход',
                            subtitle: 'Без подтверждения, можно прийти и уйти',
                            onTap: () => setState(() => accessMode = 'free'),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      children: [
                        _VisibilityRow(
                          active: isDatingMode ? false : visibility == 'public',
                          icon: Icons.public_rounded,
                          title: isAfterDarkMode
                              ? 'Видна в After Dark'
                              : 'Видна всем',
                          subtitle: isDatingMode
                              ? 'Для свидания недоступно'
                              : isAfterDarkMode
                                  ? 'Появится только в закрытой ленте'
                                  : 'Появится в ленте рядом',
                          onTap: isDatingMode
                              ? null
                              : () => setState(() => visibility = 'public'),
                        ),
                        _VisibilityRow(
                          active: visibility == 'friends',
                          icon: Icons.lock_outline_rounded,
                          title: isDatingMode
                              ? 'Только приглашенному'
                              : 'По ссылке',
                          subtitle: isDatingMode
                              ? 'Эта встреча откроется только выбранному человеку'
                              : 'Только для тех, кому отправишь',
                          onTap: () => setState(() => visibility = 'friends'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SizedBox(
                    height: 56,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: isAfterDarkMode
                            ? AppColors.adMagenta
                            : colors.primary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18)),
                        elevation: 0,
                        shadowColor: colors.foreground.withValues(alpha: 0.12),
                      ),
                      onPressed: _creating || !canSubmit ? null : _submitCreate,
                      child: Text(
                        _creating
                            ? 'Публикуем...'
                            : isDatingMode
                                ? 'Отправить приглашение на date'
                                : isAfterDarkMode
                                    ? 'Создать After Dark событие'
                                    : 'Опубликовать встречу',
                        style: AppTextStyles.button.copyWith(
                          color: isAfterDarkMode
                              ? AppColors.adFg
                              : colors.primaryForeground,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Center(
                    child: Text(
                      isDatingMode
                          ? 'Чат откроется после взаимного интереса plus отправки приглашения'
                          : isAfterDarkMode
                              ? 'Правила plus safety блок будут показаны до входа'
                              : 'Чат откроется автоматически, как только кто-то присоединится',
                      style: AppTextStyles.meta,
                      textAlign: TextAlign.center,
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

  Future<void> _fillPlaceFromLocation() async {
    setState(() {
      _resolvingPlace = true;
    });

    try {
      final position = await _resolveCurrentPosition();
      if (position == null) {
        return;
      }

      final resolved = await ref.read(yandexMapServiceProvider).reverseGeocode(
            Point(
              latitude: position.latitude,
              longitude: position.longitude,
            ),
          );

      if (resolved == null) {
        final fallback =
            '${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}';
        placeSelection = PlaceSelection(
          name: 'Моё местоположение',
          address: fallback,
          distance: '0 м',
          distanceKm: 0,
          latitude: position.latitude,
          longitude: position.longitude,
          emoji: '📍',
        );
        _placeController.text = _placeLabel();
        return;
      }

      placeSelection = PlaceSelection(
        name: 'Моё местоположение',
        address: resolved.address,
        distance: '0 м',
        distanceKm: 0,
        latitude: position.latitude,
        longitude: position.longitude,
        emoji: '📍',
      );
      _placeController.text = _placeLabel();
    } finally {
      if (mounted) {
        setState(() {
          _resolvingPlace = false;
        });
      }
    }
  }

  Future<Position?> _resolveCurrentPosition() async {
    return ref.read(appLocationServiceProvider).getCurrentPosition();
  }

  Future<void> _submitCreate() async {
    if (_creating) {
      return;
    }

    final subscription = ref.read(subscriptionStateProvider).valueOrNull;
    final afterDarkAccess = ref.read(afterDarkAccessProvider).valueOrNull;
    final isDatingMode = _mode == CreateMeetupMode.dating;
    final isAfterDarkMode = _mode == CreateMeetupMode.afterdark;
    final isPremium =
        subscription?.status == 'trial' || subscription?.status == 'active';
    final afterDarkUnlocked = afterDarkAccess?.unlocked ?? false;

    if (isDatingMode && !isPremium) {
      if (!mounted) {
        return;
      }
      context.pushRoute(AppRoute.paywall);
      return;
    }

    if (isAfterDarkMode && !afterDarkUnlocked) {
      if (!mounted) {
        return;
      }
      context.pushRoute(AppRoute.afterDarkPaywall);
      return;
    }

    if (_titleController.text.trim().isEmpty) {
      _showSubmitError('Добавь название встречи.');
      return;
    }

    if (placeSelection.name.trim().isEmpty) {
      _showSubmitError('Выбери место встречи.');
      return;
    }

    setState(() {
      _creating = true;
    });

    try {
      final submitPlace = await _placeSelectionForSubmit();
      final event = await ref.read(backendRepositoryProvider).createEvent(
            title: _titleController.text.trim(),
            description: _descriptionController.text.trim(),
            emoji: emoji,
            vibe: vibe,
            place: _placeLabel(submitPlace),
            startsAt: startsAt,
            capacity: isDatingMode ? 2 : capacity.round(),
            distanceKm: submitPlace.distanceKm,
            latitude: submitPlace.latitude,
            longitude: submitPlace.longitude,
            mode: switch (_mode) {
              CreateMeetupMode.dating => 'dating',
              CreateMeetupMode.afterdark => 'afterdark',
              CreateMeetupMode.meetup => 'default',
            },
            lifestyle: lifestyle,
            priceMode: priceMode,
            priceAmountFrom: _priceAmountFrom(),
            priceAmountTo: _priceAmountTo(),
            accessMode:
                isDatingMode || isAfterDarkMode ? 'request' : accessMode,
            genderMode: genderMode,
            visibilityMode: isDatingMode ? 'friends' : visibility,
            joinMode: isDatingMode ||
                    isAfterDarkMode ||
                    visibility == 'friends' ||
                    accessMode == 'request'
                ? EventJoinMode.request
                : EventJoinMode.open,
            inviteeUserId: widget.inviteeUserId,
            posterId: _poster?.id,
            communityId: widget.communityId,
            afterDarkCategory: isAfterDarkMode ? 'dating' : null,
            afterDarkGlow: isAfterDarkMode ? 'magenta' : null,
            dressCode: isAfterDarkMode ? 'Black' : null,
            ageRange: isAfterDarkMode ? '25-36' : null,
            ratioLabel: isAfterDarkMode ? 'Balanced' : null,
            consentRequired: isAfterDarkMode,
            rules: isAfterDarkMode
                ? const ['Consent-first', 'No photo', 'Respect boundaries']
                : null,
            idempotencyKey: _ensureCreateIdempotencyKey(),
          );
      ref.invalidate(eventsProvider('nearby'));
      ref.invalidate(mapEventsProvider);
      ref.invalidate(datingDiscoverProvider);
      ref.invalidate(datingLikesProvider);
      ref.invalidate(meetupChatsProvider);
      if (widget.communityId case final communityId?) {
        ref.invalidate(communityProvider(communityId));
        ref.invalidate(communitiesFeedProvider);
        ref.invalidate(communitiesProvider);
      }
      if (!mounted) return;
      context.pushReplacementNamed(
        AppRoute.eventDetail.name,
        pathParameters: {'eventId': event.id},
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      _showSubmitError('Не получилось опубликовать встречу.');
    } finally {
      if (mounted) {
        setState(() {
          _creating = false;
        });
      }
    }
  }

  String _ensureCreateIdempotencyKey() {
    return _createIdempotencyKey ??=
        'mobile-create-event-${DateTime.now().microsecondsSinceEpoch}';
  }

  void _showSubmitError(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  String _formatStartsAt(DateTime value) {
    final now = DateTime.now();
    final local = value.toLocal();
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(local.year, local.month, local.day);
    if (target == today) {
      return 'Сегодня · $hh:$mm';
    }
    if (target == today.add(const Duration(days: 1))) {
      return 'Завтра · $hh:$mm';
    }
    return '${local.day}.${local.month} · $hh:$mm';
  }

  Future<PlaceSelection> _placeSelectionForSubmit() async {
    final current = placeSelection;
    if (current.latitude != null && current.longitude != null) {
      return current;
    }

    final resolved = await ref.read(yandexMapServiceProvider).searchAddress(
          _placeLabel(current),
        );
    if (resolved == null) {
      return current;
    }

    return PlaceSelection(
      name: current.name,
      address: current.address,
      distance: current.distance,
      distanceKm: current.distanceKm,
      category: current.category,
      emoji: current.emoji,
      latitude: resolved.point.latitude,
      longitude: resolved.point.longitude,
    );
  }

  String _placeLabel([PlaceSelection? selection]) {
    final value = selection ?? placeSelection;
    if (value.address.isEmpty) {
      return value.name;
    }
    return '${value.name}, ${value.address}';
  }

  double? _distanceKmFromLabel(String value) {
    final normalized = value.replaceAll(',', '.');
    final match = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(normalized);
    return match == null ? null : double.tryParse(match.group(1)!);
  }

  void _applyPartnerVenue(PartnerVenue venue) {
    _partnerVenue = venue;
    placeSelection = PlaceSelection(
      name: venue.name,
      address: venue.address,
      distance: venue.distance,
      distanceKm: _distanceKmFromLabel(venue.distance),
      category: 'Партнёр Frendly',
      emoji: venue.emoji,
    );
    _placeController.text = _placeLabel();
    emoji = venue.emoji;
    if (_titleController.text.trim().isEmpty) {
      _titleController.text = 'Встреча в ${venue.name}';
    }
    if (_descriptionController.text.trim().isEmpty) {
      _descriptionController.text = venue.perk;
    }
  }

  String _lifestyleHint() {
    switch (lifestyle) {
      case 'zozh':
        return 'Без алкоголя и курения. Спорт, здоровая еда.';
      case 'anti':
        return 'Можно расслабиться: бар, вино, кальян.';
      case 'neutral':
      default:
        return 'Без ограничений. Каждый сам решает.';
    }
  }

  String _priceHint(bool isDatingMode) {
    if (isDatingMode) {
      return priceMode == 'fifty_fifty'
          ? 'Счет делится поровну. Это видно заранее.'
          : 'Ты берешь счет на себя. Это видно заранее.';
    }
    if (priceMode == 'split') {
      return 'Считаем счёт на месте и делим поровну.';
    }
    if (priceMode == 'free') {
      return 'Никаких трат. Только компания.';
    }
    return 'Стоимость будет видна всем участникам до вступления.';
  }

  int? _priceAmountFrom() {
    final parsed = int.tryParse(priceFrom);
    return parsed;
  }

  int? _priceAmountTo() {
    final parsed = int.tryParse(priceTo);
    return parsed;
  }

  void _applyPosterSelection(Poster poster) {
    final previousTitle = _poster == null ? null : _posterAutoTitle(_poster!);
    final previousDescription = _poster?.description;
    final shouldReplaceTitle = _titleController.text.trim().isEmpty ||
        (previousTitle != null &&
            _titleController.text.trim() == previousTitle);
    final shouldReplaceDescription =
        _descriptionController.text.trim().isEmpty ||
            (previousDescription != null &&
                _descriptionController.text.trim() == previousDescription);

    setState(() {
      _poster = poster;
      _partnerVenue = null;
      emoji = poster.emoji;
      startsAt = poster.startsAt;
      placeSelection = PlaceSelection(
        name: poster.venue,
        address: poster.address,
        distance: poster.distance,
        distanceKm: _distanceKmFromLabel(poster.distance),
        emoji: poster.emoji,
      );
      _placeController.text = _placeLabel();
      if (shouldReplaceTitle) {
        _titleController.text = _posterAutoTitle(poster);
      }
      if (shouldReplaceDescription) {
        _descriptionController.text = poster.description;
      }
    });
  }

  String _posterAutoTitle(Poster poster) => poster.meetupTitle;
}

class _FieldCard extends StatelessWidget {
  const _FieldCard({
    required this.label,
    required this.value,
    required this.icon,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: colors.inkMute),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: AppTextStyles.caption.copyWith(letterSpacing: 1)),
                  const SizedBox(height: 4),
                  Text(value,
                      style: AppTextStyles.body
                          .copyWith(fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: colors.inkMute,
            ),
          ],
        ),
      ),
    );
  }
}

class _PartnerVenueField extends StatelessWidget {
  const _PartnerVenueField({
    required this.venue,
    required this.dark,
    required this.onOpen,
    required this.onClear,
  });

  final PartnerVenue? venue;
  final bool dark;
  final VoidCallback onOpen;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final selected = venue;
    if (selected == null) {
      return InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: dark ? AppColors.adSurface : colors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: dark ? AppColors.adBorder : colors.border,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: dark ? AppColors.adSurfaceElev : colors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  LucideIcons.sparkles,
                  size: 18,
                  color: dark ? AppColors.adMagenta : colors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Партнёрские места',
                      style: AppTextStyles.body.copyWith(
                        fontWeight: FontWeight.w600,
                        color: dark ? AppColors.adFg : colors.foreground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Список мест с перками по клику',
                      style: AppTextStyles.meta.copyWith(
                        color: dark ? AppColors.adFgMute : colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: dark ? AppColors.adFgMute : colors.inkMute,
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: dark ? AppColors.adSurface : colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: dark
              ? AppColors.adMagenta.withValues(alpha: 0.4)
              : colors.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: dark ? AppColors.adSurfaceElev : colors.background,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(selected.emoji, style: const TextStyle(fontSize: 22)),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      LucideIcons.sparkles,
                      size: 12,
                      color: dark ? AppColors.adMagenta : colors.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Партнёр Frendly',
                      style: AppTextStyles.caption.copyWith(
                        color: dark ? AppColors.adMagenta : colors.primary,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                    ),
                    if (selected.verified) ...[
                      const SizedBox(width: 4),
                      Icon(
                        LucideIcons.badge_check,
                        size: 13,
                        color: dark ? AppColors.adCyan : colors.primary,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  selected.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                    color: dark ? AppColors.adFg : colors.foreground,
                  ),
                ),
                Text(
                  '${selected.area} · ${selected.distance}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.meta.copyWith(
                    color: dark ? AppColors.adFgMute : colors.inkMute,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: dark
                        ? AppColors.adMagentaSoft.withValues(alpha: 0.3)
                        : colors.primarySoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        LucideIcons.gift,
                        size: 13,
                        color: dark ? AppColors.adMagenta : colors.primary,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          selected.perk,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            color: dark ? AppColors.adMagenta : colors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Column(
            children: [
              TextButton(
                onPressed: onOpen,
                child: const Text('Заменить'),
              ),
              IconButton(
                tooltip: 'Убрать партнёра',
                onPressed: onClear,
                icon: Icon(
                  LucideIcons.x,
                  size: 18,
                  color: dark ? AppColors.adFgMute : colors.inkMute,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SegmentCell extends StatelessWidget {
  const _SegmentCell({
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
      color: active ? colors.foreground : colors.background,
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

class _TopModeCell extends StatelessWidget {
  const _TopModeCell({
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

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: active ? colors.background : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.button.copyWith(
            fontSize: 13,
            color: active ? colors.foreground : colors.inkMute,
          ),
        ),
      ),
    );
  }
}

class _PriceModeChip extends StatelessWidget {
  const _PriceModeChip({
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
      color: active ? colors.foreground : colors.background,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 12),
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

class _PriceInput extends StatelessWidget {
  const _PriceInput({
    required this.placeholder,
    required this.controller,
    required this.onChanged,
  });

  final String placeholder;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: TextField(
        controller: controller,
        onChanged: (next) {
          final digitsOnly = next.replaceAll(RegExp(r'\D'), '');
          final sanitized =
              digitsOnly.length > 6 ? digitsOnly.substring(0, 6) : digitsOnly;
          if (controller.text != sanitized) {
            controller.value = TextEditingValue(
              text: sanitized,
              selection: TextSelection.collapsed(offset: sanitized.length),
            );
          }
          onChanged(sanitized);
        },
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          hintText: placeholder,
          hintStyle: AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
          filled: false,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
        style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _VisibilityRow extends StatelessWidget {
  const _VisibilityRow({
    required this.active,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final bool active;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: active ? colors.muted : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: colors.inkSoft),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: AppTextStyles.body
                          .copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                  Text(subtitle, style: AppTextStyles.meta),
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
                    color: active ? colors.primary : colors.border, width: 2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
