import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_cache_store.dart';
import 'package:mobile2/app/core/local_cache/chat_local_store.dart';

class SessionCleanupController {
  SessionCleanupController({
    required AppLocalCacheStore? cacheStore,
    required ChatLocalStore? chatStore,
    required Future<void> Function() clearPrivateMediaCache,
  })  : _cacheStore = cacheStore,
        _chatStore = chatStore,
        _clearPrivateMediaCache = clearPrivateMediaCache;

  final AppLocalCacheStore? _cacheStore;
  final ChatLocalStore? _chatStore;
  final Future<void> Function() _clearPrivateMediaCache;

  Future<void> clearPrivateUserData(String userId) async {
    await _cacheStore?.deleteUser(AppCacheUserScope.user(userId));
    await _chatStore?.clearUser(userId);
    await _clearPrivateMediaCache();
  }
}
