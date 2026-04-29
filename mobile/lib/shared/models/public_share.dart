class PublicShareLink {
  const PublicShareLink({
    required this.slug,
    required this.targetType,
    required this.targetId,
    required this.appPath,
    required this.url,
    required this.deepLink,
  });

  final String slug;
  final String targetType;
  final String targetId;
  final String appPath;
  final String url;
  final String deepLink;

  factory PublicShareLink.fromJson(Map<String, dynamic> json) {
    return PublicShareLink(
      slug: json['slug'] as String? ?? '',
      targetType: json['targetType'] as String? ?? '',
      targetId: json['targetId'] as String? ?? '',
      appPath: json['appPath'] as String? ?? '',
      url: json['url'] as String? ?? '',
      deepLink: json['deepLink'] as String? ?? '',
    );
  }
}
