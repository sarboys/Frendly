class EventFilters {
  const EventFilters({
    this.lifestyle = 'any',
    this.price = 'any',
    this.gender = 'any',
    this.access = 'any',
  });

  final String lifestyle;
  final String price;
  final String gender;
  final String access;

  static const defaults = EventFilters();

  int get activeCount {
    var count = 0;
    if (lifestyle != 'any') count += 1;
    if (price != 'any') count += 1;
    if (gender != 'any') count += 1;
    if (access != 'any') count += 1;
    return count;
  }

  bool get hasActiveFilters => activeCount > 0;

  EventFilters copyWith({
    String? lifestyle,
    String? price,
    String? gender,
    String? access,
  }) {
    return EventFilters(
      lifestyle: lifestyle ?? this.lifestyle,
      price: price ?? this.price,
      gender: gender ?? this.gender,
      access: access ?? this.access,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is EventFilters &&
        other.lifestyle == lifestyle &&
        other.price == price &&
        other.gender == gender &&
        other.access == access;
  }

  @override
  int get hashCode => Object.hash(lifestyle, price, gender, access);
}
