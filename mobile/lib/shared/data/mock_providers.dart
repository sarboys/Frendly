import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final eventsProvider = Provider((ref) => mockEvents);
final meetupChatsProvider = Provider((ref) => mockMeetupChats);
final personalChatsProvider = Provider((ref) => mockPersonalChats);
final meetupMessagesProvider = Provider((ref) => mockMeetupMessages);
final personalMessagesProvider = Provider((ref) => mockPersonalMessages);
final peopleProvider = Provider((ref) => mockPeople);
