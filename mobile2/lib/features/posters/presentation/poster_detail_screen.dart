import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:url_launcher/url_launcher.dart';

class PosterDetailScreen extends ConsumerWidget {
  const PosterDetailScreen({super.key, required this.posterId});

  final String posterId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(posterDetailProvider(posterId));
    return DateasyPhoneFrame(
      child: state.when(
        data: (poster) => _PosterDetailBody(poster: poster),
        loading: () => const _PosterDetailState(
          icon: LucideIcons.ticket,
          text: 'Загружаю афишу',
          loading: true,
        ),
        error: (_, __) => const _PosterDetailState(
          icon: LucideIcons.circleAlert,
          text: 'Афиша недоступна',
        ),
      ),
    );
  }
}

class _PosterDetailBody extends StatelessWidget {
  const _PosterDetailBody({required this.poster});

  final BackendCardItem poster;

  Future<void> _openTicket(BuildContext context) async {
    final url = _posterActionUrl(poster);
    final uri = url == null ? null : Uri.tryParse(url);
    if (uri != null && uri.hasScheme) {
      final opened = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (opened) {
        return;
      }
    }
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Backend не отдает ссылку на билет'),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DateasyColors.surface2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final place = _posterPlace(poster);
    final address = _posterAddress(poster);
    final price = _posterPrice(poster);
    final description = _posterDescription(poster);
    final bottomPadding = MediaQuery.paddingOf(context).bottom;
    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _PosterHero(
                poster: poster,
                onBack: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/posters');
                  }
                },
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(20, 22, 20, bottomPadding + 118),
              sliver: SliverList.list(
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoChip(
                          icon: LucideIcons.clock,
                          label: _formatDate(poster.startsAt)),
                      _InfoChip(icon: LucideIcons.mapPin, label: place),
                      if (price.isNotEmpty)
                        _InfoChip(icon: LucideIcons.ticket, label: price),
                    ],
                  ),
                  if (address.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _InfoRow(icon: LucideIcons.navigation, label: address),
                  ],
                  const SizedBox(height: 22),
                  Text(
                    description.isEmpty
                        ? 'Описание появится позже'
                        : description,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: DateasyColors.foreground,
                          fontSize: 15,
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
        Positioned(
          left: 20,
          right: 20,
          bottom: bottomPadding + 18,
          child: Row(
            children: [
              Expanded(
                child: _PrimaryButton(
                  icon: LucideIcons.users,
                  label: 'Собрать компанию',
                  onTap: () => context.go(
                    '/meetings/new?afficheEventId=${Uri.encodeComponent(poster.id)}',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _TicketButton(onTap: () => _openTicket(context)),
            ],
          ),
        ),
      ],
    );
  }
}

class _PosterHero extends StatelessWidget {
  const _PosterHero({
    required this.poster,
    required this.onBack,
  });

  final BackendCardItem poster;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 390,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DateasyRemoteImage(
            imageUrl: poster.imageUrl,
            usage: DateasyImageUsage.hero,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  Color(0xF215082C),
                  Color(0x6615082C),
                  Color(0x0015082C),
                ],
                stops: [0, 0.58, 1],
              ),
            ),
          ),
          Positioned(
            left: 16,
            top: MediaQuery.paddingOf(context).top + 12,
            child: _RoundIconButton(
              icon: LucideIcons.arrowLeft,
              onTap: onBack,
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if ((poster.city ?? '').isNotEmpty) ...[
                  _Tag(label: poster.city!),
                  const SizedBox(height: 12),
                ],
                Text(
                  poster.title,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        color: Colors.white,
                        fontSize: 32,
                        height: 1.05,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PosterDetailState extends StatelessWidget {
  const _PosterDetailState({
    required this.icon,
    required this.text,
    this.loading = false,
  });

  final IconData icon;
  final String text;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (loading)
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: DateasyColors.lime,
              ),
            )
          else
            Icon(icon, size: 32, color: DateasyColors.muted),
          const SizedBox(height: 12),
          Text(
            text,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 54,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: dateasyLimeGradient,
          boxShadow: const [
            BoxShadow(
              color: Color(0x66BEFF67),
              blurRadius: 28,
              spreadRadius: -10,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: DateasyColors.backgroundDeep),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TicketButton extends StatelessWidget {
  const _TicketButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: DateasyColors.foreground,
          borderRadius: BorderRadius.circular(18),
        ),
        child: const Icon(
          LucideIcons.ticket,
          color: DateasyColors.backgroundDeep,
          size: 20,
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
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
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, color: DateasyColors.foreground, size: 20),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: DateasyColors.lime),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.foreground,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: DateasyColors.muted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 13,
                ),
          ),
        ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: DateasyColors.lime,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.backgroundDeep,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

String _posterPlace(BackendCardItem poster) {
  return _rawString(poster.raw, const ['venue', 'venueName', 'placeName']) ??
      _nestedRawString(poster.raw, 'place', const ['name', 'title']) ??
      poster.subtitle ??
      poster.city ??
      'Место уточняется';
}

String _posterAddress(BackendCardItem poster) {
  return _rawString(poster.raw, const ['address', 'locationAddress']) ??
      _nestedRawString(poster.raw, 'place', const ['address']) ??
      '';
}

String _posterDescription(BackendCardItem poster) {
  return _rawString(poster.raw, const ['description', 'body', 'details']) ?? '';
}

String _posterPrice(BackendCardItem poster) {
  return _rawString(poster.raw, const ['price', 'priceMode']) ?? '';
}

String? _posterActionUrl(BackendCardItem poster) {
  return _rawString(
    poster.raw,
    const ['actionUrl', 'ticketUrl', 'bookingUrl', 'url'],
  );
}

String? _nestedRawString(
  Map<String, Object?> raw,
  String key,
  List<String> fields,
) {
  final nested = raw[key];
  if (nested is! Map) {
    return null;
  }
  return _rawString(
    nested.map((key, value) => MapEntry('$key', value)),
    fields,
  );
}

String? _rawString(Map<String, Object?> raw, List<String> keys) {
  for (final key in keys) {
    final value = raw[key]?.toString().trim();
    if (value != null && value.isNotEmpty) {
      return value;
    }
  }
  return null;
}

String _formatDate(DateTime? value) {
  if (value == null) {
    return 'Время уточняется';
  }
  final local = value.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day.$month · $hour:$minute';
}
