import 'package:big_break_mobile/features/communities/data/mock_communities.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeCommunityRepository extends BackendRepository {
  _FakeCommunityRepository({
    required super.ref,
    required super.dio,
  });

  final cursors = <String?>[];
  final mediaCursors = <String?>[];

  @override
  Future<PaginatedResponse<Community>> fetchCommunities({
    String? cursor,
    int limit = 20,
  }) async {
    cursors.add(cursor);

    if (cursor == null) {
      return PaginatedResponse(
        items: [mockCommunities[0]],
        nextCursor: 'cursor-2',
      );
    }

    return PaginatedResponse(
      items: [mockCommunities[0], mockCommunities[1]],
      nextCursor: null,
    );
  }

  @override
  Future<PaginatedResponse<CommunityMediaItem>> fetchCommunityMedia(
    String communityId, {
    String? cursor,
    int limit = 30,
  }) async {
    mediaCursors.add(cursor);

    if (cursor == null) {
      return PaginatedResponse(
        items: [mockCommunities[0].media[0]],
        nextCursor: 'media-cursor-2',
      );
    }

    return PaginatedResponse(
      items: [mockCommunities[0].media[0], mockCommunities[0].media[1]],
      nextCursor: null,
    );
  }
}

void main() {
  test('communities feed keeps cursor and appends the next page once',
      () async {
    late _FakeCommunityRepository repository;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        backendRepositoryProvider.overrideWith((ref) {
          repository = _FakeCommunityRepository(ref: ref, dio: Dio());
          return repository;
        }),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(
      communitiesFeedProvider,
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final firstPage = await _readFeedData(container);
    expect(firstPage.items.map((item) => item.id), ['c1']);
    expect(firstPage.hasMore, isTrue);

    await container.read(communitiesFeedProvider.notifier).loadNextPage();

    final secondPage = await _readFeedData(container);
    expect(secondPage.items.map((item) => item.id), ['c1', 'c2']);
    expect(secondPage.hasMore, isFalse);
    expect(repository.cursors, [null, 'cursor-2']);
  });

  test('community media feed keeps cursor and appends the next page once',
      () async {
    late _FakeCommunityRepository repository;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        backendRepositoryProvider.overrideWith((ref) {
          repository = _FakeCommunityRepository(ref: ref, dio: Dio());
          return repository;
        }),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(
      communityMediaFeedProvider('c1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final firstPage = await _readMediaFeedData(container, 'c1');
    expect(firstPage.items.map((item) => item.id), ['m1']);
    expect(firstPage.hasMore, isTrue);

    await container
        .read(communityMediaFeedProvider('c1').notifier)
        .loadNextPage();

    final secondPage = await _readMediaFeedData(container, 'c1');
    expect(secondPage.items.map((item) => item.id), ['m1', 'm2']);
    expect(secondPage.hasMore, isFalse);
    expect(repository.mediaCursors, [null, 'media-cursor-2']);
  });
}

Future<CommunitiesFeedState> _readFeedData(ProviderContainer container) async {
  for (var attempt = 0; attempt < 10; attempt += 1) {
    final asyncValue = container.read(communitiesFeedProvider);
    CommunitiesFeedState? data;
    Object? error;
    StackTrace? stackTrace;

    asyncValue.when(
      data: (value) => data = value,
      loading: () {},
      error: (value, stack) {
        error = value;
        stackTrace = stack;
      },
    );

    if (data != null) {
      return data!;
    }
    if (error != null) {
      Error.throwWithStackTrace(error!, stackTrace!);
    }

    await Future<void>.delayed(Duration.zero);
  }

  throw StateError('Communities feed did not load');
}

Future<CommunityMediaFeedState> _readMediaFeedData(
  ProviderContainer container,
  String communityId,
) async {
  for (var attempt = 0; attempt < 10; attempt += 1) {
    final asyncValue = container.read(communityMediaFeedProvider(communityId));
    CommunityMediaFeedState? data;
    Object? error;
    StackTrace? stackTrace;

    asyncValue.when(
      data: (value) => data = value,
      loading: () {},
      error: (value, stack) {
        error = value;
        stackTrace = stack;
      },
    );

    if (data != null) {
      return data!;
    }
    if (error != null) {
      Error.throwWithStackTrace(error!, stackTrace!);
    }

    await Future<void>.delayed(Duration.zero);
  }

  throw StateError('Community media feed did not load');
}
