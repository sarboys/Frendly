import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile2/app/core/auth/auth_token_storage.dart';
import 'package:mobile2/app/core/config/backend_config.dart';
import 'package:mobile2/app/core/device/app_attachment_service.dart';
import 'package:mobile2/app/core/device/app_media_prewarm_service.dart';
import 'package:mobile2/app/core/device/app_push_token_service.dart';
import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_cache_store.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';
import 'package:mobile2/app/core/local_cache/chat_local_store.dart';
import 'package:mobile2/app/core/local_cache/local_first_repository.dart';
import 'package:mobile2/app/core/network/api_client.dart';
import 'package:mobile2/app/core/network/chat_socket_client.dart';
import 'package:mobile2/app/session/session_cleanup_controller.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

const appLocalCacheLastUserIdStorageKey = 'app.local_cache.last_user_id.v1';
const completedOnboardingUserStorageKeyPrefix =
    'app.onboarding.completed_user.v1.';

String completedOnboardingUserStorageKey(String userId) {
  return '$completedOnboardingUserStorageKeyPrefix$userId';
}

final sharedPreferencesProvider = Provider<SharedPreferences?>((ref) => null);
final authTokenStorageProvider = Provider<AuthTokenStorage?>((ref) => null);
final initialAuthTokensProvider = Provider<AuthTokens?>((ref) => null);

final authTokensProvider =
    StateNotifierProvider<AuthTokensController, AuthTokens?>((ref) {
  return AuthTokensController(
    storage: ref.read(authTokenStorageProvider),
    initialTokens: ref.read(initialAuthTokensProvider),
  );
});

final currentUserProvider = StateProvider<BackendUser?>((ref) => null);

final currentUserIdProvider = Provider<String?>((ref) {
  return ref.watch(currentUserProvider.select((user) => user?.id));
});

final currentCacheScopeProvider = Provider<AppCacheUserScope>((ref) {
  final userId = ref.watch(currentUserIdProvider);
  return userId == null
      ? AppCacheUserScope.public()
      : AppCacheUserScope.user(userId);
});

final localFirstCacheEnabledProvider =
    Provider<bool>((ref) => BackendConfig.localFirstCacheEnabled);

final appLocalCacheRuntimeDisabledProvider =
    StateProvider<bool>((ref) => false);

AppLocalDatabase _createDatabase() => AppLocalDatabase();

final appLocalDatabaseFactoryProvider =
    Provider<AppLocalDatabase Function()>((ref) => _createDatabase);

final appLocalDatabaseProvider = Provider<AppLocalDatabase?>((ref) {
  final enabled = ref.watch(localFirstCacheEnabledProvider);
  final disabled = ref.watch(appLocalCacheRuntimeDisabledProvider);
  if (!enabled || disabled) {
    return null;
  }
  final factory = ref.watch(appLocalDatabaseFactoryProvider);
  if (identical(factory, _createDatabase) && _isDebugWidgetTest()) {
    return null;
  }
  try {
    final database = factory();
    ref.onDispose(() => unawaited(database.close()));
    return database;
  } catch (_) {
    Future<void>.microtask(() {
      ref.read(appLocalCacheRuntimeDisabledProvider.notifier).state = true;
    });
    return null;
  }
});

bool _isDebugWidgetTest() {
  if (!kDebugMode) {
    return false;
  }
  final bindingType = BindingBase.debugBindingType()?.toString();
  return bindingType == null || bindingType.contains('TestWidgets');
}

final appLocalCacheStoreProvider = Provider<AppLocalCacheStore?>((ref) {
  final database = ref.watch(appLocalDatabaseProvider);
  return database == null ? null : AppLocalCacheStore(database);
});

final localFirstRepositoryProvider = Provider<LocalFirstRepository?>((ref) {
  final store = ref.watch(appLocalCacheStoreProvider);
  return store == null ? null : LocalFirstRepository(store);
});

final chatLocalStoreProvider = Provider<ChatLocalStore?>((ref) {
  final database = ref.watch(appLocalDatabaseProvider);
  return database == null ? null : ChatLocalStore(database);
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    readAccessToken: () async => ref.read(authTokensProvider)?.accessToken,
    refreshTokens: () async {
      final existing = ref.read(authTokensProvider);
      if (existing == null) {
        throw DioException(
          requestOptions: RequestOptions(path: '/auth/refresh'),
          type: DioExceptionType.badResponse,
        );
      }
      final repository = BackendRepository(
        Dio(BaseOptions(baseUrl: BackendConfig.apiBaseUrl)),
      );
      final fresh = await repository.refreshTokens(existing);
      await ref.read(authTokensProvider.notifier).setTokens(fresh);
      return fresh;
    },
  );
});

final backendRepositoryProvider = Provider<BackendRepository>((ref) {
  return BackendRepository(ref.watch(apiClientProvider).dio);
});

final chatSocketTransportFactoryProvider =
    Provider<ChatSocketTransportFactory>((ref) {
  return WebSocketChatTransport.connect;
});

final appAttachmentServiceProvider = Provider<AppAttachmentService>((ref) {
  final repository = ref.watch(backendRepositoryProvider);
  return AppAttachmentService(
    fetchSignedUrl: (path) async {
      final json = await repository.fetchSignedMediaUrl(path);
      return SignedMediaUrl(
        url: json['url']?.toString() ?? json['downloadUrl']?.toString() ?? '',
        expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
            DateTime.now().add(const Duration(minutes: 4)),
      );
    },
  );
});

final appMediaPrewarmServiceProvider = Provider<AppMediaPrewarmService>((ref) {
  return AppMediaPrewarmService();
});

final appPushTokenServiceProvider = Provider<AppPushTokenService>((ref) {
  return NativeAppPushTokenService(
    sharedPreferences: ref.watch(sharedPreferencesProvider),
  );
});

final sessionCleanupControllerProvider =
    Provider<SessionCleanupController>((ref) {
  return SessionCleanupController(
    cacheStore: ref.watch(appLocalCacheStoreProvider),
    chatStore: ref.watch(chatLocalStoreProvider),
    clearPrivateMediaCache:
        ref.watch(appAttachmentServiceProvider).clearPrivateCache,
  );
});

final authBootstrapProvider = FutureProvider<void>((ref) async {
  final tokens = ref.watch(authTokensProvider);
  final currentUserController = ref.read(currentUserProvider.notifier);
  if (tokens == null) {
    currentUserController.state = null;
    return;
  }
  final repository = ref.read(backendRepositoryProvider);
  try {
    final user = await repository.fetchMe();
    await _cleanupIfUserChanged(ref, user.id);
    currentUserController.state = _withLocalCompletedOnboarding(ref, user);
  } on DioException catch (error) {
    if (error.response?.statusCode == 401) {
      await ref.read(authTokensProvider.notifier).clear();
      currentUserController.state = null;
    }
  }
});

Future<void> _cleanupIfUserChanged(Ref ref, String restoredUserId) async {
  final preferences = ref.read(sharedPreferencesProvider);
  final previousUserId =
      preferences?.getString(appLocalCacheLastUserIdStorageKey);
  if (previousUserId != null &&
      previousUserId.isNotEmpty &&
      previousUserId != restoredUserId) {
    await ref
        .read(sessionCleanupControllerProvider)
        .clearPrivateUserData(previousUserId);
  }
  await preferences?.setString(
      appLocalCacheLastUserIdStorageKey, restoredUserId);
}

BackendUser _withLocalCompletedOnboarding(Ref ref, BackendUser user) {
  if (user.onboardingComplete) {
    return user;
  }
  final completed = ref
          .read(sharedPreferencesProvider)
          ?.getBool(completedOnboardingUserStorageKey(user.id)) ??
      false;
  if (!completed) {
    return user;
  }
  return BackendUser(
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    gender: user.gender,
    onboardingComplete: true,
    city: user.city,
    raw: user.raw,
  );
}

AppCacheUserScope currentCacheScope(Ref ref) {
  return ref.read(currentCacheScopeProvider);
}
