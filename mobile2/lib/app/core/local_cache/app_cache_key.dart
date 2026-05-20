class AppCacheUserScope {
  const AppCacheUserScope._(this.value);

  final String value;

  factory AppCacheUserScope.public() => const AppCacheUserScope._('public');

  factory AppCacheUserScope.user(String userId) {
    return AppCacheUserScope._('user:$userId');
  }
}

class AppCacheKey {
  const AppCacheKey({
    required this.namespace,
    required this.value,
    required this.userScope,
  });

  final String namespace;
  final String value;
  final AppCacheUserScope userScope;

  String get storageKey => '$namespace::$value';

  AppCacheKey copyWith({
    String? namespace,
    String? value,
    AppCacheUserScope? userScope,
  }) {
    return AppCacheKey(
      namespace: namespace ?? this.namespace,
      value: value ?? this.value,
      userScope: userScope ?? this.userScope,
    );
  }
}
