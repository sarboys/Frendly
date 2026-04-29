import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/dating_profile.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

bool hasPremiumDatingAccess(SubscriptionStateData? state) {
  if (state == null) {
    return false;
  }

  return state.status == 'trial' || state.status == 'active';
}

final datingDiscoverProvider =
    FutureProvider<List<DatingProfileData>>((ref) async {
  try {
    await ref.watch(authBootstrapProvider.future);
  } catch (_) {
    return const [];
  }

  SubscriptionStateData? subscription;
  try {
    subscription = await ref.watch(subscriptionStateProvider.future);
  } catch (_) {
    return const [];
  }

  if (!hasPremiumDatingAccess(subscription)) {
    return const [];
  }

  try {
    return await ref
        .read(backendRepositoryProvider)
        .fetchDatingDiscover()
        .then((value) => value.items);
  } catch (_) {
    final people = await ref.read(backendRepositoryProvider).fetchPeople();
    return people.items.map(_mapPersonToDatingFallback).toList(growable: false);
  }
});

final datingLikesProvider =
    FutureProvider<List<DatingProfileData>>((ref) async {
  try {
    await ref.watch(authBootstrapProvider.future);
  } catch (_) {
    return const [];
  }

  SubscriptionStateData? subscription;
  try {
    subscription = await ref.watch(subscriptionStateProvider.future);
  } catch (_) {
    return const [];
  }

  if (!hasPremiumDatingAccess(subscription)) {
    return const [];
  }

  try {
    return await ref
        .read(backendRepositoryProvider)
        .fetchDatingLikes()
        .then((value) => value.items);
  } catch (_) {
    return const [];
  }
});

DatingProfileData _mapPersonToDatingFallback(PersonSummary person) {
  final tags = person.common.isNotEmpty
      ? person.common.take(3).toList(growable: false)
      : <String>[
          if ((person.area ?? '').isNotEmpty) person.area!,
          if ((person.vibe ?? '').isNotEmpty) person.vibe!,
        ];

  return DatingProfileData(
    userId: person.id,
    name: person.name,
    age: person.age,
    distance: 'Рядом',
    about: 'Пока используем fallback список, чтобы dating экран не ломался.',
    tags: tags,
    prompt: 'Можно начать с лайка plus потом перевести в чат.',
    photoEmoji: person.online ? '💘' : '✨',
    avatarUrl: person.avatarUrl,
    likedYou: false,
    premium: true,
    vibe: person.vibe,
    area: person.area,
    verified: person.verified,
    online: person.online,
  );
}
