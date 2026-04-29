import 'package:big_break_mobile/app/core/config/backend_config.dart';

String? resolveBackendUrl(String? raw) {
  if (raw == null || raw.isEmpty) {
    return raw;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return '${BackendConfig.apiBaseUrl}$raw';
  }

  return raw;
}
