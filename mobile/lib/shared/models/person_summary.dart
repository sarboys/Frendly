import 'package:big_break_mobile/shared/models/backend_url.dart';

class PersonSummary {
  const PersonSummary({
    required this.id,
    required this.name,
    required this.age,
    required this.area,
    required this.common,
    required this.online,
    required this.verified,
    required this.vibe,
    required this.avatarUrl,
  });

  final String id;
  final String name;
  final int? age;
  final String? area;
  final List<String> common;
  final bool online;
  final bool verified;
  final String? vibe;
  final String? avatarUrl;

  factory PersonSummary.fromJson(Map<String, dynamic> json) {
    return PersonSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      age: json['age'] as int?,
      area: json['area'] as String?,
      common: ((json['common'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      online: (json['online'] as bool?) ?? false,
      verified: (json['verified'] as bool?) ?? false,
      vibe: json['vibe'] as String?,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
    );
  }
}
