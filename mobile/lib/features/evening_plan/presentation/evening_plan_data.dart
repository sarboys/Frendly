enum EveningMood { chill, social, date, wild, afterdark }

enum EveningBudget { free, low, mid, high }

enum EveningGoal { newfriends, date, company, quiet, afterdark }

enum EveningFormat { bar, show, active, culture, mixed }

enum EveningStepKind {
  bar,
  show,
  afterparty,
  followup,
  dinner,
  wellness,
  active,
}

class EveningOption {
  const EveningOption({
    required this.key,
    required this.label,
    this.emoji,
    this.blurb,
  });

  final String key;
  final String label;
  final String? emoji;
  final String? blurb;
}

class EveningRouteStep {
  const EveningRouteStep({
    required this.id,
    required this.time,
    this.endTime,
    required this.kind,
    required this.title,
    required this.venue,
    required this.address,
    required this.emoji,
    required this.distance,
    this.walkMin,
    this.perk,
    this.perkShort,
    this.ticketPrice,
    this.ticketCommission,
    this.sponsored = false,
    this.premium = false,
    this.partnerId,
    this.venueId,
    this.partnerOfferId,
    this.offerTitle,
    this.offerDescription,
    this.offerTerms,
    this.offerShortLabel,
    this.description,
    this.vibeTag,
    required this.lat,
    required this.lng,
  });

  final String id;
  final String time;
  final String? endTime;
  final EveningStepKind kind;
  final String title;
  final String venue;
  final String address;
  final String emoji;
  final String distance;
  final int? walkMin;
  final String? perk;
  final String? perkShort;
  final int? ticketPrice;
  final int? ticketCommission;
  final bool sponsored;
  final bool premium;
  final String? partnerId;
  final String? venueId;
  final String? partnerOfferId;
  final String? offerTitle;
  final String? offerDescription;
  final String? offerTerms;
  final String? offerShortLabel;
  final String? description;
  final String? vibeTag;
  final double lat;
  final double lng;

  bool get hasShareable => perk != null || ticketPrice != null;

  EveningRouteStep copyWith({
    String? id,
    String? time,
    String? endTime,
    bool clearEndTime = false,
    EveningStepKind? kind,
    String? title,
    String? venue,
    String? address,
    String? emoji,
    String? distance,
    int? walkMin,
    bool clearWalkMin = false,
    String? perk,
    bool clearPerk = false,
    String? perkShort,
    bool clearPerkShort = false,
    int? ticketPrice,
    bool clearTicketPrice = false,
    int? ticketCommission,
    bool clearTicketCommission = false,
    bool? sponsored,
    bool? premium,
    String? partnerId,
    bool clearPartnerId = false,
    String? venueId,
    bool clearVenueId = false,
    String? partnerOfferId,
    bool clearPartnerOfferId = false,
    String? offerTitle,
    bool clearOfferTitle = false,
    String? offerDescription,
    bool clearOfferDescription = false,
    String? offerTerms,
    bool clearOfferTerms = false,
    String? offerShortLabel,
    bool clearOfferShortLabel = false,
    String? description,
    bool clearDescription = false,
    String? vibeTag,
    bool clearVibeTag = false,
    double? lat,
    double? lng,
  }) {
    return EveningRouteStep(
      id: id ?? this.id,
      time: time ?? this.time,
      endTime: clearEndTime ? null : endTime ?? this.endTime,
      kind: kind ?? this.kind,
      title: title ?? this.title,
      venue: venue ?? this.venue,
      address: address ?? this.address,
      emoji: emoji ?? this.emoji,
      distance: distance ?? this.distance,
      walkMin: clearWalkMin ? null : walkMin ?? this.walkMin,
      perk: clearPerk ? null : perk ?? this.perk,
      perkShort: clearPerkShort ? null : perkShort ?? this.perkShort,
      ticketPrice: clearTicketPrice ? null : ticketPrice ?? this.ticketPrice,
      ticketCommission: clearTicketCommission
          ? null
          : ticketCommission ?? this.ticketCommission,
      sponsored: sponsored ?? this.sponsored,
      premium: premium ?? this.premium,
      partnerId: clearPartnerId ? null : partnerId ?? this.partnerId,
      venueId: clearVenueId ? null : venueId ?? this.venueId,
      partnerOfferId:
          clearPartnerOfferId ? null : partnerOfferId ?? this.partnerOfferId,
      offerTitle: clearOfferTitle ? null : offerTitle ?? this.offerTitle,
      offerDescription: clearOfferDescription
          ? null
          : offerDescription ?? this.offerDescription,
      offerTerms: clearOfferTerms ? null : offerTerms ?? this.offerTerms,
      offerShortLabel:
          clearOfferShortLabel ? null : offerShortLabel ?? this.offerShortLabel,
      description: clearDescription ? null : description ?? this.description,
      vibeTag: clearVibeTag ? null : vibeTag ?? this.vibeTag,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
    );
  }
}

class EveningRouteData {
  const EveningRouteData({
    required this.id,
    required this.title,
    required this.vibe,
    required this.blurb,
    required this.totalPriceFrom,
    required this.totalSavings,
    required this.durationLabel,
    required this.area,
    required this.goal,
    required this.mood,
    required this.budget,
    this.premium = false,
    this.recommendedFor,
    required this.steps,
    required this.hostsCount,
  });

  final String id;
  final String title;
  final String vibe;
  final String blurb;
  final int totalPriceFrom;
  final int totalSavings;
  final String durationLabel;
  final String area;
  final EveningGoal goal;
  final EveningMood mood;
  final EveningBudget budget;
  final bool premium;
  final String? recommendedFor;
  final List<EveningRouteStep> steps;
  final int hostsCount;

  EveningRouteData copyWith({
    String? id,
    String? title,
    String? vibe,
    String? blurb,
    int? totalPriceFrom,
    int? totalSavings,
    String? durationLabel,
    String? area,
    EveningGoal? goal,
    EveningMood? mood,
    EveningBudget? budget,
    bool? premium,
    String? recommendedFor,
    bool clearRecommendedFor = false,
    List<EveningRouteStep>? steps,
    int? hostsCount,
  }) {
    return EveningRouteData(
      id: id ?? this.id,
      title: title ?? this.title,
      vibe: vibe ?? this.vibe,
      blurb: blurb ?? this.blurb,
      totalPriceFrom: totalPriceFrom ?? this.totalPriceFrom,
      totalSavings: totalSavings ?? this.totalSavings,
      durationLabel: durationLabel ?? this.durationLabel,
      area: area ?? this.area,
      goal: goal ?? this.goal,
      mood: mood ?? this.mood,
      budget: budget ?? this.budget,
      premium: premium ?? this.premium,
      recommendedFor:
          clearRecommendedFor ? null : recommendedFor ?? this.recommendedFor,
      steps: steps ?? this.steps,
      hostsCount: hostsCount ?? this.hostsCount,
    );
  }
}

class EveningBuilderOptions {
  const EveningBuilderOptions({
    required this.goals,
    required this.moods,
    required this.budgets,
    required this.formats,
    required this.areas,
  });

  final List<EveningOption> goals;
  final List<EveningOption> moods;
  final List<EveningOption> budgets;
  final List<EveningOption> formats;
  final List<EveningOption> areas;

  factory EveningBuilderOptions.fromJson(Map<String, dynamic> json) {
    return EveningBuilderOptions(
      goals: eveningOptionsFromJson(json['goals'], eveningGoals),
      moods: eveningOptionsFromJson(json['moods'], eveningMoods),
      budgets: eveningOptionsFromJson(json['budgets'], eveningBudgets),
      formats: eveningOptionsFromJson(json['formats'], eveningFormats),
      areas: eveningOptionsFromJson(json['areas'], eveningAreas),
    );
  }
}

const eveningRoutes = <EveningRouteData>[
  EveningRouteData(
    id: 'r-cozy-circle',
    title: 'Тёплый круг на Покровке',
    vibe: 'Камерный вечер с новыми людьми',
    blurb: 'Аперитив, лёгкий стендап и долгий разговор в кофейне',
    totalPriceFrom: 1400,
    totalSavings: 650,
    durationLabel: '19:00 — 00:30',
    area: 'Чистые пруды → Покровка',
    goal: EveningGoal.newfriends,
    mood: EveningMood.chill,
    budget: EveningBudget.mid,
    recommendedFor: 'Для тех, кто впервые',
    hostsCount: 8,
    steps: [
      EveningRouteStep(
        id: 's1-1',
        time: '19:00',
        endTime: '20:15',
        kind: EveningStepKind.bar,
        title: 'Аперитив в Brix Wine',
        venue: 'Brix Wine',
        address: 'Покровка 12',
        emoji: '🍇',
        distance: '1.2 км',
        walkMin: 14,
        perk: '−15% на бокалы и бутылку для группы',
        perkShort: '−15%',
        partnerId: 'p-brix',
        vibeTag: 'Уютно',
        description: 'Знакомство за бокалом — без формальностей и спешки',
        lat: 0.42,
        lng: 0.38,
      ),
      EveningRouteStep(
        id: 's1-2',
        time: '20:30',
        endTime: '22:00',
        kind: EveningStepKind.show,
        title: 'Открытый микрофон Standup Store',
        venue: 'Standup Store',
        address: 'Бол. Дмитровка 32',
        emoji: '🎤',
        distance: '2.1 км',
        walkMin: 6,
        ticketPrice: 800,
        ticketCommission: 80,
        vibeTag: 'Смех',
        description: 'Молодые комики, короткие сеты, лёгкая атмосфера',
        lat: 0.55,
        lng: 0.32,
      ),
      EveningRouteStep(
        id: 's1-3',
        time: '22:30',
        endTime: '00:30',
        kind: EveningStepKind.afterparty,
        title: 'After-chat в Кафе Заря',
        venue: 'Кафе Заря',
        address: 'Хохловский пер. 7',
        emoji: '☕',
        distance: '0.9 км',
        walkMin: 9,
        perk: 'Второй кофе в подарок · стол держим до 01:00',
        perkShort: '1+1',
        partnerId: 'p-zarya',
        vibeTag: 'Тепло',
        description: 'Разбираем вечер, обмениваемся контактами',
        lat: 0.44,
        lng: 0.42,
      ),
      EveningRouteStep(
        id: 's1-4',
        time: 'Завтра',
        kind: EveningStepKind.followup,
        title: 'Follow-up с теми, кто понравился',
        venue: 'Frendly чат',
        address: 'В приложении',
        emoji: '💬',
        distance: '—',
        vibeTag: 'Связь',
        description:
            'Утром Frendly предложит написать тем, кто был на маршруте',
        lat: 0.5,
        lng: 0.5,
      ),
    ],
  ),
  EveningRouteData(
    id: 'r-date-noir',
    title: 'Свидание Noir',
    vibe: 'Вечер для двоих — кино и поздний бар',
    blurb: 'Камерный показ, прогулка и финал на крыше',
    totalPriceFrom: 2400,
    totalSavings: 900,
    durationLabel: '20:00 — 01:00',
    area: 'Парк Горького → Берсеневская',
    goal: EveningGoal.date,
    mood: EveningMood.date,
    budget: EveningBudget.high,
    premium: true,
    recommendedFor: 'Идеально для второго свидания',
    hostsCount: 3,
    steps: [
      EveningRouteStep(
        id: 's2-1',
        time: '20:00',
        endTime: '21:45',
        kind: EveningStepKind.show,
        title: 'Авторское кино в Garage Screen',
        venue: 'Garage Screen',
        address: 'Парк Горького',
        emoji: '🎬',
        distance: '3.5 км',
        walkMin: 12,
        ticketPrice: 600,
        ticketCommission: 60,
        perk: '−15% билет по коду Frendly',
        perkShort: '−15%',
        partnerId: 'p-kino',
        vibeTag: 'Кинематично',
        description: 'Авторский показ с обсуждением в фойе',
        lat: 0.32,
        lng: 0.62,
      ),
      EveningRouteStep(
        id: 's2-2',
        time: '22:00',
        endTime: '23:00',
        kind: EveningStepKind.dinner,
        title: 'Ужин в Tilda Bistro',
        venue: 'Tilda Bistro',
        address: 'Спиридоньевский 10А',
        emoji: '🍝',
        distance: '1.4 км',
        walkMin: 18,
        perk: 'Комплимент шефа на пару',
        perkShort: 'Комплимент',
        partnerId: 'p-tilda',
        sponsored: true,
        vibeTag: 'Гастро',
        description: 'Маленький бистро на двоих, тёплый свет',
        lat: 0.48,
        lng: 0.46,
      ),
      EveningRouteStep(
        id: 's2-3',
        time: '23:30',
        endTime: '01:00',
        kind: EveningStepKind.bar,
        title: 'Финал на крыше Стрелка',
        venue: 'Стрелка',
        address: 'Берсеневская наб. 14',
        emoji: '🍸',
        distance: '2.8 км',
        walkMin: 8,
        perk: 'Welcome-коктейль на пару',
        perkShort: 'Welcome',
        partnerId: 'p-strelka',
        vibeTag: 'Виды',
        description: 'Огни города, тихая музыка, поздний разговор',
        lat: 0.38,
        lng: 0.55,
      ),
    ],
  ),
  EveningRouteData(
    id: 'r-wild-night',
    title: 'Большой вечер в центре',
    vibe: 'Активная компания и танцы до утра',
    blurb: 'Бар → концерт → клуб с fast-track для группы',
    totalPriceFrom: 2800,
    totalSavings: 1200,
    durationLabel: '20:00 — 04:00',
    area: 'Тверская → Курская',
    goal: EveningGoal.company,
    mood: EveningMood.wild,
    budget: EveningBudget.high,
    hostsCount: 14,
    steps: [
      EveningRouteStep(
        id: 's3-1',
        time: '20:00',
        endTime: '21:30',
        kind: EveningStepKind.bar,
        title: 'Старт в Noor Bar',
        venue: 'Noor Bar',
        address: 'Тверская 23',
        emoji: '🥃',
        distance: '2.4 км',
        walkMin: 10,
        perk: '−10% на весь чек до 22:00',
        perkShort: '−10%',
        partnerId: 'p-noor',
        vibeTag: 'Старт',
        lat: 0.5,
        lng: 0.3,
      ),
      EveningRouteStep(
        id: 's3-2',
        time: '22:00',
        endTime: '23:30',
        kind: EveningStepKind.show,
        title: 'Концерт в Arma17',
        venue: 'Arma17',
        address: 'Нижний Сусальный 5',
        emoji: '🎧',
        distance: '3.2 км',
        walkMin: 14,
        ticketPrice: 1200,
        ticketCommission: 120,
        perk: '−20% early bird по промо',
        perkShort: '−20%',
        partnerId: 'p-arma',
        vibeTag: 'Лайв',
        lat: 0.62,
        lng: 0.4,
      ),
      EveningRouteStep(
        id: 's3-3',
        time: '00:00',
        endTime: '04:00',
        kind: EveningStepKind.afterparty,
        title: 'Afterparty в Mutabor',
        venue: 'Mutabor',
        address: 'Шарикоподшипниковская 13',
        emoji: '🪩',
        distance: '5.1 км',
        walkMin: 20,
        perk: 'Fast-track вход для группы 4+',
        perkShort: 'Fast-track',
        partnerId: 'p-mutabor',
        sponsored: true,
        vibeTag: 'Танцы',
        lat: 0.72,
        lng: 0.55,
      ),
    ],
  ),
  EveningRouteData(
    id: 'r-quiet-soul',
    title: 'Тихий вечер для себя',
    vibe: 'Отдых, баня и долгая прогулка',
    blurb: 'Wellness, лёгкий ужин и медленный финал',
    totalPriceFrom: 3200,
    totalSavings: 1100,
    durationLabel: '18:30 — 23:00',
    area: 'Цветной → Патриаршие',
    goal: EveningGoal.quiet,
    mood: EveningMood.chill,
    budget: EveningBudget.mid,
    premium: true,
    recommendedFor: 'Перезагрузиться после недели',
    hostsCount: 5,
    steps: [
      EveningRouteStep(
        id: 's4-1',
        time: '18:30',
        endTime: '20:00',
        kind: EveningStepKind.wellness,
        title: 'Парная сессия Esthetic Spa',
        venue: 'Esthetic Spa',
        address: 'Цветной бульвар 11',
        emoji: '💆',
        distance: '1.7 км',
        walkMin: 8,
        perk: '−25% на парный массаж',
        perkShort: '−25%',
        partnerId: 'p-spa',
        vibeTag: 'Тишина',
        lat: 0.46,
        lng: 0.34,
      ),
      EveningRouteStep(
        id: 's4-2',
        time: '20:30',
        endTime: '22:00',
        kind: EveningStepKind.dinner,
        title: 'Ужин на Патриках',
        venue: 'Tilda Bistro',
        address: 'Спиридоньевский 10А',
        emoji: '🍝',
        distance: '1.4 км',
        walkMin: 12,
        perk: 'Комплимент шефа',
        perkShort: 'Комплимент',
        partnerId: 'p-tilda',
        vibeTag: 'Гастро',
        lat: 0.48,
        lng: 0.46,
      ),
      EveningRouteStep(
        id: 's4-3',
        time: '22:30',
        endTime: '23:00',
        kind: EveningStepKind.afterparty,
        title: 'Прогулка вокруг прудов',
        venue: 'Патриаршие пруды',
        address: 'Малая Бронная',
        emoji: '🌙',
        distance: '0.4 км',
        walkMin: 5,
        vibeTag: 'Покой',
        lat: 0.5,
        lng: 0.5,
      ),
    ],
  ),
  EveningRouteData(
    id: 'r-afterdark',
    title: 'After Dark · приватный круг',
    vibe: '18+ закрытое событие и медленный финал',
    blurb: 'Закрытая сессия, бар-перформанс, утренний хаммам',
    totalPriceFrom: 4500,
    totalSavings: 1500,
    durationLabel: '22:00 — 06:00',
    area: 'Красный Октябрь → Неглинная',
    goal: EveningGoal.afterdark,
    mood: EveningMood.afterdark,
    budget: EveningBudget.high,
    premium: true,
    recommendedFor: 'Только Frendly+ и After Dark',
    hostsCount: 2,
    steps: [
      EveningRouteStep(
        id: 's5-1',
        time: '22:00',
        endTime: '23:30',
        kind: EveningStepKind.show,
        title: 'Закрытая сессия 18+',
        venue: 'Скрыто до подтверждения',
        address: 'Адрес откроется за 4 ч',
        emoji: '🕯️',
        distance: '—',
        vibeTag: 'Приватно',
        lat: 0.4,
        lng: 0.6,
      ),
      EveningRouteStep(
        id: 's5-2',
        time: '00:00',
        endTime: '02:30',
        kind: EveningStepKind.bar,
        title: 'Бар-перформанс Стрелка Late',
        venue: 'Стрелка',
        address: 'Берсеневская наб. 14',
        emoji: '🍸',
        distance: '2.8 км',
        perk: 'Welcome-коктейль для пары',
        perkShort: 'Welcome',
        partnerId: 'p-strelka',
        vibeTag: 'Атмосфера',
        lat: 0.38,
        lng: 0.55,
      ),
      EveningRouteStep(
        id: 's5-3',
        time: '04:00',
        endTime: '06:00',
        kind: EveningStepKind.wellness,
        title: 'Утренний хаммам',
        venue: 'Сандуны Lab',
        address: 'Неглинная 14',
        emoji: '🧖',
        distance: '2.0 км',
        perk: 'Парение в подарок',
        perkShort: 'В подарок',
        partnerId: 'p-banya',
        vibeTag: 'Перезагрузка',
        lat: 0.5,
        lng: 0.4,
      ),
    ],
  ),
];

const eveningMoods = <EveningOption>[
  EveningOption(
    key: 'chill',
    emoji: '🌿',
    label: 'Спокойно',
    blurb: 'Уютно, без шума',
  ),
  EveningOption(
    key: 'social',
    emoji: '✨',
    label: 'Знакомства',
    blurb: 'Хочу новых людей',
  ),
  EveningOption(
    key: 'date',
    emoji: '🌹',
    label: 'Свидание',
    blurb: 'Камерно для двоих',
  ),
  EveningOption(
    key: 'wild',
    emoji: '🔥',
    label: 'Огонь',
    blurb: 'Танцы и драйв',
  ),
  EveningOption(
    key: 'afterdark',
    emoji: '🌙',
    label: 'After Dark',
    blurb: '18+ и приватно',
  ),
];

const eveningBudgets = <EveningOption>[
  EveningOption(key: 'free', label: 'Бесплатно', blurb: 'до 500 ₽'),
  EveningOption(key: 'low', label: 'Лайт', blurb: '500–1500 ₽'),
  EveningOption(key: 'mid', label: 'Средне', blurb: '1500–3000 ₽'),
  EveningOption(key: 'high', label: 'Не считаю', blurb: '3000+ ₽'),
];

const eveningFormats = <EveningOption>[
  EveningOption(key: 'bar', emoji: '🍷', label: 'Бары и вино'),
  EveningOption(key: 'show', emoji: '🎤', label: 'Стендап / концерт'),
  EveningOption(key: 'active', emoji: '🏃', label: 'Активно'),
  EveningOption(key: 'culture', emoji: '🎨', label: 'Культура'),
  EveningOption(key: 'mixed', emoji: '🎲', label: 'Смешать всё'),
];

const eveningGoals = <EveningOption>[
  EveningOption(
    key: 'newfriends',
    emoji: '👋',
    label: 'Новые друзья',
    blurb: 'Маршрут с группой',
  ),
  EveningOption(
    key: 'date',
    emoji: '💞',
    label: 'Свидание',
    blurb: 'Для двоих',
  ),
  EveningOption(
    key: 'company',
    emoji: '🥂',
    label: 'С моей компанией',
    blurb: 'С друзьями',
  ),
  EveningOption(
    key: 'quiet',
    emoji: '🌙',
    label: 'Тихий вечер',
    blurb: 'Сам(а) с собой',
  ),
  EveningOption(
    key: 'afterdark',
    emoji: '🔮',
    label: 'After Dark',
    blurb: '18+ закрытое',
  ),
];

const eveningAreas = <EveningOption>[
  EveningOption(key: 'center', emoji: '🏛️', label: 'Центр'),
  EveningOption(key: 'patriki', emoji: '🦢', label: 'Патриаршие'),
  EveningOption(key: 'chistye', emoji: '🌳', label: 'Чистые пруды'),
  EveningOption(key: 'gorky', emoji: '🎡', label: 'Парк Горького'),
  EveningOption(key: 'kursk', emoji: '🚉', label: 'Курская'),
  EveningOption(key: 'any', emoji: '🗺️', label: 'Не важно'),
];

List<EveningOption> eveningOptionsFromJson(
  Object? value,
  List<EveningOption> fallback,
) {
  final parsed = ((value as List?) ?? const [])
      .whereType<Map>()
      .map((item) => EveningOption(
            key: item['key'] as String? ?? '',
            emoji: item['emoji'] as String?,
            label: item['label'] as String? ?? '',
            blurb: item['blurb'] as String? ?? item['range'] as String?,
          ))
      .where((item) => item.key.isNotEmpty && item.label.isNotEmpty)
      .toList(growable: false);
  return parsed.isEmpty ? fallback : parsed;
}

String eveningKindLabel(EveningStepKind kind) {
  switch (kind) {
    case EveningStepKind.bar:
      return 'Бар';
    case EveningStepKind.show:
      return 'Шоу';
    case EveningStepKind.afterparty:
      return 'Финал';
    case EveningStepKind.followup:
      return 'Утро';
    case EveningStepKind.dinner:
      return 'Ужин';
    case EveningStepKind.wellness:
      return 'Wellness';
    case EveningStepKind.active:
      return 'Актив';
  }
}

EveningRouteData findEveningRoute(String? id) {
  return eveningRoutes.firstWhere(
    (route) => route.id == id,
    orElse: () => eveningRoutes.first,
  );
}

EveningRouteData eveningRouteFromJson(
  Map<String, dynamic> json, {
  EveningRouteData? fallback,
}) {
  final base = fallback ?? eveningRoutes.first;
  final steps = ((json['steps'] as List?) ?? const [])
      .whereType<Map>()
      .map((item) => eveningRouteStepFromJson(
            Map<String, dynamic>.from(item),
            fallback: base.steps.isEmpty ? null : base.steps.first,
          ))
      .toList(growable: false);

  return EveningRouteData(
    id: json['id'] as String? ?? base.id,
    title: json['title'] as String? ?? base.title,
    vibe: json['vibe'] as String? ?? base.vibe,
    blurb: json['blurb'] as String? ?? base.blurb,
    totalPriceFrom:
        (json['totalPriceFrom'] as num?)?.toInt() ?? base.totalPriceFrom,
    totalSavings: (json['totalSavings'] as num?)?.toInt() ?? base.totalSavings,
    durationLabel: json['durationLabel'] as String? ?? base.durationLabel,
    area: json['area'] as String? ?? base.area,
    goal: eveningGoalFromKey(json['goal'] as String?) ?? base.goal,
    mood: eveningMoodFromKey(json['mood'] as String?) ?? base.mood,
    budget: eveningBudgetFromKey(json['budget'] as String?) ?? base.budget,
    premium: json['premium'] as bool? ?? base.premium,
    recommendedFor: json['recommendedFor'] as String? ?? base.recommendedFor,
    hostsCount: (json['hostsCount'] as num?)?.toInt() ?? base.hostsCount,
    steps: steps.isEmpty ? base.steps : steps,
  );
}

EveningRouteStep eveningRouteStepFromJson(
  Map<String, dynamic> json, {
  EveningRouteStep? fallback,
}) {
  return EveningRouteStep(
    id: json['id'] as String? ?? fallback?.id ?? '',
    time: json['time'] as String? ??
        json['timeLabel'] as String? ??
        fallback?.time ??
        '',
    endTime: json['endTime'] as String? ??
        json['endTimeLabel'] as String? ??
        fallback?.endTime,
    kind: eveningStepKindFromKey(json['kind'] as String?) ??
        fallback?.kind ??
        EveningStepKind.bar,
    title: json['title'] as String? ?? fallback?.title ?? '',
    venue: json['venue'] as String? ?? fallback?.venue ?? '',
    address: json['address'] as String? ?? fallback?.address ?? '',
    emoji: json['emoji'] as String? ?? fallback?.emoji ?? '✨',
    distance: json['distance'] as String? ??
        json['distanceLabel'] as String? ??
        fallback?.distance ??
        '',
    walkMin: (json['walkMin'] as num?)?.toInt() ?? fallback?.walkMin,
    perk: json['perk'] as String? ?? fallback?.perk,
    perkShort: json['perkShort'] as String? ?? fallback?.perkShort,
    ticketPrice:
        (json['ticketPrice'] as num?)?.toInt() ?? fallback?.ticketPrice,
    ticketCommission: (json['ticketCommission'] as num?)?.toInt() ??
        fallback?.ticketCommission,
    sponsored: json['sponsored'] as bool? ?? fallback?.sponsored ?? false,
    premium: json['premium'] as bool? ?? fallback?.premium ?? false,
    partnerId: json['partnerId'] as String? ?? fallback?.partnerId,
    venueId: json['venueId'] as String? ?? fallback?.venueId,
    partnerOfferId:
        json['partnerOfferId'] as String? ?? fallback?.partnerOfferId,
    offerTitle: json['offerTitle'] as String? ?? fallback?.offerTitle,
    offerDescription:
        json['offerDescription'] as String? ?? fallback?.offerDescription,
    offerTerms: json['offerTerms'] as String? ?? fallback?.offerTerms,
    offerShortLabel:
        json['offerShortLabel'] as String? ?? fallback?.offerShortLabel,
    description: json['description'] as String? ?? fallback?.description,
    vibeTag: json['vibeTag'] as String? ?? fallback?.vibeTag,
    lat: (json['lat'] as num?)?.toDouble() ?? fallback?.lat ?? 0.5,
    lng: (json['lng'] as num?)?.toDouble() ?? fallback?.lng ?? 0.5,
  );
}

EveningGoal? eveningGoalFromKey(String? key) {
  switch (key) {
    case 'newfriends':
      return EveningGoal.newfriends;
    case 'date':
      return EveningGoal.date;
    case 'company':
      return EveningGoal.company;
    case 'quiet':
      return EveningGoal.quiet;
    case 'afterdark':
      return EveningGoal.afterdark;
    default:
      return null;
  }
}

EveningMood? eveningMoodFromKey(String? key) {
  switch (key) {
    case 'chill':
      return EveningMood.chill;
    case 'social':
      return EveningMood.social;
    case 'date':
      return EveningMood.date;
    case 'wild':
      return EveningMood.wild;
    case 'afterdark':
      return EveningMood.afterdark;
    default:
      return null;
  }
}

EveningBudget? eveningBudgetFromKey(String? key) {
  switch (key) {
    case 'free':
      return EveningBudget.free;
    case 'low':
      return EveningBudget.low;
    case 'mid':
      return EveningBudget.mid;
    case 'high':
      return EveningBudget.high;
    default:
      return null;
  }
}

EveningFormat? eveningFormatFromKey(String? key) {
  switch (key) {
    case 'bar':
      return EveningFormat.bar;
    case 'show':
      return EveningFormat.show;
    case 'active':
      return EveningFormat.active;
    case 'culture':
      return EveningFormat.culture;
    case 'mixed':
      return EveningFormat.mixed;
    default:
      return null;
  }
}

EveningStepKind? eveningStepKindFromKey(String? key) {
  switch (key) {
    case 'bar':
      return EveningStepKind.bar;
    case 'show':
      return EveningStepKind.show;
    case 'afterparty':
      return EveningStepKind.afterparty;
    case 'followup':
      return EveningStepKind.followup;
    case 'dinner':
      return EveningStepKind.dinner;
    case 'wellness':
      return EveningStepKind.wellness;
    case 'active':
      return EveningStepKind.active;
    default:
      return null;
  }
}

EveningRouteData matchEveningRoute({
  EveningGoal? goal,
  EveningMood? mood,
  EveningBudget? budget,
  EveningFormat? format,
  String? area,
}) {
  for (final route in eveningRoutes) {
    if (route.goal == goal) {
      return route;
    }
  }

  for (final route in eveningRoutes) {
    if (route.mood == mood) {
      return route;
    }
  }

  for (final route in eveningRoutes) {
    if (route.budget == budget) {
      return route;
    }
  }

  if (format != null || area != null) {
    return eveningRoutes.first;
  }

  return eveningRoutes.first;
}
