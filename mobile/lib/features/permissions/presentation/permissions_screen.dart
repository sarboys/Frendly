import 'package:big_break_mobile/app/core/device/app_permission_service.dart';
import 'package:big_break_mobile/app/core/device/app_permission_preferences.dart';
import 'package:big_break_mobile/app/core/device/app_push_token_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PermissionsScreen extends ConsumerStatefulWidget {
  const PermissionsScreen({super.key});

  @override
  ConsumerState<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends ConsumerState<PermissionsScreen> {
  UserSettingsData? _baseSettings;
  bool _allowLocation = false;
  bool _allowPush = false;
  bool _allowContacts = false;
  bool _saving = false;
  bool _didHydrateRemoteState = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final settingsAsync = ref.watch(settingsProvider);
    final remoteSettings = settingsAsync.valueOrNull;
    _baseSettings =
        remoteSettings ?? _baseSettings ?? UserSettingsData.fallback;
    if (remoteSettings != null && !_didHydrateRemoteState) {
      _allowLocation = remoteSettings.allowLocation;
      _allowPush = remoteSettings.allowPush;
      _allowContacts = remoteSettings.allowContacts;
      _didHydrateRemoteState = true;
    }
    final isLoadingRemote = settingsAsync.isLoading && remoteSettings == null;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
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
                  if (isLoadingRemote)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: LinearProgressIndicator(
                        color: colors.primary,
                        backgroundColor: colors.primarySoft,
                        minHeight: 3,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  Text(
                    'Разреши доступ',
                    style: AppTextStyles.sectionTitle.copyWith(fontSize: 28),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Без этого Frendly работает скучнее. Можно поменять в настройках в любой момент.',
                    style:
                        AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  _PermissionTile(
                    title: 'Геолокация',
                    description: 'Покажем встречи и людей в твоём районе',
                    icon: Icons.place_outlined,
                    accentBackground: colors.primarySoft,
                    accentForeground: colors.primary,
                    value: _allowLocation,
                    onChanged: _handleLocationToggle,
                  ),
	                  _PermissionTile(
	                    title: 'Уведомления',
	                    description:
	                        'Приглашения, лайки и напоминания о вечере',
                    icon: Icons.notifications_none_rounded,
                    accentBackground: colors.secondarySoft,
                    accentForeground: colors.secondary,
                    value: _allowPush,
                    onChanged: _handleNotificationsToggle,
                  ),
                  _PermissionTile(
                    title: 'Контакты',
                    description:
                        'Найдём друзей, которые уже здесь. Никому не покажем',
                    icon: Icons.groups_rounded,
                    accentBackground: colors.warmStart,
                    accentForeground: colors.foreground,
                    value: _allowContacts,
                    onChanged: _handleContactsToggle,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Frendly никогда не публикует твоё точное местоположение и не делится контактами с третьими сторонами.',
                    style: AppTextStyles.meta.copyWith(color: colors.inkMute),
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
                      onPressed: _saving
                          ? null
                          : () async {
                              setState(() {
                                _saving = true;
                              });
                              try {
                                final savedSettings = await ref
                                    .read(backendRepositoryProvider)
                                    .updateSettings(
                                      (_baseSettings ??
                                              UserSettingsData.fallback)
                                          .copyWith(
                                        allowLocation: _allowLocation,
                                        allowPush: _allowPush,
                                        allowContacts: _allowContacts,
                                      ),
                                    );
                                await ref
                                    .read(appPermissionPreferencesProvider)
                                    .syncFromSettings(savedSettings);
                                ref.invalidate(settingsProvider);
                                if (context.mounted) {
                                  context.goRoute(AppRoute.addPhoto);
                                }
                              } finally {
                                if (mounted) {
                                  setState(() {
                                    _saving = false;
                                  });
                                }
                              }
                            },
                      child: Text(
                        'Продолжить',
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
        ),
      ),
    );
  }

  Future<void> _handleLocationToggle(bool nextValue) async {
    if (!nextValue) {
      setState(() {
        _allowLocation = false;
      });
      return;
    }

    final granted =
        await ref.read(appPermissionServiceProvider).requestLocation();
    if (!mounted) {
      return;
    }

    setState(() {
      _allowLocation = granted;
    });
    if (!granted) {
      _showPermissionHint('Доступ к геолокации не выдан.');
    }
  }

  Future<void> _handleNotificationsToggle(bool nextValue) async {
    if (!nextValue) {
      setState(() {
        _allowPush = false;
      });
      return;
    }

    final granted =
        await ref.read(appPermissionServiceProvider).requestNotifications();
    if (!mounted) {
      return;
    }

    if (!granted) {
      _showPermissionHint('Доступ к уведомлениям не выдан.');
      setState(() {
        _allowPush = false;
      });
      return;
    }

    final pushToken =
        await ref.read(appPushTokenServiceProvider).registerDeviceToken();
    if (pushToken == null) {
      _showPermissionHint('Push пока недоступны в этом билде.');
      setState(() {
        _allowPush = false;
      });
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

    setState(() {
      _allowPush = true;
    });
  }

  Future<void> _handleContactsToggle(bool nextValue) async {
    if (!nextValue) {
      setState(() {
        _allowContacts = false;
      });
      return;
    }

    final granted =
        await ref.read(appPermissionServiceProvider).requestContacts();
    if (!mounted) {
      return;
    }

    setState(() {
      _allowContacts = granted;
    });
    if (!granted) {
      _showPermissionHint('Доступ к контактам не выдан.');
    }
  }

  void _showPermissionHint(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({
    required this.title,
    required this.description,
    required this.icon,
    required this.accentBackground,
    required this.accentForeground,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String description;
  final IconData icon;
  final Color accentBackground;
  final Color accentForeground;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: value ? colors.foreground : colors.border,
          width: value ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(20),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: accentBackground,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 20, color: accentForeground),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(description,
                      style:
                          AppTextStyles.meta.copyWith(color: colors.inkMute)),
                ],
              ),
            ),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: value ? colors.foreground : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(
                  color: value ? colors.foreground : colors.border,
                  width: 2,
                ),
              ),
              child: value
                  ? Icon(
                      Icons.check_rounded,
                      size: 18,
                      color: colors.primaryForeground,
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
