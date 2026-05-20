import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/communities/presentation/communities_screen.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('communities prewarm uses only the first eight community covers', () {
    final communities = List.generate(
      10,
      (index) => BackendCardItem(
        id: 'community-$index',
        title: 'Community $index',
        imageUrl: 'https://cdn.test/community-$index.jpg',
      ),
    );

    expect(communityPrewarmImageUrls(communities).toList(growable: false), [
      'https://cdn.test/community-0.jpg',
      'https://cdn.test/community-1.jpg',
      'https://cdn.test/community-2.jpg',
      'https://cdn.test/community-3.jpg',
      'https://cdn.test/community-4.jpg',
      'https://cdn.test/community-5.jpg',
      'https://cdn.test/community-6.jpg',
      'https://cdn.test/community-7.jpg',
    ]);
  });
}
