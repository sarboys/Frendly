import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

const _dateasyCities = [
  'Москва',
  'Санкт-Петербург',
  'Сочи',
  'Казань',
  'Дубай',
  'Тбилиси',
  'Ереван',
  'Алматы',
  'Берлин',
  'Лиссабон',
];

class DateasyTopBar extends ConsumerWidget {
  const DateasyTopBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(tokenWalletProvider);
    final balance = wallet.valueOrNull?.balance.toString() ?? '0';
    final unreadNotifications = ref.watch(
      notificationUnreadCountProvider.select(
        (value) => value.maybeWhen(
          data: (count) => count,
          orElse: () => 0,
        ),
      ),
    );
    final user = ref.watch(currentUserProvider);
    final city = user?.city?.trim();
    final cityLabel = city == null || city.isEmpty ? 'Москва' : city;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _CityPill(
            city: cityLabel,
            onTap: () => _showCityPicker(context),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: GestureDetector(
              onTap: () => context.go('/wallet'),
              child: _GlassBox(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      LucideIcons.coins,
                      color: DateasyColors.lime,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      balance,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontFamily: 'Sora',
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'FT',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _IconButtonGlass(
            icon: LucideIcons.bell,
            showDot: unreadNotifications > 0,
            onTap: () => context.go('/notifications'),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: _ProfileAvatar(imageUrl: user?.avatarUrl),
          ),
        ],
      ),
    );
  }

  void _showCityPicker(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _CityPickerSheet(),
    );
  }
}

class _CityPill extends StatelessWidget {
  const _CityPill({required this.city, required this.onTap});

  final String city;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        constraints: const BoxConstraints(maxWidth: 126),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('📍', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                city,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.foreground,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
            const SizedBox(width: 3),
            const Icon(
              LucideIcons.chevronDown,
              color: DateasyColors.muted,
              size: 14,
            ),
          ],
        ),
      ),
    );
  }
}

class _CityPickerSheet extends ConsumerStatefulWidget {
  const _CityPickerSheet();

  @override
  ConsumerState<_CityPickerSheet> createState() => _CityPickerSheetState();
}

class _CityPickerSheetState extends ConsumerState<_CityPickerSheet> {
  bool _detecting = false;
  String? _error;

  Future<void> _saveCity(String city) async {
    setState(() {
      _detecting = true;
      _error = null;
    });
    try {
      await ref.read(profileActionsProvider).updateCity(city);
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Не удалось сохранить город');
      }
    } finally {
      if (mounted) {
        setState(() => _detecting = false);
      }
    }
  }

  Future<void> _detectCity() async {
    setState(() {
      _detecting = true;
      _error = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => _error = 'Разреши геолокацию или выбери город вручную');
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      final places = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );
      final city = _cityFromPlacemark(places.isEmpty ? null : places.first);
      if (city == null) {
        setState(() => _error = 'Не смог определить город');
        return;
      }
      await _saveCity(city);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Не удалось определить город');
      }
    } finally {
      if (mounted) {
        setState(() => _detecting = false);
      }
    }
  }

  String? _cityFromPlacemark(Placemark? place) {
    final values = [
      place?.locality,
      place?.subAdministrativeArea,
      place?.administrativeArea,
    ];
    for (final value in values) {
      final text = value?.trim();
      if (text != null && text.isNotEmpty) {
        return text;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    final currentCity = ref.watch(currentUserProvider)?.city?.trim();
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, bottom + 16),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: DateasyColors.backgroundDeep,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Город',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 12),
              _VpnNotice(),
              const SizedBox(height: 12),
              _DetectButton(
                busy: _detecting,
                onTap: _detecting ? null : _detectCity,
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.pink,
                      ),
                ),
              ],
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final city in _dateasyCities)
                    _CityChip(
                      city: city,
                      selected: currentCity == city,
                      onTap: _detecting ? null : () => _saveCity(city),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _detecting
                    ? null
                    : () {
                        Navigator.of(context).pop();
                        context.go('/city');
                      },
                child: const Text(
                  'Открыть полный выбор города',
                  style: TextStyle(
                    color: DateasyColors.lime,
                    fontWeight: FontWeight.w800,
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

class _VpnNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DateasyColors.lime.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: DateasyColors.lime.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.shieldAlert, color: DateasyColors.lime),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Если включен VPN, укажи город вручную.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.foreground,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetectButton extends StatelessWidget {
  const _DetectButton({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: DateasyColors.lime,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Center(
          child: busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: DateasyColors.backgroundDeep,
                  ),
                )
              : Text(
                  'Определить автоматически',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontWeight: FontWeight.w900,
                      ),
                ),
        ),
      ),
    );
  }
}

class _CityChip extends StatelessWidget {
  const _CityChip({
    required this.city,
    required this.selected,
    required this.onTap,
  });

  final String city;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: selected
              ? DateasyColors.lime
              : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        child: Text(
          city,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected
                    ? DateasyColors.backgroundDeep
                    : DateasyColors.foreground,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

class _GlassBox extends StatelessWidget {
  const _GlassBox({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: child,
    );
  }
}

class _IconButtonGlass extends StatelessWidget {
  const _IconButtonGlass({
    required this.icon,
    required this.onTap,
    this.showDot = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            ),
            child: Icon(icon, color: DateasyColors.foreground, size: 21),
          ),
          if (showDot)
            Positioned(
              right: 5,
              top: 5,
              child: Container(
                width: 9,
                height: 9,
                decoration: const BoxDecoration(
                  color: DateasyColors.pink,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl == null || imageUrl!.isEmpty
          ? const Icon(
              LucideIcons.user,
              color: DateasyColors.muted,
              size: 22,
            )
          : DateasyRemoteImage(
              imageUrl: imageUrl!,
              usage: DateasyImageUsage.avatar,
              fit: BoxFit.cover,
            ),
    );
  }
}
