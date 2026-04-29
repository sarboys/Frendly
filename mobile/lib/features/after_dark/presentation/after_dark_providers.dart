import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final afterDarkAccessProvider =
    FutureProvider<AfterDarkAccessData>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchAfterDarkAccess();
});

final afterDarkEventsProvider =
    FutureProvider<List<AfterDarkEvent>>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchAfterDarkEvents()
      .then((value) => value.items);
});

final afterDarkEventDetailProvider =
    FutureProvider.family<AfterDarkEventDetail, String>((ref, eventId) async {
  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchAfterDarkEventDetail(eventId);
});

Future<void> openAfterDarkEntry(BuildContext context, WidgetRef ref) async {
  final access = await ref.read(afterDarkAccessProvider.future);
  if (!context.mounted) {
    return;
  }

  await context.pushRoute(
    access.unlocked ? AppRoute.afterDark : AppRoute.afterDarkPaywall,
  );
}
