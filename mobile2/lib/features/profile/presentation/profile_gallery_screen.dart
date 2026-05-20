import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class ProfileGalleryScreen extends ConsumerWidget {
  const ProfileGalleryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(ownProfileProvider);
    final photos = _profilePhotos(profileState.valueOrNull);
    return DateasyPhoneFrame(
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          20,
          MediaQuery.paddingOf(context).top + 16,
          20,
          96,
        ),
        children: [
          const _Header(),
          const SizedBox(height: 16),
          Text(
            profileState.isLoading && photos.isEmpty
                ? 'Загружаем фото'
                : '${photos.length} фото · обновлено сегодня',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
          const SizedBox(height: 12),
          if (profileState.hasError && photos.isEmpty)
            const _InlineState(text: 'Не удалось загрузить фото')
          else if (photos.isEmpty)
            const _InlineState(text: 'Фото пока нет')
          else
            _GalleryGrid(photos: photos),
          const SizedBox(height: 24),
          const _UploadMoreButton(),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _GlassIconButton(
          icon: LucideIcons.chevronLeft,
          onTap: () => context.go('/profile'),
        ),
        const Spacer(),
        Text(
          'Галерея',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Sora',
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
        ),
        const Spacer(),
        GestureDetector(
          onTap: () => context.go('/profile/edit'),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: dateasyLimeGradient,
            ),
            child: const Icon(
              LucideIcons.plus,
              size: 21,
              color: DateasyColors.backgroundDeep,
            ),
          ),
        ),
      ],
    );
  }
}

class _GalleryGrid extends StatelessWidget {
  const _GalleryGrid({required this.photos});

  final List<String> photos;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: photos.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemBuilder: (context, index) {
        return _GalleryTile(
          imageUrl: photos[index],
          primary: index == 0,
        );
      },
    );
  }
}

class _GalleryTile extends StatelessWidget {
  const _GalleryTile({
    required this.imageUrl,
    required this.primary,
  });

  final String imageUrl;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Stack(
        fit: StackFit.expand,
        children: [
          DateasyRemoteImage(
            imageUrl: imageUrl,
            usage: DateasyImageUsage.card,
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: DateasyColors.border),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          if (primary)
            Positioned(
              top: 6,
              left: 6,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: ColoredBox(
                  color: DateasyColors.background.withValues(alpha: 0.72),
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    child: Text(
                      'Главное',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontSize: 10,
                            color: DateasyColors.foreground,
                          ),
                    ),
                  ),
                ),
              ),
            ),
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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _UploadMoreButton extends StatelessWidget {
  const _UploadMoreButton();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/profile/edit'),
      child: CustomPaint(
        painter: _DashedBorderPainter(
          color: Colors.white.withValues(alpha: 0.15),
          radius: 16,
        ),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: DateasyColors.glass.withValues(alpha: 0.84),
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons.camera,
                  size: 17,
                  color: DateasyColors.muted,
                ),
                const SizedBox(width: 8),
                Text(
                  'Загрузить ещё фото',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 14,
                      ),
                ),
              ],
            ),
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
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, size: 20, color: DateasyColors.foreground),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({
    required this.color,
    required this.radius,
  });

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Offset.zero & size,
          Radius.circular(radius),
        ),
      );

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + 7;
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance = next + 6;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.radius != radius;
  }
}

List<String> _profilePhotos(BackendCardItem? profile) {
  if (profile == null) {
    return const [];
  }
  final photos = profile.raw['photos'];
  if (photos is! List) {
    final avatar = profile.imageUrl;
    return avatar == null || avatar.isEmpty ? const [] : [avatar];
  }
  final urls = photos
      .whereType<Map>()
      .map((photo) => photo['url'] ?? (photo['media'] as Map?)?['url'])
      .map((value) => value?.toString() ?? '')
      .where((url) => url.isNotEmpty)
      .toList(growable: false);
  if (urls.isNotEmpty) {
    return urls;
  }
  final avatar = profile.imageUrl;
  return avatar == null || avatar.isEmpty ? const [] : [avatar];
}
