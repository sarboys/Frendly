import 'dart:async';
import 'dart:math' as math;

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/partner_offer_code.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

class PartnerOfferQrScreen extends ConsumerStatefulWidget {
  const PartnerOfferQrScreen({
    required this.codeId,
    super.key,
  });

  final String codeId;

  @override
  ConsumerState<PartnerOfferQrScreen> createState() =>
      _PartnerOfferQrScreenState();
}

class _PartnerOfferQrScreenState extends ConsumerState<PartnerOfferQrScreen> {
  Timer? _pollTimer;
  PartnerOfferCode? _code;
  Object? _error;
  bool _loading = true;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load(initial: true));
  }

  @override
  void dispose() {
    _stopPolling();
    super.dispose();
  }

  Future<void> _load({bool initial = false}) async {
    if (_refreshing) {
      return;
    }
    _refreshing = true;
    if (initial && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final code = await ref
          .read(backendRepositoryProvider)
          .fetchPartnerOfferCode(widget.codeId);
      if (!mounted) {
        return;
      }
      setState(() {
        _code = code;
        _error = null;
        _loading = false;
      });
      if (code.status == PartnerOfferCodeStatus.issued) {
        _startPolling();
      } else {
        _stopPolling();
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error;
        _loading = false;
      });
      _stopPolling();
    } finally {
      _refreshing = false;
    }
  }

  void _startPolling() {
    if (_pollTimer != null) {
      return;
    }
    _pollTimer = Timer.periodic(
      const Duration(seconds: 4),
      (_) => unawaited(_load()),
    );
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: 'Закрыть',
                    onPressed: () => context.pop(),
                    icon: const Icon(LucideIcons.x),
                  ),
                  const Spacer(),
                  Text(
                    'QR оффера',
                    style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                  ),
                  const Spacer(),
                  const SizedBox(width: 48),
                ],
              ),
              Expanded(
                child: Center(
                  child: _content(colors),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _content(BigBreakThemeColors colors) {
    if (_loading) {
      return CircularProgressIndicator(color: colors.primary);
    }
    if (_error != null || _code == null) {
      return _MessageState(
        icon: LucideIcons.triangle_alert,
        title: 'Не получилось загрузить QR',
        text: 'Проверь соединение и попробуй снова',
        actionLabel: 'Повторить',
        onAction: () => unawaited(_load(initial: true)),
      );
    }

    final code = _code!;
    final status = _statusMeta(code.status, colors);
    final qrSize = math.min(MediaQuery.sizeOf(context).width - 88, 300.0);

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: qrSize + 28,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadii.cardBorder,
              border: Border.all(color: colors.border),
            ),
            child: QrImageView(
              data: code.codeUrl,
              version: QrVersions.auto,
              size: qrSize,
              backgroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: status.background,
              borderRadius: AppRadii.pillBorder,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(status.icon, size: 15, color: status.foreground),
                const SizedBox(width: 6),
                Text(
                  status.label,
                  style: AppTextStyles.caption.copyWith(
                    color: status.foreground,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            code.offerTitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.screenTitle.copyWith(fontSize: 28),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            code.venueName.isNotEmpty ? code.venueName : code.partnerName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(color: colors.inkSoft),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Действует до ${_timeLabel(context, code.expiresAt)}',
            style: AppTextStyles.meta.copyWith(color: colors.inkMute),
          ),
        ],
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.title,
    required this.text,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String text;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 42, color: colors.inkMute),
        const SizedBox(height: AppSpacing.sm),
        Text(title, style: AppTextStyles.sectionTitle),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          text,
          textAlign: TextAlign.center,
          style: AppTextStyles.body.copyWith(color: colors.inkSoft),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton(
          onPressed: onAction,
          child: Text(actionLabel),
        ),
      ],
    );
  }
}

class _StatusMeta {
  const _StatusMeta({
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

_StatusMeta _statusMeta(
  PartnerOfferCodeStatus status,
  BigBreakThemeColors colors,
) {
  switch (status) {
    case PartnerOfferCodeStatus.activated:
      return _StatusMeta(
        label: 'Использован',
        icon: LucideIcons.circle_check,
        foreground: colors.secondary,
        background: colors.secondarySoft,
      );
    case PartnerOfferCodeStatus.expired:
      return _StatusMeta(
        label: 'Истек',
        icon: LucideIcons.clock_3,
        foreground: colors.destructive,
        background: colors.destructive.withValues(alpha: 0.1),
      );
    case PartnerOfferCodeStatus.issued:
      return _StatusMeta(
        label: 'Активен',
        icon: LucideIcons.badge_percent,
        foreground: colors.primary,
        background: colors.primarySoft,
      );
  }
}

String _timeLabel(BuildContext context, DateTime value) {
  return TimeOfDay.fromDateTime(value.toLocal()).format(context);
}
