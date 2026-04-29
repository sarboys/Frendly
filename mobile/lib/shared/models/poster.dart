import 'package:big_break_mobile/shared/models/event.dart';

enum PosterCategory {
  concert,
  sport,
  exhibition,
  theatre,
  standup,
  festival,
  cinema,
}

class Poster {
  const Poster({
    required this.id,
    required this.title,
    required this.category,
    required this.emoji,
    required this.startsAt,
    required this.dateLabel,
    required this.timeLabel,
    required this.venue,
    required this.address,
    required this.distance,
    required this.priceFrom,
    required this.ticketUrl,
    required this.provider,
    required this.tone,
    required this.tags,
    required this.description,
    required this.isFeatured,
  });

  final String id;
  final String title;
  final PosterCategory category;
  final String emoji;
  final DateTime startsAt;
  final String dateLabel;
  final String timeLabel;
  final String venue;
  final String address;
  final String distance;
  final int priceFrom;
  final String ticketUrl;
  final String provider;
  final EventTone tone;
  final List<String> tags;
  final String description;
  final bool isFeatured;

  String get priceLabel =>
      priceFrom == 0 ? 'Бесплатно' : 'от ${priceFrom.toString()} ₽';

  String get meetupTitle => 'Идём на «$title»';

  String get placeLabel => '$venue, $address';

  factory Poster.fromJson(Map<String, dynamic> json) {
    return Poster(
      id: json['id'] as String,
      title: json['title'] as String,
      category: _parseCategory(json['category'] as String?),
      emoji: json['emoji'] as String,
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      dateLabel: json['date'] as String,
      timeLabel: json['time'] as String,
      venue: json['venue'] as String,
      address: json['address'] as String,
      distance: json['distance'] as String,
      priceFrom: (json['priceFrom'] as num?)?.toInt() ?? 0,
      ticketUrl: json['ticketUrl'] as String,
      provider: json['provider'] as String,
      tone: Event.parseTone(json['tone'] as String?),
      tags: ((json['tags'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      description: json['description'] as String,
      isFeatured: (json['isFeatured'] as bool?) ?? false,
    );
  }

  static PosterCategory _parseCategory(String? raw) {
    switch (raw) {
      case 'sport':
        return PosterCategory.sport;
      case 'exhibition':
        return PosterCategory.exhibition;
      case 'theatre':
        return PosterCategory.theatre;
      case 'standup':
        return PosterCategory.standup;
      case 'festival':
        return PosterCategory.festival;
      case 'cinema':
        return PosterCategory.cinema;
      case 'concert':
      default:
        return PosterCategory.concert;
    }
  }
}

extension PosterCategoryPresentation on PosterCategory {
  String get label {
    switch (this) {
      case PosterCategory.concert:
        return 'Концерты';
      case PosterCategory.sport:
        return 'Спорт';
      case PosterCategory.exhibition:
        return 'Выставки';
      case PosterCategory.theatre:
        return 'Театр';
      case PosterCategory.standup:
        return 'Стендап';
      case PosterCategory.festival:
        return 'Фестивали';
      case PosterCategory.cinema:
        return 'Кино';
    }
  }

  String get emoji {
    switch (this) {
      case PosterCategory.concert:
        return '🎸';
      case PosterCategory.sport:
        return '⚽';
      case PosterCategory.exhibition:
        return '🎨';
      case PosterCategory.theatre:
        return '🎭';
      case PosterCategory.standup:
        return '🎤';
      case PosterCategory.festival:
        return '🎡';
      case PosterCategory.cinema:
        return '🎬';
    }
  }
}
