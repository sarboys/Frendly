import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:url_launcher/url_launcher.dart';

class SosScreen extends ConsumerStatefulWidget {
  const SosScreen({super.key});

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> {
  bool _pressed = false;
  bool _sosBusy = false;
  bool _settingsBusy = false;
  Timer? _holdTimer;

  @override
  void dispose() {
    _holdTimer?.cancel();
    super.dispose();
  }

  void _startSosHold() {
    if (_sosBusy) {
      return;
    }
    _holdTimer?.cancel();
    setState(() => _pressed = true);
    _holdTimer = Timer(
      const Duration(seconds: 3),
      () => unawaited(_sendSos()),
    );
  }

  void _cancelSosHold() {
    if (_sosBusy) {
      return;
    }
    _holdTimer?.cancel();
    setState(() => _pressed = false);
  }

  Future<void> _sendSos() async {
    _holdTimer?.cancel();
    if (_sosBusy) {
      return;
    }
    setState(() {
      _pressed = false;
      _sosBusy = true;
    });
    try {
      final result = await ref.read(safetyActionsProvider).createSos();
      if (!mounted) {
        return;
      }
      final count = result['notifiedContactsCount']?.toString() ?? '0';
      _showNotice('SOS отправлен. Контактов оповещено: $count');
    } catch (_) {
      if (mounted) {
        _showNotice('Не удалось отправить SOS');
      }
    } finally {
      if (mounted) {
        setState(() => _sosBusy = false);
      }
    }
  }

  Future<void> _callEmergency() async {
    final opened = await launchUrl(Uri.parse('tel:112'));
    if (!opened && mounted) {
      _showNotice('Не удалось открыть звонок 112');
    }
  }

  Future<void> _addContact() async {
    final draft = await showDialog<_TrustedContactDraft>(
      context: context,
      builder: (context) => const _AddContactDialog(),
    );
    if (draft == null) {
      return;
    }
    try {
      await ref.read(safetyActionsProvider).createTrustedContact(
            name: draft.name,
            value: draft.value,
            channel: draft.channel,
            mode: 'sos_only',
          );
      if (mounted) {
        _showNotice('${draft.name} добавлен в доверенные');
      }
    } catch (_) {
      if (mounted) {
        _showNotice('Не удалось добавить контакт');
      }
    }
  }

  Future<void> _toggleSafetySetting(String key, bool value) async {
    if (_settingsBusy) {
      return;
    }
    setState(() => _settingsBusy = true);
    try {
      await ref.read(safetyActionsProvider).updateSafety({key: value});
      if (mounted) {
        _showNotice('Настройки безопасности обновлены');
      }
    } catch (_) {
      if (mounted) {
        _showNotice('Не удалось обновить настройки');
      }
    } finally {
      if (mounted) {
        setState(() => _settingsBusy = false);
      }
    }
  }

  Future<void> _removeContact(_TrustedContact contact) async {
    try {
      await ref.read(safetyActionsProvider).deleteTrustedContact(contact.id);
      if (mounted) {
        _showNotice('${contact.name} удалён из доверенных');
      }
    } catch (_) {
      if (mounted) {
        _showNotice('Не удалось удалить контакт');
      }
    }
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
    final contactsState = ref.watch(trustedContactsProvider);
    final safetyState = ref.watch(safetyProvider);
    final settings = safetyState.valueOrNull?.settings;
    final contacts = contactsState.valueOrNull?.items
            .map(_TrustedContact.fromBackend)
            .toList(growable: false) ??
        const <_TrustedContact>[];
    return DateasyPhoneFrame(
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.paddingOf(context).top + 16,
          bottom: 52,
        ),
        children: [
          const _Header(),
          _SosHero(
            pressed: _pressed || _sosBusy,
            onPressStart: _startSosHold,
            onPressEnd: _cancelSosHold,
            onPressCancel: _cancelSosHold,
          ),
          _QuickActions(
            onCallEmergency: _callEmergency,
            onSendSos: _sendSos,
            onGap: (text) => _showNotice(text),
          ),
          if (contactsState.isLoading && contacts.isEmpty)
            const _InlineState(text: 'Загружаем контакты')
          else if (contactsState.hasError && contacts.isEmpty)
            const _InlineState(text: 'Не удалось загрузить контакты'),
          _TrustedContacts(
            contacts: contacts,
            onAdd: _addContact,
            onRemove: _removeContact,
          ),
          if (safetyState.isLoading && safetyState.valueOrNull == null)
            const _InlineState(text: 'Загружаем настройки безопасности')
          else if (safetyState.hasError && safetyState.valueOrNull == null)
            const _InlineState(text: 'Не удалось загрузить настройки'),
          _SafetyCards(
            autoSharePlans: settings?.autoSharePlans ?? false,
            busy: _settingsBusy || safetyState.isLoading,
            onToggleAutoSharePlans: (value) => _toggleSafetySetting(
              'autoSharePlans',
              value,
            ),
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
            onTap: () => context.go('/profile'),
          ),
          Text(
            'Безопасность',
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

class _SosHero extends StatelessWidget {
  const _SosHero({
    required this.pressed,
    required this.onPressStart,
    required this.onPressEnd,
    required this.onPressCancel,
  });

  final bool pressed;
  final VoidCallback onPressStart;
  final VoidCallback onPressEnd;
  final VoidCallback onPressCancel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        children: [
          SizedBox(
            width: 280,
            child: Text(
              'Удерживай кнопку 3 секунды — отправим геолокацию и оповестим контакты',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
          const SizedBox(height: 24),
          Listener(
            key: const ValueKey('sos-button'),
            behavior: HitTestBehavior.opaque,
            onPointerDown: (_) => onPressStart(),
            onPointerUp: (_) => onPressEnd(),
            onPointerCancel: (_) => onPressCancel(),
            child: AnimatedScale(
              scale: pressed ? 0.95 : 1,
              duration: const Duration(milliseconds: 130),
              child: SizedBox(
                width: 224,
                height: 224,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    _SosRing(size: 224, active: !pressed),
                    _SosRing(size: 200, active: !pressed),
                    Container(
                      width: 224,
                      height: 224,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: dateasyPinkGradient,
                        boxShadow: [
                          BoxShadow(
                            color: Color(0x66FF639F),
                            blurRadius: 34,
                            spreadRadius: -8,
                            offset: Offset(0, 18),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'SOS',
                            style: Theme.of(context)
                                .textTheme
                                .headlineLarge
                                ?.copyWith(
                                  color: DateasyColors.backgroundDeep,
                                  fontSize: 40,
                                  height: 1,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Удерживай',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.backgroundDeep
                                          .withValues(alpha: 0.8),
                                      fontSize: 12,
                                    ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 140),
            child: pressed
                ? Padding(
                    key: const ValueKey('sending'),
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      'Отправляем…',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.lime,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  )
                : const SizedBox(height: 34),
          ),
        ],
      ),
    );
  }
}

class _SosRing extends StatelessWidget {
  const _SosRing({
    required this.size,
    required this.active,
  });

  final double size;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: active ? 0.18 : 0.08,
      duration: const Duration(milliseconds: 160),
      child: Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: DateasyColors.pink,
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.onCallEmergency,
    required this.onSendSos,
    required this.onGap,
  });

  final VoidCallback onCallEmergency;
  final VoidCallback onSendSos;
  final ValueChanged<String> onGap;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Быстрые действия',
      top: 28,
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: _actions.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          mainAxisExtent: 104,
        ),
        itemBuilder: (context, index) {
          final action = _actions[index];
          return _ActionCard(
            action: action,
            onTap: () {
              switch (action.kind) {
                case _SafetyActionKind.callEmergency:
                  onCallEmergency();
                  break;
                case _SafetyActionKind.sendSos:
                  onSendSos();
                  break;
                case _SafetyActionKind.gap:
                  onGap(action.notice);
                  break;
              }
            },
          );
        },
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.action,
    required this.onTap,
  });

  final _SafetyAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(action.icon, color: action.color, size: 20),
            ),
            const Spacer(),
            Text(
              action.title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrustedContacts extends StatelessWidget {
  const _TrustedContacts({
    required this.contacts,
    required this.onAdd,
    required this.onRemove,
  });

  final List<_TrustedContact> contacts;
  final VoidCallback onAdd;
  final ValueChanged<_TrustedContact> onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ДОВЕРЕННЫЕ КОНТАКТЫ',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 12,
                      letterSpacing: 1.2,
                    ),
              ),
              GestureDetector(
                onTap: onAdd,
                child: Text(
                  '+ Добавить',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.lime,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _GlassPanel(
            borderRadius: 16,
            padding: EdgeInsets.zero,
            clip: true,
            child: contacts.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text(
                      'Контакты не добавлены',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.muted,
                          ),
                    ),
                  )
                : Column(
                    children: [
                      for (var index = 0; index < contacts.length; index++) ...[
                        _ContactRow(
                          contact: contacts[index],
                          onRemove: () => onRemove(contacts[index]),
                        ),
                        if (index != contacts.length - 1)
                          Divider(
                            height: 1,
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({
    required this.contact,
    required this.onRemove,
  });

  final _TrustedContact contact;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              gradient: dateasyLimeGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              contact.name.characters.first,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.backgroundDeep,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contact.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  contact.phone,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onRemove,
            child: const Padding(
              padding: EdgeInsets.all(6),
              child: Icon(
                LucideIcons.x,
                color: DateasyColors.muted,
                size: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SafetyCards extends StatelessWidget {
  const _SafetyCards({
    required this.autoSharePlans,
    required this.busy,
    required this.onToggleAutoSharePlans,
  });

  final bool autoSharePlans;
  final bool busy;
  final ValueChanged<bool> onToggleAutoSharePlans;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        children: [
          _SafetyCard(
            icon: LucideIcons.clock,
            iconColor: DateasyColors.lime,
            title: 'Чек-ин на встрече',
            subtitle: 'Напомним через 2 часа, всё ли ок',
            trailing: _CheckInToggle(
              value: autoSharePlans,
              onTap:
                  busy ? null : () => onToggleAutoSharePlans(!autoSharePlans),
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => context.go('/verify'),
            child: const _SafetyCard(
              icon: LucideIcons.shieldCheck,
              iconColor: DateasyColors.lime,
              title: 'Верификация профиля',
              subtitle: 'Подними доверие — больше встреч',
              trailing: Icon(
                LucideIcons.share2,
                color: DateasyColors.muted,
                size: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SafetyCard extends StatelessWidget {
  const _SafetyCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 24,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}

class _CheckInToggle extends StatelessWidget {
  const _CheckInToggle({
    required this.value,
    required this.onTap,
  });

  final bool value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const ValueKey('sos-checkin-toggle'),
      onTap: onTap,
      child: Container(
        width: 44,
        height: 24,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          gradient: value ? dateasyLimeGradient : null,
          color: value ? null : Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Align(
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 16,
            height: 16,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: DateasyColors.backgroundDeep,
            ),
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    this.top = 24,
  });

  final String title;
  final Widget child;
  final double top;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, top, 20, 0),
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

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(14),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
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
    this.clip = false,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final bool clip;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      padding: padding,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: child,
    );
  }
}

class _TrustedContact {
  const _TrustedContact({
    required this.id,
    required this.name,
    required this.phone,
  });

  final String id;
  final String name;
  final String phone;

  factory _TrustedContact.fromBackend(BackendCardItem item) {
    final channel = item.raw['channel']?.toString() ?? 'phone';
    final value = item.raw['value']?.toString() ??
        item.raw['phoneNumber']?.toString() ??
        item.subtitle ??
        channel;
    return _TrustedContact(
      id: item.id,
      name: item.title.isEmpty ? 'Контакт' : item.title,
      phone: _maskedContactValue(value, channel),
    );
  }
}

String _maskedContactValue(String value, String channel) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return channel;
  }
  if (channel == 'email') {
    final at = trimmed.indexOf('@');
    if (at <= 1) {
      return trimmed;
    }
    return '${trimmed.substring(0, 1)}***${trimmed.substring(at)}';
  }
  if (channel == 'telegram') {
    return trimmed.startsWith('@') ? trimmed : '@$trimmed';
  }
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 2) {
    return trimmed;
  }
  final prefix = digits.startsWith('7') || digits.startsWith('8') ? '+7' : '+';
  return '$prefix ··· ${digits.substring(digits.length - 2)}';
}

class _TrustedContactDraft {
  const _TrustedContactDraft({
    required this.name,
    required this.value,
    required this.channel,
  });

  final String name;
  final String value;
  final String channel;
}

class _AddContactDialog extends StatefulWidget {
  const _AddContactDialog();

  @override
  State<_AddContactDialog> createState() => _AddContactDialogState();
}

class _AddContactDialogState extends State<_AddContactDialog> {
  final _nameController = TextEditingController();
  final _valueController = TextEditingController();
  String _channel = 'phone';

  @override
  void dispose() {
    _nameController.dispose();
    _valueController.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _nameController.text.trim();
    final value = _valueController.text.trim();
    if (name.isEmpty || value.isEmpty) {
      return;
    }
    Navigator.of(context).pop(
      _TrustedContactDraft(
        name: name,
        value: value,
        channel: _channel,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: DateasyColors.surface,
      title: const Text('Доверенный контакт'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(labelText: 'Имя'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _valueController,
            keyboardType: _channel == 'email'
                ? TextInputType.emailAddress
                : TextInputType.phone,
            decoration: InputDecoration(
              labelText: _channel == 'email' ? 'Email' : 'Телефон',
            ),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'phone', label: Text('Телефон')),
              ButtonSegment(value: 'telegram', label: Text('Telegram')),
              ButtonSegment(value: 'email', label: Text('Email')),
            ],
            selected: {_channel},
            onSelectionChanged: (value) {
              setState(() => _channel = value.first);
            },
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
        FilledButton(
          onPressed: _submit,
          child: const Text('Добавить'),
        ),
      ],
    );
  }
}

enum _SafetyActionKind { callEmergency, sendSos, gap }

class _SafetyAction {
  const _SafetyAction({
    required this.kind,
    required this.icon,
    required this.title,
    required this.color,
    required this.notice,
  });

  final _SafetyActionKind kind;
  final IconData icon;
  final String title;
  final Color color;
  final String notice;
}

const _actions = [
  _SafetyAction(
    kind: _SafetyActionKind.callEmergency,
    icon: LucideIcons.phoneCall,
    title: 'Позвонить 112',
    color: DateasyColors.pink,
    notice: 'Открываем номер 112',
  ),
  _SafetyAction(
    kind: _SafetyActionKind.gap,
    icon: LucideIcons.mapPin,
    title: 'Поделиться локацией',
    color: DateasyColors.lime,
    notice: 'Endpoint для разовой геолокации не найден',
  ),
  _SafetyAction(
    kind: _SafetyActionKind.gap,
    icon: LucideIcons.bell,
    title: 'Тревожный сигнал',
    color: DateasyColors.lilac,
    notice: 'Endpoint Frendly Care не найден',
  ),
  _SafetyAction(
    kind: _SafetyActionKind.sendSos,
    icon: LucideIcons.users,
    title: 'Оповестить контакты',
    color: DateasyColors.lime,
    notice: 'SOS отправлен доверенным контактам',
  ),
];
