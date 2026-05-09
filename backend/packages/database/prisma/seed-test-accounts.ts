import { Prisma, PrismaClient, UserGender } from '@prisma/client';
import {
  TEST_ACCOUNT_PHONE_NUMBERS,
  buildSeededTestAccountIds,
} from '../src/test-accounts';

type Gender = 'male' | 'female';

type TestPhotoDraft = {
  id: string;
  photoId: string;
  objectKey: string;
  publicUrl: string;
  gender: Gender;
  sortOrder: number;
  byteSize: number;
};

type TestEventDraft = {
  id: string;
  chatId: string;
  title: string;
  emoji: string;
  startsAt: Date;
  moscowDayOffset: number;
  city: 'Москва';
  area: string;
  place: string;
  latitude: number;
  longitude: number;
  vibe: string;
  joinMode: 'open' | 'request';
  lifestyle: 'zozh' | 'neutral' | 'anti';
  priceMode:
    | 'free'
    | 'fixed'
    | 'split'
    | 'host_pays'
    | 'fifty_fifty';
  priceAmountFrom: number | null;
  priceAmountTo: number | null;
  accessMode: 'open' | 'request' | 'free';
  genderMode: 'all' | 'male' | 'female';
  visibilityMode: 'public' | 'friends';
  capacity: number;
  description: string;
};

type TestClubDraft = {
  id: string;
  chatId: string;
  ownerUserId: string;
  name: string;
  avatar: string;
  description: string;
  tags: string[];
  mood: string;
};

type TestAccountDraft = {
  id: string;
  digit: number;
  phoneNumber: string;
  displayName: string;
  gender: Gender;
  city: 'Москва';
  area: string;
  latitude: number;
  longitude: number;
  birthDate: Date;
  bio: string;
  vibe: string;
  interests: string[];
  photos: TestPhotoDraft[];
  subscription: {
    id: string;
    plan: 'month' | 'year';
    status: 'active';
    startedAt: Date;
    renewsAt: Date;
  };
  events: TestEventDraft[];
  clubs: TestClubDraft[];
};

type TestAccountsSeedPlan = {
  accounts: TestAccountDraft[];
};

const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TEST_MEDIA_PREFIX = 'test-accounts/';
const SEEDED_EVENT_PREFIX = 'test-event-';
const SEEDED_EVENT_CHAT_PREFIX = 'test-event-chat-';
const SEEDED_COMMUNITY_PREFIX = 'test-community-';
const SEEDED_COMMUNITY_CHAT_PREFIX = 'test-community-chat-';

const AREAS = [
  { name: 'Арбат', place: 'Никитский бульвар', lat: 55.7521, lng: 37.599 },
  { name: 'Патриаршие', place: 'Патриаршие пруды', lat: 55.7638, lng: 37.5929 },
  { name: 'Китай-город', place: 'Маросейка', lat: 55.7572, lng: 37.6355 },
  { name: 'Замоскворечье', place: 'Большая Ордынка', lat: 55.7391, lng: 37.6271 },
  { name: 'Хамовники', place: 'Парк Горького', lat: 55.7298, lng: 37.6019 },
  { name: 'Басманный', place: 'Чистые пруды', lat: 55.7646, lng: 37.6387 },
  { name: 'Тверской', place: 'Столешников переулок', lat: 55.7636, lng: 37.6146 },
  { name: 'Пресненский', place: 'Трехгорная мануфактура', lat: 55.7588, lng: 37.5588 },
  { name: 'Даниловский', place: 'Даниловский рынок', lat: 55.7117, lng: 37.6222 },
  { name: 'Сокольники', place: 'Парк Сокольники', lat: 55.7941, lng: 37.6761 },
] as const;

const MALE_NAMES = ['Илья', 'Марк', 'Дима', 'Антон', 'Олег'];
const FEMALE_NAMES = ['Аня', 'Лиза', 'Соня', 'Маша', 'Вика'];
const VIBES = ['Уютно', 'Активно', 'Свидание', 'Культурно', 'Спокойно'];
const EVENT_EMOJIS = ['☕', '🎧', '🎲', '🍝', '🚶', '🎬'];
const EVENT_TITLES = [
  'Кофе и короткая прогулка',
  'Вечерний разговор без спешки',
  'Настолки и новые люди',
  'Ужин маленькой компанией',
  'Прогулка по району',
  'Кино и обсуждение после',
];

export function buildTestAccountsSeedPlan(now = new Date()): TestAccountsSeedPlan {
  const accountIds = buildSeededTestAccountIds();
  const moscowDayStart = startOfMoscowDayUtc(now);

  return {
    accounts: TEST_ACCOUNT_PHONE_NUMBERS.map((phoneNumber, index) => {
      const digit = index;
      const suffix = phoneNumber.slice(2);
      const gender: Gender = index < 5 ? 'male' : 'female';
      const area = AREAS[index]!;
      const displayName =
        gender === 'male'
          ? `${MALE_NAMES[index]} Тест`
          : `${FEMALE_NAMES[index - 5]} Тест`;
      const userId = accountIds[index]!;

      return {
        id: userId,
        digit,
        phoneNumber,
        displayName,
        gender,
        city: 'Москва',
        area: area.name,
        latitude: area.lat,
        longitude: area.lng,
        birthDate: new Date(Date.UTC(1993 + (index % 8), index % 12, 10 + index)),
        bio: `Тестовый профиль для проверки встреч, клубов и френдли подписки. Район: ${area.name}.`,
        vibe: VIBES[index % VIBES.length]!,
        interests: buildInterests(index),
        photos: [0, 1].map((photoIndex) =>
          buildPhotoDraft({
            userId,
            suffix,
            gender,
            displayName,
            area: area.name,
            photoIndex,
          }),
        ),
        subscription: {
          id: `test-subscription-${suffix}`,
          plan: index % 2 === 0 ? 'month' : 'year',
          status: 'active',
          startedAt: new Date(moscowDayStart.getTime() - DAY_MS),
          renewsAt: new Date(moscowDayStart.getTime() + 45 * DAY_MS + index * DAY_MS),
        },
        events: [0, 1, 2].map((dayOffset) =>
          buildEventDraft({
            userId,
            suffix,
            digit,
            dayOffset,
            accountIndex: index,
            moscowDayStart,
            area,
          }),
        ),
        clubs: [0, 3, 6].includes(index)
          ? [
              {
                id: `${SEEDED_COMMUNITY_PREFIX}${suffix}`,
                chatId: `${SEEDED_COMMUNITY_CHAT_PREFIX}${suffix}`,
                ownerUserId: userId,
                name: `${area.name}: свои`,
                avatar: gender === 'male' ? '🟢' : '🟣',
                description: `Клуб тестовых встреч в районе ${area.name}.`,
                tags: [area.name, 'Москва', 'тест'],
                mood: VIBES[index % VIBES.length]!,
              },
            ]
          : [],
      };
    }),
  };
}

export async function seedTestAccounts(
  prisma: PrismaClient,
  now = new Date(),
) {
  const deleted = await deleteTestAccounts(prisma);
  const plan = buildTestAccountsSeedPlan(now);

  await prisma.$transaction(async (tx) => {
    for (const account of plan.accounts) {
      await tx.user.create({
        data: {
          id: account.id,
          displayName: account.displayName,
          phoneNumber: account.phoneNumber,
          verified: true,
          online: false,
          profile: {
            create: {
              birthDate: account.birthDate,
              gender: account.gender as UserGender,
              city: account.city,
              area: account.area,
              bio: account.bio,
              vibe: account.vibe,
              rating: 4.6 + account.digit / 100,
              meetupCount: account.events.length,
            },
          },
          onboarding: {
            create: {
              intent: 'meetups',
              gender: account.gender as UserGender,
              birthDate: account.birthDate,
              city: account.city,
              area: account.area,
              interests: account.interests,
              vibe: account.vibe,
            },
          },
          settings: {
            create: {
              allowLocation: true,
              allowPush: true,
              allowContacts: false,
              autoSharePlans: true,
              hideExactLocation: false,
              quietHours: false,
              showAge: true,
              discoverable: true,
              darkMode: false,
            },
          },
          verification: {
            create: {
              status: 'verified',
              selfieDone: true,
              documentDone: true,
              reviewedAt: now,
            },
          },
        },
      });

      for (const photo of account.photos) {
        await tx.mediaAsset.create({
          data: {
            id: photo.id,
            ownerId: account.id,
            kind: 'avatar',
            status: 'ready',
            bucket: 'seeded',
            objectKey: photo.objectKey,
            mimeType: 'image/svg+xml',
            byteSize: photo.byteSize,
            originalFileName: `${photo.id}.svg`,
            publicUrl: photo.publicUrl,
            variants: buildMediaVariants(photo.publicUrl, photo.id),
          },
        });

        await tx.profilePhoto.create({
          data: {
            id: photo.photoId,
            profileUserId: account.id,
            mediaAssetId: photo.id,
            sortOrder: photo.sortOrder,
          },
        });
      }

      await tx.profile.update({
        where: { userId: account.id },
        data: {
          avatarAssetId: account.photos[0]!.id,
          avatarUrl: `/media/${account.photos[0]!.id}`,
        },
      });

      await tx.userSubscription.create({
        data: {
          id: account.subscription.id,
          userId: account.id,
          plan: account.subscription.plan,
          status: account.subscription.status,
          startedAt: account.subscription.startedAt,
          renewsAt: account.subscription.renewsAt,
        },
      });

      for (const event of account.events) {
        await tx.event.create({
          data: {
            id: event.id,
            title: event.title,
            emoji: event.emoji,
            startsAt: event.startsAt,
            durationMinutes: 120 + event.moscowDayOffset * 30,
            place: event.place,
            distanceKm: 1.2 + event.moscowDayOffset,
            latitude: event.latitude,
            longitude: event.longitude,
            vibe: event.vibe,
            tone: event.vibe === 'Свидание' ? 'evening' : 'warm',
            joinMode: event.joinMode,
            lifestyle: event.lifestyle,
            priceMode: event.priceMode,
            priceAmountFrom: event.priceAmountFrom,
            priceAmountTo: event.priceAmountTo,
            accessMode: event.accessMode,
            genderMode: event.genderMode,
            visibilityMode: event.visibilityMode,
            description: event.description,
            capacity: event.capacity,
            hostId: account.id,
            isCalm: event.vibe === 'Спокойно' || event.vibe === 'Уютно',
            isNewcomers: event.moscowDayOffset === 0,
            isDate: event.vibe === 'Свидание',
            rules: Prisma.JsonNull,
          },
        });

        await tx.chat.create({
          data: {
            id: event.chatId,
            kind: 'meetup',
            origin: 'meetup',
            title: event.title,
            emoji: event.emoji,
            eventId: event.id,
            meetupStartsAt: event.startsAt,
            meetupEndsAt: new Date(event.startsAt.getTime() + 120 * 60 * 1000),
          },
        });

        await tx.eventParticipant.create({
          data: {
            eventId: event.id,
            userId: account.id,
          },
        });

        await tx.eventAttendance.create({
          data: {
            eventId: event.id,
            userId: account.id,
            status: 'not_checked_in',
          },
        });

        await tx.eventLiveState.create({
          data: {
            eventId: event.id,
            status: 'idle',
          },
        });

        await tx.chatMember.create({
          data: {
            chatId: event.chatId,
            userId: account.id,
          },
        });
      }

      for (const club of account.clubs) {
        await tx.chat.create({
          data: {
            id: club.chatId,
            kind: 'community',
            origin: 'community',
            title: club.name,
            emoji: club.avatar,
          },
        });

        await tx.community.create({
          data: {
            id: club.id,
            name: club.name,
            avatar: club.avatar,
            description: club.description,
            privacy: 'public',
            tags: club.tags,
            joinRule: 'Вступление открыто для тестовых аккаунтов.',
            premiumOnly: false,
            mood: club.mood,
            sharedMediaLabel: 'Фото клуба',
            createdById: club.ownerUserId,
            chatId: club.chatId,
            idempotencyKey: club.id,
            members: {
              create: {
                userId: club.ownerUserId,
                role: 'owner',
              },
            },
            news: {
              create: {
                title: 'Тестовый клуб открыт',
                blurb: 'Можно проверять клубную карточку и чат.',
                timeLabel: 'сегодня',
                sortOrder: 0,
              },
            },
            media: {
              create: {
                emoji: '📷',
                label: '2 тестовых фото',
                kind: 'photo',
                sortOrder: 0,
              },
            },
          },
        });
      }
    }
  });

  return {
    deleted,
    createdUsers: plan.accounts.length,
    createdEvents: plan.accounts.reduce(
      (count, account) => count + account.events.length,
      0,
    ),
    createdCommunities: plan.accounts.reduce(
      (count, account) => count + account.clubs.length,
      0,
    ),
    phoneNumbers: plan.accounts.map((account) => account.phoneNumber),
  };
}

export async function deleteTestAccounts(prisma: PrismaClient) {
  const seededUserIds = buildSeededTestAccountIds();
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: seededUserIds } },
        { phoneNumber: { in: [...TEST_ACCOUNT_PHONE_NUMBERS] } },
      ],
    },
    select: {
      id: true,
      phoneNumber: true,
      displayName: true,
    },
  });
  const userIds = users.map((user) => user.id);

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { id: { startsWith: SEEDED_EVENT_PREFIX } },
        ...whenNonEmpty(userIds, (ids) => [{ hostId: { in: ids } }]),
      ],
    },
    select: { id: true },
  });
  const eventIds = events.map((event) => event.id);

  const chats = await prisma.chat.findMany({
    where: {
      OR: [
        { id: { startsWith: SEEDED_EVENT_CHAT_PREFIX } },
        { id: { startsWith: SEEDED_COMMUNITY_CHAT_PREFIX } },
        ...whenNonEmpty(eventIds, (ids) => [
          { eventId: { in: ids } },
          { sourceEventId: { in: ids } },
        ]),
        ...whenNonEmpty(userIds, (ids) => [
          {
            members: {
              some: {
                userId: { in: ids },
              },
            },
          },
        ]),
      ],
    },
    select: { id: true },
  });
  const chatIds = chats.map((chat) => chat.id);

  const result: Record<string, number> = {};
  const collect = async (key: string, action: Promise<{ count: number }>) => {
    result[key] = (await action).count;
  };
  const notificationFilters: Prisma.NotificationWhereInput[] = [
    ...whenNonEmpty(userIds, (ids) => [
      { userId: { in: ids } },
      { actorUserId: { in: ids } },
    ]),
    ...whenNonEmpty(chatIds, (ids) => [{ chatId: { in: ids } }]),
    ...whenNonEmpty(eventIds, (ids) => [{ eventId: { in: ids } }]),
  ];

  await collect(
    'realtimeEvents',
    prisma.realtimeEvent.deleteMany({
      where:
        chatIds.length > 0
          ? { chatId: { in: chatIds } }
          : { chatId: '__none__' },
    }),
  );
  await collect(
    'notifications',
    prisma.notification.deleteMany({
      where:
        notificationFilters.length > 0
          ? { OR: notificationFilters }
          : { id: '__none__' },
    }),
  );
  await collect(
    'communities',
    prisma.community.deleteMany({
      where: {
        OR: [
          { id: { startsWith: SEEDED_COMMUNITY_PREFIX } },
          ...whenNonEmpty(userIds, (ids) => [{ createdById: { in: ids } }]),
        ],
      },
    }),
  );
  await collect(
    'chats',
    prisma.chat.deleteMany({
      where: chatIds.length > 0 ? { id: { in: chatIds } } : { id: '__none__' },
    }),
  );
  await collect(
    'events',
    prisma.event.deleteMany({
      where: {
        OR: [
          { id: { startsWith: SEEDED_EVENT_PREFIX } },
          ...whenNonEmpty(userIds, (ids) => [{ hostId: { in: ids } }]),
        ],
      },
    }),
  );

  if (userIds.length > 0) {
    await prisma.profile.updateMany({
      where: { userId: { in: userIds } },
      data: {
        avatarAssetId: null,
        avatarUrl: null,
      },
    });
  }

  await collect(
    'profilePhotos',
    prisma.profilePhoto.deleteMany({
      where:
        userIds.length > 0
          ? { profileUserId: { in: userIds } }
          : { id: '__none__' },
    }),
  );
  await collect(
    'mediaAssets',
    prisma.mediaAsset.deleteMany({
      where: {
        OR: [
          { objectKey: { startsWith: TEST_MEDIA_PREFIX } },
          ...whenNonEmpty(userIds, (ids) => [{ ownerId: { in: ids } }]),
        ],
      },
    }),
  );
  await collect(
    'telegramLoginSessions',
    prisma.telegramLoginSession.deleteMany({
      where: { phoneNumber: { in: [...TEST_ACCOUNT_PHONE_NUMBERS] } },
    }),
  );
  await collect(
    'phoneOtpChallenges',
    prisma.phoneOtpChallenge.deleteMany({
      where: {
        OR: [
          { phoneNumber: { in: [...TEST_ACCOUNT_PHONE_NUMBERS] } },
          ...whenNonEmpty(userIds, (ids) => [{ userId: { in: ids } }]),
        ],
      },
    }),
  );
  await collect(
    'authAuditEvents',
    prisma.authAuditEvent.deleteMany({
      where: userIds.length > 0 ? { userId: { in: userIds } } : { id: '__none__' },
    }),
  );
  await collect(
    'sessions',
    prisma.session.deleteMany({
      where: userIds.length > 0 ? { userId: { in: userIds } } : { id: '__none__' },
    }),
  );
  await collect(
    'subscriptions',
    prisma.userSubscription.deleteMany({
      where: userIds.length > 0 ? { userId: { in: userIds } } : { id: '__none__' },
    }),
  );
  await collect(
    'users',
    prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: seededUserIds } },
          { phoneNumber: { in: [...TEST_ACCOUNT_PHONE_NUMBERS] } },
        ],
      },
    }),
  );

  return {
    ...result,
    deletedUsers: users,
    deletedHostedEventCount: eventIds.length,
    deletedChatCount: chatIds.length,
  };
}

function buildInterests(index: number) {
  const base = ['кофе', 'прогулки', 'новые люди', 'Москва'];
  const extra = ['кино', 'музыка', 'еда', 'спорт', 'выставки'];
  return [...base, extra[index % extra.length]!];
}

function buildEventDraft(input: {
  userId: string;
  suffix: string;
  digit: number;
  dayOffset: number;
  accountIndex: number;
  moscowDayStart: Date;
  area: (typeof AREAS)[number];
}): TestEventDraft {
  const titleIndex = (input.accountIndex + input.dayOffset) % EVENT_TITLES.length;
  const hour = 18 + ((input.accountIndex + input.dayOffset) % 4);
  const minute = input.dayOffset === 1 ? 30 : 0;
  const priceMode = ['free', 'split', 'host_pays', 'fifty_fifty', 'fixed'][
    (input.accountIndex + input.dayOffset) % 5
  ] as TestEventDraft['priceMode'];

  return {
    id: `${SEEDED_EVENT_PREFIX}${input.suffix}-${input.dayOffset}`,
    chatId: `${SEEDED_EVENT_CHAT_PREFIX}${input.suffix}-${input.dayOffset}`,
    title: EVENT_TITLES[titleIndex]!,
    emoji: EVENT_EMOJIS[titleIndex]!,
    startsAt: moscowWallTimeUtc(input.moscowDayStart, input.dayOffset, hour, minute),
    moscowDayOffset: input.dayOffset,
    city: 'Москва',
    area: input.area.name,
    place: input.area.place,
    latitude: input.area.lat,
    longitude: input.area.lng,
    vibe: VIBES[(input.accountIndex + input.dayOffset) % VIBES.length]!,
    joinMode: (input.accountIndex + input.dayOffset) % 3 === 0 ? 'request' : 'open',
    lifestyle: ['neutral', 'zozh', 'anti'][
      (input.accountIndex + input.dayOffset) % 3
    ] as TestEventDraft['lifestyle'],
    priceMode,
    priceAmountFrom: priceMode === 'fixed' ? 900 + input.digit * 100 : null,
    priceAmountTo: priceMode === 'fixed' ? 900 + input.digit * 100 : null,
    accessMode: input.dayOffset === 2 ? 'request' : 'open',
    genderMode: ['all', 'male', 'female'][
      (input.accountIndex + input.dayOffset) % 3
    ] as TestEventDraft['genderMode'],
    visibilityMode: input.dayOffset === 1 ? 'friends' : 'public',
    capacity: 4 + ((input.accountIndex + input.dayOffset) % 5),
    description: `Тестовая встреча в районе ${input.area.name}. Создатель: ${input.userId}.`,
  };
}

function buildPhotoDraft(input: {
  userId: string;
  suffix: string;
  gender: Gender;
  displayName: string;
  area: string;
  photoIndex: number;
}): TestPhotoDraft {
  const id = `test-media-${input.suffix}-${input.photoIndex}`;
  const publicUrl = buildSvgDataUrl({
    id,
    gender: input.gender,
    displayName: input.displayName,
    area: input.area,
    photoIndex: input.photoIndex,
  });

  return {
    id,
    photoId: `test-photo-${input.suffix}-${input.photoIndex}`,
    objectKey: `${TEST_MEDIA_PREFIX}${input.gender}/${input.suffix}-${input.photoIndex}.svg`,
    publicUrl,
    gender: input.gender,
    sortOrder: input.photoIndex,
    byteSize: Buffer.byteLength(publicUrl),
  };
}

function buildSvgDataUrl(input: {
  id: string;
  gender: Gender;
  displayName: string;
  area: string;
  photoIndex: number;
}) {
  const palette =
    input.gender === 'male'
      ? ['#d8efe4', '#2f6f58', '#102f28']
      : ['#f3dce8', '#8e3d68', '#331a29'];
  const initials = input.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="${palette[0]}"/><circle cx="${input.photoIndex === 0 ? 450 : 520}" cy="430" r="230" fill="${palette[1]}"/><rect x="140" y="720" width="620" height="220" rx="52" fill="#fff" opacity=".86"/><text x="450" y="455" text-anchor="middle" font-family="Arial, sans-serif" font-size="150" font-weight="700" fill="#fff">${escapeSvg(initials)}</text><text x="450" y="810" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="${palette[2]}">${escapeSvg(input.displayName)}</text><text x="450" y="875" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="${palette[2]}">${escapeSvg(input.area)}</text><text x="450" y="1060" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="${palette[2]}">${escapeSvg(input.id)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function buildMediaVariants(publicUrl: string, cacheKey: string): Prisma.InputJsonValue {
  return {
    avatar: {
      url: publicUrl,
      downloadUrl: publicUrl,
      mimeType: 'image/svg+xml',
      byteSize: Buffer.byteLength(publicUrl),
      cacheKey: `${cacheKey}:avatar`,
    },
    card: {
      url: publicUrl,
      downloadUrl: publicUrl,
      mimeType: 'image/svg+xml',
      byteSize: Buffer.byteLength(publicUrl),
      cacheKey: `${cacheKey}:card`,
    },
  };
}

function startOfMoscowDayUtc(now: Date) {
  const shifted = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - MOSCOW_UTC_OFFSET_MS,
  );
}

function moscowWallTimeUtc(
  moscowDayStartUtc: Date,
  dayOffset: number,
  hour: number,
  minute: number,
) {
  return new Date(
    moscowDayStartUtc.getTime() +
      dayOffset * DAY_MS +
      hour * 60 * 60 * 1000 +
      minute * 60 * 1000,
  );
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function whenNonEmpty<T, R>(values: T[], build: (items: T[]) => R[]): R[] {
  return values.length > 0 ? build(values) : [];
}

async function main() {
  const command = process.argv[2] ?? 'seed';
  const prisma = new PrismaClient();

  try {
    if (command === 'seed' || command === 'reset') {
      const result = await seedTestAccounts(prisma);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === 'delete' || command === 'cleanup') {
      const result = await deleteTestAccounts(prisma);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(
      `Unknown command "${command}". Use seed, reset, delete or cleanup.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
