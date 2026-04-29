enum CommunityPrivacy {
  public,
  private,
}

enum CommunityMediaKind {
  photo,
  video,
  doc,
}

class CommunityNewsItem {
  const CommunityNewsItem({
    required this.id,
    required this.title,
    required this.blurb,
    required this.time,
  });

  final String id;
  final String title;
  final String blurb;
  final String time;

  factory CommunityNewsItem.fromJson(Map<String, dynamic> json) {
    return CommunityNewsItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      blurb: json['blurb'] as String? ?? '',
      time: json['time'] as String? ?? '',
    );
  }
}

class CommunityMeetupItem {
  const CommunityMeetupItem({
    required this.id,
    required this.title,
    required this.emoji,
    required this.time,
    required this.place,
    required this.format,
    required this.going,
  });

  final String id;
  final String title;
  final String emoji;
  final String time;
  final String place;
  final String format;
  final int going;

  factory CommunityMeetupItem.fromJson(Map<String, dynamic> json) {
    return CommunityMeetupItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '📍',
      time: json['time'] as String? ?? '',
      place: json['place'] as String? ?? '',
      format: json['format'] as String? ?? '',
      going: (json['going'] as num?)?.toInt() ?? 0,
    );
  }
}

class CommunityChatPreview {
  const CommunityChatPreview({
    required this.author,
    required this.text,
    required this.time,
  });

  final String author;
  final String text;
  final String time;

  factory CommunityChatPreview.fromJson(Map<String, dynamic> json) {
    return CommunityChatPreview(
      author: json['author'] as String? ?? '',
      text: json['text'] as String? ?? '',
      time: json['time'] as String? ?? '',
    );
  }
}

class CommunityMessage {
  const CommunityMessage({
    required this.id,
    required this.author,
    required this.text,
    required this.time,
    this.mine = false,
    this.meetupId,
  });

  final String id;
  final String author;
  final String text;
  final String time;
  final bool mine;
  final String? meetupId;

  factory CommunityMessage.fromJson(Map<String, dynamic> json) {
    return CommunityMessage(
      id: json['id'] as String? ?? '',
      author: json['author'] as String? ?? '',
      text: json['text'] as String? ?? '',
      time: json['time'] as String? ?? '',
      mine: json['mine'] as bool? ?? false,
      meetupId: json['meetupId'] as String?,
    );
  }
}

class CommunitySocialLink {
  const CommunitySocialLink({
    required this.id,
    required this.label,
    required this.handle,
  });

  final String id;
  final String label;
  final String handle;

  factory CommunitySocialLink.fromJson(Map<String, dynamic> json) {
    return CommunitySocialLink(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      handle: json['handle'] as String? ?? '',
    );
  }
}

class CommunityMediaItem {
  const CommunityMediaItem({
    required this.id,
    required this.emoji,
    required this.label,
    required this.kind,
  });

  final String id;
  final String emoji;
  final String label;
  final CommunityMediaKind kind;

  factory CommunityMediaItem.fromJson(Map<String, dynamic> json) {
    return CommunityMediaItem(
      id: json['id'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '📎',
      label: json['label'] as String? ?? '',
      kind: switch (json['kind']) {
        'video' => CommunityMediaKind.video,
        'doc' => CommunityMediaKind.doc,
        _ => CommunityMediaKind.photo,
      },
    );
  }
}

class Community {
  const Community({
    required this.id,
    required this.chatId,
    required this.name,
    required this.avatar,
    required this.description,
    required this.privacy,
    required this.members,
    required this.online,
    required this.tags,
    required this.joinRule,
    this.joined = false,
    this.isOwner = false,
    required this.premiumOnly,
    required this.unread,
    required this.mood,
    required this.sharedMediaLabel,
    required this.news,
    required this.meetups,
    required this.media,
    required this.chatPreview,
    required this.chatMessages,
    required this.socialLinks,
    required this.memberNames,
    this.nextMeetup,
  });

  final String id;
  final String chatId;
  final String name;
  final String avatar;
  final String description;
  final CommunityPrivacy privacy;
  final int members;
  final int online;
  final List<String> tags;
  final String joinRule;
  final bool joined;
  final bool isOwner;
  final bool premiumOnly;
  final int unread;
  final String mood;
  final String sharedMediaLabel;
  final CommunityMeetupItem? nextMeetup;
  final List<CommunityNewsItem> news;
  final List<CommunityMeetupItem> meetups;
  final List<CommunityMediaItem> media;
  final List<CommunityChatPreview> chatPreview;
  final List<CommunityMessage> chatMessages;
  final List<CommunitySocialLink> socialLinks;
  final List<String> memberNames;

  factory Community.fromJson(Map<String, dynamic> json) {
    final meetups = ((json['meetups'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => CommunityMeetupItem.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList(growable: false);

    return Community(
      id: json['id'] as String,
      chatId: json['chatId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      avatar: json['avatar'] as String? ?? '🌿',
      description: json['description'] as String? ?? '',
      privacy: json['privacy'] == 'private'
          ? CommunityPrivacy.private
          : CommunityPrivacy.public,
      members: (json['members'] as num?)?.toInt() ?? 0,
      online: (json['online'] as num?)?.toInt() ?? 0,
      tags: ((json['tags'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      joinRule: json['joinRule'] as String? ?? '',
      joined: json['joined'] as bool? ?? false,
      isOwner: json['isOwner'] as bool? ?? false,
      premiumOnly: json['premiumOnly'] as bool? ?? true,
      unread: (json['unread'] as num?)?.toInt() ?? 0,
      mood: json['mood'] as String? ?? '',
      sharedMediaLabel: json['sharedMediaLabel'] as String? ?? '0 медиа',
      nextMeetup: json['nextMeetup'] is Map
          ? CommunityMeetupItem.fromJson(
              Map<String, dynamic>.from(json['nextMeetup'] as Map),
            )
          : meetups.isEmpty
              ? null
              : meetups.first,
      news: ((json['news'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => CommunityNewsItem.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
      meetups: meetups,
      media: ((json['media'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => CommunityMediaItem.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
      chatPreview: ((json['chatPreview'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => CommunityChatPreview.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
      chatMessages: ((json['chatMessages'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => CommunityMessage.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
      socialLinks: ((json['socialLinks'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => CommunitySocialLink.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
      memberNames: ((json['memberNames'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
    );
  }
}
