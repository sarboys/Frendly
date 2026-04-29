import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_check_in.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_brand_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class CheckInScreen extends ConsumerStatefulWidget {
  const CheckInScreen({
    required this.eventId,
    super.key,
  });

  final String eventId;

  @override
  ConsumerState<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends ConsumerState<CheckInScreen> {
  bool _confirming = false;
  String? _distanceStatus;

  Future<void> _showManualCodeDialog(String initialCode) async {
    final controller = TextEditingController(text: initialCode);

    await showDialog<void>(
      context: context,
      builder: (context) {
        bool submitting = false;
        String? errorText;
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('Ввести код'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    hintText: 'Код от хоста',
                  ),
                ),
                if (errorText != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    errorText!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed:
                    submitting ? null : () => Navigator.of(context).pop(),
                child: const Text('Отмена'),
              ),
              FilledButton(
                onPressed: submitting
                    ? null
                    : () async {
                        setDialogState(() {
                          submitting = true;
                          errorText = null;
                        });
                        try {
                          await ref
                              .read(backendRepositoryProvider)
                              .confirmCheckIn(
                                widget.eventId,
                                code: controller.text.trim(),
                              );
                          if (context.mounted) {
                            Navigator.of(context).pop();
                          }
                          ref.invalidate(checkInProvider(widget.eventId));
                          ref.invalidate(eventDetailProvider(widget.eventId));
                          ref.invalidate(liveMeetupProvider(widget.eventId));
                        } catch (_) {
                          setDialogState(() {
                            errorText = 'Не получилось подтвердить код';
                          });
                        } finally {
                          setDialogState(() {
                            submitting = false;
                          });
                        }
                      },
                child: Text(submitting ? 'Проверяем' : 'Подтвердить'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final checkInAsync = ref.watch(checkInProvider(widget.eventId));

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: AsyncValueView<EventCheckInData>(
          value: checkInAsync,
          data: (state) {
            final checkedInCount = state.attendees
                .where((item) => item.attendanceStatus.name == 'checkedIn')
                .length;

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => context.pop(),
                        icon: const Icon(Icons.chevron_left_rounded, size: 28),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                    children: [
                      Text(
                        'Чек-ин на встречу',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.secondary,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(state.title, style: AppTextStyles.sectionTitle),
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        children: [
                          Icon(
                            LucideIcons.map_pin,
                            size: 14,
                            color: colors.inkMute,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(state.place, style: AppTextStyles.meta),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.xl),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                        ),
                        child: Column(
                          children: [
                            Container(
                              height: 260,
                              decoration: BoxDecoration(
                                color: colors.foreground,
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: const Center(
                                child: BbBrandIcon(
                                  size: 84,
                                  radius: 24,
                                ),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              'Покажи хосту, чтобы отметиться',
                              style: AppTextStyles.meta.copyWith(
                                color: colors.inkSoft,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            SelectableText(
                              state.code,
                              style: AppTextStyles.caption.copyWith(
                                color: colors.inkMute,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: colors.secondarySoft,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              alignment: Alignment.center,
                              child: Icon(
                                LucideIcons.shield_check,
                                color: colors.secondary,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Статус чек-ина',
                                    style: AppTextStyles.itemTitle
                                        .copyWith(fontSize: 14),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _distanceStatus ??
                                        switch (state.status) {
                                          EventAttendanceStatus.checkedIn =>
                                            'Ты уже отмечен у хоста',
                                          EventAttendanceStatus.left =>
                                            'Ты уже покинул встречу',
                                          EventAttendanceStatus.notCheckedIn =>
                                            'Покажи код хосту или введи его вручную',
                                        },
                                    style: AppTextStyles.meta.copyWith(
                                      color: colors.inkMute,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                color: colors.online,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      InkWell(
                        onTap: () => _showManualCodeDialog(state.code),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: colors.border),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                LucideIcons.qr_code,
                                color: colors.inkSoft,
                                size: 18,
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Text(
                                  'Ввести код вручную',
                                  style: AppTextStyles.itemTitle
                                      .copyWith(fontSize: 14),
                                ),
                              ),
                              Text(
                                '→',
                                style: AppTextStyles.meta.copyWith(
                                  color: colors.inkMute,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              LucideIcons.badge_check,
                              color: colors.secondary,
                              size: 18,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                'Уже на месте: $checkedInCount из ${state.attendees.length}',
                                style: AppTextStyles.itemTitle
                                    .copyWith(fontSize: 14),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      ...state.attendees.map(
                        (attendee) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Container(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: colors.border),
                            ),
                            child: Row(
                              children: [
                                BbAvatar(
                                  name: attendee.displayName,
                                  imageUrl: attendee.avatarUrl,
                                  online: attendee.online,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Text(
                                    attendee.displayName,
                                    style: AppTextStyles.itemTitle,
                                  ),
                                ),
                                Text(
                                  attendee.attendanceStatus ==
                                          EventAttendanceStatus.checkedIn
                                      ? 'на месте'
                                      : 'ждет',
                                  style: AppTextStyles.meta.copyWith(
                                    color: attendee.attendanceStatus ==
                                            EventAttendanceStatus.checkedIn
                                        ? colors.secondary
                                        : colors.inkMute,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SafeArea(
                  top: false,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.background.withValues(alpha: 0.92),
                      border: Border(
                        top: BorderSide(
                          color: colors.border.withValues(alpha: 0.6),
                        ),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
                      child: SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: colors.foreground,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                          ),
                          onPressed: _confirming
                              ? null
                              : () async {
                                  setState(() {
                                    _confirming = true;
                                  });
                                  try {
                                    final distanceStatus =
                                        await _resolveDistanceStatus(state);
                                    if (distanceStatus != null && mounted) {
                                      setState(() {
                                        _distanceStatus = distanceStatus;
                                      });
                                    }
                                    await ref
                                        .read(backendRepositoryProvider)
                                        .confirmCheckIn(
                                          widget.eventId,
                                          code: state.code,
                                        );
                                    ref.invalidate(
                                        checkInProvider(widget.eventId));
                                    ref.invalidate(
                                        eventDetailProvider(widget.eventId));
                                    ref.invalidate(
                                        liveMeetupProvider(widget.eventId));
                                    if (context.mounted) {
                                      if (distanceStatus != null) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          SnackBar(
                                              content: Text(distanceStatus)),
                                        );
                                      }
                                      context.pushRoute(
                                        AppRoute.liveMeetup,
                                        pathParameters: {
                                          'eventId': widget.eventId,
                                        },
                                      );
                                    }
                                  } finally {
                                    if (mounted) {
                                      setState(() {
                                        _confirming = false;
                                      });
                                    }
                                  }
                                },
                          child: Text(
                            'Я на месте',
                            style: AppTextStyles.button.copyWith(
                              color: colors.primaryForeground,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<String?> _resolveDistanceStatus(EventCheckInData state) async {
    if (state.latitude == null || state.longitude == null) {
      return null;
    }

    final position =
        await ref.read(appLocationServiceProvider).getCurrentPosition();
    if (position == null) {
      return null;
    }

    final distanceMeters = ref.read(appLocationServiceProvider).distanceBetween(
          startLatitude: position.latitude,
          startLongitude: position.longitude,
          endLatitude: state.latitude!,
          endLongitude: state.longitude!,
        );

    if (distanceMeters < 1000) {
      return 'До точки около ${distanceMeters.round()} м';
    }

    return 'До точки около ${(distanceMeters / 1000).toStringAsFixed(1)} км';
  }
}
