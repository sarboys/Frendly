import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile2/app/core/config/backend_config.dart';
import 'package:mobile2/app/core/device/app_push_token_service.dart';
import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_cache_store.dart';
import 'package:mobile2/app/core/network/chat_socket_client.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';

typedef CardPage = BackendPage<BackendCardItem>;
typedef SafetyReportPage = BackendPage<SafetyReportData>;
typedef BlockedUserPage = BackendPage<BlockedUserData>;

enum ChatListKind { all, meetups, personal, unread }

class EventListQuery {
  const EventListQuery({
    this.city,
    this.filter,
    this.query,
    this.lifestyle,
    this.price,
    this.gender,
    this.access,
    this.date,
    this.limit = 20,
  });

  final String? city;
  final String? filter;
  final String? query;
  final String? lifestyle;
  final String? price;
  final String? gender;
  final String? access;
  final String? date;
  final int limit;

  String cacheValue({String? resolvedCity}) {
    return [
      'limit=$limit',
      if ((resolvedCity ?? city) != null && (resolvedCity ?? city)!.isNotEmpty)
        'city=${resolvedCity ?? city}',
      if (filter != null && filter!.isNotEmpty) 'filter=$filter',
      if (query != null && query!.isNotEmpty) 'q=$query',
      if (lifestyle != null && lifestyle!.isNotEmpty) 'lifestyle=$lifestyle',
      if (price != null && price!.isNotEmpty) 'price=$price',
      if (gender != null && gender!.isNotEmpty) 'gender=$gender',
      if (access != null && access!.isNotEmpty) 'access=$access',
      if (date != null && date!.isNotEmpty) 'date=$date',
    ].join('&');
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is EventListQuery &&
            other.city == city &&
            other.filter == filter &&
            other.query == query &&
            other.lifestyle == lifestyle &&
            other.price == price &&
            other.gender == gender &&
            other.access == access &&
            other.date == date &&
            other.limit == limit;
  }

  @override
  int get hashCode => Object.hash(
        filter,
        city,
        query,
        lifestyle,
        price,
        gender,
        access,
        date,
        limit,
      );
}

class BackendActionException implements Exception {
  const BackendActionException({
    required this.message,
    this.code,
  });

  final String message;
  final String? code;

  factory BackendActionException.fromDio(DioException error) {
    final data = error.response?.data;
    final code = data is Map ? data['code']?.toString() : null;
    final message = data is Map
        ? data['message']?.toString() ?? 'Backend request failed'
        : 'Backend request failed';
    return BackendActionException(message: message, code: code);
  }

  @override
  String toString() {
    return code == null ? message : '$message ($code)';
  }
}

final homeEventsProvider =
    homeEventsQueryProvider(const EventListQuery(limit: 6));

final homeEventsQueryProvider =
    StreamProvider.autoDispose.family<CardPage, EventListQuery>((ref, query) {
  final city = query.city ?? _currentCity(ref);
  return _localFirstPageStream(
    ref,
    namespace: 'events',
    cacheValue: 'home?${query.cacheValue(resolvedCity: city)}',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchEvents(
      city: city,
      filter: query.filter,
      query: query.query,
      lifestyle: query.lifestyle,
      price: query.price,
      gender: query.gender,
      access: query.access,
      date: query.date,
      limit: query.limit,
      cancelToken: cancelToken,
    ),
  );
});

final meetingsProvider = meetingsQueryProvider(const EventListQuery(limit: 20));

final meetingsQueryProvider =
    StreamProvider.autoDispose.family<CardPage, EventListQuery>((ref, query) {
  final city = query.city ?? _currentCity(ref);
  return _localFirstPageStream(
    ref,
    namespace: 'events',
    cacheValue: 'meetings?${query.cacheValue(resolvedCity: city)}',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchEvents(
      city: city,
      filter: query.filter,
      query: query.query,
      lifestyle: query.lifestyle,
      price: query.price,
      gender: query.gender,
      access: query.access,
      date: query.date,
      limit: query.limit,
      cancelToken: cancelToken,
    ),
  );
});

final meetingDetailProvider =
    FutureProvider.autoDispose.family<BackendCardItem, String>((ref, id) {
  return _localFirstValueFuture<BackendCardItem>(
    ref,
    namespace: 'events',
    cacheValue: 'detail:$id',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchEventDetail(
      id,
      cancelToken: cancelToken,
    ),
    encode: (event) => event.raw,
    decode: BackendCardItem.fromJson,
  );
});

final ownProfileProvider = FutureProvider.autoDispose<BackendCardItem>((ref) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchOwnProfile(cancelToken: cancelToken);
  }
  return localFirst.fetch<BackendCardItem>(
    key: AppCacheKey(
      namespace: 'profile',
      value: 'me',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 5),
    network: () async {
      final profile = await repository.fetchOwnProfile(
        cancelToken: cancelToken,
      );
      return profile.raw;
    },
    decode: BackendCardItem.fromJson,
  );
});

final onboardingProvider = FutureProvider.autoDispose<OnboardingData>((ref) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchOnboarding(cancelToken: cancelToken);
  }
  return localFirst.fetch<OnboardingData>(
    key: AppCacheKey(
      namespace: 'onboarding',
      value: 'me',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 5),
    network: () async {
      final onboarding = await repository.fetchOnboarding(
        cancelToken: cancelToken,
      );
      return onboarding.raw;
    },
    decode: OnboardingData.fromJson,
  );
});

final onboardingFlowControllerProvider = Provider<OnboardingFlowController>(
  OnboardingFlowController.new,
);

final appSettingsProvider = FutureProvider.autoDispose<AppSettingsData>((ref) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchSettings(cancelToken: cancelToken);
  }
  return localFirst.fetch<AppSettingsData>(
    key: AppCacheKey(
      namespace: 'settings',
      value: 'me',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 5),
    network: () async {
      final settings = await repository.fetchSettings(cancelToken: cancelToken);
      return settings.raw;
    },
    decode: AppSettingsData.fromJson,
  );
});

final safetyProvider = FutureProvider.autoDispose<SafetyData>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(
      const SafetyData(
        trustScore: 0,
        settings: AppSettingsData(),
      ),
    );
  }
  return _localFirstValueFuture<SafetyData>(
    ref,
    namespace: 'safety',
    cacheValue: 'me',
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchSafety(
      cancelToken: cancelToken,
    ),
    encode: (safety) => safety.raw,
    decode: SafetyData.fromJson,
  );
});

final settingsActionsProvider = Provider<SettingsActionsController>(
  SettingsActionsController.new,
);

final authActionsProvider = Provider<AuthActionsController>(
  AuthActionsController.new,
);

class SettingsActionsController {
  SettingsActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<AppSettingsData> update(Map<String, Object?> data) async {
    final cancelToken = _trackToken();
    try {
      final settings =
          await _ref.read(backendRepositoryProvider).updateSettings(
                data,
                cancelToken: cancelToken,
              );
      _ref.invalidate(appSettingsProvider);
      return settings;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> setPushEnabled(bool enabled) async {
    final pushTokenService = _ref.read(appPushTokenServiceProvider);
    final cancelToken = _trackToken();
    try {
      final repository = _ref.read(backendRepositoryProvider);
      if (enabled) {
        final token = await pushTokenService.registerDeviceToken();
        if (token == null) {
          throw const BackendActionException(message: 'push_unavailable');
        }
        await repository.registerPushToken(
          token: token.token,
          provider: token.provider,
          deviceId: token.deviceId,
          platform: token.platform,
          cancelToken: cancelToken,
        );
        await update({'allowPush': true});
      } else {
        final deviceId = await pushTokenService.currentDeviceId();
        if (deviceId != null && deviceId.isNotEmpty) {
          await repository.deletePushTokenByDeviceId(
            deviceId,
            cancelToken: cancelToken,
          );
        }
        await pushTokenService.clearRegisteredToken();
        await update({'allowPush': false});
      }
      await _ref
          .read(sharedPreferencesProvider)
          ?.setBool(pushNotificationsEnabledStorageKey, enabled);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> logout() async {
    final userId = _ref.read(currentUserIdProvider);
    final repository = _ref.read(backendRepositoryProvider);
    final pushTokenService = _ref.read(appPushTokenServiceProvider);
    final deviceId = await pushTokenService.currentDeviceId();
    final cancelToken = _trackToken();
    try {
      if (deviceId != null && deviceId.isNotEmpty) {
        try {
          await repository.deletePushTokenByDeviceId(
            deviceId,
            cancelToken: cancelToken,
          );
        } catch (_) {}
      }
      try {
        await repository.logout(cancelToken: cancelToken);
      } catch (_) {}
      await pushTokenService.clearRegisteredToken();
      if (userId != null && userId.isNotEmpty) {
        await _ref
            .read(sessionCleanupControllerProvider)
            .clearPrivateUserData(userId);
      }
      await _ref.read(authTokensProvider.notifier).clear();
      _ref.read(currentUserProvider.notifier).state = null;
      await _ref
          .read(sharedPreferencesProvider)
          ?.setBool(pushNotificationsEnabledStorageKey, false);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class AuthActionsController {
  AuthActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<PhoneAuthChallenge> requestPhoneCode(String phone) async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).requestPhoneCode(
            phone,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<AuthSession> verifyPhone({
    required String challengeId,
    required String code,
  }) async {
    final cancelToken = _trackToken();
    try {
      final session = await _ref.read(backendRepositoryProvider).verifyPhone(
            challengeId: challengeId,
            code: code,
            cancelToken: cancelToken,
          );
      await _ref.read(authTokensProvider.notifier).setTokens(session.tokens);
      return session;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<AuthSession> loginWithTestPhoneShortcut(String phone) async {
    final cancelToken = _trackToken();
    try {
      final session =
          await _ref.read(backendRepositoryProvider).loginWithTestPhoneShortcut(
                phone,
                cancelToken: cancelToken,
              );
      await _ref.read(authTokensProvider.notifier).setTokens(session.tokens);
      return session;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<TelegramAuthStart> startTelegramAuth() async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).startTelegramAuth(
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<AuthSession> verifyTelegramAuth({
    required String loginSessionId,
    required String code,
  }) async {
    final cancelToken = _trackToken();
    try {
      final session =
          await _ref.read(backendRepositoryProvider).verifyTelegramAuth(
                loginSessionId: loginSessionId,
                code: code,
                cancelToken: cancelToken,
              );
      await _ref.read(authTokensProvider.notifier).setTokens(session.tokens);
      return session;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class OnboardingFlowController {
  OnboardingFlowController(this._ref);

  final Ref _ref;

  Future<OnboardingData> save(OnboardingData data) async {
    final saved = await _ref.read(backendRepositoryProvider).saveOnboarding(
          data,
        );
    await _writeSavedOnboardingCache(saved);
    _ref.invalidate(onboardingProvider);
    _ref.invalidate(ownProfileProvider);
    final currentUserId = _ref.read(currentUserIdProvider);
    if (currentUserId != null && currentUserId.isNotEmpty) {
      await _ref.read(sharedPreferencesProvider)?.setBool(
            completedOnboardingUserStorageKey(currentUserId),
            true,
          );
    }
    try {
      final user = await _ref.read(backendRepositoryProvider).fetchMe();
      await _ref.read(sharedPreferencesProvider)?.setBool(
            completedOnboardingUserStorageKey(user.id),
            true,
          );
      _ref.read(currentUserProvider.notifier).state =
          _withCompletedOnboarding(user, saved);
    } catch (_) {}
    return saved;
  }

  Future<void> _writeSavedOnboardingCache(OnboardingData saved) async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    try {
      await store.putJson(
        AppCacheKey(
          namespace: 'onboarding',
          value: 'me',
          userScope: _ref.read(currentCacheScopeProvider),
        ),
        saved.raw.isEmpty ? saved.toJson() : saved.raw,
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );
    } catch (_) {}
  }

  Future<void> checkContact({
    String? email,
    String? phoneNumber,
  }) async {
    await _ref.read(backendRepositoryProvider).checkOnboardingContact(
          email: email,
          phoneNumber: phoneNumber,
        );
  }
}

BackendUser _withCompletedOnboarding(BackendUser user, OnboardingData data) {
  return BackendUser(
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    gender: data.gender ?? user.gender,
    onboardingComplete: true,
    city: data.city ?? user.city,
    raw: user.raw,
  );
}

final profileActionsProvider = Provider<ProfileActionsController>(
  ProfileActionsController.new,
);

final publicProfileActionsProvider = Provider<PublicProfileActionsController>(
  PublicProfileActionsController.new,
);

class PublicProfileActionsController {
  PublicProfileActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<Map<String, Object?>> createDirectChat(String userId) async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).createDirectChat(
            userId,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> like(String userId) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).setProfileReaction(
            userId: userId,
            kind: 'like',
            active: true,
            cancelToken: cancelToken,
          );
      _ref.invalidate(publicUserProvider(userId));
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<ProfileSocialData> setFollow(String userId, bool active) async {
    final cancelToken = _trackToken();
    try {
      final social =
          await _ref.read(backendRepositoryProvider).setProfileFollow(
                userId: userId,
                active: active,
                cancelToken: cancelToken,
              );
      _ref.invalidate(publicUserProvider(userId));
      _ref.invalidate(profileSocialProvider(userId));
      return social;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<ProfileSocialData> setFollowNotifications(
    String userId,
    bool enabled,
  ) async {
    final cancelToken = _trackToken();
    try {
      final social = await _ref
          .read(backendRepositoryProvider)
          .setProfileFollowNotifications(
            userId: userId,
            enabled: enabled,
            cancelToken: cancelToken,
          );
      _ref.invalidate(publicUserProvider(userId));
      _ref.invalidate(profileSocialProvider(userId));
      return social;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class ProfileActionsController {
  ProfileActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<void> updateCity(String city) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).updateOwnProfile(
        data: {'city': city},
        cancelToken: cancelToken,
      );
      await _clearProfileCache();
      _ref.invalidate(ownProfileProvider);
      final user = _ref.read(currentUserProvider);
      if (user != null) {
        _ref.read(currentUserProvider.notifier).state = BackendUser(
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          gender: user.gender,
          onboardingComplete: user.onboardingComplete,
          city: city,
          raw: user.raw,
        );
      }
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> updateProfileAndInterests({
    required Map<String, Object?> profileData,
    required List<String> interests,
  }) async {
    final cancelToken = _trackToken();
    try {
      final repository = _ref.read(backendRepositoryProvider);
      final onboarding = _ref.read(onboardingProvider).valueOrNull ??
          await repository.fetchOnboarding(cancelToken: cancelToken);
      await repository.updateOwnProfile(
        data: profileData,
        cancelToken: cancelToken,
      );
      await _clearProfileCache();
      await repository.saveOnboarding(
        OnboardingData(
          intent: onboarding.intent,
          gender: onboarding.gender,
          birthDate: onboarding.birthDate,
          city: onboarding.city,
          area: onboarding.area,
          interests: interests,
          vibe: onboarding.vibe,
          email: onboarding.email,
          phoneNumber: onboarding.phoneNumber,
        ),
        cancelToken: cancelToken,
      );
      await _clearOnboardingCache();
      _ref.invalidate(ownProfileProvider);
      _ref.invalidate(onboardingProvider);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<Map<String, Object?>> uploadProfilePhoto({
    required String filePath,
    required String fileName,
    required String mimeType,
  }) async {
    final cancelToken = _trackToken();
    try {
      final result =
          await _ref.read(backendRepositoryProvider).uploadProfilePhotoFile(
                filePath: filePath,
                fileName: fileName,
                mimeType: mimeType,
                cancelToken: cancelToken,
              );
      await _clearProfileCache();
      _ref.invalidate(ownProfileProvider);
      final user = _ref.read(currentUserProvider);
      final url = result['url']?.toString();
      if (user != null && url != null && url.isNotEmpty) {
        _ref.read(currentUserProvider.notifier).state = BackendUser(
          id: user.id,
          name: user.name,
          avatarUrl: url,
          gender: user.gender,
          onboardingComplete: user.onboardingComplete,
          city: user.city,
          raw: user.raw,
        );
      }
      return result;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> deleteProfilePhoto(String photoId) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).deleteProfilePhoto(
            photoId,
            cancelToken: cancelToken,
          );
      await _clearProfileCache();
      _ref.invalidate(ownProfileProvider);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> makePrimaryProfilePhoto(String photoId) async {
    final cancelToken = _trackToken();
    try {
      final result =
          await _ref.read(backendRepositoryProvider).makePrimaryProfilePhoto(
                photoId,
                cancelToken: cancelToken,
              );
      await _clearProfileCache();
      _ref.invalidate(ownProfileProvider);
      final user = _ref.read(currentUserProvider);
      final url = result['url']?.toString();
      if (user != null && url != null && url.isNotEmpty) {
        _ref.read(currentUserProvider.notifier).state = BackendUser(
          id: user.id,
          name: user.name,
          avatarUrl: url,
          gender: user.gender,
          onboardingComplete: user.onboardingComplete,
          city: user.city,
          raw: user.raw,
        );
      }
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  Future<void> _clearProfileCache() {
    return _deleteLocalCacheKey(
      AppCacheKey(
        namespace: 'profile',
        value: 'me',
        userScope: _ref.read(currentCacheScopeProvider),
      ),
    );
  }

  Future<void> _clearOnboardingCache() {
    return _deleteLocalCacheKey(
      AppCacheKey(
        namespace: 'onboarding',
        value: 'me',
        userScope: _ref.read(currentCacheScopeProvider),
      ),
    );
  }

  Future<void> _deleteLocalCacheKey(AppCacheKey key) async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    await store.deleteKey(key);
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final meetingActionsProvider = Provider<MeetingActionsController>(
  MeetingActionsController.new,
);

class MeetingActionsController {
  MeetingActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<BackendCardItem> setJoined({
    required String eventId,
    required bool joined,
  }) async {
    final cancelToken = _trackToken();
    try {
      final event = joined
          ? await _ref.read(backendRepositoryProvider).joinEvent(
                eventId,
                cancelToken: cancelToken,
              )
          : await _ref.read(backendRepositoryProvider).leaveEvent(
                eventId,
                cancelToken: cancelToken,
              );
      _invalidateEvent(eventId);
      return event;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> setJoinRequested({
    required String eventId,
    required bool requested,
    String? note,
  }) async {
    final cancelToken = _trackToken();
    try {
      final event = requested
          ? await _ref.read(backendRepositoryProvider).createJoinRequest(
                eventId,
                note: note,
                cancelToken: cancelToken,
              )
          : await _ref.read(backendRepositoryProvider).cancelJoinRequest(
                eventId,
                cancelToken: cancelToken,
              );
      _invalidateEvent(eventId);
      return event;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> createEvent({
    required Map<String, Object?> data,
    required String idempotencyKey,
  }) async {
    final cancelToken = _trackToken();
    try {
      final event = await _ref.read(backendRepositoryProvider).createEvent(
            data: data,
            idempotencyKey: idempotencyKey,
            cancelToken: cancelToken,
          );
      await _dropEventsCache();
      _ref.invalidate(homeEventsProvider);
      _ref.invalidate(homeEventsQueryProvider);
      _ref.invalidate(meetingsProvider);
      _ref.invalidate(meetingsQueryProvider);
      return event;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> fetchHostedEvent(String eventId) async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).fetchHostedEvent(
            eventId,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> updateHostedEvent({
    required String eventId,
    required Map<String, Object?> data,
  }) async {
    final cancelToken = _trackToken();
    try {
      final event =
          await _ref.read(backendRepositoryProvider).updateHostedEvent(
                eventId,
                data: data,
                cancelToken: cancelToken,
              );
      await _dropEventsCache();
      _invalidateEvent(eventId);
      _ref.invalidate(hostDashboardProvider);
      return event;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  void _invalidateEvent(String eventId) {
    _ref.invalidate(homeEventsProvider);
    _ref.invalidate(homeEventsQueryProvider);
    _ref.invalidate(meetingsProvider);
    _ref.invalidate(meetingsQueryProvider);
    _ref.invalidate(meetingDetailProvider(eventId));
  }

  Future<void> _dropEventsCache() async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    await store.deleteNamespace(
      namespace: 'events',
      userScope: currentCacheScope(_ref),
    );
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final routeTemplatesProvider = routeTemplatesByQueryProvider(null);

final routeTemplatesByQueryProvider =
    StreamProvider.autoDispose.family<CardPage, String?>((ref, query) {
  final city = _currentCity(ref);
  return _localFirstPageStream(
    ref,
    namespace: 'routes',
    cacheValue: 'templates?city=${city ?? ''}&q=${query ?? ''}&limit=20',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchRoutes(
      city: city,
      query: query,
      limit: 20,
      cancelToken: cancelToken,
    ),
  );
});

final routeDetailProvider =
    FutureProvider.autoDispose.family<BackendCardItem, String>((ref, id) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchRouteDetail(id, cancelToken: cancelToken);
  }
  return localFirst.fetch<BackendCardItem>(
    key: AppCacheKey(
      namespace: 'routes',
      value: 'detail:$id',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 10),
    network: () async {
      final route = await repository.fetchRouteDetail(
        id,
        cancelToken: cancelToken,
      );
      return route.raw;
    },
    decode: BackendCardItem.fromJson,
  );
});

final matchesProvider = StreamProvider.autoDispose<CardPage>((ref) {
  return _privatePageStream(
    ref,
    namespace: 'matches',
    cacheValue: 'list?limit=10',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchMatches(
      cancelToken: cancelToken,
    ),
  );
});

class PostersQuery {
  const PostersQuery({
    this.city,
    this.query,
    this.date,
    this.dateFrom,
    this.dateTo,
    this.priceMode,
    this.category,
    this.limit = 20,
  });

  final String? city;
  final String? query;
  final String? date;
  final String? dateFrom;
  final String? dateTo;
  final String? priceMode;
  final String? category;
  final int limit;

  String cacheValueFor(String? resolvedCity) {
    return [
      'events',
      'city=${resolvedCity ?? city ?? ''}',
      'q=${query ?? ''}',
      'date=${date ?? ''}',
      'dateFrom=${dateFrom ?? ''}',
      'dateTo=${dateTo ?? ''}',
      'priceMode=${priceMode ?? ''}',
      'category=${category ?? ''}',
      'limit=$limit',
    ].join('&');
  }

  @override
  bool operator ==(Object other) {
    return other is PostersQuery &&
        other.city == city &&
        other.query == query &&
        other.date == date &&
        other.dateFrom == dateFrom &&
        other.dateTo == dateTo &&
        other.priceMode == priceMode &&
        other.category == category &&
        other.limit == limit;
  }

  @override
  int get hashCode => Object.hash(
      city, query, date, dateFrom, dateTo, priceMode, category, limit);
}

final postersProvider = FutureProvider.autoDispose<CardPage>((ref) {
  return ref.watch(postersQueryProvider(const PostersQuery(limit: 8)).future);
});

final postersQueryProvider =
    StreamProvider.autoDispose.family<CardPage, PostersQuery>((ref, query) {
  final city = query.city ?? _currentCity(ref);
  return _localFirstPageStream(
    ref,
    namespace: 'affiche',
    cacheValue: query.cacheValueFor(city),
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchAffiche(
      city: city,
      query: query.query,
      limit: query.limit,
      date: query.date,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      priceMode: query.priceMode,
      category: query.category,
      cancelToken: cancelToken,
    ),
  );
});

final postersPaginationProvider = StateNotifierProvider.autoDispose
    .family<PostersPaginationController, PostersPaginationState, PostersQuery>(
        (ref, query) {
  return PostersPaginationController(ref, query);
});

class PostersPaginationState {
  const PostersPaginationState({
    this.items = const [],
    this.nextCursor,
    this.loading = false,
    this.error = false,
    this.initialized = false,
  });

  final List<BackendCardItem> items;
  final String? nextCursor;
  final bool loading;
  final bool error;
  final bool initialized;

  bool get hasNextPage => nextCursor != null && nextCursor!.isNotEmpty;

  PostersPaginationState copyWith({
    List<BackendCardItem>? items,
    String? nextCursor,
    bool clearNextCursor = false,
    bool? loading,
    bool? error,
    bool? initialized,
  }) {
    return PostersPaginationState(
      items: items ?? this.items,
      nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
      loading: loading ?? this.loading,
      error: error ?? this.error,
      initialized: initialized ?? this.initialized,
    );
  }
}

class PostersPaginationController
    extends StateNotifier<PostersPaginationState> {
  PostersPaginationController(this._ref, this._query)
      : super(const PostersPaginationState()) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final PostersQuery _query;
  final Set<CancelToken> _tokens = {};

  void primeNextCursor(String? cursor) {
    if (state.items.isNotEmpty || state.loading) {
      return;
    }
    if (state.initialized && state.nextCursor == cursor) {
      return;
    }
    state = state.copyWith(
      nextCursor: cursor,
      clearNextCursor: cursor == null || cursor.isEmpty,
      error: false,
      initialized: true,
    );
  }

  Future<void> loadNextPage() async {
    final cursor = state.nextCursor;
    if (state.loading || cursor == null || cursor.isEmpty) {
      return;
    }
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    state = state.copyWith(loading: true, error: false);
    try {
      final city = _query.city ?? _currentCity(_ref);
      final page = await _ref.read(backendRepositoryProvider).fetchAffiche(
            city: city,
            query: _query.query,
            date: _query.date,
            dateFrom: _query.dateFrom,
            dateTo: _query.dateTo,
            priceMode: _query.priceMode,
            category: _query.category,
            limit: _query.limit,
            cursor: cursor,
            cancelToken: cancelToken,
          );
      state = state.copyWith(
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        clearNextCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
        loading: false,
        error: false,
      );
    } catch (_) {
      if (!cancelToken.isCancelled) {
        state = state.copyWith(loading: false, error: true);
      }
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final posterDetailProvider =
    FutureProvider.autoDispose.family<BackendCardItem, String>((ref, id) {
  return _localFirstValueFuture<BackendCardItem>(
    ref,
    namespace: 'affiche',
    cacheValue: 'detail:$id',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchAfficheDetail(
      id,
      cancelToken: cancelToken,
    ),
    encode: (event) => event.raw.isEmpty
        ? {
            'id': event.id,
            'title': event.title,
            'subtitle': event.subtitle,
            'imageUrl': event.imageUrl,
            'startsAt': event.startsAt?.toIso8601String(),
            'city': event.city,
            'latitude': event.latitude,
            'longitude': event.longitude,
          }
        : event.raw,
    decode: BackendCardItem.fromJson,
  );
});

class DatingDiscoverFilters {
  const DatingDiscoverFilters({
    this.gender,
    this.ageMin = 18,
    this.ageMax = 99,
    this.radiusKm = 500,
    this.interests = const [],
    this.verifiedOnly = false,
    this.frendlyPlusOnly = false,
    this.onlineOnly = false,
    this.newThisWeekOnly = false,
  });

  final String? gender;
  final int ageMin;
  final int ageMax;
  final int radiusKm;
  final List<String> interests;
  final bool verifiedOnly;
  final bool frendlyPlusOnly;
  final bool onlineOnly;
  final bool newThisWeekOnly;

  String get cacheValue {
    final sortedInterests = [...interests]..sort();
    return [
      'discover',
      if (gender != null && gender!.isNotEmpty) 'gender=$gender',
      'ageMin=$ageMin',
      'ageMax=$ageMax',
      'radiusKm=$radiusKm',
      'interests=${sortedInterests.join(',')}',
      'verifiedOnly=$verifiedOnly',
      'frendlyPlusOnly=$frendlyPlusOnly',
      'onlineOnly=$onlineOnly',
      'newThisWeekOnly=$newThisWeekOnly',
      'limit=10',
    ].join('&');
  }
}

final datingDiscoverFiltersProvider = StateProvider<DatingDiscoverFilters>(
  (_) => const DatingDiscoverFilters(),
);

final chatsProvider = chatListProvider(ChatListKind.meetups);

final chatSummaryProvider = StreamProvider.autoDispose
    .family<BackendChatSummary?, String>((ref, chatId) async* {
  final userId = ref.read(currentUserIdProvider);
  final chatStore = ref.read(chatLocalStoreProvider);
  if (userId != null && chatStore != null) {
    unawaited(
      Future.wait([
        _chatListForKind(ref, ChatListKind.meetups),
        _chatListForKind(ref, ChatListKind.personal),
      ]).catchError((_) => <BackendPage<BackendChatSummary>>[]),
    );
    yield* chatStore.watchSummary(userId: userId, chatId: chatId).map(
          (json) => json == null ? null : BackendChatSummary.fromJson(json),
        );
    return;
  }

  final pages = await Future.wait([
    _chatListForKind(ref, ChatListKind.meetups),
    _chatListForKind(ref, ChatListKind.personal),
  ]);
  for (final page in pages) {
    for (final summary in page.items) {
      if (summary.id == chatId) {
        yield summary;
        return;
      }
    }
  }
  yield null;
});

final chatListProvider = StreamProvider.autoDispose
    .family<BackendPage<BackendChatSummary>, ChatListKind>((ref, kind) {
  if (kind == ChatListKind.all || kind == ChatListKind.unread) {
    return _watchCombinedChatLists(ref, kind);
  }
  return _watchChatListForKind(ref, kind);
});

Future<BackendPage<BackendChatSummary>> _chatListForKind(
  Ref ref,
  ChatListKind kind,
) async {
  final repository = ref.read(backendRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final userId = ref.read(currentUserIdProvider);
  final chatStore = ref.read(chatLocalStoreProvider);
  final storeKind = switch (kind) {
    ChatListKind.personal => 'personal',
    _ => 'meetups',
  };
  Future<BackendPage<BackendChatSummary>> fetchFresh() {
    return switch (kind) {
      ChatListKind.personal =>
        repository.fetchPersonalChats(cancelToken: cancelToken),
      _ => repository.fetchMeetupChats(cancelToken: cancelToken),
    };
  }

  if (userId != null && chatStore != null) {
    final cached =
        await chatStore.watchSummaries(userId: userId, kind: storeKind).first;
    if (cached.isNotEmpty) {
      fetchFresh().then((freshPage) {
        final fresh = _withChatKind(freshPage, storeKind);
        chatStore.replaceSummaries(
          userId: userId,
          kind: storeKind,
          summaries: fresh.items.map((item) => item.raw).toList(),
        );
      });
      return BackendPage(
        items: cached.map(BackendChatSummary.fromJson).toList(growable: false),
      );
    }
  }
  final fresh = _withChatKind(await fetchFresh(), storeKind);
  if (userId != null && chatStore != null) {
    await chatStore.replaceSummaries(
      userId: userId,
      kind: storeKind,
      summaries: fresh.items.map((item) => item.raw).toList(),
    );
  }
  return fresh;
}

BackendPage<BackendChatSummary> _withChatKind(
  BackendPage<BackendChatSummary> page,
  String kind,
) {
  return BackendPage(
    items: page.items.map((item) {
      final raw = {
        ...item.raw,
        'kind': kind == 'personal' ? 'personal' : 'meetup',
      };
      return BackendChatSummary.fromJson(raw);
    }).toList(growable: false),
    nextCursor: page.nextCursor,
    raw: page.raw,
  );
}

Stream<BackendPage<BackendChatSummary>> _watchChatListForKind(
  Ref ref,
  ChatListKind kind,
) async* {
  final repository = ref.read(backendRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final userId = ref.read(currentUserIdProvider);
  final chatStore = ref.read(chatLocalStoreProvider);
  final storeKind = _chatStoreKind(kind);

  Future<BackendPage<BackendChatSummary>> fetchFresh() {
    return switch (kind) {
      ChatListKind.personal =>
        repository.fetchPersonalChats(cancelToken: cancelToken),
      _ => repository.fetchMeetupChats(cancelToken: cancelToken),
    };
  }

  if (userId == null || chatStore == null) {
    yield _withChatKind(await fetchFresh(), storeKind);
    return;
  }

  final cached =
      await chatStore.watchSummaries(userId: userId, kind: storeKind).first;
  if (cached.isEmpty) {
    final fresh = _withChatKind(await fetchFresh(), storeKind);
    await chatStore.replaceSummaries(
      userId: userId,
      kind: storeKind,
      summaries: fresh.items.map((item) => item.raw).toList(),
    );
  } else {
    unawaited(
      fetchFresh().then((freshPage) {
        final fresh = _withChatKind(freshPage, storeKind);
        return chatStore.replaceSummaries(
          userId: userId,
          kind: storeKind,
          summaries: fresh.items.map((item) => item.raw).toList(),
        );
      }).catchError((_) {}),
    );
  }

  yield* chatStore.watchSummaries(userId: userId, kind: storeKind).map(
        (rows) => BackendPage(
          items: rows.map(BackendChatSummary.fromJson).toList(growable: false),
        ),
      );
}

Stream<BackendPage<BackendChatSummary>> _watchCombinedChatLists(
  Ref ref,
  ChatListKind kind,
) {
  late final StreamSubscription<BackendPage<BackendChatSummary>> meetupsSub;
  late final StreamSubscription<BackendPage<BackendChatSummary>> personalSub;
  final controller = StreamController<BackendPage<BackendChatSummary>>();
  List<BackendChatSummary>? meetups;
  List<BackendChatSummary>? personal;
  var canceled = false;

  void emitIfReady() {
    if (meetups == null && personal == null) {
      return;
    }
    final items = [
      ...?meetups,
      ...?personal,
    ];
    controller.add(
      BackendPage(
        items: kind == ChatListKind.unread
            ? items.where((item) => item.unreadCount > 0).toList()
            : items,
      ),
    );
  }

  controller.onListen = () {
    meetupsSub = _watchChatListForKind(ref, ChatListKind.meetups).listen(
      (page) {
        meetups = page.items;
        emitIfReady();
      },
      onError: (Object error, StackTrace stackTrace) {
        if (!canceled && !controller.isClosed) {
          controller.addError(error, stackTrace);
        }
      },
    );
    personalSub = _watchChatListForKind(ref, ChatListKind.personal).listen(
      (page) {
        personal = page.items;
        emitIfReady();
      },
      onError: (Object error, StackTrace stackTrace) {
        if (!canceled && !controller.isClosed) {
          controller.addError(error, stackTrace);
        }
      },
    );
  };
  controller.onCancel = () async {
    canceled = true;
    await Future.wait([
      meetupsSub.cancel().catchError((_) {}),
      personalSub.cancel().catchError((_) {}),
    ]);
  };
  return controller.stream;
}

String _chatStoreKind(ChatListKind kind) {
  return switch (kind) {
    ChatListKind.personal => 'personal',
    _ => 'meetups',
  };
}

final chatMessagesProvider = StreamProvider.autoDispose
    .family<List<BackendChatMessage>, String>((ref, chatId) async* {
  final userId = ref.read(currentUserIdProvider);
  final chatStore = ref.read(chatLocalStoreProvider);
  if (userId != null && chatStore != null) {
    final repository = ref.read(backendRepositoryProvider);
    final cancelToken = CancelToken();
    ref.onDispose(cancelToken.cancel);
    Future<List<BackendChatMessage>> refreshMessages() async {
      final page = await repository.fetchChatMessages(
        chatId,
        cancelToken: cancelToken,
      );
      await chatStore.upsertMessages(
        userId: userId,
        chatId: chatId,
        messages: page.items.map((item) => item.raw).toList(),
      );
      ref
          .read(chatHistoryPaginationProvider(chatId).notifier)
          .setNextCursor(page.nextCursor);
      unawaited(
        ref
            .read(appAttachmentServiceProvider)
            .warmCache(_recentChatAttachmentPaths(page.items)),
      );
      final lastMessageId = _lastServerMessageId(page.items);
      if (lastMessageId != null) {
        unawaited(
          repository
              .markChatRead(
            chatId,
            messageId: lastMessageId,
            cancelToken: cancelToken,
          )
              .then((_) {
            return chatStore.markSummaryRead(userId: userId, chatId: chatId);
          }).catchError((_) {}),
        );
      }
      return page.items;
    }

    final cached = await chatStore.readRecentMessages(
      userId: userId,
      chatId: chatId,
      limit: 60,
    );
    if (cached.isEmpty) {
      yield await refreshMessages();
    } else {
      unawaited(
        refreshMessages().then<void>((_) {}).catchError((_) {}),
      );
    }
    yield* chatStore.watchRecentMessages(userId: userId, chatId: chatId).map(
        (rows) => rows
            .map((json) => BackendChatMessage.fromJson(chatId, json))
            .toList(growable: false));
    return;
  }
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final page = await ref.read(backendRepositoryProvider).fetchChatMessages(
        chatId,
        cancelToken: cancelToken,
      );
  ref
      .read(chatHistoryPaginationProvider(chatId).notifier)
      .setNextCursor(page.nextCursor);
  yield page.items;
});

final chatHistoryPaginationProvider = StateNotifierProvider.autoDispose.family<
    ChatHistoryPaginationController,
    ChatHistoryPaginationState,
    String>((ref, chatId) {
  return ChatHistoryPaginationController(ref, chatId);
});

final chatMessageSenderProvider = Provider<ChatMessageSender>((ref) {
  return ChatMessageSender(ref);
});

final chatActionsProvider = Provider<ChatActions>((ref) {
  return ChatActions(ref);
});

final signedMediaUrlProvider =
    FutureProvider.autoDispose.family<String, String>((ref, path) {
  return ref.read(appAttachmentServiceProvider).resolveSignedUrl(path);
});

String? _lastServerMessageId(List<BackendChatMessage> messages) {
  for (var index = messages.length - 1; index >= 0; index -= 1) {
    final message = messages[index];
    if (!message.pending && message.id.isNotEmpty) {
      return message.id;
    }
  }
  return null;
}

class ChatHistoryPaginationState {
  const ChatHistoryPaginationState({
    this.nextCursor,
    this.loading = false,
    this.error = false,
  });

  final String? nextCursor;
  final bool loading;
  final bool error;

  bool get hasNextPage => nextCursor != null && nextCursor!.isNotEmpty;

  ChatHistoryPaginationState copyWith({
    String? nextCursor,
    bool clearNextCursor = false,
    bool? loading,
    bool? error,
  }) {
    return ChatHistoryPaginationState(
      nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
      loading: loading ?? this.loading,
      error: error ?? this.error,
    );
  }
}

class ChatHistoryPaginationController
    extends StateNotifier<ChatHistoryPaginationState> {
  ChatHistoryPaginationController(this._ref, this._chatId)
      : super(const ChatHistoryPaginationState());

  final Ref _ref;
  final String _chatId;

  void setNextCursor(String? cursor) {
    state = state.copyWith(
      nextCursor: cursor,
      clearNextCursor: cursor == null || cursor.isEmpty,
      error: false,
    );
  }

  Future<void> loadNextPage() async {
    final cursor = state.nextCursor;
    if (state.loading || cursor == null || cursor.isEmpty) {
      return;
    }
    final userId = _ref.read(currentUserIdProvider);
    final store = _ref.read(chatLocalStoreProvider);
    if (userId == null || store == null) {
      return;
    }
    state = state.copyWith(loading: true, error: false);
    try {
      final page = await _ref.read(backendRepositoryProvider).fetchChatMessages(
            _chatId,
            cursor: cursor,
          );
      await store.upsertMessages(
        userId: userId,
        chatId: _chatId,
        messages: page.items.map((item) => item.raw).toList(),
      );
      unawaited(
        _ref
            .read(appAttachmentServiceProvider)
            .warmCache(_recentChatAttachmentPaths(page.items)),
      );
      state = state.copyWith(
        nextCursor: page.nextCursor,
        clearNextCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
        loading: false,
        error: false,
      );
    } catch (_) {
      state = state.copyWith(loading: false, error: true);
    }
  }
}

Iterable<String> _recentChatAttachmentPaths(List<BackendChatMessage> messages) {
  return messages.reversed
      .expand((message) => _chatAttachmentPaths(message.raw['attachments']))
      .take(6);
}

Iterable<String> _chatAttachmentPaths(Object? value) sync* {
  if (value is! List) {
    return;
  }
  for (final raw in value.whereType<Map>()) {
    final attachment = raw.map((key, value) => MapEntry('$key', value));
    final status = attachment['status']?.toString();
    if (status != 'ready') {
      continue;
    }
    final mimeType = attachment['mimeType']?.toString() ?? '';
    final kind = attachment['kind']?.toString() ?? '';
    final fileName = attachment['fileName']?.toString() ?? '';
    final shouldWarm = mimeType.startsWith('image/') ||
        kind == 'image' ||
        kind == 'chat_attachment' && _looksLikeImageFileName(fileName);
    if (!shouldWarm) {
      continue;
    }
    final path = attachment['downloadUrlPath']?.toString();
    if (path != null && path.isNotEmpty) {
      yield path;
    }
  }
}

bool _looksLikeImageFileName(String fileName) {
  final lower = fileName.toLowerCase();
  return lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.heic');
}

final chatRealtimeProvider =
    Provider.autoDispose.family<ChatRealtimeSession?, String>((ref, chatId) {
  final userId = ref.watch(currentUserIdProvider);
  final tokens = ref.watch(authTokensProvider);
  final store = ref.watch(chatLocalStoreProvider);
  if (userId == null || tokens == null || store == null) {
    return null;
  }
  final transportFactory = ref.watch(chatSocketTransportFactoryProvider);
  final socketUri = Uri.parse(BackendConfig.chatWebSocketUrl);
  final transport = transportFactory(socketUri);
  final session = ChatRealtimeSession(
    transport: transport,
    store: store,
    userId: userId,
    chatId: chatId,
    accessToken: tokens.accessToken,
    reconnectTransportFactory: transportFactory,
    reconnectUri: socketUri,
    onNotificationCreated: (payload) {
      unawaited(
        ref
            .read(notificationsActionsProvider)
            .applyRealtimeNotificationCreated(payload),
      );
    },
  );
  unawaited(session.start());
  ref.onDispose(() => unawaited(session.close()));
  return session;
});

final chatListRealtimeProvider = Provider.autoDispose
    .family<ChatRealtimeSession?, ChatListKind>((ref, kind) {
  final chatIdKey = ref.watch(
    chatListProvider(kind).select(
      (value) => _chatRealtimeKey(value.valueOrNull?.items ?? const []),
    ),
  );
  if (chatIdKey.isEmpty) {
    return null;
  }
  final userId = ref.watch(currentUserIdProvider);
  final tokens = ref.watch(authTokensProvider);
  final store = ref.watch(chatLocalStoreProvider);
  if (userId == null || tokens == null || store == null) {
    return null;
  }

  final chatIds = chatIdKey.split(_chatRealtimeKeySeparator);
  final transportFactory = ref.watch(chatSocketTransportFactoryProvider);
  final socketUri = Uri.parse(BackendConfig.chatWebSocketUrl);
  final transport = transportFactory(socketUri);
  final session = ChatRealtimeSession(
    transport: transport,
    store: store,
    userId: userId,
    chatId: chatIds.first,
    chatIds: chatIds,
    accessToken: tokens.accessToken,
    reconnectTransportFactory: transportFactory,
    reconnectUri: socketUri,
    onNotificationCreated: (payload) {
      unawaited(
        ref
            .read(notificationsActionsProvider)
            .applyRealtimeNotificationCreated(payload),
      );
    },
  );
  unawaited(session.start());
  ref.onDispose(() => unawaited(session.close()));
  return session;
});

const _chatRealtimeKeySeparator = '\u001F';

String _chatRealtimeKey(Iterable<BackendChatSummary> items) {
  final ids = items
      .map((item) => item.id.trim())
      .where((id) => id.isNotEmpty)
      .take(50)
      .toSet()
      .toList(growable: false)
    ..sort();
  return ids.join(_chatRealtimeKeySeparator);
}

class ChatMessageSender {
  ChatMessageSender(this._ref);

  final Ref _ref;

  Future<void> sendText({
    required String chatId,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      return;
    }
    final userId = _ref.read(currentUserIdProvider);
    final store = _ref.read(chatLocalStoreProvider);
    if (userId == null || store == null) {
      throw StateError('Chat local store is unavailable');
    }
    final clientMessageId = 'mobile2-${DateTime.now().microsecondsSinceEpoch}';
    final now = DateTime.now();
    final user = _ref.read(currentUserProvider);
    final message = <String, Object?>{
      'id': clientMessageId,
      'chatId': chatId,
      'text': trimmed,
      'clientMessageId': clientMessageId,
      'sender': {
        'displayName': user?.name ?? 'Вы',
      },
      'createdAt': now.toIso8601String(),
      'pending': true,
      'mine': true,
    };
    await store.upsertMessages(
      userId: userId,
      chatId: chatId,
      messages: [message],
    );
    await store.enqueuePendingCommand(
      userId: userId,
      commandId: clientMessageId,
      dedupeKey: 'message.send:$chatId:$clientMessageId',
      payload: {
        'type': 'message.send',
        'payload': {
          'chatId': chatId,
          'text': trimmed,
          'clientMessageId': clientMessageId,
        },
      },
    );
  }

  Future<void> sendAttachment({
    required String chatId,
    required String filePath,
    required String fileName,
    required String mimeType,
    String kind = 'chat_attachment',
    int? durationMs,
    List<double> waveform = const [],
  }) async {
    final userId = _ref.read(currentUserIdProvider);
    final store = _ref.read(chatLocalStoreProvider);
    if (userId == null || store == null) {
      throw StateError('Chat local store is unavailable');
    }
    final clientMessageId = 'mobile2-${DateTime.now().microsecondsSinceEpoch}';
    final now = DateTime.now();
    final user = _ref.read(currentUserProvider);
    Map<String, Object?> buildMessage(Map<String, Object?> attachment) {
      return <String, Object?>{
        'id': clientMessageId,
        'chatId': chatId,
        'text': '',
        'clientMessageId': clientMessageId,
        'sender': {
          'displayName': user?.name ?? 'Вы',
        },
        'createdAt': now.toIso8601String(),
        'pending': true,
        'mine': true,
        'attachments': [attachment],
      };
    }

    final uploadingAttachment = {
      'kind': kind,
      'status': 'uploading',
      'fileName': fileName,
      'mimeType': mimeType,
      if (durationMs != null) 'durationMs': durationMs,
      if (waveform.isNotEmpty) 'waveform': waveform,
    };
    await store.upsertMessages(
      userId: userId,
      chatId: chatId,
      messages: [buildMessage(uploadingAttachment)],
    );
    Future<void> markUploadFailed() {
      return store.upsertMessages(
        userId: userId,
        chatId: chatId,
        messages: [
          buildMessage({
            ...uploadingAttachment,
            'status': 'failed',
          }),
        ],
      );
    }

    final uploaded = await _ref
        .read(backendRepositoryProvider)
        .uploadChatAttachmentFile(
          chatId: chatId,
          filePath: filePath,
          fileName: fileName,
          mimeType: mimeType,
          kind: kind,
          durationMs: durationMs,
          waveform: waveform,
        )
        .catchError((Object error) async {
      await markUploadFailed();
      throw error;
    });
    final assetId = uploaded['assetId']?.toString();
    if (assetId == null || assetId.isEmpty) {
      await markUploadFailed();
      throw StateError('Attachment upload did not return assetId');
    }
    final attachment = {
      'id': assetId,
      'kind': kind,
      'status': uploaded['status']?.toString() ?? 'ready',
      'fileName': fileName,
      'mimeType': mimeType,
      if (durationMs != null) 'durationMs': durationMs,
      if (waveform.isNotEmpty) 'waveform': waveform,
      if (uploaded['url'] != null) 'url': uploaded['url'],
    };
    await store.upsertMessages(
      userId: userId,
      chatId: chatId,
      messages: [buildMessage(attachment)],
    );
    await store.enqueuePendingCommand(
      userId: userId,
      commandId: clientMessageId,
      dedupeKey: 'message.send:$chatId:$clientMessageId',
      payload: {
        'type': 'message.send',
        'payload': {
          'chatId': chatId,
          'text': '',
          'clientMessageId': clientMessageId,
          'attachmentIds': [assetId],
        },
      },
    );
  }
}

class ChatActions {
  ChatActions(this._ref);

  final Ref _ref;

  Future<void> setPinned({
    required String chatId,
    required bool isPinned,
  }) async {
    await _ref.read(backendRepositoryProvider).setChatPinned(
          chatId,
          isPinned: isPinned,
        );
    final userId = _ref.read(currentUserIdProvider);
    final store = _ref.read(chatLocalStoreProvider);
    if (userId != null && store != null) {
      await store.setSummaryPinned(
        userId: userId,
        chatId: chatId,
        isPinned: isPinned,
      );
    }
    _ref.invalidate(chatListProvider);
    _ref.invalidate(chatSummaryProvider(chatId));
  }

  Future<void> deleteChat(String chatId) async {
    final userId = _ref.read(currentUserIdProvider);
    final store = _ref.read(chatLocalStoreProvider);
    List<Map<String, Object?>> rollbackRows = const [];
    if (userId != null && store != null) {
      rollbackRows = await store.readSummariesForChat(
        userId: userId,
        chatId: chatId,
      );
      await store.deleteChat(userId: userId, chatId: chatId);
    }
    try {
      await _ref.read(backendRepositoryProvider).deleteChat(chatId);
      _ref.invalidate(chatListProvider);
      _ref.invalidate(chatSummaryProvider(chatId));
    } catch (_) {
      if (userId != null && store != null && rollbackRows.isNotEmpty) {
        await store.restoreSummaries(userId: userId, rows: rollbackRows);
      }
      _ref.invalidate(chatListProvider);
      _ref.invalidate(chatSummaryProvider(chatId));
      rethrow;
    }
  }
}

final tokenWalletProvider = FutureProvider.autoDispose<TokenWalletData>((ref) {
  final tokens = ref.watch(authTokensProvider);
  final userId = ref.watch(currentUserIdProvider);
  if (tokens == null || userId == null) {
    return Future.value(const TokenWalletData(balance: 0));
  }
  return _localFirstValueFuture<TokenWalletData>(
    ref,
    namespace: 'wallet',
    cacheValue: 'tokens',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchTokenWallet(
      cancelToken: cancelToken,
    ),
    encode: (wallet) =>
        wallet.raw.isEmpty ? {'balance': wallet.balance} : wallet.raw,
    decode: TokenWalletData.fromJson,
  );
});

final paymentsCatalogProvider =
    FutureProvider.autoDispose<PaymentsCatalog>((ref) {
  return _localFirstValueFuture<PaymentsCatalog>(
    ref,
    namespace: 'payments',
    cacheValue: 'catalog',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchPaymentsCatalog(
      cancelToken: cancelToken,
    ),
    encode: (catalog) => catalog.raw,
    decode: PaymentsCatalog.fromJson,
  );
});

final subscriptionProvider =
    FutureProvider.autoDispose<SubscriptionStateData>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(const SubscriptionStateData(status: 'inactive'));
  }
  return _localFirstValueFuture<SubscriptionStateData>(
    ref,
    namespace: 'subscription',
    cacheValue: 'state',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchSubscription(
      cancelToken: cancelToken,
    ),
    encode: (subscription) => subscription.raw,
    decode: SubscriptionStateData.fromJson,
  );
});

final subscriptionPlansProvider =
    FutureProvider.autoDispose<List<SubscriptionPlan>>((ref) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchSubscriptionPlans(cancelToken: cancelToken);
  }
  return localFirst.fetch<List<SubscriptionPlan>>(
    key: AppCacheKey(
      namespace: 'subscription',
      value: 'plans',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 30),
    network: () async {
      final plans = await repository.fetchSubscriptionPlans(
        cancelToken: cancelToken,
      );
      return {'items': plans.map((plan) => plan.raw).toList(growable: false)};
    },
    decode: (json) =>
        _items(json).map(SubscriptionPlan.fromJson).toList(growable: false),
  );
});

final verificationProvider =
    FutureProvider.autoDispose<VerificationStateData>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(
      const VerificationStateData(
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
      ),
    );
  }
  return _localFirstValueFuture<VerificationStateData>(
    ref,
    namespace: 'verification',
    cacheValue: 'state',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchVerification(
      cancelToken: cancelToken,
    ),
    encode: (verification) => verification.raw,
    decode: VerificationStateData.fromJson,
  );
});

final paymentActionsProvider = Provider<PaymentActionsController>(
  PaymentActionsController.new,
);

final verificationActionsProvider = Provider<VerificationActionsController>(
  VerificationActionsController.new,
);

final frendlySeasonActionsProvider = Provider<FrendlySeasonActionsController>(
  FrendlySeasonActionsController.new,
);

final dropsActionsProvider = Provider<DropsActionsController>(
  DropsActionsController.new,
);

final safetyActionsProvider = Provider<SafetyActionsController>(
  SafetyActionsController.new,
);

final datingActionsProvider = Provider<DatingActionsController>(
  DatingActionsController.new,
);

final afterDarkActionsProvider = Provider<AfterDarkActionsController>(
  AfterDarkActionsController.new,
);

final routeActionsProvider = Provider<RouteActionsController>(
  RouteActionsController.new,
);

final eveningAiActionsProvider = Provider<EveningAiActionsController>(
  EveningAiActionsController.new,
);

class PaymentActionsController {
  PaymentActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<PaymentOrderData> initTokenPayment(String productId) async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).initTokenPayment(
            productId: productId,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<SubscriptionStateData> subscribeWithTokens(String plan) async {
    final cancelToken = _trackToken();
    try {
      final subscription =
          await _ref.read(backendRepositoryProvider).subscribeWithTokens(
                plan: plan,
                cancelToken: cancelToken,
              );
      _ref.invalidate(tokenWalletProvider);
      _ref.invalidate(subscriptionProvider);
      return subscription;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  void handlePaymentReturn() {
    _ref.invalidate(tokenWalletProvider);
    _ref.invalidate(paymentsCatalogProvider);
    _ref.invalidate(subscriptionProvider);
    _ref.invalidate(subscriptionPlansProvider);
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class VerificationActionsController {
  VerificationActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<VerificationStateData> submitStep(String step) async {
    final cancelToken = _trackToken();
    try {
      final state =
          await _ref.read(backendRepositoryProvider).submitVerification(
                step: step,
                cancelToken: cancelToken,
              );
      _ref.invalidate(verificationProvider);
      return state;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class FrendlySeasonActionsController {
  FrendlySeasonActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<void> claimReward(String rewardKey) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).claimFrendlySeasonReward(
            rewardKey,
            cancelToken: cancelToken,
          );
      _ref.invalidate(frendlySeasonProvider);
      _ref.invalidate(tokenWalletProvider);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class DropsActionsController {
  DropsActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<void> claimVerification() async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).claimDropsVerification(
            cancelToken: cancelToken,
          );
      _invalidateDrops();
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> claimDailyLogin() async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).claimDropsDailyLogin(
            cancelToken: cancelToken,
          );
      _invalidateDrops();
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<DropApplyResult> applyTickets(String dropId, int ticketCount) async {
    final cancelToken = _trackToken();
    try {
      final result =
          await _ref.read(backendRepositoryProvider).applyDropTickets(
                dropId: dropId,
                ticketCount: ticketCount,
                cancelToken: cancelToken,
              );
      _invalidateDrops();
      return result;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<DropReferralLinkData> createReferralLink() async {
    final cancelToken = _trackToken();
    try {
      final result =
          await _ref.read(backendRepositoryProvider).createDropsReferralLink(
                cancelToken: cancelToken,
              );
      _invalidateDrops();
      return result;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _invalidateDrops() {
    _ref.invalidate(dropsHomeProvider);
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class SafetyActionsController {
  SafetyActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<Map<String, Object?>> createSos() async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).createSos(
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> createTrustedContact({
    required String name,
    required String value,
    required String channel,
    String mode = 'sos_only',
  }) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).createTrustedContact(
            name: name,
            value: value,
            channel: channel,
            mode: mode,
            cancelToken: cancelToken,
          );
      _ref.invalidate(trustedContactsProvider);
      _ref.invalidate(safetyProvider);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> deleteTrustedContact(String contactId) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).deleteTrustedContact(
            contactId,
            cancelToken: cancelToken,
          );
      _ref.invalidate(trustedContactsProvider);
      _ref.invalidate(safetyProvider);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  Future<SafetyData> updateSafety(Map<String, Object?> data) async {
    final cancelToken = _trackToken();
    try {
      final safety = await _ref.read(backendRepositoryProvider).updateSafety(
            data,
            cancelToken: cancelToken,
          );
      _ref.invalidate(safetyProvider);
      return safety;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class DatingActionsController {
  DatingActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<Map<String, Object?>> recordAction({
    required String targetUserId,
    required String action,
  }) async {
    final cancelToken = _trackToken();
    try {
      final result =
          await _ref.read(backendRepositoryProvider).recordDatingAction(
                targetUserId: targetUserId,
                action: action,
                cancelToken: cancelToken,
              );
      if (result['matched'] == true) {
        _ref.invalidate(matchesProvider);
      }
      return result;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class AfterDarkActionsController {
  AfterDarkActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<void> unlock({
    required String plan,
    required bool ageConfirmed,
    required bool codeAccepted,
  }) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).unlockAfterDark(
            plan: plan,
            ageConfirmed: ageConfirmed,
            codeAccepted: codeAccepted,
            cancelToken: cancelToken,
          );
      _ref.invalidate(afterDarkAccessProvider);
      _ref.invalidate(afterDarkEventsProvider);
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> joinEvent(String eventId) async {
    final cancelToken = _trackToken();
    try {
      final event =
          await _ref.read(backendRepositoryProvider).joinAfterDarkEvent(
                eventId,
                acceptedRules: true,
                cancelToken: cancelToken,
              );
      _ref.invalidate(afterDarkEventProvider(eventId));
      _ref.invalidate(afterDarkEventsProvider);
      return event;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class RouteActionsController {
  RouteActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<EveningRouteSessionData> createTemplateSession({
    required String templateId,
    required DateTime startsAt,
    String privacy = 'open',
    int? capacity,
  }) async {
    final cancelToken = _trackToken();
    try {
      return await _ref
          .read(backendRepositoryProvider)
          .createRouteTemplateSession(
            templateId: templateId,
            startsAt: startsAt,
            privacy: privacy,
            capacity: capacity,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class EveningAiActionsController {
  EveningAiActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<EveningAiDraftData> createDraft(String prompt) async {
    final cancelToken = _trackToken();
    try {
      final user = _ref.read(currentUserProvider);
      return await _ref.read(backendRepositoryProvider).createEveningAiDraft(
            prompt: prompt,
            city: user?.city,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<EveningAiDraftData> acceptStep({
    required String draftId,
    required int stepIndex,
  }) async {
    final cancelToken = _trackToken();
    try {
      final draft =
          await _ref.read(backendRepositoryProvider).acceptEveningAiDraftStep(
                draftId: draftId,
                stepIndex: stepIndex,
                cancelToken: cancelToken,
              );
      _ref.invalidate(eveningAiDraftProvider(draft.draftId));
      return draft;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<EveningAiDraftData> regenerate(String draftId) async {
    final cancelToken = _trackToken();
    try {
      final draft =
          await _ref.read(backendRepositoryProvider).regenerateEveningAiDraft(
                draftId,
                cancelToken: cancelToken,
              );
      _ref.invalidate(eveningAiDraftProvider(draft.draftId));
      return draft;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<EveningAiDraftData> confirm(String draftId) async {
    final cancelToken = _trackToken();
    try {
      final draft =
          await _ref.read(backendRepositoryProvider).confirmEveningAiDraft(
                draftId,
                cancelToken: cancelToken,
              );
      _ref.invalidate(eveningAiDraftProvider(draft.draftId));
      return draft;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final notificationsProvider = StreamProvider.autoDispose<CardPage>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Stream.value(const BackendPage(items: []));
  }
  return _localFirstPageStream(
    ref,
    namespace: _notificationsCacheNamespace,
    cacheValue: _notificationsListCacheValue,
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchNotifications(
      cancelToken: cancelToken,
    ),
  );
});

final notificationUnreadCountProvider =
    FutureProvider.autoDispose<int>((ref) async {
  if (ref.watch(authTokensProvider) == null) {
    return 0;
  }
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  final localFirst = ref.read(localFirstRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchNotificationUnreadCount(cancelToken: cancelToken);
  }
  return localFirst.fetch<int>(
    key: AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsUnreadCountCacheValue,
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 1),
    network: () async {
      final count = await repository.fetchNotificationUnreadCount(
        cancelToken: cancelToken,
      );
      return {'unreadCount': count};
    },
    decode: (json) => int.tryParse(json['unreadCount']?.toString() ?? '') ?? 0,
  );
});

final reportActionsProvider = Provider<ReportActionsController>(
  ReportActionsController.new,
);

final shareActionsProvider = Provider<ShareActionsController>(
  ShareActionsController.new,
);

class ShareActionsController {
  ShareActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<Map<String, Object?>> createShare({
    required String targetType,
    required String targetId,
  }) async {
    final cancelToken = _trackToken();
    try {
      return await _ref.read(backendRepositoryProvider).createShare(
            targetType: targetType,
            targetId: targetId,
            cancelToken: cancelToken,
          );
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

class ReportActionsController {
  ReportActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<void> createReport({
    required String targetUserId,
    required String reason,
    String details = '',
    bool blockRequested = false,
  }) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).createReport(
            targetUserId: targetUserId,
            reason: reason,
            details: details,
            blockRequested: blockRequested,
            cancelToken: cancelToken,
          );
      _ref.invalidate(reportsProvider);
      _ref.invalidate(safetyProvider);
      if (blockRequested) {
        _ref.invalidate(blocksProvider);
      }
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BlockedUserData> createBlock({
    required String targetUserId,
  }) async {
    final cancelToken = _trackToken();
    try {
      final block = await _ref.read(backendRepositoryProvider).createBlock(
            targetUserId: targetUserId,
            cancelToken: cancelToken,
          );
      _ref.invalidate(blocksProvider);
      _ref.invalidate(safetyProvider);
      return block;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final notificationsActionsProvider = Provider<NotificationsActionsController>(
  NotificationsActionsController.new,
);

final reportsProvider = FutureProvider.autoDispose<SafetyReportPage>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(const BackendPage(items: []));
  }
  return _localFirstValueFuture<SafetyReportPage>(
    ref,
    namespace: 'reports',
    cacheValue: 'me',
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchReports(
      cancelToken: cancelToken,
    ),
    encode: (page) => page.raw,
    decode: _decodeSafetyReportPage,
  );
});

final blocksProvider = FutureProvider.autoDispose<BlockedUserPage>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(const BackendPage(items: []));
  }
  return _localFirstValueFuture<BlockedUserPage>(
    ref,
    namespace: 'blocks',
    cacheValue: 'me',
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchBlocks(
      cancelToken: cancelToken,
    ),
    encode: (page) => page.raw,
    decode: _decodeBlockedUserPage,
  );
});

const _notificationsCacheNamespace = 'notifications';
const _notificationsListCacheValue = 'list?limit=30';
const _notificationsUnreadCountCacheValue = 'unread-count';

class NotificationsActionsController {
  NotificationsActionsController(this._ref) {
    _ref.onDispose(() {
      for (final token in _tokens) {
        token.cancel();
      }
      _tokens.clear();
    });
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<void> markRead(String notificationId) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).markNotificationRead(
            notificationId,
            cancelToken: cancelToken,
          );
      await _markNotificationReadLocally(notificationId);
      _ref.invalidate(notificationUnreadCountProvider);
      _ref.invalidate(notificationsProvider);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> markAllRead() async {
    final cancelToken = _trackToken();
    try {
      await _ref
          .read(backendRepositoryProvider)
          .markAllNotificationsRead(cancelToken: cancelToken);
      await _markAllNotificationsReadLocally();
      _ref.invalidate(notificationUnreadCountProvider);
      _ref.invalidate(notificationsProvider);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> applyRealtimeNotificationCreated(
    Map<String, Object?> payload,
  ) async {
    final notification = _realtimeNotificationFromPayload(payload);
    if (notification == null) {
      _ref.invalidate(notificationUnreadCountProvider);
      _ref.invalidate(notificationsProvider);
      return;
    }

    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      _ref.invalidate(notificationUnreadCountProvider);
      _ref.invalidate(notificationsProvider);
      return;
    }

    final userScope = currentCacheScope(_ref);
    final now = DateTime.now();
    final listKey = AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsListCacheValue,
      userScope: userScope,
    );
    final countKey = AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsUnreadCountCacheValue,
      userScope: userScope,
    );
    final cachedList = await store.getFreshJson(listKey, now: now);
    final cachedCount = await store.getFreshJson(countKey, now: now);
    var insertedUnread = false;

    if (cachedList != null) {
      final notificationId = notification['id']?.toString();
      final existingItems = _items(cachedList);
      final hadItem = existingItems.any(
        (item) => item['id']?.toString() == notificationId,
      );
      insertedUnread = !hadItem && _notificationIsUnread(notification);
      final updatedItems = <Map<String, Object?>>[
        notification,
        ...existingItems.where(
          (item) => item['id']?.toString() != notificationId,
        ),
      ].take(30).toList(growable: false);
      await store.putJson(
        listKey,
        <String, Object?>{
          ...cachedList,
          'items': updatedItems,
        },
        expiresAt: now.add(const Duration(minutes: 2)),
      );
    }

    if (cachedCount != null && insertedUnread) {
      final count =
          int.tryParse(cachedCount['unreadCount']?.toString() ?? '') ?? 0;
      await store.putJson(
        countKey,
        <String, Object?>{'unreadCount': count + 1},
        expiresAt: now.add(const Duration(minutes: 1)),
      );
    } else if (cachedCount == null && _notificationIsUnread(notification)) {
      _ref.invalidate(notificationUnreadCountProvider);
    }

    _ref.invalidate(notificationUnreadCountProvider);
    _ref.invalidate(notificationsProvider);
  }

  Future<BackendCardItem> acceptEventInvite({
    required String eventId,
    required String requestId,
  }) async {
    final cancelToken = _trackToken();
    try {
      final event =
          await _ref.read(backendRepositoryProvider).acceptEventInvite(
                eventId: eventId,
                requestId: requestId,
                cancelToken: cancelToken,
              );
      await _dropNotificationCache();
      _ref.invalidate(homeEventsProvider);
      _ref.invalidate(homeEventsQueryProvider);
      _ref.invalidate(meetingsProvider);
      _ref.invalidate(meetingsQueryProvider);
      _ref.invalidate(meetingDetailProvider(eventId));
      _ref.invalidate(mapEventsProvider);
      _ref.invalidate(chatListProvider);
      _ref.invalidate(chatsProvider);
      _ref.invalidate(publicUserProvider);
      _ref.invalidate(notificationUnreadCountProvider);
      _ref.invalidate(notificationsProvider);
      return event;
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<void> declineEventInvite({
    required String eventId,
    required String requestId,
  }) async {
    final cancelToken = _trackToken();
    try {
      await _ref.read(backendRepositoryProvider).declineEventInvite(
            eventId: eventId,
            requestId: requestId,
            cancelToken: cancelToken,
          );
      await _dropNotificationCache();
      _ref.invalidate(meetingDetailProvider(eventId));
      _ref.invalidate(notificationUnreadCountProvider);
      _ref.invalidate(notificationsProvider);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  Future<void> _dropNotificationCache() async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    final userScope = currentCacheScope(_ref);
    await store.deleteKey(
      AppCacheKey(
        namespace: _notificationsCacheNamespace,
        value: _notificationsListCacheValue,
        userScope: userScope,
      ),
    );
    await store.deleteKey(
      AppCacheKey(
        namespace: _notificationsCacheNamespace,
        value: _notificationsUnreadCountCacheValue,
        userScope: userScope,
      ),
    );
  }

  Future<void> _markNotificationReadLocally(String notificationId) async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    final userScope = currentCacheScope(_ref);
    final now = DateTime.now();
    final listKey = AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsListCacheValue,
      userScope: userScope,
    );
    final countKey = AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsUnreadCountCacheValue,
      userScope: userScope,
    );
    final cachedList = await store.getFreshJson(listKey, now: now);
    final cachedCount = await store.getFreshJson(countKey, now: now);
    final items = cachedList == null ? null : _items(cachedList);
    var wasUnread = false;

    if (cachedList != null && items != null) {
      final updatedItems = items.map((item) {
        if (item['id']?.toString() != notificationId) {
          return item;
        }
        wasUnread = _notificationIsUnread(item);
        return <String, Object?>{
          ...item,
          'read': true,
          'isRead': true,
          'readAt': item['readAt'] ?? now.toUtc().toIso8601String(),
        };
      }).toList(growable: false);
      await store.putJson(
        listKey,
        <String, Object?>{
          ...cachedList,
          'items': updatedItems,
        },
        expiresAt: now.add(const Duration(minutes: 2)),
      );
    }

    if (cachedCount != null && (wasUnread || cachedList == null)) {
      final count =
          int.tryParse(cachedCount['unreadCount']?.toString() ?? '') ?? 0;
      await store.putJson(
        countKey,
        <String, Object?>{'unreadCount': count > 0 ? count - 1 : 0},
        expiresAt: now.add(const Duration(minutes: 1)),
      );
    }
  }

  Future<void> _markAllNotificationsReadLocally() async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    final userScope = currentCacheScope(_ref);
    final now = DateTime.now();
    final listKey = AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsListCacheValue,
      userScope: userScope,
    );
    final countKey = AppCacheKey(
      namespace: _notificationsCacheNamespace,
      value: _notificationsUnreadCountCacheValue,
      userScope: userScope,
    );
    final cachedList = await store.getFreshJson(listKey, now: now);

    if (cachedList != null) {
      final readAt = now.toUtc().toIso8601String();
      final updatedItems = _items(cachedList).map((item) {
        return <String, Object?>{
          ...item,
          'read': true,
          'isRead': true,
          'readAt': item['readAt'] ?? readAt,
        };
      }).toList(growable: false);
      await store.putJson(
        listKey,
        <String, Object?>{
          ...cachedList,
          'items': updatedItems,
        },
        expiresAt: now.add(const Duration(minutes: 2)),
      );
    }

    await store.putJson(
      countKey,
      const <String, Object?>{'unreadCount': 0},
      expiresAt: now.add(const Duration(minutes: 1)),
    );
  }
}

bool _notificationIsUnread(Map<String, Object?> item) {
  final read = item['read'];
  if (read is bool) {
    return !read;
  }
  final isRead = item['isRead'];
  if (isRead is bool) {
    return !isRead;
  }
  return item['readAt'] == null;
}

Map<String, Object?>? _realtimeNotificationFromPayload(
  Map<String, Object?> payload,
) {
  final notificationId = payload['notificationId']?.toString();
  final kind = payload['kind']?.toString();
  final title = payload['title']?.toString();
  final body = payload['body']?.toString();
  final createdAt = payload['createdAt']?.toString();
  if (notificationId == null ||
      notificationId.isEmpty ||
      kind == null ||
      kind.isEmpty ||
      title == null ||
      body == null ||
      createdAt == null ||
      createdAt.isEmpty) {
    return null;
  }
  final readAt = payload['readAt']?.toString();
  final rawPayload = payload['payload'];
  return <String, Object?>{
    'id': notificationId,
    'notificationId': notificationId,
    'kind': kind,
    'title': title,
    'body': body,
    'payload': rawPayload is Map
        ? rawPayload.map((key, value) => MapEntry('$key', value))
        : const <String, Object?>{},
    'readAt': readAt == null || readAt.isEmpty ? null : readAt,
    'read': readAt != null && readAt.isNotEmpty,
    'isRead': readAt != null && readAt.isNotEmpty,
    'createdAt': createdAt,
  };
}

final communitiesProvider = StreamProvider.autoDispose<CardPage>((ref) {
  return _localFirstPageStream(
    ref,
    namespace: _communitiesCacheNamespace,
    cacheValue: _communitiesListCacheValue,
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchCommunities(
      cancelToken: cancelToken,
    ),
  );
});

final communitiesPaginationProvider = StateNotifierProvider.autoDispose<
    CommunitiesPaginationController, CommunitiesPaginationState>((ref) {
  return CommunitiesPaginationController(ref);
});

class CommunitiesPaginationState {
  const CommunitiesPaginationState({
    this.items = const [],
    this.nextCursor,
    this.loading = false,
    this.error = false,
    this.initialized = false,
  });

  final List<BackendCardItem> items;
  final String? nextCursor;
  final bool loading;
  final bool error;
  final bool initialized;

  bool get hasNextPage => nextCursor != null && nextCursor!.isNotEmpty;

  CommunitiesPaginationState copyWith({
    List<BackendCardItem>? items,
    String? nextCursor,
    bool clearNextCursor = false,
    bool? loading,
    bool? error,
    bool? initialized,
  }) {
    return CommunitiesPaginationState(
      items: items ?? this.items,
      nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
      loading: loading ?? this.loading,
      error: error ?? this.error,
      initialized: initialized ?? this.initialized,
    );
  }
}

class CommunitiesPaginationController
    extends StateNotifier<CommunitiesPaginationState> {
  CommunitiesPaginationController(this._ref)
      : super(const CommunitiesPaginationState()) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = {};

  void primeNextCursor(String? cursor) {
    if (state.items.isNotEmpty || state.loading) {
      return;
    }
    if (state.initialized && state.nextCursor == cursor) {
      return;
    }
    state = state.copyWith(
      nextCursor: cursor,
      clearNextCursor: cursor == null || cursor.isEmpty,
      error: false,
      initialized: true,
    );
  }

  Future<void> loadNextPage() async {
    final cursor = state.nextCursor;
    if (state.loading || cursor == null || cursor.isEmpty) {
      return;
    }
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    state = state.copyWith(loading: true, error: false);
    try {
      final page = await _ref.read(backendRepositoryProvider).fetchCommunities(
            cursor: cursor,
            cancelToken: cancelToken,
          );
      state = state.copyWith(
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        clearNextCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
        loading: false,
        error: false,
      );
    } catch (_) {
      if (!cancelToken.isCancelled) {
        state = state.copyWith(loading: false, error: true);
      }
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final communityActionsProvider = Provider<CommunityActionsController>(
  CommunityActionsController.new,
);

const _communitiesCacheNamespace = 'communities';
const _communitiesListCacheValue = 'list?limit=20';

class CommunityActionsController {
  CommunityActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = <CancelToken>{};

  Future<BackendCardItem> createCommunity({
    required Map<String, Object?> data,
    required String idempotencyKey,
  }) async {
    final cancelToken = _trackToken();
    try {
      final community =
          await _ref.read(backendRepositoryProvider).createCommunity(
                data: data,
                idempotencyKey: idempotencyKey,
                cancelToken: cancelToken,
              );
      await _prependCommunityToCaches(community);
      _ref.invalidate(communitiesProvider);
      return community;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> setJoined({
    required String communityId,
    required bool joined,
  }) async {
    final cancelToken = _trackToken();
    try {
      final community = joined
          ? await _ref.read(backendRepositoryProvider).joinCommunity(
                communityId,
                cancelToken: cancelToken,
              )
          : await _ref.read(backendRepositoryProvider).leaveCommunity(
                communityId,
                cancelToken: cancelToken,
              );
      await _updateCommunityCaches(community);
      _ref.invalidate(communityDetailProvider(communityId));
      _ref.invalidate(communitiesProvider);
      return community;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<BackendCardItem> createNews({
    required String communityId,
    required String title,
    required String body,
  }) async {
    final cancelToken = _trackToken();
    try {
      final community =
          await _ref.read(backendRepositoryProvider).createCommunityNews(
                communityId: communityId,
                title: title,
                body: body,
                cancelToken: cancelToken,
              );
      await _writeCommunityDetailCache(community);
      _ref.invalidate(communityDetailProvider(communityId));
      return community;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }

  Future<void> _prependCommunityToCaches(BackendCardItem community) async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    final scope = currentCacheScope(_ref);
    final now = DateTime.now();
    final expiresAt = now.add(const Duration(minutes: 5));
    final communityJson = _communityCacheJson(community);
    await _writeCommunityDetailCache(
      community,
      store: store,
      scope: scope,
      expiresAt: expiresAt,
    );

    final listKey = AppCacheKey(
      namespace: _communitiesCacheNamespace,
      value: _communitiesListCacheValue,
      userScope: scope,
    );
    final cachedList = await store.getFreshJson(listKey, now: now);
    final items = cachedList?['items'];
    if (cachedList == null || items is! List) {
      await store.putJson(
        listKey,
        {
          'items': [communityJson],
          'nextCursor': null,
        },
        expiresAt: expiresAt,
      );
      return;
    }
    final nextItems = [
      communityJson,
      for (final item in items)
        if (item is! Map || item['id']?.toString() != community.id) item,
    ];
    await store.putJson(
      listKey,
      {...cachedList, 'items': nextItems},
      expiresAt: expiresAt,
    );
  }

  Future<void> _updateCommunityCaches(BackendCardItem community) async {
    final store = _ref.read(appLocalCacheStoreProvider);
    if (store == null) {
      return;
    }
    final scope = currentCacheScope(_ref);
    final now = DateTime.now();
    final expiresAt = now.add(const Duration(minutes: 5));
    final communityJson = _communityCacheJson(community);
    await _writeCommunityDetailCache(
      community,
      store: store,
      scope: scope,
      expiresAt: expiresAt,
    );

    final listKey = AppCacheKey(
      namespace: _communitiesCacheNamespace,
      value: _communitiesListCacheValue,
      userScope: scope,
    );
    final cachedList = await store.getFreshJson(listKey, now: now);
    final items = cachedList?['items'];
    if (cachedList == null || items is! List) {
      return;
    }
    var updated = false;
    final nextItems = [
      for (final item in items)
        if (item is Map && item['id']?.toString() == community.id) ...[
          _mergeCacheJson(item, communityJson)
        ] else
          item,
    ];
    updated = nextItems.any(
      (item) => item is Map && item['id']?.toString() == community.id,
    );
    if (!updated) {
      return;
    }
    await store.putJson(
      listKey,
      {...cachedList, 'items': nextItems},
      expiresAt: expiresAt,
    );
  }

  Map<String, Object?> _communityCacheJson(BackendCardItem community) {
    return {
      ...community.raw,
      'id': community.id,
      if (community.title.isNotEmpty && !community.raw.containsKey('name'))
        'name': community.title,
      if (community.subtitle != null && !community.raw.containsKey('subtitle'))
        'subtitle': community.subtitle,
      if (community.imageUrl != null && !community.raw.containsKey('imageUrl'))
        'imageUrl': community.imageUrl,
    };
  }

  Future<void> _writeCommunityDetailCache(
    BackendCardItem community, {
    AppLocalCacheStore? store,
    AppCacheUserScope? scope,
    DateTime? expiresAt,
  }) async {
    final cacheStore = store ?? _ref.read(appLocalCacheStoreProvider);
    if (cacheStore == null) {
      return;
    }
    await cacheStore.putJson(
      AppCacheKey(
        namespace: _communitiesCacheNamespace,
        value: 'detail:${community.id}',
        userScope: scope ?? currentCacheScope(_ref),
      ),
      _communityCacheJson(community),
      expiresAt: expiresAt ?? DateTime.now().add(const Duration(minutes: 5)),
    );
  }

  Map<String, Object?> _mergeCacheJson(
    Map<Object?, Object?> cached,
    Map<String, Object?> fresh,
  ) {
    return {
      for (final entry in cached.entries) '${entry.key}': entry.value,
      ...fresh,
    };
  }
}

final communityDetailProvider =
    FutureProvider.autoDispose.family<BackendCardItem, String>((ref, id) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchCommunityDetail(id, cancelToken: cancelToken);
  }
  return localFirst.fetch<BackendCardItem>(
    key: AppCacheKey(
      namespace: 'communities',
      value: 'detail:$id',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 5),
    network: () async {
      final community = await repository.fetchCommunityDetail(
        id,
        cancelToken: cancelToken,
      );
      return community.raw;
    },
    decode: BackendCardItem.fromJson,
  );
});

final communityMediaProvider =
    StreamProvider.autoDispose.family<CardPage, String>((ref, communityId) {
  return _localFirstPageStream(
    ref,
    namespace: 'communities',
    cacheValue: 'media:$communityId?limit=20',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchCommunityMedia(
      communityId,
      cancelToken: cancelToken,
    ),
  );
});

final communityMediaPaginationProvider = StateNotifierProvider.autoDispose
    .family<CommunityMediaPaginationController, CommunityMediaPaginationState,
        String>((ref, communityId) {
  return CommunityMediaPaginationController(ref, communityId);
});

class CommunityMediaPaginationState {
  const CommunityMediaPaginationState({
    this.items = const [],
    this.nextCursor,
    this.loading = false,
    this.error = false,
    this.initialized = false,
  });

  final List<BackendCardItem> items;
  final String? nextCursor;
  final bool loading;
  final bool error;
  final bool initialized;

  bool get hasNextPage => nextCursor != null && nextCursor!.isNotEmpty;

  CommunityMediaPaginationState copyWith({
    List<BackendCardItem>? items,
    String? nextCursor,
    bool clearNextCursor = false,
    bool? loading,
    bool? error,
    bool? initialized,
  }) {
    return CommunityMediaPaginationState(
      items: items ?? this.items,
      nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
      loading: loading ?? this.loading,
      error: error ?? this.error,
      initialized: initialized ?? this.initialized,
    );
  }
}

class CommunityMediaPaginationController
    extends StateNotifier<CommunityMediaPaginationState> {
  CommunityMediaPaginationController(this._ref, this._communityId)
      : super(const CommunityMediaPaginationState()) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final String _communityId;
  final Set<CancelToken> _tokens = {};

  void primeNextCursor(String? cursor) {
    if (state.items.isNotEmpty || state.loading) {
      return;
    }
    if (state.initialized && state.nextCursor == cursor) {
      return;
    }
    state = state.copyWith(
      nextCursor: cursor,
      clearNextCursor: cursor == null || cursor.isEmpty,
      error: false,
      initialized: true,
    );
  }

  Future<void> loadNextPage() async {
    final cursor = state.nextCursor;
    if (state.loading || cursor == null || cursor.isEmpty) {
      return;
    }
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    state = state.copyWith(loading: true, error: false);
    try {
      final page =
          await _ref.read(backendRepositoryProvider).fetchCommunityMedia(
                _communityId,
                cursor: cursor,
                cancelToken: cancelToken,
              );
      state = state.copyWith(
        items: [...state.items, ...page.items],
        nextCursor: page.nextCursor,
        clearNextCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
        loading: false,
        error: false,
      );
    } catch (_) {
      if (!cancelToken.isCancelled) {
        state = state.copyWith(loading: false, error: true);
      }
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final eveningAiDraftProvider =
    FutureProvider.autoDispose.family<EveningAiDraftData, String>(
  (ref, draftId) {
    final localFirst = ref.read(localFirstRepositoryProvider);
    final cancelToken = CancelToken();
    ref.onDispose(cancelToken.cancel);
    final repository = ref.read(backendRepositoryProvider);
    if (localFirst == null) {
      return repository.fetchEveningAiDraft(
        draftId,
        cancelToken: cancelToken,
      );
    }
    return localFirst.fetch<EveningAiDraftData>(
      key: AppCacheKey(
        namespace: 'evening-ai-drafts',
        value: draftId,
        userScope: ref.watch(currentCacheScopeProvider),
      ),
      ttl: const Duration(minutes: 15),
      network: () async {
        final draft = await repository.fetchEveningAiDraft(
          draftId,
          cancelToken: cancelToken,
        );
        return draft.raw;
      },
      decode: EveningAiDraftData.fromJson,
    );
  },
);

final afterDarkAccessProvider =
    FutureProvider.autoDispose<AfterDarkAccessData>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(const AfterDarkAccessData(unlocked: false));
  }
  return _localFirstValueFuture<AfterDarkAccessData>(
    ref,
    namespace: 'after_dark_access',
    cacheValue: 'me',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchAfterDarkAccess(
      cancelToken: cancelToken,
    ),
    encode: (access) => access.raw,
    decode: AfterDarkAccessData.fromJson,
  );
});

final afterDarkEventsProvider = StreamProvider.autoDispose<CardPage>((ref) {
  return _privatePageStream(
    ref,
    namespace: 'after_dark_events',
    cacheValue: 'events?limit=20',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchAfterDarkEvents(
      cancelToken: cancelToken,
    ),
  );
});

final afterDarkEventProvider =
    FutureProvider.autoDispose.family<BackendCardItem, String>((ref, eventId) {
  return _localFirstValueFuture<BackendCardItem>(
    ref,
    namespace: 'after_dark_events',
    cacheValue: 'detail:$eventId',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchAfterDarkEvent(
      eventId,
      cancelToken: cancelToken,
    ),
    encode: (event) => event.raw,
    decode: BackendCardItem.fromJson,
  );
});

final publicUserProvider =
    FutureProvider.autoDispose.family<BackendCardItem, String>((ref, userId) {
  return _localFirstValueFuture<BackendCardItem>(
    ref,
    namespace: 'people',
    cacheValue: 'profile:$userId',
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchPublicUser(
      userId,
      cancelToken: cancelToken,
    ),
    encode: (user) => user.raw,
    decode: BackendCardItem.fromJson,
  );
});

final profileSocialProvider =
    FutureProvider.autoDispose.family<ProfileSocialData, String>((ref, userId) {
  return _localFirstValueFuture<ProfileSocialData>(
    ref,
    namespace: 'people',
    cacheValue: 'social:$userId',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchProfileSocial(
      userId,
      cancelToken: cancelToken,
    ),
    encode: (social) => social.raw,
    decode: ProfileSocialData.fromJson,
  );
});

final hostDashboardProvider =
    FutureProvider.autoDispose<HostDashboardData>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(
      const HostDashboardData(stats: HostDashboardStats()),
    );
  }
  return _localFirstValueFuture<HostDashboardData>(
    ref,
    namespace: 'host',
    cacheValue: 'dashboard',
    ttl: const Duration(minutes: 1),
    fetch: (repository, cancelToken) => repository.fetchHostDashboard(
      cancelToken: cancelToken,
    ),
    encode: (dashboard) => dashboard.raw,
    decode: HostDashboardData.fromJson,
  );
});

final hostDashboardActionsProvider = Provider<HostDashboardActionsController>(
    HostDashboardActionsController.new);

class HostDashboardActionsController {
  HostDashboardActionsController(this._ref) {
    _ref.onDispose(_cancelActiveRequests);
  }

  final Ref _ref;
  final Set<CancelToken> _tokens = {};

  Future<HostJoinRequestData> approveRequest(String requestId) async {
    final cancelToken = _trackToken();
    try {
      final request =
          await _ref.read(backendRepositoryProvider).approveHostRequest(
                requestId,
                cancelToken: cancelToken,
              );
      _ref.invalidate(hostDashboardProvider);
      return request;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<HostJoinRequestData> rejectRequest(String requestId) async {
    final cancelToken = _trackToken();
    try {
      final request =
          await _ref.read(backendRepositoryProvider).rejectHostRequest(
                requestId,
                cancelToken: cancelToken,
              );
      _ref.invalidate(hostDashboardProvider);
      return request;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  Future<TokenWalletData> boostEvent(String eventId) async {
    final cancelToken = _trackToken();
    try {
      final wallet = await _ref.read(backendRepositoryProvider).createPromotion(
            targetKind: 'event',
            targetId: eventId,
            optionId: 'boost-24',
            cancelToken: cancelToken,
          );
      _ref.invalidate(tokenWalletProvider);
      _ref.invalidate(hostDashboardProvider);
      return wallet;
    } on DioException catch (error) {
      throw BackendActionException.fromDio(error);
    } finally {
      _tokens.remove(cancelToken);
    }
  }

  CancelToken _trackToken() {
    final cancelToken = CancelToken();
    _tokens.add(cancelToken);
    return cancelToken;
  }

  void _cancelActiveRequests() {
    for (final token in _tokens) {
      token.cancel();
    }
    _tokens.clear();
  }
}

final searchResultsProvider =
    FutureProvider.autoDispose.family<CardPage, String>((ref, query) {
  final trimmed = query.trim();
  if (trimmed.isEmpty) {
    return Future.value(const BackendPage(items: []));
  }
  if (ref.watch(authTokensProvider) == null) {
    return Future.value(const BackendPage(items: []));
  }
  final city = _currentCity(ref);
  return _localFirstValueFuture<CardPage>(
    ref,
    namespace: 'search',
    cacheValue: 'city:${city ?? ''};q:$trimmed',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.search(
      trimmed,
      city: city,
      cancelToken: cancelToken,
    ),
    encode: (page) => page.raw.isEmpty
        ? {'items': page.items.map((item) => item.raw).toList()}
        : page.raw,
    decode: _decodeCardPage,
  );
});

class MapViewportQuery {
  const MapViewportQuery({
    required this.north,
    required this.south,
    required this.east,
    required this.west,
  });

  final double north;
  final double south;
  final double east;
  final double west;

  String get cacheValue => [
        north.toStringAsFixed(3),
        south.toStringAsFixed(3),
        east.toStringAsFixed(3),
        west.toStringAsFixed(3),
      ].join(':');

  @override
  bool operator ==(Object other) {
    return other is MapViewportQuery && other.cacheValue == cacheValue;
  }

  @override
  int get hashCode => cacheValue.hashCode;
}

final mapEventsProvider =
    StreamProvider.autoDispose.family<CardPage, MapViewportQuery>((ref, query) {
  return _localFirstPageStream(
    ref,
    namespace: 'map_events',
    cacheValue: query.cacheValue,
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchMapEvents(
      north: query.north,
      south: query.south,
      east: query.east,
      west: query.west,
      cancelToken: cancelToken,
    ),
  );
});

final datingDiscoverProvider = StreamProvider.autoDispose<CardPage>((ref) {
  if (ref.watch(authTokensProvider) == null) {
    return Stream.value(const BackendPage(items: []));
  }
  final filters = ref.watch(datingDiscoverFiltersProvider);
  return _localFirstPageStream(
    ref,
    namespace: 'dating',
    cacheValue: filters.cacheValue,
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchDatingDiscover(
      gender: filters.gender,
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      radiusKm: filters.radiusKm,
      interests: filters.interests,
      verifiedOnly: filters.verifiedOnly,
      onlineOnly: filters.onlineOnly,
      newThisWeekOnly: filters.newThisWeekOnly,
      cancelToken: cancelToken,
    ),
  ).map((page) => _applyDatingClientFilters(page, filters));
});

CardPage _applyDatingClientFilters(
  CardPage page,
  DatingDiscoverFilters filters,
) {
  if (!filters.frendlyPlusOnly) {
    return page;
  }
  final items = page.items.where((item) {
    final raw = item.raw;
    if (filters.frendlyPlusOnly && raw['premium'] != true) {
      return false;
    }
    return true;
  }).toList(growable: false);
  return BackendPage(
    items: items,
    nextCursor: page.nextCursor,
    raw: page.raw,
  );
}

final perksProvider = perksByCategoryProvider(null);

final perksByCategoryProvider =
    StreamProvider.autoDispose.family<CardPage, String?>((ref, category) {
  final city = _currentCity(ref);
  return _localFirstPageStream(
    ref,
    namespace: 'perks',
    cacheValue: 'promos?city=${city ?? ''}&category=${category ?? ''}&limit=20',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchPerks(
      city: city,
      category: category,
      cancelToken: cancelToken,
    ),
  );
});

final placeSearchProvider =
    StreamProvider.autoDispose.family<CardPage, String>((ref, query) {
  final city = _currentCity(ref);
  return _localFirstPageStream(
    ref,
    namespace: 'places',
    cacheValue: 'search?city=${city ?? ''}&q=$query&limit=20',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.searchPlaces(
      query: query,
      city: city,
      limit: 20,
      cancelToken: cancelToken,
    ),
  );
});

final profileHistoryProvider = StreamProvider.autoDispose<CardPage>((ref) {
  return _privatePageStream(
    ref,
    namespace: 'profile',
    cacheValue: 'frendly-history?limit=20',
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchHistory(
      cancelToken: cancelToken,
    ),
  );
});

final frendlySeasonProvider =
    FutureProvider.autoDispose<FrendlySeasonData>((ref) {
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  final repository = ref.read(backendRepositoryProvider);
  if (localFirst == null) {
    return repository.fetchFrendlySeason(cancelToken: cancelToken);
  }
  return localFirst.fetch<FrendlySeasonData>(
    key: AppCacheKey(
      namespace: 'profile',
      value: 'frendly-season',
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: const Duration(minutes: 5),
    network: () async {
      final season = await repository.fetchFrendlySeason(
        cancelToken: cancelToken,
      );
      return season.raw;
    },
    decode: FrendlySeasonData.fromJson,
  );
});

final dropsHomeProvider = FutureProvider.autoDispose<DropsHomeData>((ref) {
  if (ref.watch(authTokensProvider) == null ||
      ref.watch(currentUserIdProvider) == null) {
    return Future.value(
      const DropsHomeData(
        ticketProgress: DropTicketProgressData(),
        eligibility: DropUserEligibilityData(),
      ),
    );
  }
  return _localFirstValueFuture<DropsHomeData>(
    ref,
    namespace: 'drops',
    cacheValue: 'home',
    ttl: const Duration(minutes: 1),
    fetch: (repository, cancelToken) => repository.fetchDropsHome(
      cancelToken: cancelToken,
    ),
    encode: (home) => home.raw,
    decode: DropsHomeData.fromJson,
  );
});

final trustedContactsProvider = StreamProvider.autoDispose<CardPage>((ref) {
  return _privatePageStream(
    ref,
    namespace: 'safety',
    cacheValue: 'trusted-contacts',
    ttl: const Duration(minutes: 5),
    fetch: (repository, cancelToken) => repository.fetchTrustedContacts(
      cancelToken: cancelToken,
    ),
  );
});

final eventStoriesProvider =
    StreamProvider.autoDispose.family<CardPage, String>((ref, eventId) {
  return _localFirstPageStream(
    ref,
    namespace: 'stories',
    cacheValue: 'event:$eventId?limit=20',
    ttl: const Duration(minutes: 2),
    fetch: (repository, cancelToken) => repository.fetchEventStories(
      eventId,
      cancelToken: cancelToken,
    ),
  );
});

final memoryPeopleProvider = StreamProvider.autoDispose<CardPage>((ref) {
  return _privatePageStream(
    ref,
    namespace: 'profile',
    cacheValue: 'frendly-people?limit=20',
    ttl: const Duration(minutes: 10),
    fetch: (repository, cancelToken) => repository.fetchMemoryPeople(
      cancelToken: cancelToken,
    ),
  );
});

Stream<CardPage> _privatePageStream(
  Ref ref, {
  required String namespace,
  required String cacheValue,
  required Duration ttl,
  required Future<CardPage> Function(BackendRepository, CancelToken) fetch,
}) {
  if (ref.watch(authTokensProvider) == null ||
      ref.watch(currentUserIdProvider) == null) {
    return Stream.value(const BackendPage(items: []));
  }
  return _localFirstPageStream(
    ref,
    namespace: namespace,
    cacheValue: cacheValue,
    ttl: ttl,
    fetch: fetch,
  );
}

String? _currentCity(Ref ref) {
  final city = ref.watch(currentUserProvider)?.city?.trim();
  return city == null || city.isEmpty ? null : city;
}

Stream<CardPage> _localFirstPageStream(
  Ref ref, {
  required String namespace,
  required String cacheValue,
  required Duration ttl,
  required Future<CardPage> Function(BackendRepository, CancelToken) fetch,
}) {
  final repository = ref.read(backendRepositoryProvider);
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  if (localFirst == null) {
    return Stream.fromFuture(fetch(repository, cancelToken));
  }
  return localFirst.watch<CardPage>(
    key: AppCacheKey(
      namespace: namespace,
      value: cacheValue,
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: ttl,
    network: () async {
      final page = await fetch(repository, cancelToken);
      return page.raw.isEmpty
          ? {'items': page.items.map((item) => item.raw).toList()}
          : page.raw;
    },
    decode: _decodeCardPage,
  );
}

Future<T> _localFirstValueFuture<T>(
  Ref ref, {
  required String namespace,
  required String cacheValue,
  required Duration ttl,
  required Future<T> Function(BackendRepository, CancelToken) fetch,
  required Map<String, Object?> Function(T) encode,
  required T Function(Map<String, Object?>) decode,
}) {
  final repository = ref.read(backendRepositoryProvider);
  final localFirst = ref.read(localFirstRepositoryProvider);
  final cancelToken = CancelToken();
  ref.onDispose(cancelToken.cancel);
  if (localFirst == null) {
    return fetch(repository, cancelToken);
  }
  return localFirst.fetch<T>(
    key: AppCacheKey(
      namespace: namespace,
      value: cacheValue,
      userScope: ref.watch(currentCacheScopeProvider),
    ),
    ttl: ttl,
    network: () async {
      final value = await fetch(repository, cancelToken);
      return encode(value);
    },
    decode: decode,
  );
}

CardPage _decodeCardPage(Map<String, Object?> json) {
  return BackendPage(
    items: _items(json).map(BackendCardItem.fromJson).toList(growable: false),
    nextCursor: json['nextCursor']?.toString(),
    raw: json,
  );
}

SafetyReportPage _decodeSafetyReportPage(Map<String, Object?> json) {
  return BackendPage(
    items: _items(json).map(SafetyReportData.fromJson).toList(growable: false),
    nextCursor: json['nextCursor']?.toString(),
    raw: json,
  );
}

BlockedUserPage _decodeBlockedUserPage(Map<String, Object?> json) {
  return BackendPage(
    items: _items(json).map(BlockedUserData.fromJson).toList(growable: false),
    nextCursor: json['nextCursor']?.toString(),
    raw: json,
  );
}

List<Map<String, Object?>> _items(Map<String, Object?> json) {
  final value = json['items'];
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => item.map((key, value) => MapEntry('$key', value)))
      .toList(growable: false);
}
