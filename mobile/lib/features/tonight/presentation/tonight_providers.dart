import 'package:flutter_riverpod/flutter_riverpod.dart';

enum TonightFilter { nearby, now, calm, newcomers, date }

final tonightFilterProvider =
    StateProvider<TonightFilter>((ref) => TonightFilter.nearby);
