export const seededUsers: Array<{
  id: string;
  displayName: string;
  verified: boolean;
  online: boolean;
  age: number;
  city: string;
  area: string;
  bio: string;
  vibe: string;
  rating: number;
  meetupCount: number;
  avatarUrl: string;
  intent: string;
  interests: string[];
}> = [
  {
    id: 'user-me',
    displayName: 'Илья В',
    verified: true,
    online: true,
    age: 29,
    city: 'Москва',
    area: 'Чистые пруды',
    bio: 'Люблю тихие бары, короткие прогулки и быстрые планы на вечер.',
    vibe: 'Спокойно',
    rating: 4.8,
    meetupCount: 14,
    avatarUrl: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Ilya',
    intent: 'both',
    interests: ['Кофе', 'Кино', 'Бары', 'Прогулки'],
  },
  {
    id: 'user-anya',
    displayName: 'Анна Л',
    verified: true,
    online: true,
    age: 27,
    city: 'Москва',
    area: 'Покровка',
    bio: 'Собираю людей на камерные вечера, вино и долгие разговоры.',
    vibe: 'Уютно',
    rating: 4.9,
    meetupCount: 21,
    avatarUrl: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Anna',
    intent: 'dating',
    interests: ['Вино', 'Кино', 'Настолки', 'Кофе'],
  },
  {
    id: 'user-mark',
    displayName: 'Марк Д',
    verified: false,
    online: false,
    age: 31,
    city: 'Москва',
    area: 'Белорусская',
    bio: 'Бег, кино, шумные ужины и спонтанные планы после работы.',
    vibe: 'Активно',
    rating: 4.4,
    meetupCount: 9,
    avatarUrl: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Mark',
    intent: 'friendship',
    interests: ['Бег', 'Кино', 'Бары', 'Велик'],
  },
  {
    id: 'user-sonya',
    displayName: 'Соня Р',
    verified: true,
    online: true,
    age: 26,
    city: 'Москва',
    area: 'Замоскворечье',
    bio: 'Люблю настолки, театр, длинные прогулки и уютные ужины в центре.',
    vibe: 'Спокойно',
    rating: 4.7,
    meetupCount: 11,
    avatarUrl: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Sonya',
    intent: 'both',
    interests: ['Театр', 'Настолки', 'Кофе', 'Прогулки'],
  },
];

export const seededEvents: Array<{
  id: string;
  title: string;
  emoji: string;
  startsAt: Date;
  durationMinutes: number;
  place: string;
  distanceKm: number;
  vibe: string;
  tone: 'warm' | 'evening' | 'sage';
  joinMode?: 'open' | 'request';
  lifestyle?: 'zozh' | 'neutral' | 'anti';
  priceMode?: 'free' | 'fixed' | 'from' | 'upto' | 'range' | 'split';
  priceAmountFrom?: number | null;
  priceAmountTo?: number | null;
  accessMode?: 'open' | 'request' | 'free';
  genderMode?: 'all' | 'male' | 'female';
  visibilityMode?: 'public' | 'friends';
  hostNote?: string;
  description: string;
  partnerName?: string;
  partnerOffer?: string;
  capacity: number;
  isCalm: boolean;
  isNewcomers: boolean;
  isDate: boolean;
  hostId: string;
}> = [
  {
    id: 'e1',
    title: 'Винный вечер на крыше',
    emoji: '🍷',
    startsAt: new Date('2026-04-19T20:00:00.000Z'),
    durationMinutes: 120,
    place: 'Brix Wine, Покровка 12',
    distanceKm: 1.2,
    vibe: 'Спокойно',
    tone: 'evening',
    joinMode: 'open',
    lifestyle: 'anti',
    priceMode: 'range',
    priceAmountFrom: 1800,
    priceAmountTo: 2800,
    accessMode: 'open',
    genderMode: 'all',
    visibilityMode: 'public',
    hostNote: 'Знакомимся за бокалом, без спешки.',
    description: 'Камерный вечер на крыше с вином и спокойным разговором.',
    partnerName: 'Brix Wine',
    partnerOffer: '−15% на бокалы для участников',
    capacity: 8,
    isCalm: true,
    isNewcomers: true,
    isDate: true,
    hostId: 'user-anya',
  },
  {
    id: 'e2',
    title: 'Вечерняя пробежка по бульварам',
    emoji: '🌿',
    startsAt: new Date('2026-04-20T19:30:00.000Z'),
    durationMinutes: 90,
    place: 'Чистые пруды',
    distanceKm: 0.6,
    vibe: 'Активно',
    tone: 'sage',
    joinMode: 'open',
    lifestyle: 'zozh',
    priceMode: 'free',
    accessMode: 'free',
    genderMode: 'all',
    visibilityMode: 'public',
    description: 'Легкая пробежка без гонки и с остановкой на кофе после финиша.',
    capacity: 6,
    isCalm: false,
    isNewcomers: true,
    isDate: false,
    hostId: 'user-mark',
  },
  {
    id: 'e3',
    title: 'Настолки и кофе',
    emoji: '♟️',
    startsAt: new Date('2026-04-20T19:00:00.000Z'),
    durationMinutes: 180,
    place: 'Кафе Заря, Хохловский',
    distanceKm: 0.9,
    vibe: 'Уютно',
    tone: 'warm',
    joinMode: 'open',
    lifestyle: 'neutral',
    priceMode: 'upto',
    priceAmountTo: 900,
    accessMode: 'open',
    genderMode: 'all',
    visibilityMode: 'public',
    description: 'Небольшая компания, кофе и настолки до закрытия.',
    capacity: 8,
    isCalm: true,
    isNewcomers: true,
    isDate: false,
    hostId: 'user-sonya',
  },
  {
    id: 'e4',
    title: 'Кино под открытым небом',
    emoji: '🎬',
    startsAt: new Date('2026-04-21T21:00:00.000Z'),
    durationMinutes: 150,
    place: 'Парк Горького',
    distanceKm: 3.4,
    vibe: 'Свидание',
    tone: 'evening',
    joinMode: 'open',
    lifestyle: 'neutral',
    priceMode: 'from',
    priceAmountFrom: 3500,
    accessMode: 'free',
    genderMode: 'all',
    visibilityMode: 'public',
    description: 'Летний киносеанс под открытым небом и короткая прогулка после фильма.',
    capacity: 10,
    isCalm: true,
    isNewcomers: false,
    isDate: true,
    hostId: 'user-mark',
  },
  {
    id: 'e5',
    title: 'Камерный ужин по заявкам',
    emoji: '🍝',
    startsAt: new Date('2026-04-20T18:30:00.000Z'),
    durationMinutes: 150,
    place: 'Солянка 5',
    distanceKm: 0.7,
    vibe: 'Уютно',
    tone: 'warm',
    joinMode: 'request',
    lifestyle: 'neutral',
    priceMode: 'range',
    priceAmountFrom: 1200,
    priceAmountTo: 2200,
    accessMode: 'request',
    genderMode: 'all',
    visibilityMode: 'friends',
    hostNote: 'Хочу собрать маленькую спокойную компанию.',
    description: 'Ужин в маленькой компании. Сначала заявка, потом подтверждение хостом.',
    capacity: 5,
    isCalm: true,
    isNewcomers: true,
    isDate: false,
    hostId: 'user-me',
  },
];
