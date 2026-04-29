import 'package:flutter_riverpod/flutter_riverpod.dart';

enum ChatSegment { meetup, personal }

final chatSegmentProvider =
    StateProvider<ChatSegment>((ref) => ChatSegment.meetup);
