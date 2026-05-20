import 'package:mobile2/app/core/config/backend_config.dart';

String? resolveBackendUrl(String? raw) {
  final value = raw?.trim();
  if (value == null || value.isEmpty) {
    return value;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return joinBackendUrl(BackendConfig.apiBaseUrl, value);
  }
  return value;
}

String joinBackendUrl(String baseUrl, String path) {
  final cleanBase = baseUrl.replaceFirst(RegExp(r'/+$'), '');
  if (path.startsWith('/')) {
    return '$cleanBase$path';
  }
  return '$cleanBase/$path';
}
