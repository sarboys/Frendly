import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('profile parses photos and keeps avatar fallback from first photo', () {
    final profile = ProfileData.fromProfileJson(
      {
        'id': 'user-me',
        'displayName': 'Никита М',
        'verified': true,
        'online': true,
        'rating': 4.8,
        'meetupCount': 12,
        'photos': [
          {
            'id': 'ph1',
            'url': 'https://cdn.example.com/ph1.jpg',
            'order': 0,
          },
          {
            'id': 'ph2',
            'url': 'https://cdn.example.com/ph2.jpg',
            'order': 1,
          },
        ],
      },
      onboardingJson: const {
        'interests': ['Кофе'],
        'intent': 'both',
      },
    );

    expect(profile.photos, hasLength(2));
    expect(profile.photos.first.id, 'ph1');
    expect(profile.avatarUrl, 'https://cdn.example.com/ph1.jpg');
  });

  test('profile resolves relative media urls through api base url', () {
    final profile = ProfileData.fromProfileJson(
      {
        'id': 'user-me',
        'displayName': 'Никита М',
        'verified': true,
        'online': true,
        'avatarUrl': '/media/avatar-1',
        'rating': 4.8,
        'meetupCount': 12,
        'photos': [
          {
            'id': 'ph1',
            'url': '/media/photo-1',
            'order': 0,
          },
        ],
      },
    );

    expect(profile.avatarUrl, '${BackendConfig.apiBaseUrl}/media/avatar-1');
    expect(
        profile.photos.first.url, '${BackendConfig.apiBaseUrl}/media/photo-1');
  });
}
