// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_local_database.dart';

// ignore_for_file: type=lint
class $CacheEntriesTable extends CacheEntries
    with TableInfo<$CacheEntriesTable, CacheEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CacheEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userScopeMeta =
      const VerificationMeta('userScope');
  @override
  late final GeneratedColumn<String> userScope = GeneratedColumn<String>(
      'user_scope', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _namespaceMeta =
      const VerificationMeta('namespace');
  @override
  late final GeneratedColumn<String> namespace = GeneratedColumn<String>(
      'namespace', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cacheKeyMeta =
      const VerificationMeta('cacheKey');
  @override
  late final GeneratedColumn<String> cacheKey = GeneratedColumn<String>(
      'cache_key', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _jsonValueMeta =
      const VerificationMeta('jsonValue');
  @override
  late final GeneratedColumn<String> jsonValue = GeneratedColumn<String>(
      'json_value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _expiresAtMeta =
      const VerificationMeta('expiresAt');
  @override
  late final GeneratedColumn<DateTime> expiresAt = GeneratedColumn<DateTime>(
      'expires_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [userScope, namespace, cacheKey, jsonValue, createdAt, expiresAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_entries';
  @override
  VerificationContext validateIntegrity(Insertable<CacheEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_scope')) {
      context.handle(_userScopeMeta,
          userScope.isAcceptableOrUnknown(data['user_scope']!, _userScopeMeta));
    } else if (isInserting) {
      context.missing(_userScopeMeta);
    }
    if (data.containsKey('namespace')) {
      context.handle(_namespaceMeta,
          namespace.isAcceptableOrUnknown(data['namespace']!, _namespaceMeta));
    } else if (isInserting) {
      context.missing(_namespaceMeta);
    }
    if (data.containsKey('cache_key')) {
      context.handle(_cacheKeyMeta,
          cacheKey.isAcceptableOrUnknown(data['cache_key']!, _cacheKeyMeta));
    } else if (isInserting) {
      context.missing(_cacheKeyMeta);
    }
    if (data.containsKey('json_value')) {
      context.handle(_jsonValueMeta,
          jsonValue.isAcceptableOrUnknown(data['json_value']!, _jsonValueMeta));
    } else if (isInserting) {
      context.missing(_jsonValueMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('expires_at')) {
      context.handle(_expiresAtMeta,
          expiresAt.isAcceptableOrUnknown(data['expires_at']!, _expiresAtMeta));
    } else if (isInserting) {
      context.missing(_expiresAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userScope, namespace, cacheKey};
  @override
  CacheEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheEntry(
      userScope: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}user_scope'])!,
      namespace: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}namespace'])!,
      cacheKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}cache_key'])!,
      jsonValue: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}json_value'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      expiresAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}expires_at'])!,
    );
  }

  @override
  $CacheEntriesTable createAlias(String alias) {
    return $CacheEntriesTable(attachedDatabase, alias);
  }
}

class CacheEntry extends DataClass implements Insertable<CacheEntry> {
  final String userScope;
  final String namespace;
  final String cacheKey;
  final String jsonValue;
  final DateTime createdAt;
  final DateTime expiresAt;
  const CacheEntry(
      {required this.userScope,
      required this.namespace,
      required this.cacheKey,
      required this.jsonValue,
      required this.createdAt,
      required this.expiresAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_scope'] = Variable<String>(userScope);
    map['namespace'] = Variable<String>(namespace);
    map['cache_key'] = Variable<String>(cacheKey);
    map['json_value'] = Variable<String>(jsonValue);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['expires_at'] = Variable<DateTime>(expiresAt);
    return map;
  }

  CacheEntriesCompanion toCompanion(bool nullToAbsent) {
    return CacheEntriesCompanion(
      userScope: Value(userScope),
      namespace: Value(namespace),
      cacheKey: Value(cacheKey),
      jsonValue: Value(jsonValue),
      createdAt: Value(createdAt),
      expiresAt: Value(expiresAt),
    );
  }

  factory CacheEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheEntry(
      userScope: serializer.fromJson<String>(json['userScope']),
      namespace: serializer.fromJson<String>(json['namespace']),
      cacheKey: serializer.fromJson<String>(json['cacheKey']),
      jsonValue: serializer.fromJson<String>(json['jsonValue']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      expiresAt: serializer.fromJson<DateTime>(json['expiresAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userScope': serializer.toJson<String>(userScope),
      'namespace': serializer.toJson<String>(namespace),
      'cacheKey': serializer.toJson<String>(cacheKey),
      'jsonValue': serializer.toJson<String>(jsonValue),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'expiresAt': serializer.toJson<DateTime>(expiresAt),
    };
  }

  CacheEntry copyWith(
          {String? userScope,
          String? namespace,
          String? cacheKey,
          String? jsonValue,
          DateTime? createdAt,
          DateTime? expiresAt}) =>
      CacheEntry(
        userScope: userScope ?? this.userScope,
        namespace: namespace ?? this.namespace,
        cacheKey: cacheKey ?? this.cacheKey,
        jsonValue: jsonValue ?? this.jsonValue,
        createdAt: createdAt ?? this.createdAt,
        expiresAt: expiresAt ?? this.expiresAt,
      );
  CacheEntry copyWithCompanion(CacheEntriesCompanion data) {
    return CacheEntry(
      userScope: data.userScope.present ? data.userScope.value : this.userScope,
      namespace: data.namespace.present ? data.namespace.value : this.namespace,
      cacheKey: data.cacheKey.present ? data.cacheKey.value : this.cacheKey,
      jsonValue: data.jsonValue.present ? data.jsonValue.value : this.jsonValue,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      expiresAt: data.expiresAt.present ? data.expiresAt.value : this.expiresAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheEntry(')
          ..write('userScope: $userScope, ')
          ..write('namespace: $namespace, ')
          ..write('cacheKey: $cacheKey, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('createdAt: $createdAt, ')
          ..write('expiresAt: $expiresAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      userScope, namespace, cacheKey, jsonValue, createdAt, expiresAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheEntry &&
          other.userScope == this.userScope &&
          other.namespace == this.namespace &&
          other.cacheKey == this.cacheKey &&
          other.jsonValue == this.jsonValue &&
          other.createdAt == this.createdAt &&
          other.expiresAt == this.expiresAt);
}

class CacheEntriesCompanion extends UpdateCompanion<CacheEntry> {
  final Value<String> userScope;
  final Value<String> namespace;
  final Value<String> cacheKey;
  final Value<String> jsonValue;
  final Value<DateTime> createdAt;
  final Value<DateTime> expiresAt;
  final Value<int> rowid;
  const CacheEntriesCompanion({
    this.userScope = const Value.absent(),
    this.namespace = const Value.absent(),
    this.cacheKey = const Value.absent(),
    this.jsonValue = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.expiresAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheEntriesCompanion.insert({
    required String userScope,
    required String namespace,
    required String cacheKey,
    required String jsonValue,
    required DateTime createdAt,
    required DateTime expiresAt,
    this.rowid = const Value.absent(),
  })  : userScope = Value(userScope),
        namespace = Value(namespace),
        cacheKey = Value(cacheKey),
        jsonValue = Value(jsonValue),
        createdAt = Value(createdAt),
        expiresAt = Value(expiresAt);
  static Insertable<CacheEntry> custom({
    Expression<String>? userScope,
    Expression<String>? namespace,
    Expression<String>? cacheKey,
    Expression<String>? jsonValue,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? expiresAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userScope != null) 'user_scope': userScope,
      if (namespace != null) 'namespace': namespace,
      if (cacheKey != null) 'cache_key': cacheKey,
      if (jsonValue != null) 'json_value': jsonValue,
      if (createdAt != null) 'created_at': createdAt,
      if (expiresAt != null) 'expires_at': expiresAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheEntriesCompanion copyWith(
      {Value<String>? userScope,
      Value<String>? namespace,
      Value<String>? cacheKey,
      Value<String>? jsonValue,
      Value<DateTime>? createdAt,
      Value<DateTime>? expiresAt,
      Value<int>? rowid}) {
    return CacheEntriesCompanion(
      userScope: userScope ?? this.userScope,
      namespace: namespace ?? this.namespace,
      cacheKey: cacheKey ?? this.cacheKey,
      jsonValue: jsonValue ?? this.jsonValue,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userScope.present) {
      map['user_scope'] = Variable<String>(userScope.value);
    }
    if (namespace.present) {
      map['namespace'] = Variable<String>(namespace.value);
    }
    if (cacheKey.present) {
      map['cache_key'] = Variable<String>(cacheKey.value);
    }
    if (jsonValue.present) {
      map['json_value'] = Variable<String>(jsonValue.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (expiresAt.present) {
      map['expires_at'] = Variable<DateTime>(expiresAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheEntriesCompanion(')
          ..write('userScope: $userScope, ')
          ..write('namespace: $namespace, ')
          ..write('cacheKey: $cacheKey, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('createdAt: $createdAt, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ChatSummariesTable extends ChatSummaries
    with TableInfo<$ChatSummariesTable, ChatSummary> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ChatSummariesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
      'user_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
      'kind', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _chatIdMeta = const VerificationMeta('chatId');
  @override
  late final GeneratedColumn<String> chatId = GeneratedColumn<String>(
      'chat_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _jsonValueMeta =
      const VerificationMeta('jsonValue');
  @override
  late final GeneratedColumn<String> jsonValue = GeneratedColumn<String>(
      'json_value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [userId, kind, chatId, jsonValue, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'chat_summaries';
  @override
  VerificationContext validateIntegrity(Insertable<ChatSummary> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(_userIdMeta,
          userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta));
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
          _kindMeta, kind.isAcceptableOrUnknown(data['kind']!, _kindMeta));
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('chat_id')) {
      context.handle(_chatIdMeta,
          chatId.isAcceptableOrUnknown(data['chat_id']!, _chatIdMeta));
    } else if (isInserting) {
      context.missing(_chatIdMeta);
    }
    if (data.containsKey('json_value')) {
      context.handle(_jsonValueMeta,
          jsonValue.isAcceptableOrUnknown(data['json_value']!, _jsonValueMeta));
    } else if (isInserting) {
      context.missing(_jsonValueMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, kind, chatId};
  @override
  ChatSummary map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ChatSummary(
      userId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}user_id'])!,
      kind: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}kind'])!,
      chatId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}chat_id'])!,
      jsonValue: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}json_value'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $ChatSummariesTable createAlias(String alias) {
    return $ChatSummariesTable(attachedDatabase, alias);
  }
}

class ChatSummary extends DataClass implements Insertable<ChatSummary> {
  final String userId;
  final String kind;
  final String chatId;
  final String jsonValue;
  final DateTime updatedAt;
  const ChatSummary(
      {required this.userId,
      required this.kind,
      required this.chatId,
      required this.jsonValue,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['kind'] = Variable<String>(kind);
    map['chat_id'] = Variable<String>(chatId);
    map['json_value'] = Variable<String>(jsonValue);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  ChatSummariesCompanion toCompanion(bool nullToAbsent) {
    return ChatSummariesCompanion(
      userId: Value(userId),
      kind: Value(kind),
      chatId: Value(chatId),
      jsonValue: Value(jsonValue),
      updatedAt: Value(updatedAt),
    );
  }

  factory ChatSummary.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ChatSummary(
      userId: serializer.fromJson<String>(json['userId']),
      kind: serializer.fromJson<String>(json['kind']),
      chatId: serializer.fromJson<String>(json['chatId']),
      jsonValue: serializer.fromJson<String>(json['jsonValue']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'kind': serializer.toJson<String>(kind),
      'chatId': serializer.toJson<String>(chatId),
      'jsonValue': serializer.toJson<String>(jsonValue),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  ChatSummary copyWith(
          {String? userId,
          String? kind,
          String? chatId,
          String? jsonValue,
          DateTime? updatedAt}) =>
      ChatSummary(
        userId: userId ?? this.userId,
        kind: kind ?? this.kind,
        chatId: chatId ?? this.chatId,
        jsonValue: jsonValue ?? this.jsonValue,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  ChatSummary copyWithCompanion(ChatSummariesCompanion data) {
    return ChatSummary(
      userId: data.userId.present ? data.userId.value : this.userId,
      kind: data.kind.present ? data.kind.value : this.kind,
      chatId: data.chatId.present ? data.chatId.value : this.chatId,
      jsonValue: data.jsonValue.present ? data.jsonValue.value : this.jsonValue,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ChatSummary(')
          ..write('userId: $userId, ')
          ..write('kind: $kind, ')
          ..write('chatId: $chatId, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, kind, chatId, jsonValue, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ChatSummary &&
          other.userId == this.userId &&
          other.kind == this.kind &&
          other.chatId == this.chatId &&
          other.jsonValue == this.jsonValue &&
          other.updatedAt == this.updatedAt);
}

class ChatSummariesCompanion extends UpdateCompanion<ChatSummary> {
  final Value<String> userId;
  final Value<String> kind;
  final Value<String> chatId;
  final Value<String> jsonValue;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const ChatSummariesCompanion({
    this.userId = const Value.absent(),
    this.kind = const Value.absent(),
    this.chatId = const Value.absent(),
    this.jsonValue = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ChatSummariesCompanion.insert({
    required String userId,
    required String kind,
    required String chatId,
    required String jsonValue,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : userId = Value(userId),
        kind = Value(kind),
        chatId = Value(chatId),
        jsonValue = Value(jsonValue),
        updatedAt = Value(updatedAt);
  static Insertable<ChatSummary> custom({
    Expression<String>? userId,
    Expression<String>? kind,
    Expression<String>? chatId,
    Expression<String>? jsonValue,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (kind != null) 'kind': kind,
      if (chatId != null) 'chat_id': chatId,
      if (jsonValue != null) 'json_value': jsonValue,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ChatSummariesCompanion copyWith(
      {Value<String>? userId,
      Value<String>? kind,
      Value<String>? chatId,
      Value<String>? jsonValue,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return ChatSummariesCompanion(
      userId: userId ?? this.userId,
      kind: kind ?? this.kind,
      chatId: chatId ?? this.chatId,
      jsonValue: jsonValue ?? this.jsonValue,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (chatId.present) {
      map['chat_id'] = Variable<String>(chatId.value);
    }
    if (jsonValue.present) {
      map['json_value'] = Variable<String>(jsonValue.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ChatSummariesCompanion(')
          ..write('userId: $userId, ')
          ..write('kind: $kind, ')
          ..write('chatId: $chatId, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ChatMessagesTable extends ChatMessages
    with TableInfo<$ChatMessagesTable, ChatMessage> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ChatMessagesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
      'user_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _chatIdMeta = const VerificationMeta('chatId');
  @override
  late final GeneratedColumn<String> chatId = GeneratedColumn<String>(
      'chat_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _localKeyMeta =
      const VerificationMeta('localKey');
  @override
  late final GeneratedColumn<String> localKey = GeneratedColumn<String>(
      'local_key', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _messageIdMeta =
      const VerificationMeta('messageId');
  @override
  late final GeneratedColumn<String> messageId = GeneratedColumn<String>(
      'message_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _clientMessageIdMeta =
      const VerificationMeta('clientMessageId');
  @override
  late final GeneratedColumn<String> clientMessageId = GeneratedColumn<String>(
      'client_message_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _jsonValueMeta =
      const VerificationMeta('jsonValue');
  @override
  late final GeneratedColumn<String> jsonValue = GeneratedColumn<String>(
      'json_value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        userId,
        chatId,
        localKey,
        messageId,
        clientMessageId,
        jsonValue,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'chat_messages';
  @override
  VerificationContext validateIntegrity(Insertable<ChatMessage> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(_userIdMeta,
          userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta));
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('chat_id')) {
      context.handle(_chatIdMeta,
          chatId.isAcceptableOrUnknown(data['chat_id']!, _chatIdMeta));
    } else if (isInserting) {
      context.missing(_chatIdMeta);
    }
    if (data.containsKey('local_key')) {
      context.handle(_localKeyMeta,
          localKey.isAcceptableOrUnknown(data['local_key']!, _localKeyMeta));
    } else if (isInserting) {
      context.missing(_localKeyMeta);
    }
    if (data.containsKey('message_id')) {
      context.handle(_messageIdMeta,
          messageId.isAcceptableOrUnknown(data['message_id']!, _messageIdMeta));
    }
    if (data.containsKey('client_message_id')) {
      context.handle(
          _clientMessageIdMeta,
          clientMessageId.isAcceptableOrUnknown(
              data['client_message_id']!, _clientMessageIdMeta));
    }
    if (data.containsKey('json_value')) {
      context.handle(_jsonValueMeta,
          jsonValue.isAcceptableOrUnknown(data['json_value']!, _jsonValueMeta));
    } else if (isInserting) {
      context.missing(_jsonValueMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, chatId, localKey};
  @override
  ChatMessage map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ChatMessage(
      userId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}user_id'])!,
      chatId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}chat_id'])!,
      localKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}local_key'])!,
      messageId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}message_id']),
      clientMessageId: attachedDatabase.typeMapping.read(
          DriftSqlType.string, data['${effectivePrefix}client_message_id']),
      jsonValue: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}json_value'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $ChatMessagesTable createAlias(String alias) {
    return $ChatMessagesTable(attachedDatabase, alias);
  }
}

class ChatMessage extends DataClass implements Insertable<ChatMessage> {
  final String userId;
  final String chatId;
  final String localKey;
  final String? messageId;
  final String? clientMessageId;
  final String jsonValue;
  final DateTime createdAt;
  const ChatMessage(
      {required this.userId,
      required this.chatId,
      required this.localKey,
      this.messageId,
      this.clientMessageId,
      required this.jsonValue,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['chat_id'] = Variable<String>(chatId);
    map['local_key'] = Variable<String>(localKey);
    if (!nullToAbsent || messageId != null) {
      map['message_id'] = Variable<String>(messageId);
    }
    if (!nullToAbsent || clientMessageId != null) {
      map['client_message_id'] = Variable<String>(clientMessageId);
    }
    map['json_value'] = Variable<String>(jsonValue);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  ChatMessagesCompanion toCompanion(bool nullToAbsent) {
    return ChatMessagesCompanion(
      userId: Value(userId),
      chatId: Value(chatId),
      localKey: Value(localKey),
      messageId: messageId == null && nullToAbsent
          ? const Value.absent()
          : Value(messageId),
      clientMessageId: clientMessageId == null && nullToAbsent
          ? const Value.absent()
          : Value(clientMessageId),
      jsonValue: Value(jsonValue),
      createdAt: Value(createdAt),
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ChatMessage(
      userId: serializer.fromJson<String>(json['userId']),
      chatId: serializer.fromJson<String>(json['chatId']),
      localKey: serializer.fromJson<String>(json['localKey']),
      messageId: serializer.fromJson<String?>(json['messageId']),
      clientMessageId: serializer.fromJson<String?>(json['clientMessageId']),
      jsonValue: serializer.fromJson<String>(json['jsonValue']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'chatId': serializer.toJson<String>(chatId),
      'localKey': serializer.toJson<String>(localKey),
      'messageId': serializer.toJson<String?>(messageId),
      'clientMessageId': serializer.toJson<String?>(clientMessageId),
      'jsonValue': serializer.toJson<String>(jsonValue),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  ChatMessage copyWith(
          {String? userId,
          String? chatId,
          String? localKey,
          Value<String?> messageId = const Value.absent(),
          Value<String?> clientMessageId = const Value.absent(),
          String? jsonValue,
          DateTime? createdAt}) =>
      ChatMessage(
        userId: userId ?? this.userId,
        chatId: chatId ?? this.chatId,
        localKey: localKey ?? this.localKey,
        messageId: messageId.present ? messageId.value : this.messageId,
        clientMessageId: clientMessageId.present
            ? clientMessageId.value
            : this.clientMessageId,
        jsonValue: jsonValue ?? this.jsonValue,
        createdAt: createdAt ?? this.createdAt,
      );
  ChatMessage copyWithCompanion(ChatMessagesCompanion data) {
    return ChatMessage(
      userId: data.userId.present ? data.userId.value : this.userId,
      chatId: data.chatId.present ? data.chatId.value : this.chatId,
      localKey: data.localKey.present ? data.localKey.value : this.localKey,
      messageId: data.messageId.present ? data.messageId.value : this.messageId,
      clientMessageId: data.clientMessageId.present
          ? data.clientMessageId.value
          : this.clientMessageId,
      jsonValue: data.jsonValue.present ? data.jsonValue.value : this.jsonValue,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ChatMessage(')
          ..write('userId: $userId, ')
          ..write('chatId: $chatId, ')
          ..write('localKey: $localKey, ')
          ..write('messageId: $messageId, ')
          ..write('clientMessageId: $clientMessageId, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, chatId, localKey, messageId,
      clientMessageId, jsonValue, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ChatMessage &&
          other.userId == this.userId &&
          other.chatId == this.chatId &&
          other.localKey == this.localKey &&
          other.messageId == this.messageId &&
          other.clientMessageId == this.clientMessageId &&
          other.jsonValue == this.jsonValue &&
          other.createdAt == this.createdAt);
}

class ChatMessagesCompanion extends UpdateCompanion<ChatMessage> {
  final Value<String> userId;
  final Value<String> chatId;
  final Value<String> localKey;
  final Value<String?> messageId;
  final Value<String?> clientMessageId;
  final Value<String> jsonValue;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const ChatMessagesCompanion({
    this.userId = const Value.absent(),
    this.chatId = const Value.absent(),
    this.localKey = const Value.absent(),
    this.messageId = const Value.absent(),
    this.clientMessageId = const Value.absent(),
    this.jsonValue = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ChatMessagesCompanion.insert({
    required String userId,
    required String chatId,
    required String localKey,
    this.messageId = const Value.absent(),
    this.clientMessageId = const Value.absent(),
    required String jsonValue,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : userId = Value(userId),
        chatId = Value(chatId),
        localKey = Value(localKey),
        jsonValue = Value(jsonValue),
        createdAt = Value(createdAt);
  static Insertable<ChatMessage> custom({
    Expression<String>? userId,
    Expression<String>? chatId,
    Expression<String>? localKey,
    Expression<String>? messageId,
    Expression<String>? clientMessageId,
    Expression<String>? jsonValue,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (chatId != null) 'chat_id': chatId,
      if (localKey != null) 'local_key': localKey,
      if (messageId != null) 'message_id': messageId,
      if (clientMessageId != null) 'client_message_id': clientMessageId,
      if (jsonValue != null) 'json_value': jsonValue,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ChatMessagesCompanion copyWith(
      {Value<String>? userId,
      Value<String>? chatId,
      Value<String>? localKey,
      Value<String?>? messageId,
      Value<String?>? clientMessageId,
      Value<String>? jsonValue,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return ChatMessagesCompanion(
      userId: userId ?? this.userId,
      chatId: chatId ?? this.chatId,
      localKey: localKey ?? this.localKey,
      messageId: messageId ?? this.messageId,
      clientMessageId: clientMessageId ?? this.clientMessageId,
      jsonValue: jsonValue ?? this.jsonValue,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (chatId.present) {
      map['chat_id'] = Variable<String>(chatId.value);
    }
    if (localKey.present) {
      map['local_key'] = Variable<String>(localKey.value);
    }
    if (messageId.present) {
      map['message_id'] = Variable<String>(messageId.value);
    }
    if (clientMessageId.present) {
      map['client_message_id'] = Variable<String>(clientMessageId.value);
    }
    if (jsonValue.present) {
      map['json_value'] = Variable<String>(jsonValue.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ChatMessagesCompanion(')
          ..write('userId: $userId, ')
          ..write('chatId: $chatId, ')
          ..write('localKey: $localKey, ')
          ..write('messageId: $messageId, ')
          ..write('clientMessageId: $clientMessageId, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncCursorsTable extends SyncCursors
    with TableInfo<$SyncCursorsTable, SyncCursor> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncCursorsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
      'user_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _scopeMeta = const VerificationMeta('scope');
  @override
  late final GeneratedColumn<String> scope = GeneratedColumn<String>(
      'scope', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cursorMeta = const VerificationMeta('cursor');
  @override
  late final GeneratedColumn<String> cursor = GeneratedColumn<String>(
      'cursor', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _updatedAtMeta =
      const VerificationMeta('updatedAt');
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
      'updated_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [userId, scope, cursor, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_cursors';
  @override
  VerificationContext validateIntegrity(Insertable<SyncCursor> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(_userIdMeta,
          userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta));
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('scope')) {
      context.handle(
          _scopeMeta, scope.isAcceptableOrUnknown(data['scope']!, _scopeMeta));
    } else if (isInserting) {
      context.missing(_scopeMeta);
    }
    if (data.containsKey('cursor')) {
      context.handle(_cursorMeta,
          cursor.isAcceptableOrUnknown(data['cursor']!, _cursorMeta));
    } else if (isInserting) {
      context.missing(_cursorMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(_updatedAtMeta,
          updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta));
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, scope};
  @override
  SyncCursor map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncCursor(
      userId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}user_id'])!,
      scope: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}scope'])!,
      cursor: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}cursor'])!,
      updatedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}updated_at'])!,
    );
  }

  @override
  $SyncCursorsTable createAlias(String alias) {
    return $SyncCursorsTable(attachedDatabase, alias);
  }
}

class SyncCursor extends DataClass implements Insertable<SyncCursor> {
  final String userId;
  final String scope;
  final String cursor;
  final DateTime updatedAt;
  const SyncCursor(
      {required this.userId,
      required this.scope,
      required this.cursor,
      required this.updatedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['scope'] = Variable<String>(scope);
    map['cursor'] = Variable<String>(cursor);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  SyncCursorsCompanion toCompanion(bool nullToAbsent) {
    return SyncCursorsCompanion(
      userId: Value(userId),
      scope: Value(scope),
      cursor: Value(cursor),
      updatedAt: Value(updatedAt),
    );
  }

  factory SyncCursor.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncCursor(
      userId: serializer.fromJson<String>(json['userId']),
      scope: serializer.fromJson<String>(json['scope']),
      cursor: serializer.fromJson<String>(json['cursor']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'scope': serializer.toJson<String>(scope),
      'cursor': serializer.toJson<String>(cursor),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  SyncCursor copyWith(
          {String? userId,
          String? scope,
          String? cursor,
          DateTime? updatedAt}) =>
      SyncCursor(
        userId: userId ?? this.userId,
        scope: scope ?? this.scope,
        cursor: cursor ?? this.cursor,
        updatedAt: updatedAt ?? this.updatedAt,
      );
  SyncCursor copyWithCompanion(SyncCursorsCompanion data) {
    return SyncCursor(
      userId: data.userId.present ? data.userId.value : this.userId,
      scope: data.scope.present ? data.scope.value : this.scope,
      cursor: data.cursor.present ? data.cursor.value : this.cursor,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncCursor(')
          ..write('userId: $userId, ')
          ..write('scope: $scope, ')
          ..write('cursor: $cursor, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(userId, scope, cursor, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncCursor &&
          other.userId == this.userId &&
          other.scope == this.scope &&
          other.cursor == this.cursor &&
          other.updatedAt == this.updatedAt);
}

class SyncCursorsCompanion extends UpdateCompanion<SyncCursor> {
  final Value<String> userId;
  final Value<String> scope;
  final Value<String> cursor;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const SyncCursorsCompanion({
    this.userId = const Value.absent(),
    this.scope = const Value.absent(),
    this.cursor = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncCursorsCompanion.insert({
    required String userId,
    required String scope,
    required String cursor,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  })  : userId = Value(userId),
        scope = Value(scope),
        cursor = Value(cursor),
        updatedAt = Value(updatedAt);
  static Insertable<SyncCursor> custom({
    Expression<String>? userId,
    Expression<String>? scope,
    Expression<String>? cursor,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (scope != null) 'scope': scope,
      if (cursor != null) 'cursor': cursor,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncCursorsCompanion copyWith(
      {Value<String>? userId,
      Value<String>? scope,
      Value<String>? cursor,
      Value<DateTime>? updatedAt,
      Value<int>? rowid}) {
    return SyncCursorsCompanion(
      userId: userId ?? this.userId,
      scope: scope ?? this.scope,
      cursor: cursor ?? this.cursor,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (scope.present) {
      map['scope'] = Variable<String>(scope.value);
    }
    if (cursor.present) {
      map['cursor'] = Variable<String>(cursor.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncCursorsCompanion(')
          ..write('userId: $userId, ')
          ..write('scope: $scope, ')
          ..write('cursor: $cursor, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PendingCommandsTable extends PendingCommands
    with TableInfo<$PendingCommandsTable, PendingCommand> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingCommandsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _userIdMeta = const VerificationMeta('userId');
  @override
  late final GeneratedColumn<String> userId = GeneratedColumn<String>(
      'user_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _commandIdMeta =
      const VerificationMeta('commandId');
  @override
  late final GeneratedColumn<String> commandId = GeneratedColumn<String>(
      'command_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _dedupeKeyMeta =
      const VerificationMeta('dedupeKey');
  @override
  late final GeneratedColumn<String> dedupeKey = GeneratedColumn<String>(
      'dedupe_key', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _jsonValueMeta =
      const VerificationMeta('jsonValue');
  @override
  late final GeneratedColumn<String> jsonValue = GeneratedColumn<String>(
      'json_value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [userId, commandId, dedupeKey, jsonValue, createdAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_commands';
  @override
  VerificationContext validateIntegrity(Insertable<PendingCommand> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('user_id')) {
      context.handle(_userIdMeta,
          userId.isAcceptableOrUnknown(data['user_id']!, _userIdMeta));
    } else if (isInserting) {
      context.missing(_userIdMeta);
    }
    if (data.containsKey('command_id')) {
      context.handle(_commandIdMeta,
          commandId.isAcceptableOrUnknown(data['command_id']!, _commandIdMeta));
    } else if (isInserting) {
      context.missing(_commandIdMeta);
    }
    if (data.containsKey('dedupe_key')) {
      context.handle(_dedupeKeyMeta,
          dedupeKey.isAcceptableOrUnknown(data['dedupe_key']!, _dedupeKeyMeta));
    } else if (isInserting) {
      context.missing(_dedupeKeyMeta);
    }
    if (data.containsKey('json_value')) {
      context.handle(_jsonValueMeta,
          jsonValue.isAcceptableOrUnknown(data['json_value']!, _jsonValueMeta));
    } else if (isInserting) {
      context.missing(_jsonValueMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {userId, commandId};
  @override
  PendingCommand map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingCommand(
      userId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}user_id'])!,
      commandId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}command_id'])!,
      dedupeKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}dedupe_key'])!,
      jsonValue: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}json_value'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $PendingCommandsTable createAlias(String alias) {
    return $PendingCommandsTable(attachedDatabase, alias);
  }
}

class PendingCommand extends DataClass implements Insertable<PendingCommand> {
  final String userId;
  final String commandId;
  final String dedupeKey;
  final String jsonValue;
  final DateTime createdAt;
  const PendingCommand(
      {required this.userId,
      required this.commandId,
      required this.dedupeKey,
      required this.jsonValue,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['user_id'] = Variable<String>(userId);
    map['command_id'] = Variable<String>(commandId);
    map['dedupe_key'] = Variable<String>(dedupeKey);
    map['json_value'] = Variable<String>(jsonValue);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  PendingCommandsCompanion toCompanion(bool nullToAbsent) {
    return PendingCommandsCompanion(
      userId: Value(userId),
      commandId: Value(commandId),
      dedupeKey: Value(dedupeKey),
      jsonValue: Value(jsonValue),
      createdAt: Value(createdAt),
    );
  }

  factory PendingCommand.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingCommand(
      userId: serializer.fromJson<String>(json['userId']),
      commandId: serializer.fromJson<String>(json['commandId']),
      dedupeKey: serializer.fromJson<String>(json['dedupeKey']),
      jsonValue: serializer.fromJson<String>(json['jsonValue']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'userId': serializer.toJson<String>(userId),
      'commandId': serializer.toJson<String>(commandId),
      'dedupeKey': serializer.toJson<String>(dedupeKey),
      'jsonValue': serializer.toJson<String>(jsonValue),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  PendingCommand copyWith(
          {String? userId,
          String? commandId,
          String? dedupeKey,
          String? jsonValue,
          DateTime? createdAt}) =>
      PendingCommand(
        userId: userId ?? this.userId,
        commandId: commandId ?? this.commandId,
        dedupeKey: dedupeKey ?? this.dedupeKey,
        jsonValue: jsonValue ?? this.jsonValue,
        createdAt: createdAt ?? this.createdAt,
      );
  PendingCommand copyWithCompanion(PendingCommandsCompanion data) {
    return PendingCommand(
      userId: data.userId.present ? data.userId.value : this.userId,
      commandId: data.commandId.present ? data.commandId.value : this.commandId,
      dedupeKey: data.dedupeKey.present ? data.dedupeKey.value : this.dedupeKey,
      jsonValue: data.jsonValue.present ? data.jsonValue.value : this.jsonValue,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingCommand(')
          ..write('userId: $userId, ')
          ..write('commandId: $commandId, ')
          ..write('dedupeKey: $dedupeKey, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(userId, commandId, dedupeKey, jsonValue, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingCommand &&
          other.userId == this.userId &&
          other.commandId == this.commandId &&
          other.dedupeKey == this.dedupeKey &&
          other.jsonValue == this.jsonValue &&
          other.createdAt == this.createdAt);
}

class PendingCommandsCompanion extends UpdateCompanion<PendingCommand> {
  final Value<String> userId;
  final Value<String> commandId;
  final Value<String> dedupeKey;
  final Value<String> jsonValue;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const PendingCommandsCompanion({
    this.userId = const Value.absent(),
    this.commandId = const Value.absent(),
    this.dedupeKey = const Value.absent(),
    this.jsonValue = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PendingCommandsCompanion.insert({
    required String userId,
    required String commandId,
    required String dedupeKey,
    required String jsonValue,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : userId = Value(userId),
        commandId = Value(commandId),
        dedupeKey = Value(dedupeKey),
        jsonValue = Value(jsonValue),
        createdAt = Value(createdAt);
  static Insertable<PendingCommand> custom({
    Expression<String>? userId,
    Expression<String>? commandId,
    Expression<String>? dedupeKey,
    Expression<String>? jsonValue,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (userId != null) 'user_id': userId,
      if (commandId != null) 'command_id': commandId,
      if (dedupeKey != null) 'dedupe_key': dedupeKey,
      if (jsonValue != null) 'json_value': jsonValue,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PendingCommandsCompanion copyWith(
      {Value<String>? userId,
      Value<String>? commandId,
      Value<String>? dedupeKey,
      Value<String>? jsonValue,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return PendingCommandsCompanion(
      userId: userId ?? this.userId,
      commandId: commandId ?? this.commandId,
      dedupeKey: dedupeKey ?? this.dedupeKey,
      jsonValue: jsonValue ?? this.jsonValue,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (userId.present) {
      map['user_id'] = Variable<String>(userId.value);
    }
    if (commandId.present) {
      map['command_id'] = Variable<String>(commandId.value);
    }
    if (dedupeKey.present) {
      map['dedupe_key'] = Variable<String>(dedupeKey.value);
    }
    if (jsonValue.present) {
      map['json_value'] = Variable<String>(jsonValue.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingCommandsCompanion(')
          ..write('userId: $userId, ')
          ..write('commandId: $commandId, ')
          ..write('dedupeKey: $dedupeKey, ')
          ..write('jsonValue: $jsonValue, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppLocalDatabase extends GeneratedDatabase {
  _$AppLocalDatabase(QueryExecutor e) : super(e);
  $AppLocalDatabaseManager get managers => $AppLocalDatabaseManager(this);
  late final $CacheEntriesTable cacheEntries = $CacheEntriesTable(this);
  late final $ChatSummariesTable chatSummaries = $ChatSummariesTable(this);
  late final $ChatMessagesTable chatMessages = $ChatMessagesTable(this);
  late final $SyncCursorsTable syncCursors = $SyncCursorsTable(this);
  late final $PendingCommandsTable pendingCommands =
      $PendingCommandsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities =>
      [cacheEntries, chatSummaries, chatMessages, syncCursors, pendingCommands];
}

typedef $$CacheEntriesTableCreateCompanionBuilder = CacheEntriesCompanion
    Function({
  required String userScope,
  required String namespace,
  required String cacheKey,
  required String jsonValue,
  required DateTime createdAt,
  required DateTime expiresAt,
  Value<int> rowid,
});
typedef $$CacheEntriesTableUpdateCompanionBuilder = CacheEntriesCompanion
    Function({
  Value<String> userScope,
  Value<String> namespace,
  Value<String> cacheKey,
  Value<String> jsonValue,
  Value<DateTime> createdAt,
  Value<DateTime> expiresAt,
  Value<int> rowid,
});

class $$CacheEntriesTableFilterComposer
    extends Composer<_$AppLocalDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userScope => $composableBuilder(
      column: $table.userScope, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get namespace => $composableBuilder(
      column: $table.namespace, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get cacheKey => $composableBuilder(
      column: $table.cacheKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get expiresAt => $composableBuilder(
      column: $table.expiresAt, builder: (column) => ColumnFilters(column));
}

class $$CacheEntriesTableOrderingComposer
    extends Composer<_$AppLocalDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userScope => $composableBuilder(
      column: $table.userScope, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get namespace => $composableBuilder(
      column: $table.namespace, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get cacheKey => $composableBuilder(
      column: $table.cacheKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get expiresAt => $composableBuilder(
      column: $table.expiresAt, builder: (column) => ColumnOrderings(column));
}

class $$CacheEntriesTableAnnotationComposer
    extends Composer<_$AppLocalDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userScope =>
      $composableBuilder(column: $table.userScope, builder: (column) => column);

  GeneratedColumn<String> get namespace =>
      $composableBuilder(column: $table.namespace, builder: (column) => column);

  GeneratedColumn<String> get cacheKey =>
      $composableBuilder(column: $table.cacheKey, builder: (column) => column);

  GeneratedColumn<String> get jsonValue =>
      $composableBuilder(column: $table.jsonValue, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get expiresAt =>
      $composableBuilder(column: $table.expiresAt, builder: (column) => column);
}

class $$CacheEntriesTableTableManager extends RootTableManager<
    _$AppLocalDatabase,
    $CacheEntriesTable,
    CacheEntry,
    $$CacheEntriesTableFilterComposer,
    $$CacheEntriesTableOrderingComposer,
    $$CacheEntriesTableAnnotationComposer,
    $$CacheEntriesTableCreateCompanionBuilder,
    $$CacheEntriesTableUpdateCompanionBuilder,
    (
      CacheEntry,
      BaseReferences<_$AppLocalDatabase, $CacheEntriesTable, CacheEntry>
    ),
    CacheEntry,
    PrefetchHooks Function()> {
  $$CacheEntriesTableTableManager(
      _$AppLocalDatabase db, $CacheEntriesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CacheEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CacheEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CacheEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> userScope = const Value.absent(),
            Value<String> namespace = const Value.absent(),
            Value<String> cacheKey = const Value.absent(),
            Value<String> jsonValue = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> expiresAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CacheEntriesCompanion(
            userScope: userScope,
            namespace: namespace,
            cacheKey: cacheKey,
            jsonValue: jsonValue,
            createdAt: createdAt,
            expiresAt: expiresAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String userScope,
            required String namespace,
            required String cacheKey,
            required String jsonValue,
            required DateTime createdAt,
            required DateTime expiresAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              CacheEntriesCompanion.insert(
            userScope: userScope,
            namespace: namespace,
            cacheKey: cacheKey,
            jsonValue: jsonValue,
            createdAt: createdAt,
            expiresAt: expiresAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CacheEntriesTableProcessedTableManager = ProcessedTableManager<
    _$AppLocalDatabase,
    $CacheEntriesTable,
    CacheEntry,
    $$CacheEntriesTableFilterComposer,
    $$CacheEntriesTableOrderingComposer,
    $$CacheEntriesTableAnnotationComposer,
    $$CacheEntriesTableCreateCompanionBuilder,
    $$CacheEntriesTableUpdateCompanionBuilder,
    (
      CacheEntry,
      BaseReferences<_$AppLocalDatabase, $CacheEntriesTable, CacheEntry>
    ),
    CacheEntry,
    PrefetchHooks Function()>;
typedef $$ChatSummariesTableCreateCompanionBuilder = ChatSummariesCompanion
    Function({
  required String userId,
  required String kind,
  required String chatId,
  required String jsonValue,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$ChatSummariesTableUpdateCompanionBuilder = ChatSummariesCompanion
    Function({
  Value<String> userId,
  Value<String> kind,
  Value<String> chatId,
  Value<String> jsonValue,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$ChatSummariesTableFilterComposer
    extends Composer<_$AppLocalDatabase, $ChatSummariesTable> {
  $$ChatSummariesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get chatId => $composableBuilder(
      column: $table.chatId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$ChatSummariesTableOrderingComposer
    extends Composer<_$AppLocalDatabase, $ChatSummariesTable> {
  $$ChatSummariesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get kind => $composableBuilder(
      column: $table.kind, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get chatId => $composableBuilder(
      column: $table.chatId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$ChatSummariesTableAnnotationComposer
    extends Composer<_$AppLocalDatabase, $ChatSummariesTable> {
  $$ChatSummariesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get chatId =>
      $composableBuilder(column: $table.chatId, builder: (column) => column);

  GeneratedColumn<String> get jsonValue =>
      $composableBuilder(column: $table.jsonValue, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$ChatSummariesTableTableManager extends RootTableManager<
    _$AppLocalDatabase,
    $ChatSummariesTable,
    ChatSummary,
    $$ChatSummariesTableFilterComposer,
    $$ChatSummariesTableOrderingComposer,
    $$ChatSummariesTableAnnotationComposer,
    $$ChatSummariesTableCreateCompanionBuilder,
    $$ChatSummariesTableUpdateCompanionBuilder,
    (
      ChatSummary,
      BaseReferences<_$AppLocalDatabase, $ChatSummariesTable, ChatSummary>
    ),
    ChatSummary,
    PrefetchHooks Function()> {
  $$ChatSummariesTableTableManager(
      _$AppLocalDatabase db, $ChatSummariesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ChatSummariesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ChatSummariesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ChatSummariesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> userId = const Value.absent(),
            Value<String> kind = const Value.absent(),
            Value<String> chatId = const Value.absent(),
            Value<String> jsonValue = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ChatSummariesCompanion(
            userId: userId,
            kind: kind,
            chatId: chatId,
            jsonValue: jsonValue,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String userId,
            required String kind,
            required String chatId,
            required String jsonValue,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              ChatSummariesCompanion.insert(
            userId: userId,
            kind: kind,
            chatId: chatId,
            jsonValue: jsonValue,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ChatSummariesTableProcessedTableManager = ProcessedTableManager<
    _$AppLocalDatabase,
    $ChatSummariesTable,
    ChatSummary,
    $$ChatSummariesTableFilterComposer,
    $$ChatSummariesTableOrderingComposer,
    $$ChatSummariesTableAnnotationComposer,
    $$ChatSummariesTableCreateCompanionBuilder,
    $$ChatSummariesTableUpdateCompanionBuilder,
    (
      ChatSummary,
      BaseReferences<_$AppLocalDatabase, $ChatSummariesTable, ChatSummary>
    ),
    ChatSummary,
    PrefetchHooks Function()>;
typedef $$ChatMessagesTableCreateCompanionBuilder = ChatMessagesCompanion
    Function({
  required String userId,
  required String chatId,
  required String localKey,
  Value<String?> messageId,
  Value<String?> clientMessageId,
  required String jsonValue,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$ChatMessagesTableUpdateCompanionBuilder = ChatMessagesCompanion
    Function({
  Value<String> userId,
  Value<String> chatId,
  Value<String> localKey,
  Value<String?> messageId,
  Value<String?> clientMessageId,
  Value<String> jsonValue,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$ChatMessagesTableFilterComposer
    extends Composer<_$AppLocalDatabase, $ChatMessagesTable> {
  $$ChatMessagesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get chatId => $composableBuilder(
      column: $table.chatId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get localKey => $composableBuilder(
      column: $table.localKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get messageId => $composableBuilder(
      column: $table.messageId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get clientMessageId => $composableBuilder(
      column: $table.clientMessageId,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$ChatMessagesTableOrderingComposer
    extends Composer<_$AppLocalDatabase, $ChatMessagesTable> {
  $$ChatMessagesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get chatId => $composableBuilder(
      column: $table.chatId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get localKey => $composableBuilder(
      column: $table.localKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get messageId => $composableBuilder(
      column: $table.messageId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get clientMessageId => $composableBuilder(
      column: $table.clientMessageId,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$ChatMessagesTableAnnotationComposer
    extends Composer<_$AppLocalDatabase, $ChatMessagesTable> {
  $$ChatMessagesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get chatId =>
      $composableBuilder(column: $table.chatId, builder: (column) => column);

  GeneratedColumn<String> get localKey =>
      $composableBuilder(column: $table.localKey, builder: (column) => column);

  GeneratedColumn<String> get messageId =>
      $composableBuilder(column: $table.messageId, builder: (column) => column);

  GeneratedColumn<String> get clientMessageId => $composableBuilder(
      column: $table.clientMessageId, builder: (column) => column);

  GeneratedColumn<String> get jsonValue =>
      $composableBuilder(column: $table.jsonValue, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$ChatMessagesTableTableManager extends RootTableManager<
    _$AppLocalDatabase,
    $ChatMessagesTable,
    ChatMessage,
    $$ChatMessagesTableFilterComposer,
    $$ChatMessagesTableOrderingComposer,
    $$ChatMessagesTableAnnotationComposer,
    $$ChatMessagesTableCreateCompanionBuilder,
    $$ChatMessagesTableUpdateCompanionBuilder,
    (
      ChatMessage,
      BaseReferences<_$AppLocalDatabase, $ChatMessagesTable, ChatMessage>
    ),
    ChatMessage,
    PrefetchHooks Function()> {
  $$ChatMessagesTableTableManager(
      _$AppLocalDatabase db, $ChatMessagesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ChatMessagesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ChatMessagesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ChatMessagesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> userId = const Value.absent(),
            Value<String> chatId = const Value.absent(),
            Value<String> localKey = const Value.absent(),
            Value<String?> messageId = const Value.absent(),
            Value<String?> clientMessageId = const Value.absent(),
            Value<String> jsonValue = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ChatMessagesCompanion(
            userId: userId,
            chatId: chatId,
            localKey: localKey,
            messageId: messageId,
            clientMessageId: clientMessageId,
            jsonValue: jsonValue,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String userId,
            required String chatId,
            required String localKey,
            Value<String?> messageId = const Value.absent(),
            Value<String?> clientMessageId = const Value.absent(),
            required String jsonValue,
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              ChatMessagesCompanion.insert(
            userId: userId,
            chatId: chatId,
            localKey: localKey,
            messageId: messageId,
            clientMessageId: clientMessageId,
            jsonValue: jsonValue,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ChatMessagesTableProcessedTableManager = ProcessedTableManager<
    _$AppLocalDatabase,
    $ChatMessagesTable,
    ChatMessage,
    $$ChatMessagesTableFilterComposer,
    $$ChatMessagesTableOrderingComposer,
    $$ChatMessagesTableAnnotationComposer,
    $$ChatMessagesTableCreateCompanionBuilder,
    $$ChatMessagesTableUpdateCompanionBuilder,
    (
      ChatMessage,
      BaseReferences<_$AppLocalDatabase, $ChatMessagesTable, ChatMessage>
    ),
    ChatMessage,
    PrefetchHooks Function()>;
typedef $$SyncCursorsTableCreateCompanionBuilder = SyncCursorsCompanion
    Function({
  required String userId,
  required String scope,
  required String cursor,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$SyncCursorsTableUpdateCompanionBuilder = SyncCursorsCompanion
    Function({
  Value<String> userId,
  Value<String> scope,
  Value<String> cursor,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$SyncCursorsTableFilterComposer
    extends Composer<_$AppLocalDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get scope => $composableBuilder(
      column: $table.scope, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get cursor => $composableBuilder(
      column: $table.cursor, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnFilters(column));
}

class $$SyncCursorsTableOrderingComposer
    extends Composer<_$AppLocalDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get scope => $composableBuilder(
      column: $table.scope, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get cursor => $composableBuilder(
      column: $table.cursor, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
      column: $table.updatedAt, builder: (column) => ColumnOrderings(column));
}

class $$SyncCursorsTableAnnotationComposer
    extends Composer<_$AppLocalDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get scope =>
      $composableBuilder(column: $table.scope, builder: (column) => column);

  GeneratedColumn<String> get cursor =>
      $composableBuilder(column: $table.cursor, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$SyncCursorsTableTableManager extends RootTableManager<
    _$AppLocalDatabase,
    $SyncCursorsTable,
    SyncCursor,
    $$SyncCursorsTableFilterComposer,
    $$SyncCursorsTableOrderingComposer,
    $$SyncCursorsTableAnnotationComposer,
    $$SyncCursorsTableCreateCompanionBuilder,
    $$SyncCursorsTableUpdateCompanionBuilder,
    (
      SyncCursor,
      BaseReferences<_$AppLocalDatabase, $SyncCursorsTable, SyncCursor>
    ),
    SyncCursor,
    PrefetchHooks Function()> {
  $$SyncCursorsTableTableManager(_$AppLocalDatabase db, $SyncCursorsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncCursorsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncCursorsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncCursorsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> userId = const Value.absent(),
            Value<String> scope = const Value.absent(),
            Value<String> cursor = const Value.absent(),
            Value<DateTime> updatedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncCursorsCompanion(
            userId: userId,
            scope: scope,
            cursor: cursor,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String userId,
            required String scope,
            required String cursor,
            required DateTime updatedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncCursorsCompanion.insert(
            userId: userId,
            scope: scope,
            cursor: cursor,
            updatedAt: updatedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncCursorsTableProcessedTableManager = ProcessedTableManager<
    _$AppLocalDatabase,
    $SyncCursorsTable,
    SyncCursor,
    $$SyncCursorsTableFilterComposer,
    $$SyncCursorsTableOrderingComposer,
    $$SyncCursorsTableAnnotationComposer,
    $$SyncCursorsTableCreateCompanionBuilder,
    $$SyncCursorsTableUpdateCompanionBuilder,
    (
      SyncCursor,
      BaseReferences<_$AppLocalDatabase, $SyncCursorsTable, SyncCursor>
    ),
    SyncCursor,
    PrefetchHooks Function()>;
typedef $$PendingCommandsTableCreateCompanionBuilder = PendingCommandsCompanion
    Function({
  required String userId,
  required String commandId,
  required String dedupeKey,
  required String jsonValue,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$PendingCommandsTableUpdateCompanionBuilder = PendingCommandsCompanion
    Function({
  Value<String> userId,
  Value<String> commandId,
  Value<String> dedupeKey,
  Value<String> jsonValue,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$PendingCommandsTableFilterComposer
    extends Composer<_$AppLocalDatabase, $PendingCommandsTable> {
  $$PendingCommandsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get commandId => $composableBuilder(
      column: $table.commandId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get dedupeKey => $composableBuilder(
      column: $table.dedupeKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$PendingCommandsTableOrderingComposer
    extends Composer<_$AppLocalDatabase, $PendingCommandsTable> {
  $$PendingCommandsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get userId => $composableBuilder(
      column: $table.userId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get commandId => $composableBuilder(
      column: $table.commandId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get dedupeKey => $composableBuilder(
      column: $table.dedupeKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get jsonValue => $composableBuilder(
      column: $table.jsonValue, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$PendingCommandsTableAnnotationComposer
    extends Composer<_$AppLocalDatabase, $PendingCommandsTable> {
  $$PendingCommandsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get userId =>
      $composableBuilder(column: $table.userId, builder: (column) => column);

  GeneratedColumn<String> get commandId =>
      $composableBuilder(column: $table.commandId, builder: (column) => column);

  GeneratedColumn<String> get dedupeKey =>
      $composableBuilder(column: $table.dedupeKey, builder: (column) => column);

  GeneratedColumn<String> get jsonValue =>
      $composableBuilder(column: $table.jsonValue, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$PendingCommandsTableTableManager extends RootTableManager<
    _$AppLocalDatabase,
    $PendingCommandsTable,
    PendingCommand,
    $$PendingCommandsTableFilterComposer,
    $$PendingCommandsTableOrderingComposer,
    $$PendingCommandsTableAnnotationComposer,
    $$PendingCommandsTableCreateCompanionBuilder,
    $$PendingCommandsTableUpdateCompanionBuilder,
    (
      PendingCommand,
      BaseReferences<_$AppLocalDatabase, $PendingCommandsTable, PendingCommand>
    ),
    PendingCommand,
    PrefetchHooks Function()> {
  $$PendingCommandsTableTableManager(
      _$AppLocalDatabase db, $PendingCommandsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingCommandsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingCommandsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingCommandsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> userId = const Value.absent(),
            Value<String> commandId = const Value.absent(),
            Value<String> dedupeKey = const Value.absent(),
            Value<String> jsonValue = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              PendingCommandsCompanion(
            userId: userId,
            commandId: commandId,
            dedupeKey: dedupeKey,
            jsonValue: jsonValue,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String userId,
            required String commandId,
            required String dedupeKey,
            required String jsonValue,
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              PendingCommandsCompanion.insert(
            userId: userId,
            commandId: commandId,
            dedupeKey: dedupeKey,
            jsonValue: jsonValue,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$PendingCommandsTableProcessedTableManager = ProcessedTableManager<
    _$AppLocalDatabase,
    $PendingCommandsTable,
    PendingCommand,
    $$PendingCommandsTableFilterComposer,
    $$PendingCommandsTableOrderingComposer,
    $$PendingCommandsTableAnnotationComposer,
    $$PendingCommandsTableCreateCompanionBuilder,
    $$PendingCommandsTableUpdateCompanionBuilder,
    (
      PendingCommand,
      BaseReferences<_$AppLocalDatabase, $PendingCommandsTable, PendingCommand>
    ),
    PendingCommand,
    PrefetchHooks Function()>;

class $AppLocalDatabaseManager {
  final _$AppLocalDatabase _db;
  $AppLocalDatabaseManager(this._db);
  $$CacheEntriesTableTableManager get cacheEntries =>
      $$CacheEntriesTableTableManager(_db, _db.cacheEntries);
  $$ChatSummariesTableTableManager get chatSummaries =>
      $$ChatSummariesTableTableManager(_db, _db.chatSummaries);
  $$ChatMessagesTableTableManager get chatMessages =>
      $$ChatMessagesTableTableManager(_db, _db.chatMessages);
  $$SyncCursorsTableTableManager get syncCursors =>
      $$SyncCursorsTableTableManager(_db, _db.syncCursors);
  $$PendingCommandsTableTableManager get pendingCommands =>
      $$PendingCommandsTableTableManager(_db, _db.pendingCommands);
}
