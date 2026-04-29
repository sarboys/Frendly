class PaginatedResponse<T> {
  const PaginatedResponse({
    required this.items,
    required this.nextCursor,
    this.lastEventId,
  });

  final List<T> items;
  final String? nextCursor;
  final String? lastEventId;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) decoder,
  ) {
    return PaginatedResponse<T>(
      items: ((json['items'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => decoder(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      nextCursor: json['nextCursor'] as String?,
      lastEventId: json['lastEventId'] as String?,
    );
  }
}
