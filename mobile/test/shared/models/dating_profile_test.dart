import 'package:big_break_mobile/shared/models/dating_profile.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('dating profile parses primary photo and photos list from api payload',
      () {
    final profile = DatingProfileData.fromJson({
      'userId': 'user-sonya',
      'name': 'Соня',
      'age': 26,
      'distance': '1.4 км',
      'about': 'Люблю ужины и тихие бары',
      'tags': ['ужины', 'джаз'],
      'prompt': 'Лучший вечер без спешки.',
      'photoEmoji': '🕯️',
      'avatarUrl': 'https://cdn.example.com/sonya-1.jpg',
      'primaryPhoto': {
        'id': 'ph1',
        'url': 'https://cdn.example.com/sonya-1.jpg',
        'order': 0,
      },
      'photos': [
        {
          'id': 'ph1',
          'url': 'https://cdn.example.com/sonya-1.jpg',
          'order': 0,
        },
        {
          'id': 'ph2',
          'url': 'https://cdn.example.com/sonya-2.jpg',
          'order': 1,
        },
      ],
      'likedYou': false,
      'premium': true,
      'vibe': 'Спокойно',
      'area': 'Замоскворечье',
      'verified': true,
      'online': true,
    });

    expect(profile.primaryPhoto?.id, 'ph1');
    expect(profile.photos, hasLength(2));
    expect(profile.photos.first.id, 'ph1');
    expect(profile.photos.last.id, 'ph2');
  });

  test('dating profile parses dating presentation metadata from api payload',
      () {
    final profile = DatingProfileData.fromJson({
      'userId': 'user-anya',
      'name': 'Аня',
      'age': 27,
      'city': 'Москва',
      'distance': '1 км',
      'about': 'Люблю тихие бары.',
      'tags': ['вино'],
      'prompt': 'Выставка и ужин.',
      'photoEmoji': '🍷',
      'avatarUrl': null,
      'languages': [
        {'flag': '🇷🇺', 'label': 'Русский'},
        {'flag': '🇬🇧', 'label': 'English'},
      ],
      'nationality': {'flag': '🇷🇺', 'label': 'Россия'},
      'likedYou': true,
      'premium': true,
      'vibe': 'Спокойно',
      'area': 'Патрики',
      'verified': true,
      'online': true,
    });

    expect(profile.city, 'Москва');
    expect(profile.languages, hasLength(2));
    expect(profile.languages.first.label, 'Русский');
    expect(profile.nationality?.label, 'Россия');
  });
}
