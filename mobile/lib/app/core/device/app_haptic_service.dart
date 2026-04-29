import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppHapticService {
  const AppHapticService();

  Future<void> lightImpact() {
    return HapticFeedback.lightImpact();
  }
}

final appHapticServiceProvider = Provider<AppHapticService>((ref) {
  return const AppHapticService();
});
