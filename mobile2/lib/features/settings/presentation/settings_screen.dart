import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/device/app_push_token_service.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

const _emailNotificationsEnabledStorageKey = 'settings.email.enabled.v1';
const _matchNotificationsEnabledStorageKey = 'settings.matches.enabled.v1';
const _darkThemeEnabledStorageKey = 'settings.dark_theme.enabled.v1';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _push = false;
  bool _pushBusy = false;
  bool _email = false;
  bool _matches = false;
  bool _dark = false;
  final Map<String, bool> _settingOverrides = <String, bool>{};
  final Set<String> _settingsBusy = <String>{};

  @override
  void initState() {
    super.initState();
    final preferences = ref.read(sharedPreferencesProvider);
    _push = preferences?.getBool(pushNotificationsEnabledStorageKey) ?? true;
    _email =
        preferences?.getBool(_emailNotificationsEnabledStorageKey) ?? false;
    _matches =
        preferences?.getBool(_matchNotificationsEnabledStorageKey) ?? true;
    _dark = preferences?.getBool(_darkThemeEnabledStorageKey) ?? true;
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(currentUserProvider);
    final ownProfile = ref.watch(ownProfileProvider);
    final wallet = ref.watch(tokenWalletProvider);
    final verification = ref.watch(verificationProvider);
    final settingsState = ref.watch(appSettingsProvider);
    final settings = settingsState.valueOrNull;
    final city = currentUser?.city ??
        ownProfile.valueOrNull?.city ??
        ownProfile.valueOrNull?.raw['city']?.toString();
    final pushValue =
        _settingOverrides['allowPush'] ?? settings?.allowPush ?? _push;
    final darkValue =
        _settingOverrides['darkMode'] ?? settings?.darkMode ?? _dark;
    final discoverableValue =
        _settingOverrides['discoverable'] ?? settings?.discoverable ?? true;
    final showAgeValue =
        _settingOverrides['showAge'] ?? settings?.showAge ?? true;

    return DateasyPhoneFrame(
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.paddingOf(context).top + 16,
          bottom: 40,
        ),
        children: [
          const _Header(),
          const _PlusCard(),
          _SettingsGroup(
            title: 'Аккаунт',
            rows: [
              _SettingRow(
                icon: LucideIcons.lock,
                label: 'Приватность',
                right: showAgeValue ? 'Возраст виден' : 'Возраст скрыт',
                onTap: _settingsBusy.contains('showAge')
                    ? null
                    : () => _handleBackendToggle('showAge', !showAgeValue),
              ),
              _SettingRow(
                icon: LucideIcons.eye,
                label: 'Видимость профиля',
                right: discoverableValue ? 'Все' : 'Скрыт',
                onTap: _settingsBusy.contains('discoverable')
                    ? null
                    : () => _handleBackendToggle(
                          'discoverable',
                          !discoverableValue,
                        ),
              ),
              _SettingRow(
                icon: LucideIcons.mapPin,
                label: 'Город',
                right: city == null || city.isEmpty ? 'Москва' : city,
              ),
              const _SettingRow(
                icon: LucideIcons.languages,
                label: 'Язык',
                right: 'Русский',
              ),
              const _SettingRow(
                icon: LucideIcons.lock,
                label: 'Редактировать профиль',
              ),
            ],
          ),
          _SettingsGroup(
            title: 'Уведомления',
            rows: [
              _SettingRow(
                icon: LucideIcons.bell,
                label: 'Push',
                toggleValue: pushValue,
                onToggle: _pushBusy
                    ? (_) {}
                    : (value) {
                        _handlePushToggle(value);
                      },
              ),
              _SettingRow(
                icon: LucideIcons.bell,
                label: 'Email',
                toggleValue: _email,
                onToggle: (value) => _saveLocalToggle(
                  _emailNotificationsEnabledStorageKey,
                  value,
                  (next) => _email = next,
                ),
              ),
              _SettingRow(
                icon: LucideIcons.bell,
                label: 'Мэтчи и встречи',
                toggleValue: _matches,
                onToggle: (value) => _saveLocalToggle(
                  _matchNotificationsEnabledStorageKey,
                  value,
                  (next) => _matches = next,
                ),
              ),
            ],
          ),
          _SettingsGroup(
            title: 'Платежи',
            rows: [
              _SettingRow(
                icon: LucideIcons.wallet,
                label: 'Кошелёк',
                right: _walletLabel(wallet),
              ),
              const _SettingRow(
                icon: LucideIcons.creditCard,
                label: 'Способы оплаты',
              ),
            ],
          ),
          _SettingsGroup(
            title: 'Безопасность',
            rows: [
              const _SettingRow(
                icon: LucideIcons.shieldAlert,
                label: 'SOS и доверенные',
              ),
              _SettingRow(
                icon: LucideIcons.shieldAlert,
                label: 'Верификация',
                right: _verificationLabel(verification.valueOrNull),
              ),
            ],
          ),
          _SettingsGroup(
            title: 'Помощь',
            rows: [
              const _SettingRow(
                icon: LucideIcons.circleQuestionMark,
                label: 'FAQ',
              ),
              const _SettingRow(
                icon: LucideIcons.globe,
                label: 'О Frendly',
              ),
              _SettingRow(
                icon: LucideIcons.moon,
                label: 'Тёмная тема',
                toggleValue: darkValue,
                onToggle: _settingsBusy.contains('darkMode')
                    ? (_) {}
                    : (value) => _handleBackendToggle(
                          'darkMode',
                          value,
                          localPreferenceKey: _darkThemeEnabledStorageKey,
                          localApply: (next) => _dark = next,
                        ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _LogoutButton(onTap: _logout),
          const SizedBox(height: 18),
          Text(
            'v 1.0.0',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }

  String _walletLabel(AsyncValue<TokenWalletData> wallet) {
    final data = wallet.valueOrNull;
    if (data != null) {
      return '${data.balance} FT';
    }
    if (wallet.hasError) {
      return 'Не загружено';
    }
    return '...';
  }

  String _verificationLabel(VerificationStateData? verification) {
    switch (verification?.status) {
      case 'verified':
        return 'Готово';
      case 'under_review':
      case 'selfie_submitted':
        return 'На проверке';
      case 'rejected':
        return 'Повторить';
      default:
        return 'Пройти';
    }
  }

  Future<void> _saveLocalToggle(
    String key,
    bool value,
    ValueChanged<bool> apply,
  ) async {
    setState(() => apply(value));
    await ref.read(sharedPreferencesProvider)?.setBool(key, value);
  }

  Future<void> _handleBackendToggle(
    String key,
    bool value, {
    String? localPreferenceKey,
    ValueChanged<bool>? localApply,
  }) async {
    if (_settingsBusy.contains(key)) {
      return;
    }
    setState(() {
      _settingsBusy.add(key);
      _settingOverrides[key] = value;
      localApply?.call(value);
    });
    try {
      await ref.read(settingsActionsProvider).update({key: value});
      if (localPreferenceKey != null) {
        await ref.read(sharedPreferencesProvider)?.setBool(
              localPreferenceKey,
              value,
            );
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _settingOverrides.remove(key);
          localApply?.call(!value);
        });
        _showNotice('Не удалось сохранить настройку.');
      }
    } finally {
      if (mounted) {
        setState(() => _settingsBusy.remove(key));
      }
    }
  }

  Future<void> _handlePushToggle(bool nextValue) async {
    if (_pushBusy) {
      return;
    }
    final previousValue = _push;
    setState(() {
      _push = nextValue;
      _settingOverrides['allowPush'] = nextValue;
      _pushBusy = true;
    });

    try {
      await ref.read(settingsActionsProvider).setPushEnabled(nextValue);
    } catch (_) {
      if (mounted) {
        setState(() {
          _push = previousValue;
          _settingOverrides.remove('allowPush');
        });
        _showNotice(
          nextValue
              ? 'Push пока недоступны в этом билде.'
              : 'Не получилось отключить push.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _pushBusy = false);
      }
    }
  }

  Future<void> _logout() async {
    await ref.read(settingsActionsProvider).logout();

    if (mounted && context.mounted) {
      context.go('/welcome');
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
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _GlassPanel(
            borderRadius: 16,
            padding: EdgeInsets.zero,
            child: GestureDetector(
              onTap: () => context.go('/profile'),
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Icon(LucideIcons.chevronLeft, size: 20),
              ),
            ),
          ),
          Expanded(
            child: Text(
              'Настройки',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          const SizedBox(width: 44),
        ],
      ),
    );
  }
}

class _PlusCard extends StatelessWidget {
  const _PlusCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/paywall'),
        child: Container(
          decoration: BoxDecoration(
            gradient: dateasyPinkGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x55FF639F),
                blurRadius: 28,
                spreadRadius: -12,
                offset: Offset(0, 16),
              ),
            ],
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: DateasyColors.background.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  LucideIcons.crown,
                  color: DateasyColors.foreground,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Frendly Plus',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Безлимит свайпов и приоритет',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.foreground
                                .withValues(alpha: 0.78),
                            fontSize: 12,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(
                LucideIcons.chevronRight,
                color: DateasyColors.foreground,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({
    required this.title,
    required this.rows,
  });

  final String title;
  final List<_SettingRow> rows;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title.toUpperCase(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                    letterSpacing: 1,
                  ),
            ),
          ),
          _GlassPanel(
            borderRadius: 16,
            padding: EdgeInsets.zero,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Column(
                children: [
                  for (var index = 0; index < rows.length; index++) ...[
                    rows[index],
                    if (index != rows.length - 1)
                      Divider(
                        height: 1,
                        color: Colors.white.withValues(alpha: 0.05),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingRow extends StatelessWidget {
  const _SettingRow({
    required this.icon,
    required this.label,
    this.right,
    this.toggleValue,
    this.onToggle,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String? right;
  final bool? toggleValue;
  final ValueChanged<bool>? onToggle;
  final VoidCallback? onTap;

  bool get _isToggle => toggleValue != null;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 16),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w400,
                ),
          ),
        ),
        if (_isToggle)
          _SwitchPill(
            value: toggleValue!,
            onChanged: onToggle ?? (_) {},
          )
        else ...[
          if (right != null) ...[
            Text(
              right!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                  ),
            ),
            const SizedBox(width: 8),
          ],
          const Icon(
            LucideIcons.chevronRight,
            size: 16,
            color: DateasyColors.muted,
          ),
        ],
      ],
    );

    if (_isToggle) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: content,
      );
    }

    return GestureDetector(
      onTap: onTap ?? () => _handleTap(context),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: content,
      ),
    );
  }

  void _handleTap(BuildContext context) {
    switch (label) {
      case 'Город':
        context.go('/city');
      case 'Язык':
        _showNotice(context, 'Язык: Русский');
      case 'Редактировать профиль':
        context.go('/profile/edit');
      case 'Кошелёк':
        context.go('/wallet');
      case 'Способы оплаты':
        _showNotice(context, 'Карты подключаются в кошельке');
      case 'SOS и доверенные':
        context.go('/sos');
      case 'Верификация':
        context.go('/verify');
      case 'FAQ':
        _showNotice(context, 'FAQ endpoint не найден');
      case 'О Frendly':
        _showNotice(context, 'Frendly');
    }
  }

  void _showNotice(BuildContext context, String message) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _SwitchPill extends StatelessWidget {
  const _SwitchPill({
    required this.value,
    required this.onChanged,
  });

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        curve: Curves.easeOutCubic,
        width: 44,
        height: 24,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          gradient: value ? dateasyLimeGradient : null,
          color: value ? null : Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 80),
          curve: Curves.easeOutCubic,
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 16,
            height: 16,
            decoration: const BoxDecoration(
              color: DateasyColors.background,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border:
                Border.all(color: DateasyColors.pink.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                LucideIcons.logOut,
                size: 16,
                color: DateasyColors.pink,
              ),
              const SizedBox(width: 8),
              Text(
                'Выйти',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.pink,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
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
