import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key, this.targetUserId});

  final String? targetUserId;

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final _commentController = TextEditingController();
  String? _selectedReason;
  bool _blockProfile = true;
  bool _sent = false;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final targetUserId = widget.targetUserId;
    final reason = _selectedReason;
    if (targetUserId == null || targetUserId.isEmpty || reason == null) {
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(reportActionsProvider).createReport(
            targetUserId: targetUserId,
            reason: reason,
            details: _commentController.text.trim(),
            blockRequested: _blockProfile,
          );
      if (mounted) {
        setState(() {
          _sending = false;
          _sent = true;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = 'Не удалось отправить жалобу';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return _SuccessState(blockProfile: _blockProfile);
    }

    if (widget.targetUserId == null || widget.targetUserId!.isEmpty) {
      return const DateasyPhoneFrame(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Нужен targetUserId для жалобы',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: MediaQuery.paddingOf(context).bottom + 116,
            ),
            children: [
              const _Header(),
              const _PrivacyAlert(),
              _ReasonsSection(
                selected: _selectedReason,
                onSelected: (id) => setState(() => _selectedReason = id),
              ),
              const _InlineState(
                text: 'Справочник причин локальный. Backend endpoint не найден',
              ),
              _CommentSection(controller: _commentController),
              if (_error != null) _InlineState(text: _error!),
              _BlockToggle(
                value: _blockProfile,
                onChanged: (value) => setState(() => _blockProfile = value),
              ),
            ],
          ),
          _BottomSubmit(
            enabled: _selectedReason != null && !_sending,
            sending: _sending,
            onSubmit: _submit,
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/dating'),
          ),
          Text(
            'Пожаловаться',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(width: 44, height: 44),
        ],
      ),
    );
  }
}

class _PrivacyAlert extends StatelessWidget {
  const _PrivacyAlert();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: DateasyColors.pink.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: DateasyColors.pink.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            const Icon(
              LucideIcons.shieldAlert,
              color: DateasyColors.pink,
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Жалоба анонимна. Мы не покажем её другому пользователю.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 12,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReasonsSection extends StatelessWidget {
  const _ReasonsSection({
    required this.selected,
    required this.onSelected,
  });

  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Причина',
      child: Column(
        children: [
          for (var index = 0; index < _reasons.length; index++) ...[
            _ReasonTile(
              reason: _reasons[index],
              selected: selected == _reasons[index].id,
              onTap: () => onSelected(_reasons[index].id),
            ),
            if (index != _reasons.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _ReasonTile extends StatelessWidget {
  const _ReasonTile({
    required this.reason,
    required this.selected,
    required this.onTap,
  });

  final _ReportReason reason;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        borderColor:
            selected ? DateasyColors.lime : Colors.white.withValues(alpha: 0.1),
        backgroundColor: selected
            ? DateasyColors.lime.withValues(alpha: 0.1)
            : DateasyColors.glass,
        shadow: selected
            ? const [
                BoxShadow(
                  color: Color(0x55BEFF67),
                  blurRadius: 24,
                  spreadRadius: -14,
                  offset: Offset(0, 14),
                ),
              ]
            : null,
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? DateasyColors.lime : Colors.transparent,
                border: Border.all(
                  color: selected
                      ? DateasyColors.lime
                      : Colors.white.withValues(alpha: 0.3),
                  width: 2,
                ),
              ),
              alignment: Alignment.center,
              child: selected
                  ? const Icon(
                      LucideIcons.check,
                      color: DateasyColors.backgroundDeep,
                      size: 12,
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reason.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    reason.subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
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

class _CommentSection extends StatelessWidget {
  const _CommentSection({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Комментарий',
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: TextField(
          controller: controller,
          minLines: 4,
          maxLines: 4,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.foreground,
                fontSize: 14,
              ),
          decoration: InputDecoration(
            hintText: 'Опиши, что случилось',
            hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 14,
                ),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
        ),
      ),
    );
  }
}

class _BlockToggle extends StatelessWidget {
  const _BlockToggle({
    required this.value,
    required this.onChanged,
  });

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () => onChanged(!value),
        child: _GlassPanel(
          borderRadius: 16,
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: value,
                  onChanged: (next) => onChanged(next ?? false),
                  activeColor: DateasyColors.lime,
                  checkColor: DateasyColors.backgroundDeep,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  side: BorderSide(
                    color: Colors.white.withValues(alpha: 0.35),
                    width: 1.4,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Также заблокировать профиль',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomSubmit extends StatelessWidget {
  const _BottomSubmit({
    required this.enabled,
    required this.sending,
    required this.onSubmit,
  });

  final bool enabled;
  final bool sending;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.paddingOf(context).bottom + 24,
        ),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              DateasyColors.background,
              DateasyColors.background,
              Color(0x001F0C3F),
            ],
          ),
        ),
        child: GestureDetector(
          onTap: enabled ? onSubmit : null,
          child: Opacity(
            opacity: enabled ? 1 : 0.4,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                gradient: dateasyLimeGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: enabled
                    ? const [
                        BoxShadow(
                          color: Color(0x66BEFF67),
                          blurRadius: 24,
                          spreadRadius: -12,
                          offset: Offset(0, 12),
                        ),
                      ]
                    : null,
              ),
              alignment: Alignment.center,
              child: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      'Отправить жалобу',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.backgroundDeep,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Статус',
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _SuccessState extends StatelessWidget {
  const _SuccessState({required this.blockProfile});

  final bool blockProfile;

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: dateasyLimeGradient,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x66BEFF67),
                    blurRadius: 30,
                    spreadRadius: -12,
                    offset: Offset(0, 14),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.check,
                color: DateasyColors.backgroundDeep,
                size: 40,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Жалоба отправлена',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: 300,
              child: Text(
                'Рассмотрим в течение 24 часов. '
                '${blockProfile ? 'Профиль заблокирован.' : ''}',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 14,
                    ),
              ),
            ),
            const SizedBox(height: 32),
            GestureDetector(
              onTap: () => context.go('/dating'),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 13,
                ),
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66BEFF67),
                      blurRadius: 24,
                      spreadRadius: -12,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                child: Text(
                  'Вернуться',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 12,
                  letterSpacing: 1.2,
                ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 20),
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
    this.borderColor,
    this.backgroundColor,
    this.shadow,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;
  final Color? backgroundColor;
  final List<BoxShadow>? shadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: borderColor ?? Colors.white.withValues(alpha: 0.1),
        ),
        boxShadow: shadow,
      ),
      child: child,
    );
  }
}

class _ReportReason {
  const _ReportReason({
    required this.id,
    required this.title,
    required this.subtitle,
  });

  final String id;
  final String title;
  final String subtitle;
}

const _reasons = [
  _ReportReason(
    id: 'impersonation',
    title: 'Фейковый профиль',
    subtitle: 'Подозреваю, что фото не его',
  ),
  _ReportReason(
    id: 'spam',
    title: 'Спам или реклама',
    subtitle: 'Навязчивые ссылки или продажа услуг',
  ),
  _ReportReason(
    id: 'harass',
    title: 'Оскорбления',
    subtitle: 'Грубость, угрозы, домогательства',
  ),
  _ReportReason(
    id: 'minor',
    title: 'Несовершеннолетний',
    subtitle: 'Похоже, человеку нет 18',
  ),
  _ReportReason(
    id: 'scam',
    title: 'Мошенничество',
    subtitle: 'Просит деньги или данные',
  ),
  _ReportReason(
    id: 'other',
    title: 'Другое',
    subtitle: 'Опиши ниже',
  ),
];
