import 'package:big_break_mobile/app/core/maps/mapkit_bootstrap.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' as ym;

class ChatLocationScreen extends ConsumerStatefulWidget {
  const ChatLocationScreen({
    required this.latitude,
    required this.longitude,
    required this.title,
    required this.subtitle,
    super.key,
  });

  final double latitude;
  final double longitude;
  final String title;
  final String subtitle;

  @override
  ConsumerState<ChatLocationScreen> createState() => _ChatLocationScreenState();
}

class _ChatLocationScreenState extends ConsumerState<ChatLocationScreen> {
  late final Future<void> _mapBootstrapFuture;

  bool get _supportsNativeMap =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android);

  @override
  void initState() {
    super.initState();
    _mapBootstrapFuture = _supportsNativeMap
        ? ref.read(mapkitBootstrapProvider).ensureInitialized()
        : Future<void>.value();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final point = ym.Point(
      latitude: widget.latitude,
      longitude: widget.longitude,
    );

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        top: true,
        bottom: false,
        child: Stack(
          children: [
            Positioned.fill(
              child: _supportsNativeMap
                  ? FutureBuilder<void>(
                      future: _mapBootstrapFuture,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState != ConnectionState.done) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }

                        return ym.YandexMap(
                          mapObjects: [
                            ym.PlacemarkMapObject(
                              mapId: const ym.MapObjectId('chat-location'),
                              point: point,
                              text: const ym.PlacemarkText(
                                text: '📍',
                                style: ym.PlacemarkTextStyle(
                                  size: 20,
                                  placement: ym.TextStylePlacement.center,
                                  offsetFromIcon: false,
                                ),
                              ),
                            ),
                          ],
                          onMapCreated: (controller) {
                            controller.moveCamera(
                              ym.CameraUpdate.newCameraPosition(
                                ym.CameraPosition(
                                  target: point,
                                  zoom: 16,
                                ),
                              ),
                            );
                          },
                        );
                      },
                    )
                  : _FallbackLocationMap(
                      title: widget.title,
                      subtitle: widget.subtitle,
                    ),
            ),
            Positioned(
              top: 12,
              left: 16,
              right: 16,
              child: Row(
                children: [
                  _TopButton(
                    icon: Icons.chevron_left_rounded,
                    onTap: () => context.pop(),
                  ),
                  const Spacer(),
                  const _TopButton(
                    icon: Icons.place_outlined,
                    onTap: null,
                  ),
                ],
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 24,
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: AppRadii.cardBorder,
                  border: Border.all(color: colors.border),
                  boxShadow: AppShadows.card,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: colors.primarySoft,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.place_outlined,
                        color: colors.primary,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.title, style: AppTextStyles.itemTitle),
                          const SizedBox(height: 4),
                          Text(widget.subtitle, style: AppTextStyles.meta),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopButton extends StatelessWidget {
  const _TopButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.background.withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, color: colors.foreground),
        ),
      ),
    );
  }
}

class _FallbackLocationMap extends StatelessWidget {
  const _FallbackLocationMap({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.primarySoft,
            colors.background,
            colors.secondarySoft,
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _MapPin(color: colors.primary),
            const SizedBox(height: AppSpacing.md),
            Text(title, style: AppTextStyles.sectionTitle),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                subtitle,
                textAlign: TextAlign.center,
                style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin({
    required this.color,
  });

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.24),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.place_outlined,
        color: Colors.white,
        size: 28,
      ),
    );
  }
}
