import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract class MapkitBootstrap {
  Future<void> ensureInitialized();
}

final mapkitBootstrapProvider = Provider<MapkitBootstrap>(
  (ref) => const MethodChannelMapkitBootstrap(),
);

class MethodChannelMapkitBootstrap implements MapkitBootstrap {
  const MethodChannelMapkitBootstrap();

  static const MethodChannel _channel = MethodChannel('app.mapkit.bootstrap');
  static Future<void>? _initialization;

  @override
  Future<void> ensureInitialized() {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) {
      return SynchronousFuture(null);
    }

    return _initialization ??=
        _channel.invokeMethod<void>('ensureInitialized').then((_) {});
  }
}
