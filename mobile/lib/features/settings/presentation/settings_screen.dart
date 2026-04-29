import 'dart:async';

import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/device/app_permission_service.dart';
import 'package:big_break_mobile/app/core/device/app_push_token_service.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/app/theme/app_theme_mode.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  UserSettingsData? _settings;
  bool _didHydrateFromRemote = false;
  bool _isSavingSettings = false;
  UserSettingsData? _queuedSettings;
  UserSettingsData? _lastConfirmedSettings;
  String _language = 'Русский';
  String _city = 'Москва';
  bool? _frendlyPlusEnabled;
  bool? _afterDarkEnabled;
  bool _isSavingTestingAccess = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final settingsAsync = ref.watch(settingsProvider);
    final subscription = ref.watch(subscriptionStateProvider).valueOrNull;
    final afterDarkAccess = ref.watch(afterDarkAccessProvider).valueOrNull;
    final remoteSettings = settingsAsync.valueOrNull;
    if (remoteSettings != null && !_didHydrateFromRemote) {
      _settings = remoteSettings;
      _lastConfirmedSettings = remoteSettings;
      _didHydrateFromRemote = true;
    }
    final current = _settings ?? UserSettingsData.fallback;
    final currentFrendlyPlusEnabled = _frendlyPlusEnabled ??
        (subscription?.status == 'trial' || subscription?.status == 'active');
    final currentAfterDarkEnabled =
        _afterDarkEnabled ?? (afterDarkAccess?.unlocked ?? false);
    final isLoadingRemote = settingsAsync.isLoading && remoteSettings == null;
    final hasRemoteError = settingsAsync.hasError && remoteSettings == null;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: colors.border.withValues(alpha: 0.6),
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
                      'Настройки',
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(width: 40),
                ],
              ),
            ),
            if (isLoadingRemote || hasRemoteError)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: colors.muted,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      if (isLoadingRemote) ...[
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colors.primary,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                      Expanded(
                        child: Text(
                          isLoadingRemote
                              ? 'Загружаем настройки'
                              : 'Не удалось загрузить настройки. Можно вернуться позже.',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkSoft,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            _SettingsGroup(
              title: 'Аккаунт',
              children: [
                _SettingsRow(
                    label: 'Аккаунт и безопасность',
                    sub: '+7 ··· 87, Apple ID',
                    icon: Icons.verified_user_outlined,
                    chevron: true,
                    onTap: _showAccountSecuritySheet),
                _SettingsRow(
                    label: 'Язык',
                    sub: _language,
                    icon: Icons.language_outlined,
                    chevron: true,
                    onTap: _showLanguageSheet),
                _SettingsRow(
                    label: 'Город',
                    sub: _city,
                    icon: Icons.place_outlined,
                    chevron: true,
                    onTap: _showCitySheet),
              ],
            ),
            _SettingsGroup(
              title: 'Уведомления',
              children: [
	                _SettingsToggle(
	                    label: 'Push-уведомления',
	                    sub: 'Приглашения, лайки, напоминания',
                    icon: Icons.notifications_none_rounded,
                    value: current.allowPush,
                    enabled: !isLoadingRemote && !hasRemoteError,
                    onChanged: (v) => _handlePushToggle(current, v)),
                _SettingsToggle(
                    label: 'Тихие часы',
                    sub: 'С 23:00 до 08:00',
                    icon: Icons.dark_mode_outlined,
                    value: current.quietHours,
                    enabled: !isLoadingRemote && !hasRemoteError,
                    onChanged: (v) =>
                        _saveSettings(current.copyWith(quietHours: v))),
              ],
            ),
            _SettingsGroup(
              title: 'Безопасность и доступ',
              children: [
                _SettingsRow(
                  label: 'Безопасность',
                  sub: 'Контакты, SOS, жалобы, блокировки',
                  icon: Icons.shield_outlined,
                  chevron: true,
                  onTap: () => context.pushRoute(AppRoute.safetyHub),
                ),
                _SettingsRow(
                  label: 'Верификация',
                  sub: 'Подтвердить профиль и получить галочку',
                  icon: Icons.verified_user_outlined,
                  chevron: true,
                  onTap: () => context.pushRoute(AppRoute.verification),
                ),
                _SettingsRow(
                  label: 'Frendly+',
                  sub: 'Подписка и расширенные возможности',
                  icon: Icons.auto_awesome_outlined,
                  chevron: true,
                  onTap: () => context.pushRoute(AppRoute.paywall),
                ),
                _SettingsToggle(
                  label: 'Frendly+ доступ',
                  sub: 'Быстро включить или выключить premium для тестов',
                  icon: Icons.auto_awesome_outlined,
                  value: currentFrendlyPlusEnabled,
                  enabled: !_isSavingTestingAccess,
                  onChanged: (value) => _updateTestingAccess(
                    frendlyPlusEnabled: value,
                    afterDarkEnabled: value ? currentAfterDarkEnabled : false,
                  ),
                ),
                _SettingsToggle(
                  label: 'After Dark доступ',
                  sub: 'Быстро включить или выключить After Dark для тестов',
                  icon: Icons.nightlight_outlined,
                  value: currentAfterDarkEnabled,
                  enabled: !_isSavingTestingAccess,
                  onChanged: (value) => _updateTestingAccess(
                    frendlyPlusEnabled:
                        value ? true : currentFrendlyPlusEnabled,
                    afterDarkEnabled: value,
                  ),
                ),
              ],
            ),
            _SettingsGroup(
              title: 'Приватность',
              children: [
                _SettingsToggle(
                    label: 'Показывать в поиске',
                    sub: 'Тебя смогут найти люди рядом',
                    icon: Icons.visibility_outlined,
                    value: current.discoverable,
                    enabled: !isLoadingRemote && !hasRemoteError,
                    onChanged: (v) =>
                        _saveSettings(current.copyWith(discoverable: v))),
                _SettingsToggle(
                    label: 'Показывать возраст',
                    icon: Icons.verified_rounded,
                    value: current.showAge,
                    enabled: !isLoadingRemote && !hasRemoteError,
                    onChanged: (v) =>
                        _saveSettings(current.copyWith(showAge: v))),
                _SettingsRow(
                    label: 'Заблокированные',
                    icon: Icons.visibility_outlined,
                    chevron: true,
                    onTap: () => context.pushRoute(AppRoute.safetyHub)),
              ],
            ),
            _SettingsGroup(
              title: 'Внешний вид',
              children: [
                _SettingsToggle(
                    label: 'Тёмная тема',
                    icon: Icons.dark_mode_outlined,
                    value: current.darkMode,
                    enabled: !isLoadingRemote && !hasRemoteError,
                    onChanged: (v) =>
                        _saveSettings(current.copyWith(darkMode: v))),
              ],
            ),
            _SettingsGroup(
              title: 'Поддержка',
              children: [
                _SettingsRow(
                    label: 'Помощь',
                    icon: Icons.help_outline_rounded,
                    chevron: true,
                    onTap: _showHelpSheet),
                _SettingsRow(
                    label: 'Условия и приватность',
                    icon: Icons.help_outline_rounded,
                    chevron: true,
                    onTap: _showPrivacySheet),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: AppRadii.cardBorder,
                  border: Border.all(color: colors.border),
                ),
                child: InkWell(
                  borderRadius: AppRadii.cardBorder,
                  onTap: _logout,
                  child: Center(
                    child: Text(
                      'Выйти',
                      style: AppTextStyles.body.copyWith(
                        color: colors.destructive,
                        fontWeight: FontWeight.w500,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(child: Text('Frendly · v1.0', style: AppTextStyles.caption)),
          ],
        ),
      ),
    );
  }

  void _saveSettings(UserSettingsData next) {
    setState(() {
      _settings = next;
    });
    ref.read(appThemeModeProvider.notifier).syncFromSettings(next);
    _queuedSettings = next;
    unawaited(_flushQueuedSettings());
  }

  Future<void> _flushQueuedSettings() async {
    if (_isSavingSettings) {
      return;
    }

    _isSavingSettings = true;
    UserSettingsData? lastSavedSettings;

    try {
      while (_queuedSettings != null) {
        final next = _queuedSettings!;
        _queuedSettings = null;
        lastSavedSettings =
            await ref.read(backendRepositoryProvider).updateSettings(next);
      }

      if (!mounted || lastSavedSettings == null) {
        return;
      }

      setState(() {
        _settings = lastSavedSettings;
        _lastConfirmedSettings = lastSavedSettings;
        _didHydrateFromRemote = true;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      final fallback = _lastConfirmedSettings;
      if (fallback != null) {
        setState(() {
          _settings = fallback;
        });
        ref.read(appThemeModeProvider.notifier).syncFromSettings(fallback);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось сохранить настройки')),
      );
    } finally {
      _isSavingSettings = false;
    }
  }

  Future<void> _logout() async {
    final pushTokenService = ref.read(appPushTokenServiceProvider);
    final pushDeviceId = await pushTokenService.currentDeviceId();
    if (pushDeviceId != null) {
      try {
        await ref.read(backendRepositoryProvider).deletePushTokenByDeviceId(
              pushDeviceId,
            );
      } catch (_) {}
    }

    try {
      await ref.read(backendRepositoryProvider).logout();
    } catch (_) {}

    await pushTokenService.clearRegisteredToken();
    await ref.read(appAttachmentServiceProvider).clearPrivateCache();
    ref.read(authTokensProvider.notifier).clear();
    ref.read(currentUserIdProvider.notifier).state = null;

    if (mounted) {
      context.goRoute(AppRoute.welcome);
    }
  }

  Future<void> _updateTestingAccess({
    required bool frendlyPlusEnabled,
    required bool afterDarkEnabled,
  }) async {
    final previousFrendly = _frendlyPlusEnabled;
    final previousAfterDark = _afterDarkEnabled;

    setState(() {
      _frendlyPlusEnabled = frendlyPlusEnabled;
      _afterDarkEnabled = afterDarkEnabled;
      _isSavingTestingAccess = true;
    });

    try {
      await ref.read(backendRepositoryProvider).updateTestingAccess(
            frendlyPlusEnabled: frendlyPlusEnabled,
            afterDarkEnabled: afterDarkEnabled,
          );
      ref.invalidate(subscriptionStateProvider);
      ref.invalidate(afterDarkAccessProvider);
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _frendlyPlusEnabled = previousFrendly;
        _afterDarkEnabled = previousAfterDark;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось обновить тестовый доступ')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSavingTestingAccess = false;
        });
      }
    }
  }

  Future<void> _handlePushToggle(
    UserSettingsData current,
    bool nextValue,
  ) async {
    if (!nextValue) {
      _saveSettings(current.copyWith(allowPush: false));
      return;
    }

    final granted =
        await ref.read(appPermissionServiceProvider).requestNotifications();
    if (!mounted || !granted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Доступ к уведомлениям не выдан.')),
        );
      }
      return;
    }

    final pushToken =
        await ref.read(appPushTokenServiceProvider).registerDeviceToken();
    if (!mounted || pushToken == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Push пока недоступны в этом билде.')),
        );
      }
      return;
    }

    await ref.read(backendRepositoryProvider).registerPushToken(
          token: pushToken.token,
          provider: pushToken.provider,
          deviceId: pushToken.deviceId,
          platform: pushToken.platform,
        );
    if (!mounted) {
      return;
    }

    _saveSettings(current.copyWith(allowPush: true));
  }

  Future<void> _showAccountSecuritySheet() async {
    final colors = AppColors.of(context);

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.background,
      showDragHandle: true,
      builder: (context) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Аккаунт и безопасность',
                style: AppTextStyles.sectionTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Телефон: +7 ··· 87',
                style: AppTextStyles.body,
              ),
              const SizedBox(height: 6),
              Text(
                'Вход: Apple ID',
                style: AppTextStyles.body,
              ),
              const SizedBox(height: 6),
              Text(
                'Пароль здесь не используется. Вход идет по коду и Apple ID.',
                style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showHelpSheet() async {
    final colors = AppColors.of(context);

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.background,
      showDragHandle: true,
      builder: (context) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Помощь',
                style: AppTextStyles.sectionTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Если что-то сломалось, открой Безопасность и поддержку или напиши в саппорт из Safety Hub.',
                style: AppTextStyles.body,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showPrivacySheet() async {
    final colors = AppColors.of(context);

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.background,
      showDragHandle: true,
      builder: (context) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Условия и приватность',
                style: AppTextStyles.sectionTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Мы показываем только нужные данные для встреч, не публикуем точную точку без согласия и даём управлять приватностью прямо в настройках.',
                style: AppTextStyles.body,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showLanguageSheet() async {
    final next = await _showOptionSheet(
      title: 'Выбери язык',
      currentValue: _language,
      options: const ['Русский', 'English'],
    );

    if (next == null || !mounted) {
      return;
    }

    setState(() {
      _language = next;
    });
  }

  Future<void> _showCitySheet() async {
    final next = await _showOptionSheet(
      title: 'Выбери город',
      currentValue: _city,
      options: const ['Москва', 'Санкт-Петербург', 'Казань'],
    );

    if (next == null || !mounted) {
      return;
    }

    setState(() {
      _city = next;
    });
  }

  Future<String?> _showOptionSheet({
    required String title,
    required String currentValue,
    required List<String> options,
  }) {
    final colors = AppColors.of(context);

    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: colors.background,
      showDragHandle: true,
      builder: (context) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.sectionTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: AppSpacing.md),
              for (final option in options)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => Navigator.of(context).pop(option),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: option == currentValue
                            ? colors.primarySoft
                            : colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: option == currentValue
                              ? colors.primary.withValues(alpha: 0.25)
                              : colors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              option,
                              style: AppTextStyles.body.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (option == currentValue)
                            Icon(
                              Icons.check_rounded,
                              size: 18,
                              color: colors.primary,
                            ),
                        ],
                      ),
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

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(title,
                style: AppTextStyles.caption.copyWith(letterSpacing: 1)),
          ),
          const SizedBox(height: 8),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              children: [
                for (var index = 0; index < children.length; index++) ...[
                  if (index > 0)
                    Divider(
                      height: 1,
                      thickness: 1,
                      color: colors.border,
                    ),
                  children[index],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.label,
    required this.icon,
    this.sub,
    this.chevron = false,
    this.onTap,
  });

  final String label;
  final String? sub;
  final IconData icon;
  final bool chevron;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colors.muted,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: colors.inkSoft),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: AppTextStyles.body.copyWith(
                            fontSize: 14, fontWeight: FontWeight.w500)),
                    if (sub != null)
                      Text(
                        sub!,
                        style:
                            AppTextStyles.meta.copyWith(color: colors.inkMute),
                      ),
                  ],
                ),
              ),
              if (chevron)
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: colors.inkMute,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsToggle extends StatelessWidget {
  const _SettingsToggle({
    required this.label,
    required this.icon,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.sub,
  });

  final String label;
  final String? sub;
  final IconData icon;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? () => onChanged(!value) : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colors.muted,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: colors.inkSoft),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: AppTextStyles.body.copyWith(
                            fontSize: 14, fontWeight: FontWeight.w500)),
                    if (sub != null)
                      Text(
                        sub!,
                        style:
                            AppTextStyles.meta.copyWith(color: colors.inkMute),
                      ),
                  ],
                ),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 48,
                height: 28,
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: value
                      ? colors.primary
                      : colors.muted.withValues(alpha: enabled ? 1 : 0.6),
                  borderRadius: BorderRadius.circular(999),
                ),
                alignment: value ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: colors.background.withValues(
                      alpha: enabled ? 1 : 0.75,
                    ),
                    borderRadius: BorderRadius.circular(999),
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
