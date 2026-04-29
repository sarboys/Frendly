class PersonalChat {
  const PersonalChat({
    required this.id,
    required this.name,
    required this.lastMessage,
    required this.lastTime,
    required this.unread,
    required this.online,
    this.peerUserId,
    this.fromMeetup,
  });

  final String id;
  final String? peerUserId;
  final String name;
  final String lastMessage;
  final String lastTime;
  final int unread;
  final bool online;
  final String? fromMeetup;

  factory PersonalChat.fromJson(Map<String, dynamic> json) {
    return PersonalChat(
      id: json['id'] as String,
      peerUserId: json['peerUserId'] as String?,
      name: json['name'] as String? ?? '',
      lastMessage: json['lastMessage'] as String? ?? '',
      lastTime: json['lastTime'] as String? ?? '',
      unread: (json['unread'] as num?)?.toInt() ?? 0,
      online: (json['online'] as bool?) ?? false,
      fromMeetup: json['fromMeetup'] as String?,
    );
  }

  PersonalChat copyWith({
    String? id,
    String? peerUserId,
    String? name,
    String? lastMessage,
    String? lastTime,
    int? unread,
    bool? online,
    String? fromMeetup,
  }) {
    return PersonalChat(
      id: id ?? this.id,
      peerUserId: peerUserId ?? this.peerUserId,
      name: name ?? this.name,
      lastMessage: lastMessage ?? this.lastMessage,
      lastTime: lastTime ?? this.lastTime,
      unread: unread ?? this.unread,
      online: online ?? this.online,
      fromMeetup: fromMeetup ?? this.fromMeetup,
    );
  }
}
