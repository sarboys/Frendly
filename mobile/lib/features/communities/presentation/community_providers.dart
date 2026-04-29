import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final communitiesFeedProvider = StateNotifierProvider.autoDispose<
    CommunitiesFeedController, AsyncValue<CommunitiesFeedState>>(
  (ref) => CommunitiesFeedController(ref),
);

final communityMediaFeedProvider = StateNotifierProvider.autoDispose.family<
    CommunityMediaFeedController, AsyncValue<CommunityMediaFeedState>, String>(
  (ref, communityId) => CommunityMediaFeedController(ref, communityId),
);

final communitiesProvider = FutureProvider<List<Community>>((ref) async {
  await ref.watch(authBootstrapProvider.future);
  return ref
      .read(backendRepositoryProvider)
      .fetchCommunities()
      .then((value) => value.items);
});

final communityProvider =
    FutureProvider.family<Community?, String>((ref, id) async {
  final cached = ref.watch(communitiesFeedProvider).valueOrNull?.items ??
      ref.watch(communitiesProvider).valueOrNull;
  if (cached != null) {
    for (final community in cached) {
      if (community.id == id) {
        return community;
      }
    }
  }

  await ref.watch(authBootstrapProvider.future);
  return ref.read(backendRepositoryProvider).fetchCommunity(id);
});

class CommunitiesFeedState {
  const CommunitiesFeedState({
    required this.items,
    required this.nextCursor,
    this.loadingMore = false,
    this.loadMoreError,
  });

  final List<Community> items;
  final String? nextCursor;
  final bool loadingMore;
  final Object? loadMoreError;

  bool get hasMore => nextCursor != null;

  CommunitiesFeedState copyWith({
    List<Community>? items,
    String? nextCursor,
    bool clearNextCursor = false,
    bool? loadingMore,
    Object? loadMoreError,
    bool clearLoadMoreError = false,
  }) {
    return CommunitiesFeedState(
      items: items ?? this.items,
      nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
      loadingMore: loadingMore ?? this.loadingMore,
      loadMoreError:
          clearLoadMoreError ? null : loadMoreError ?? this.loadMoreError,
    );
  }
}

class CommunityMediaFeedState {
  const CommunityMediaFeedState({
    required this.items,
    required this.nextCursor,
    this.loadingMore = false,
    this.loadMoreError,
  });

  final List<CommunityMediaItem> items;
  final String? nextCursor;
  final bool loadingMore;
  final Object? loadMoreError;

  bool get hasMore => nextCursor != null;

  CommunityMediaFeedState copyWith({
    List<CommunityMediaItem>? items,
    String? nextCursor,
    bool clearNextCursor = false,
    bool? loadingMore,
    Object? loadMoreError,
    bool clearLoadMoreError = false,
  }) {
    return CommunityMediaFeedState(
      items: items ?? this.items,
      nextCursor: clearNextCursor ? null : nextCursor ?? this.nextCursor,
      loadingMore: loadingMore ?? this.loadingMore,
      loadMoreError:
          clearLoadMoreError ? null : loadMoreError ?? this.loadMoreError,
    );
  }
}

class CommunityMediaFeedController
    extends StateNotifier<AsyncValue<CommunityMediaFeedState>> {
  CommunityMediaFeedController(this.ref, this.communityId)
      : super(const AsyncValue.loading()) {
    _loadInitial();
  }

  final Ref ref;
  final String communityId;

  Future<void> loadNextPage() async {
    final current = state.valueOrNull;
    if (current == null || current.loadingMore || current.nextCursor == null) {
      return;
    }

    state = AsyncValue.data(
      current.copyWith(
        loadingMore: true,
        clearLoadMoreError: true,
      ),
    );

    try {
      final page =
          await ref.read(backendRepositoryProvider).fetchCommunityMedia(
                communityId,
                cursor: current.nextCursor,
              );
      if (!mounted) {
        return;
      }

      final latest = state.valueOrNull ?? current;
      state = AsyncValue.data(
        latest.copyWith(
          items: _mergeMedia(latest.items, page.items),
          nextCursor: page.nextCursor,
          clearNextCursor: page.nextCursor == null,
          loadingMore: false,
          clearLoadMoreError: true,
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      state = AsyncValue.data(
        current.copyWith(
          loadingMore: false,
          loadMoreError: error,
        ),
      );
    }
  }

  Future<void> _loadInitial() async {
    try {
      await ref.read(authBootstrapProvider.future);
      final page =
          await ref.read(backendRepositoryProvider).fetchCommunityMedia(
                communityId,
              );
      if (!mounted) {
        return;
      }

      state = AsyncValue.data(
        CommunityMediaFeedState(
          items: page.items,
          nextCursor: page.nextCursor,
        ),
      );
    } catch (error, stackTrace) {
      if (!mounted) {
        return;
      }

      state = AsyncValue.error(error, stackTrace);
    }
  }

  List<CommunityMediaItem> _mergeMedia(
    List<CommunityMediaItem> current,
    List<CommunityMediaItem> nextPage,
  ) {
    final byId = <String, CommunityMediaItem>{
      for (final item in current) item.id: item,
    };
    for (final item in nextPage) {
      byId[item.id] = item;
    }
    return byId.values.toList(growable: false);
  }
}

class CommunitiesFeedController
    extends StateNotifier<AsyncValue<CommunitiesFeedState>> {
  CommunitiesFeedController(
    this.ref, {
    CommunitiesFeedState? initialState,
  }) : super(
          initialState == null
              ? const AsyncValue.loading()
              : AsyncValue.data(initialState),
        ) {
    if (initialState == null) {
      _loadInitial();
    }
  }

  final Ref ref;

  Future<void> loadNextPage() async {
    final current = state.valueOrNull;
    if (current == null || current.loadingMore || current.nextCursor == null) {
      return;
    }

    state = AsyncValue.data(
      current.copyWith(
        loadingMore: true,
        clearLoadMoreError: true,
      ),
    );

    try {
      final page = await ref.read(backendRepositoryProvider).fetchCommunities(
            cursor: current.nextCursor,
          );
      if (!mounted) {
        return;
      }

      final latest = state.valueOrNull ?? current;
      state = AsyncValue.data(
        latest.copyWith(
          items: _mergeCommunities(latest.items, page.items),
          nextCursor: page.nextCursor,
          clearNextCursor: page.nextCursor == null,
          loadingMore: false,
          clearLoadMoreError: true,
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      state = AsyncValue.data(
        current.copyWith(
          loadingMore: false,
          loadMoreError: error,
        ),
      );
    }
  }

  Future<void> _loadInitial() async {
    try {
      await ref.read(authBootstrapProvider.future);
      final page = await ref.read(backendRepositoryProvider).fetchCommunities();
      if (!mounted) {
        return;
      }

      state = AsyncValue.data(
        CommunitiesFeedState(
          items: page.items,
          nextCursor: page.nextCursor,
        ),
      );
    } catch (error, stackTrace) {
      if (!mounted) {
        return;
      }

      state = AsyncValue.error(error, stackTrace);
    }
  }

  List<Community> _mergeCommunities(
    List<Community> current,
    List<Community> nextPage,
  ) {
    final byId = <String, Community>{
      for (final community in current) community.id: community,
    };
    for (final community in nextPage) {
      byId[community.id] = community;
    }
    return byId.values.toList(growable: false);
  }
}
