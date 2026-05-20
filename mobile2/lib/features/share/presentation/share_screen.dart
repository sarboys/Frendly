import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class ShareScreen extends ConsumerStatefulWidget {
  const ShareScreen({
    super.key,
    this.targetType,
    this.targetId,
  });

  final String? targetType;
  final String? targetId;

  @override
  ConsumerState<ShareScreen> createState() => _ShareScreenState();
}

class _ShareScreenState extends ConsumerState<ShareScreen> {
  _ShareTheme _theme = _themes.first;
  String? _shareUrl;
  bool _sharing = false;

  void _selectTheme(_ShareTheme theme) {
    setState(() => _theme = theme);
  }

  void _showNotice(String text) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DateasyColors.surface2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final targetId = widget.targetId;
    final eventState = widget.targetType == 'event' && targetId != null
        ? ref.watch(meetingDetailProvider(targetId))
        : null;
    final target = eventState?.valueOrNull;
    return DateasyPhoneFrame(
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.paddingOf(context).top + 16,
          bottom: 40,
        ),
        children: [
          _Header(
            onDownload: () => _showNotice('Карточка сохранена в галерею'),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: _SharePreview(
              theme: _theme,
              target: target,
              shareUrl: _shareUrl,
            ),
          ),
          if (eventState?.isLoading == true && target == null)
            const _InlineState(text: 'Загружаем цель')
          else if (_hasLocalOnlyTarget)
            _InlineState(
              text: 'Backend share endpoint не найден для ${widget.targetType}',
            )
          else if (!_hasShareTarget)
            const _InlineState(
              text: 'Backend share требует targetType и targetId',
            )
          else if (eventState?.hasError == true && target == null)
            const _InlineState(text: 'Не удалось загрузить цель'),
          _ThemeSection(
            selected: _theme,
            onSelected: _selectTheme,
          ),
          _ShareActions(
            busy: _sharing,
            onAction: (title) {
              _createShare(title);
            },
          ),
          const _ReferralNote(),
        ],
      ),
    );
  }

  bool get _hasShareTarget {
    final targetType = widget.targetType;
    final targetId = widget.targetId;
    return (targetType == 'event' || targetType == 'evening_session') &&
        targetId != null &&
        targetId.isNotEmpty;
  }

  bool get _hasLocalOnlyTarget {
    final targetType = widget.targetType;
    return targetType == 'profile' ||
        targetType == 'memory_map' ||
        targetType == 'route_template' ||
        targetType == 'ai_draft';
  }

  Future<void> _createShare(String action) async {
    if (_hasLocalOnlyTarget) {
      _showNotice('Для этого target backend share endpoint не найден');
      return;
    }
    if (!_hasShareTarget || _sharing) {
      _showNotice('Для share нет backend target');
      return;
    }
    setState(() => _sharing = true);
    try {
      final result = await ref.read(shareActionsProvider).createShare(
            targetType: widget.targetType!,
            targetId: widget.targetId!,
          );
      final url = result['url']?.toString() ?? '';
      if (!mounted) {
        return;
      }
      setState(() {
        _shareUrl = url;
        _sharing = false;
      });
      if (action == 'Копировать' && url.isNotEmpty) {
        await Clipboard.setData(ClipboardData(text: url));
        if (mounted) {
          _showNotice('Ссылка скопирована');
        }
      } else {
        _showNotice(url.isEmpty ? 'Backend не вернул ссылку' : 'Ссылка готова');
      }
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _sharing = false);
      _showNotice('Не удалось создать share');
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onDownload});

  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/profile'),
          ),
          Text(
            'Share card',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
          ),
          _GlassIconButton(
            icon: LucideIcons.download,
            onTap: onDownload,
          ),
        ],
      ),
    );
  }
}

class _SharePreview extends StatelessWidget {
  const _SharePreview({
    required this.theme,
    required this.target,
    required this.shareUrl,
  });

  final _ShareTheme theme;
  final BackendCardItem? target;
  final String? shareUrl;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 9 / 16,
      child: Container(
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: theme.color,
          gradient: theme.gradient,
          borderRadius: BorderRadius.circular(24),
          boxShadow: const [
            BoxShadow(
              color: Color(0x55BEFF67),
              blurRadius: 30,
              spreadRadius: -16,
              offset: Offset(0, 18),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned(
              top: -40,
              right: -40,
              child: _PreviewBlob(),
            ),
            const Positioned(
              left: -40,
              bottom: -40,
              child: _PreviewBlob(),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Frendly',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: theme.foreground,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 3.6,
                          ),
                    ),
                    Container(
                      padding: const EdgeInsets.fromLTRB(8, 2, 8, 3),
                      decoration: BoxDecoration(
                        color:
                            DateasyColors.backgroundDeep.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Plus',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: theme.foreground,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                SizedBox(
                  width: 80,
                  height: 80,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: DateasyColors.backgroundDeep
                              .withValues(alpha: 0.4),
                          width: 4,
                        ),
                      ),
                      child: DateasyRemoteImage(
                        imageUrl: target?.imageUrl,
                        usage: DateasyImageUsage.card,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  target?.title.isNotEmpty == true ? target!.title : 'Share',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        color: theme.foreground,
                        fontSize: 36,
                        height: 1.05,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  target?.city ?? _formatDate(target?.startsAt) ?? 'Frendly',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: theme.foreground.withValues(alpha: 0.8),
                        fontSize: 14,
                      ),
                ),
                const SizedBox(height: 16),
                Text(
                  target?.subtitle ?? 'Публичная ссылка будет создана backend',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: theme.foreground,
                        fontSize: 18,
                        height: 1.25,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 22),
                _StatsGrid(foreground: theme.foreground, target: target),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        shareUrl ?? 'share link pending',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: theme.foreground.withValues(alpha: 0.8),
                              fontSize: 12,
                            ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: DateasyColors.backgroundDeep
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'QR',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: theme.foreground,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewBlob extends StatelessWidget {
  const _PreviewBlob();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      height: 160,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: DateasyColors.backgroundDeep.withValues(alpha: 0.1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x3315082C),
            blurRadius: 30,
            spreadRadius: 18,
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({
    required this.foreground,
    required this.target,
  });

  final Color foreground;
  final BackendCardItem? target;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var index = 0; index < _stats(target).length; index++) ...[
          Expanded(
            child: _StatTile(
              stat: _stats(target)[index],
              foreground: foreground,
            ),
          ),
          if (index != _stats(target).length - 1) const SizedBox(width: 8),
        ],
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.stat,
    required this.foreground,
  });

  final _ShareStat stat;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: DateasyColors.backgroundDeep.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(
            stat.n,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: foreground,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
          ),
          Text(
            stat.label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: foreground.withValues(alpha: 0.8),
                  fontSize: 10,
                ),
          ),
        ],
      ),
    );
  }
}

class _ThemeSection extends StatelessWidget {
  const _ThemeSection({
    required this.selected,
    required this.onSelected,
  });

  final _ShareTheme selected;
  final ValueChanged<_ShareTheme> onSelected;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Тема',
      child: Row(
        children: [
          for (var index = 0; index < _themes.length; index++) ...[
            Expanded(
              child: _ThemeButton(
                theme: _themes[index],
                selected: selected.id == _themes[index].id,
                onTap: () => onSelected(_themes[index]),
              ),
            ),
            if (index != _themes.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _ThemeButton extends StatelessWidget {
  const _ThemeButton({
    required this.theme,
    required this.selected,
    required this.onTap,
  });

  final _ShareTheme theme;
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
        child: Column(
          children: [
            Container(
              height: 40,
              decoration: BoxDecoration(
                color: theme.color,
                gradient: theme.gradient,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              theme.name,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShareActions extends StatelessWidget {
  const _ShareActions({
    required this.busy,
    required this.onAction,
  });

  final bool busy;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Поделиться',
      child: Row(
        children: [
          for (var index = 0; index < _actions.length; index++) ...[
            Expanded(
              child: _ActionButton(
                action: _actions[index],
                busy: busy,
                onTap: () => onAction(_actions[index].title),
              ),
            ),
            if (index != _actions.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.action,
    required this.busy,
    required this.onTap,
  });

  final _ShareAction action;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: action.color,
                gradient: action.gradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: busy
                  ? const Center(
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : Icon(
                      action.icon,
                      size: 16,
                      color: action.iconColor,
                    ),
            ),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                action.title,
                maxLines: 1,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReferralNote extends StatelessWidget {
  const _ReferralNote();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(
              LucideIcons.sparkles,
              color: DateasyColors.lime,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Получи Plus за 3 друзей, перешедших по карте',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 12,
                    ),
              ),
            ),
            Text(
              '+7 дней',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.lime,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
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
      title: 'Backend',
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
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
    this.shadow,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;
  final List<BoxShadow>? shadow;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
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

class _ShareTheme {
  const _ShareTheme({
    required this.id,
    required this.name,
    required this.foreground,
    this.gradient,
    this.color,
  });

  final String id;
  final String name;
  final Color foreground;
  final Gradient? gradient;
  final Color? color;
}

class _ShareStat {
  const _ShareStat(this.n, this.label);

  final String n;
  final String label;
}

class _ShareAction {
  const _ShareAction({
    required this.title,
    required this.icon,
    required this.iconColor,
    this.gradient,
    this.color,
  });

  final String title;
  final IconData icon;
  final Color iconColor;
  final Gradient? gradient;
  final Color? color;
}

const _themes = [
  _ShareTheme(
    id: 'lime',
    name: 'Lime',
    foreground: DateasyColors.backgroundDeep,
    gradient: dateasyLimeGradient,
  ),
  _ShareTheme(
    id: 'pink',
    name: 'Pink',
    foreground: DateasyColors.foreground,
    gradient: dateasyPinkGradient,
  ),
  _ShareTheme(
    id: 'dark',
    name: 'Night',
    foreground: DateasyColors.foreground,
    color: Color(0xFF251342),
  ),
];

List<_ShareStat> _stats(BackendCardItem? target) {
  final raw = target?.raw ?? const <String, Object?>{};
  return [
    _ShareStat(
      _string(raw['participantCount'] ?? raw['going'] ?? raw['joinedCount']),
      'участников',
    ),
    _ShareStat(_string(raw['capacity'] ?? raw['maxGuests']), 'мест'),
    _ShareStat(target?.city ?? '', 'город'),
  ];
}

String _string(Object? value) {
  final text = value?.toString() ?? '';
  return text.isEmpty ? '0' : text;
}

String? _formatDate(DateTime? value) {
  if (value == null) {
    return null;
  }
  final local = value.toLocal();
  return '${local.day}.${local.month}.${local.year}';
}

const _actions = [
  _ShareAction(
    title: 'Stories',
    icon: LucideIcons.camera,
    iconColor: DateasyColors.foreground,
    gradient: dateasyPinkGradient,
  ),
  _ShareAction(
    title: 'Telegram',
    icon: LucideIcons.send,
    iconColor: DateasyColors.backgroundDeep,
    gradient: dateasyLimeGradient,
  ),
  _ShareAction(
    title: 'Сообщение',
    icon: LucideIcons.messageCircle,
    iconColor: DateasyColors.backgroundDeep,
    color: DateasyColors.lilac,
  ),
  _ShareAction(
    title: 'Копировать',
    icon: LucideIcons.copy,
    iconColor: DateasyColors.backgroundDeep,
    gradient: dateasyLimeGradient,
  ),
];
