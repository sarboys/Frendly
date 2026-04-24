import { PrismaClient } from '@prisma/client';

const { seededEvents, seededPosters, seededUsers }: typeof import('../src/seed-data') = require('../src/seed-data.ts');

const prisma = new PrismaClient();

const seededPhoneNumbers: Record<string, string> = {
  'user-me': '+71111111111',
  'user-anya': '+72222222222',
  'user-mark': '+73333333333',
  'user-liza': '+75555555555',
  'user-dima': '+76666666666',
  'user-sonya': '+74444444444',
  'user-oleg': '+77777777777',
};

const seededSettings: Record<
  string,
  {
    allowLocation: boolean;
    allowPush: boolean;
    allowContacts: boolean;
    autoSharePlans: boolean;
    hideExactLocation: boolean;
    quietHours: boolean;
    showAge: boolean;
    discoverable: boolean;
    darkMode: boolean;
    afterDarkAgeConfirmedAt?: Date | null;
    afterDarkCodeAcceptedAt?: Date | null;
  }
> = {
  'user-me': {
    allowLocation: true,
    allowPush: true,
    allowContacts: true,
    autoSharePlans: true,
    hideExactLocation: false,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: false,
  },
  'user-anya': {
    allowLocation: true,
    allowPush: false,
    allowContacts: false,
    autoSharePlans: true,
    hideExactLocation: true,
    quietHours: true,
    showAge: true,
    discoverable: true,
    darkMode: true,
  },
  'user-mark': {
    allowLocation: true,
    allowPush: true,
    allowContacts: false,
    autoSharePlans: false,
    hideExactLocation: false,
    quietHours: false,
    showAge: false,
    discoverable: true,
    darkMode: false,
  },
  'user-sonya': {
    allowLocation: false,
    allowPush: true,
    allowContacts: true,
    autoSharePlans: false,
    hideExactLocation: true,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: true,
  },
  'user-liza': {
    allowLocation: true,
    allowPush: true,
    allowContacts: false,
    autoSharePlans: false,
    hideExactLocation: false,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: false,
    afterDarkAgeConfirmedAt: new Date('2026-04-18T08:00:00.000Z'),
    afterDarkCodeAcceptedAt: new Date('2026-04-18T08:05:00.000Z'),
  },
  'user-dima': {
    allowLocation: true,
    allowPush: true,
    allowContacts: false,
    autoSharePlans: false,
    hideExactLocation: false,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: false,
    afterDarkAgeConfirmedAt: new Date('2026-04-18T08:00:00.000Z'),
    afterDarkCodeAcceptedAt: new Date('2026-04-18T08:05:00.000Z'),
  },
  'user-oleg': {
    allowLocation: true,
    allowPush: false,
    allowContacts: false,
    autoSharePlans: false,
    hideExactLocation: false,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: false,
  },
};

async function main() {
  await prisma.realtimeEvent.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.authAuditEvent.deleteMany();
  await prisma.telegramLoginSession.deleteMany();
  await prisma.telegramAccount.deleteMany();
  await prisma.telegramBotState.deleteMany();
  await prisma.userSubscription.deleteMany();
  await prisma.datingAction.deleteMany();
  await prisma.eventStory.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.userReport.deleteMany();
  await prisma.trustedContact.deleteMany();
  await prisma.phoneOtpChallenge.deleteMany();
  await prisma.userVerification.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.eventFavorite.deleteMany();
  await prisma.eventFeedback.deleteMany();
  await prisma.eventLiveState.deleteMany();
  await prisma.eventAttendance.deleteMany();
  await prisma.eventJoinRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.communitySocialLink.deleteMany();
  await prisma.communityMediaItem.deleteMany();
  await prisma.communityMeetupItem.deleteMany();
  await prisma.communityNewsItem.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.community.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.eventParticipant.deleteMany();
  await prisma.event.deleteMany();
  await prisma.poster.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.onboardingPreferences.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.user.deleteMany();

  for (const user of seededUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        displayName: user.displayName,
        phoneNumber: seededPhoneNumbers[user.id],
        verified: user.verified,
        online: user.online,
        profile: {
          create: {
            age: user.age,
            gender: user.gender,
            city: user.city,
            area: user.area,
            bio: user.bio,
            vibe: user.vibe,
            rating: user.rating,
            meetupCount: user.meetupCount,
            avatarUrl: user.avatarUrl,
          },
        },
        onboarding: {
          create: {
            intent: user.intent,
            gender: user.gender,
            city: user.city,
            area: user.area,
            interests: user.interests,
            vibe: user.vibe,
          },
        },
        settings: {
          create: seededSettings[user.id],
        },
        verification: {
          create: {
            status: user.verified ? 'verified' : 'not_started',
            selfieDone: user.verified,
            documentDone: user.verified,
            reviewedAt: user.verified ? new Date('2026-04-18T10:00:00.000Z') : null,
          },
        },
      },
    });

    const createdAssets = [];
    for (const [index, url] of user.photoUrls.entries()) {
      const asset = await prisma.mediaAsset.create({
        data: {
          ownerId: user.id,
          kind: 'avatar',
          status: 'ready',
          bucket: 'seeded',
          objectKey: `seeded/profile/${user.id}/${index}`,
          mimeType: 'image/svg+xml',
          byteSize: 0,
          originalFileName: `${user.id}-${index}.svg`,
          publicUrl: url,
        },
      });
      createdAssets.push(asset);

      await prisma.profilePhoto.create({
        data: {
          profileUserId: user.id,
          mediaAssetId: asset.id,
          sortOrder: index,
        },
      });
    }

    if (createdAssets.length > 0) {
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          avatarAssetId: createdAssets[0]!.id,
          avatarUrl: createdAssets[0]!.publicUrl,
        },
      });
    }
  }

  await prisma.event.createMany({
    data: seededEvents,
  });

  await prisma.poster.createMany({
    data: seededPosters.map((poster) => ({
      ...poster,
      tags: poster.tags,
    })),
  });

  await prisma.eventParticipant.createMany({
    data: [
      { id: 'ep1', eventId: 'e1', userId: 'user-anya' },
      { id: 'ep2', eventId: 'e1', userId: 'user-me' },
      { id: 'ep3', eventId: 'e1', userId: 'user-mark' },
      { id: 'ep4', eventId: 'e1', userId: 'user-sonya' },
      { id: 'ep5', eventId: 'e2', userId: 'user-mark' },
      { id: 'ep6', eventId: 'e2', userId: 'user-me' },
      { id: 'ep7', eventId: 'e2', userId: 'user-sonya' },
      { id: 'ep8', eventId: 'e3', userId: 'user-sonya' },
      { id: 'ep9', eventId: 'e3', userId: 'user-me' },
      { id: 'ep10', eventId: 'e3', userId: 'user-anya' },
      { id: 'ep11', eventId: 'e4', userId: 'user-mark' },
      { id: 'ep12', eventId: 'e4', userId: 'user-me' },
      { id: 'ep13', eventId: 'e4', userId: 'user-anya' },
      { id: 'ep14', eventId: 'e5', userId: 'user-me' },
      { id: 'ep15', eventId: 'e5', userId: 'user-anya' },
      { id: 'ep-ad1-host', eventId: 'ad1', userId: 'user-anya' },
      { id: 'ep-ad2-host', eventId: 'ad2', userId: 'user-sonya' },
      { id: 'ep-ad3-host', eventId: 'ad3', userId: 'user-liza' },
      { id: 'ep-ad4-host', eventId: 'ad4', userId: 'user-oleg' },
      { id: 'ep-ad5-host', eventId: 'ad5', userId: 'user-anya' },
      { id: 'ep-ad6-host', eventId: 'ad6', userId: 'user-liza' },
      { id: 'ep-ad7-host', eventId: 'ad7', userId: 'user-oleg' },
      { id: 'ep-ad8-host', eventId: 'ad8', userId: 'user-sonya' },
    ],
  });

  await prisma.eventAttendance.createMany({
    data: [
      {
        id: 'ea1',
        eventId: 'e1',
        userId: 'user-anya',
        status: 'checked_in',
        checkedInAt: new Date('2026-04-19T20:02:00.000Z'),
        checkedInById: 'user-anya',
        checkInMethod: 'host_manual',
      },
      {
        id: 'ea2',
        eventId: 'e1',
        userId: 'user-me',
        status: 'checked_in',
        checkedInAt: new Date('2026-04-19T20:07:00.000Z'),
        checkedInById: 'user-anya',
        checkInMethod: 'host_manual',
      },
      {
        id: 'ea3',
        eventId: 'e5',
        userId: 'user-me',
        status: 'checked_in',
        checkedInAt: new Date('2026-04-20T18:28:00.000Z'),
        checkedInById: 'user-me',
        checkInMethod: 'host_manual',
      },
    ],
  });

  await prisma.eventJoinRequest.createMany({
    data: [
      {
        id: 'jr1',
        eventId: 'e5',
        userId: 'user-sonya',
        note: 'Хочу спокойный ужин и короткую прогулку после.',
        status: 'pending',
        compatibilityScore: 82,
      },
      {
        id: 'jr2',
        eventId: 'e5',
        userId: 'user-anya',
        note: 'Буду вовремя и принесу десерт.',
        status: 'approved',
        compatibilityScore: 76,
        reviewedById: 'user-me',
        reviewedAt: new Date('2026-04-20T15:10:00.000Z'),
      },
    ],
  });

  await prisma.eventLiveState.createMany({
    data: [
      {
        id: 'ls1',
        eventId: 'e1',
        status: 'live',
        startedAt: new Date('2026-04-19T20:00:00.000Z'),
      },
      {
        id: 'ls2',
        eventId: 'e5',
        status: 'idle',
      },
    ],
  });

  await prisma.chat.createMany({
    data: [
      { id: 'mc1', kind: 'meetup', origin: 'meetup', title: 'Винный вечер на крыше', emoji: '🍷', eventId: 'e1' },
      { id: 'mc2', kind: 'meetup', origin: 'meetup', title: 'Вечерняя пробежка по бульварам', emoji: '🌿', eventId: 'e2' },
      { id: 'mc3', kind: 'meetup', origin: 'meetup', title: 'Настолки и кофе', emoji: '♟️', eventId: 'e3' },
      { id: 'mc4', kind: 'meetup', origin: 'meetup', title: 'Кино под открытым небом', emoji: '🎬', eventId: 'e4' },
      { id: 'mc5', kind: 'meetup', origin: 'meetup', title: 'Камерный ужин по заявкам', emoji: '🍝', eventId: 'e5' },
      { id: 'mc-ad1', kind: 'meetup', origin: 'meetup', title: 'Velvet Room · Speakeasy', emoji: '🥃', eventId: 'ad1' },
      { id: 'mc-ad2', kind: 'meetup', origin: 'meetup', title: 'Blind Dinner · Round 7', emoji: '🕯️', eventId: 'ad2' },
      { id: 'mc-ad3', kind: 'meetup', origin: 'meetup', title: 'Banya Night · Sauna Social', emoji: '♨️', eventId: 'ad3' },
      { id: 'mc-ad4', kind: 'meetup', origin: 'meetup', title: 'After Hours · Underground', emoji: '🔮', eventId: 'ad4' },
      { id: 'mc-ad5', kind: 'meetup', origin: 'meetup', title: 'Speed Dating · 30+', emoji: '💋', eventId: 'ad5' },
      { id: 'mc-ad6', kind: 'meetup', origin: 'meetup', title: 'Naked Yoga · Female only', emoji: '🧘‍♀️', eventId: 'ad6' },
      { id: 'mc-ad7', kind: 'meetup', origin: 'meetup', title: 'Munch · Знакомство сообщества', emoji: '🖤', eventId: 'ad7' },
      { id: 'mc-ad8', kind: 'meetup', origin: 'meetup', title: 'Dress Code Night · Fetish Friendly', emoji: '🦋', eventId: 'ad8' },
      { id: 'p1', kind: 'direct', origin: 'meetup', directKey: 'user-anya:user-me', sourceEventId: 'e1' },
      { id: 'p2', kind: 'direct', origin: 'meetup', directKey: 'user-mark:user-me', sourceEventId: 'e1' },
      { id: 'p3', kind: 'direct', origin: 'meetup', directKey: 'user-me:user-sonya', sourceEventId: 'e2' },
      { id: 'community-c1-chat', kind: 'community', origin: 'community', title: 'City Rituals', emoji: '🌿' },
      { id: 'community-c2-chat', kind: 'community', origin: 'community', title: 'Private Table', emoji: '🍸' },
      { id: 'community-c3-chat', kind: 'community', origin: 'community', title: 'Night Moves', emoji: '🪩' },
    ],
  });

  await prisma.chatMember.createMany({
    data: [
      { id: 'cm1', chatId: 'mc1', userId: 'user-anya', lastReadMessageId: 'm3' },
      { id: 'cm2', chatId: 'mc1', userId: 'user-me', lastReadMessageId: 'm2' },
      { id: 'cm3', chatId: 'mc1', userId: 'user-mark', lastReadMessageId: 'm3' },
      { id: 'cm4', chatId: 'mc1', userId: 'user-sonya', lastReadMessageId: 'm3' },
      { id: 'cm5', chatId: 'mc2', userId: 'user-mark', lastReadMessageId: 'm5' },
      { id: 'cm6', chatId: 'mc2', userId: 'user-me', lastReadMessageId: 'm4' },
      { id: 'cm7', chatId: 'mc2', userId: 'user-sonya', lastReadMessageId: 'm5' },
      { id: 'cm8', chatId: 'mc3', userId: 'user-sonya', lastReadMessageId: 'm6' },
      { id: 'cm9', chatId: 'mc3', userId: 'user-me', lastReadMessageId: 'm6' },
      { id: 'cm10', chatId: 'mc3', userId: 'user-anya', lastReadMessageId: 'm6' },
      { id: 'cm11', chatId: 'mc4', userId: 'user-mark', lastReadMessageId: 'm7' },
      { id: 'cm12', chatId: 'mc4', userId: 'user-me', lastReadMessageId: 'm7' },
      { id: 'cm13', chatId: 'mc4', userId: 'user-anya', lastReadMessageId: 'm7' },
      { id: 'cm14', chatId: 'mc5', userId: 'user-me', lastReadMessageId: 'm8' },
      { id: 'cm15', chatId: 'mc5', userId: 'user-anya', lastReadMessageId: 'm8' },
      { id: 'cm-ad1-host', chatId: 'mc-ad1', userId: 'user-anya' },
      { id: 'cm-ad2-host', chatId: 'mc-ad2', userId: 'user-sonya' },
      { id: 'cm-ad3-host', chatId: 'mc-ad3', userId: 'user-liza' },
      { id: 'cm-ad4-host', chatId: 'mc-ad4', userId: 'user-oleg' },
      { id: 'cm-ad5-host', chatId: 'mc-ad5', userId: 'user-anya' },
      { id: 'cm-ad6-host', chatId: 'mc-ad6', userId: 'user-liza' },
      { id: 'cm-ad7-host', chatId: 'mc-ad7', userId: 'user-oleg' },
      { id: 'cm-ad8-host', chatId: 'mc-ad8', userId: 'user-sonya' },
      { id: 'cm16', chatId: 'p1', userId: 'user-anya', lastReadMessageId: 'p6' },
      { id: 'cm17', chatId: 'p1', userId: 'user-me', lastReadMessageId: 'p3' },
      { id: 'cm18', chatId: 'p2', userId: 'user-mark', lastReadMessageId: 'p7' },
      { id: 'cm19', chatId: 'p2', userId: 'user-me', lastReadMessageId: 'p7' },
      { id: 'cm20', chatId: 'p3', userId: 'user-sonya', lastReadMessageId: 'p8' },
      { id: 'cm21', chatId: 'p3', userId: 'user-me', lastReadMessageId: 'p8-prev' },
      { id: 'community-c1-chat-me', chatId: 'community-c1-chat', userId: 'user-me', lastReadMessageId: 'cc2' },
      { id: 'community-c1-chat-liza', chatId: 'community-c1-chat', userId: 'user-liza', lastReadMessageId: 'cc3' },
      { id: 'community-c1-chat-sonya', chatId: 'community-c1-chat', userId: 'user-sonya', lastReadMessageId: 'cc3' },
      { id: 'community-c1-chat-anya', chatId: 'community-c1-chat', userId: 'user-anya', lastReadMessageId: 'cc3' },
      { id: 'community-c1-chat-mark', chatId: 'community-c1-chat', userId: 'user-mark', lastReadMessageId: 'cc3' },
      { id: 'community-c2-chat-me', chatId: 'community-c2-chat', userId: 'user-me', lastReadMessageId: 'cc5' },
      { id: 'community-c2-chat-oleg', chatId: 'community-c2-chat', userId: 'user-oleg', lastReadMessageId: 'cc5' },
      { id: 'community-c2-chat-liza', chatId: 'community-c2-chat', userId: 'user-liza', lastReadMessageId: 'cc5' },
      { id: 'community-c3-chat-me', chatId: 'community-c3-chat', userId: 'user-me', lastReadMessageId: 'cc7' },
      { id: 'community-c3-chat-oleg', chatId: 'community-c3-chat', userId: 'user-oleg', lastReadMessageId: 'cc7' },
      { id: 'community-c3-chat-sonya', chatId: 'community-c3-chat', userId: 'user-sonya', lastReadMessageId: 'cc7' },
    ],
  });

  await prisma.community.createMany({
    data: [
      {
        id: 'c1',
        name: 'City Rituals',
        avatar: '🌿',
        description:
          'Небольшое сообщество про ужины, прогулки и wellness-встречи без шума. Внутри — свои новости, архив фото и камерные ивенты.',
        privacy: 'public',
        tags: ['ужины', 'wellness', 'центр'],
        joinRule: 'Открытое вступление',
        premiumOnly: true,
        mood: 'Камерный городской клуб',
        sharedMediaLabel: '68 фото и видео',
        createdById: 'user-liza',
        chatId: 'community-c1-chat',
      },
      {
        id: 'c2',
        name: 'Private Table',
        avatar: '🍸',
        description:
          'Закрытое гастро-сообщество. Попасть можно по заявке, внутри — афиша ужинов, личный чат и медиахранилище с рекомендациями.',
        privacy: 'private',
        tags: ['fine dining', 'дегустации', 'закрытое'],
        joinRule: 'Ручное одобрение',
        premiumOnly: true,
        mood: 'Приватные dinner-сеты',
        sharedMediaLabel: '24 файла',
        createdById: 'user-oleg',
        chatId: 'community-c2-chat',
      },
      {
        id: 'c3',
        name: 'Night Moves',
        avatar: '🪩',
        description:
          'Ночное комьюнити для концертов, afters и закрытых вылазок. Внутри — быстрый чат, новости от хоста и ближайшие ночные встречи.',
        privacy: 'public',
        tags: ['афиша', 'nightlife', 'после полуночи'],
        joinRule: 'Открыто, но постить могут модераторы',
        premiumOnly: true,
        mood: 'Ночная программа города',
        sharedMediaLabel: '102 медиа',
        createdById: 'user-sonya',
        chatId: 'community-c3-chat',
      },
    ],
  });

  await prisma.communityMember.createMany({
    data: [
      { id: 'community-c1-me', communityId: 'c1', userId: 'user-me', role: 'member' },
      { id: 'community-c1-liza', communityId: 'c1', userId: 'user-liza', role: 'owner' },
      { id: 'community-c1-sonya', communityId: 'c1', userId: 'user-sonya', role: 'member' },
      { id: 'community-c1-anya', communityId: 'c1', userId: 'user-anya', role: 'member' },
      { id: 'community-c1-mark', communityId: 'c1', userId: 'user-mark', role: 'member' },
      { id: 'community-c2-me', communityId: 'c2', userId: 'user-me', role: 'member' },
      { id: 'community-c2-oleg', communityId: 'c2', userId: 'user-oleg', role: 'owner' },
      { id: 'community-c2-liza', communityId: 'c2', userId: 'user-liza', role: 'member' },
      { id: 'community-c3-me', communityId: 'c3', userId: 'user-me', role: 'member' },
      { id: 'community-c3-oleg', communityId: 'c3', userId: 'user-oleg', role: 'member' },
      { id: 'community-c3-sonya', communityId: 'c3', userId: 'user-sonya', role: 'owner' },
    ],
  });

  await prisma.communityNewsItem.createMany({
    data: [
      { id: 'cn1', communityId: 'c1', title: 'Майский календарь', blurb: 'Выложили расписание бранчей и сауны на май.', timeLabel: '2 ч назад', sortOrder: 0 },
      { id: 'cn2', communityId: 'c1', title: 'Новый медиапак', blurb: 'Добавили фотоальбом с rooftop dinner и чек-лист для хостов.', timeLabel: 'вчера', sortOrder: 1 },
      { id: 'cn3', communityId: 'c2', title: 'Новый шеф-ужин', blurb: 'Открыли запись на шестисетовый dinner в пятницу.', timeLabel: '1 ч назад', sortOrder: 0 },
      { id: 'cn4', communityId: 'c2', title: 'Обновили правила', blurb: 'Добавили политику no-photo за столом и quiet seating.', timeLabel: '3 дня назад', sortOrder: 1 },
      { id: 'cn5', communityId: 'c3', title: 'Tonight drop', blurb: 'Опубликовали три новые ночные точки и время входа без очереди.', timeLabel: '30 мин назад', sortOrder: 0 },
    ],
  });

  await prisma.communityMeetupItem.createMany({
    data: [
      { id: 'cm1', communityId: 'c1', title: 'Late brunch club', emoji: '🥐', timeLabel: 'Сб · 12:00', place: 'Friends Bistro, Чистые пруды', format: 'Открытая встреча', going: 16, sortOrder: 0 },
      { id: 'cm2', communityId: 'c1', title: 'Spa evening circle', emoji: '♨️', timeLabel: 'Вс · 19:30', place: 'Sense Spa, Остоженка', format: 'По заявке', going: 8, sortOrder: 1 },
      { id: 'cm3', communityId: 'c2', title: 'Chef’s table №9', emoji: '🍽️', timeLabel: 'Пт · 20:00', place: 'Atelier Kitchen, Патрики', format: 'Только для участников', going: 10, sortOrder: 0 },
      { id: 'cm4', communityId: 'c2', title: 'Wine briefing', emoji: '🍷', timeLabel: 'Вс · 17:00', place: 'Private Loft, Тверская', format: 'Мини-группа', going: 6, sortOrder: 1 },
      { id: 'cm5', communityId: 'c3', title: 'After set на Курской', emoji: '🎧', timeLabel: 'Сегодня · 01:30', place: 'Secret spot, Курская', format: 'Открытая встреча', going: 28, sortOrder: 0 },
      { id: 'cm6', communityId: 'c3', title: 'Rooftop sunrise', emoji: '🌅', timeLabel: 'Сб · 05:10', place: 'Roof 19, Бауманская', format: 'Кто в теме', going: 12, sortOrder: 1 },
    ],
  });

  await prisma.communityMediaItem.createMany({
    data: [
      { id: 'community-media-1', communityId: 'c1', emoji: '📸', label: 'Roof dinner', kind: 'photo', sortOrder: 0 },
      { id: 'community-media-2', communityId: 'c1', emoji: '🎞️', label: 'Reel с прогулки', kind: 'video', sortOrder: 1 },
      { id: 'community-media-3', communityId: 'c1', emoji: '🗂️', label: 'Гид по локациям', kind: 'doc', sortOrder: 2 },
      { id: 'community-media-4', communityId: 'c1', emoji: '📷', label: 'Brunch set', kind: 'photo', sortOrder: 3 },
      { id: 'community-media-5', communityId: 'c2', emoji: '📷', label: 'Меню недели', kind: 'photo', sortOrder: 0 },
      { id: 'community-media-6', communityId: 'c2', emoji: '🗃️', label: 'Винная карта', kind: 'doc', sortOrder: 1 },
      { id: 'community-media-7', communityId: 'c2', emoji: '🎥', label: 'Chef teaser', kind: 'video', sortOrder: 2 },
      { id: 'community-media-8', communityId: 'c2', emoji: '📸', label: 'Table archive', kind: 'photo', sortOrder: 3 },
      { id: 'community-media-9', communityId: 'c3', emoji: '📀', label: 'Set list', kind: 'doc', sortOrder: 0 },
      { id: 'community-media-10', communityId: 'c3', emoji: '🎬', label: 'Aftermovie', kind: 'video', sortOrder: 1 },
      { id: 'community-media-11', communityId: 'c3', emoji: '📸', label: 'Backstage', kind: 'photo', sortOrder: 2 },
      { id: 'community-media-12', communityId: 'c3', emoji: '📷', label: 'Crowd shots', kind: 'photo', sortOrder: 3 },
    ],
  });

  await prisma.communitySocialLink.createMany({
    data: [
      { id: 's1', communityId: 'c1', label: 'Telegram', handle: '@sagecircle', sortOrder: 0 },
      { id: 's2', communityId: 'c1', label: 'Instagram', handle: '@sage.circle', sortOrder: 1 },
      { id: 's3', communityId: 'c1', label: 'TikTok', handle: '@sage.after', sortOrder: 2 },
      { id: 's4', communityId: 'c2', label: 'Telegram', handle: '@privatetableclub', sortOrder: 0 },
      { id: 's5', communityId: 'c2', label: 'Instagram', handle: '@private.table', sortOrder: 1 },
      { id: 's6', communityId: 'c2', label: 'TikTok', handle: '@table.afterhours', sortOrder: 2 },
      { id: 's7', communityId: 'c3', label: 'Telegram', handle: '@nightmovesmoscow', sortOrder: 0 },
      { id: 's8', communityId: 'c3', label: 'Instagram', handle: '@night.moves', sortOrder: 1 },
      { id: 's9', communityId: 'c3', label: 'TikTok', handle: '@night.moves.live', sortOrder: 2 },
    ],
  });

  await prisma.message.createMany({
    data: [
      { id: 'm1', chatId: 'mc1', senderId: 'user-anya', text: 'Привет всем, я уже внутри.', clientMessageId: 'client-m1', createdAt: new Date('2026-04-19T19:42:00.000Z') },
      { id: 'm2', chatId: 'mc1', senderId: 'user-mark', text: 'Я буду через десять минут.', clientMessageId: 'client-m2', createdAt: new Date('2026-04-19T19:43:00.000Z') },
      { id: 'm3', chatId: 'mc1', senderId: 'user-me', text: 'Беру столик у окна.', clientMessageId: 'client-m3', createdAt: new Date('2026-04-19T19:45:00.000Z') },
      { id: 'm4', chatId: 'mc2', senderId: 'user-mark', text: 'Стартуем ровно в семь.', clientMessageId: 'client-m4', createdAt: new Date('2026-04-20T18:00:00.000Z') },
      { id: 'm5', chatId: 'mc2', senderId: 'user-sonya', text: 'Я буду у входа в парк.', clientMessageId: 'client-m5', createdAt: new Date('2026-04-20T18:10:00.000Z') },
      { id: 'm6', chatId: 'mc3', senderId: 'user-sonya', text: 'Беру Dixit и карты.', clientMessageId: 'client-m6', createdAt: new Date('2026-04-20T18:48:00.000Z') },
      { id: 'm7', chatId: 'mc4', senderId: 'user-mark', text: 'Фильм начнется вовремя, встречаемся у кассы.', clientMessageId: 'client-m7', createdAt: new Date('2026-04-21T20:15:00.000Z') },
      { id: 'm8', chatId: 'mc5', senderId: 'user-me', text: 'Жду вас к 18:30, адрес в карточке.', clientMessageId: 'client-m8', createdAt: new Date('2026-04-20T17:55:00.000Z') },
      { id: 'p1', chatId: 'p1', senderId: 'user-anya', text: 'Привет, классно посидели вчера.', clientMessageId: 'client-p1', createdAt: new Date('2026-04-19T21:02:00.000Z') },
      { id: 'p2', chatId: 'p1', senderId: 'user-me', text: 'Согласен, спасибо за вечер.', clientMessageId: 'client-p2', createdAt: new Date('2026-04-19T21:04:00.000Z') },
      { id: 'p3', chatId: 'p1', senderId: 'user-anya', text: 'Ты потом еще гулял?', clientMessageId: 'client-p3', createdAt: new Date('2026-04-19T21:05:00.000Z') },
      { id: 'p4', chatId: 'p1', senderId: 'user-anya', text: 'В пятницу снова встречаемся?', clientMessageId: 'client-p4', createdAt: new Date('2026-04-19T21:05:20.000Z') },
      { id: 'p5', chatId: 'p1', senderId: 'user-me', text: 'Да, если получится по времени.', clientMessageId: 'client-p5', createdAt: new Date('2026-04-19T21:07:00.000Z') },
      { id: 'p6', chatId: 'p1', senderId: 'user-anya', text: 'Тогда до восьми у входа?', clientMessageId: 'client-p6', createdAt: new Date('2026-04-19T21:09:00.000Z') },
      { id: 'p7', chatId: 'p2', senderId: 'user-me', text: 'Спасибо за вечер.', clientMessageId: 'client-p7', createdAt: new Date('2026-04-19T20:42:00.000Z') },
      { id: 'p8-prev', chatId: 'p3', senderId: 'user-me', text: 'Если что, я буду возле метро.', clientMessageId: 'client-p8-prev', createdAt: new Date('2026-04-20T17:50:00.000Z') },
      { id: 'p8', chatId: 'p3', senderId: 'user-sonya', text: 'Можем встретиться раньше.', clientMessageId: 'client-p8', createdAt: new Date('2026-04-20T18:10:00.000Z') },
      { id: 'cc1', chatId: 'community-c1-chat', senderId: 'user-liza', text: 'Я беру стол у окна на brunch, кто будет к 12:00?', clientMessageId: 'client-cc1', createdAt: new Date('2026-04-24T08:24:00.000Z') },
      { id: 'cc2', chatId: 'community-c1-chat', senderId: 'user-sonya', text: 'Я буду точно, после brunch могу показать новую spa-локацию для воскресенья.', clientMessageId: 'client-cc2', createdAt: new Date('2026-04-24T08:31:00.000Z') },
      { id: 'cc3', chatId: 'community-c1-chat', senderId: 'user-me', text: 'Я подтянусь к 12:10. Если будет очередь, напишите прямо сюда.', clientMessageId: 'client-cc3', createdAt: new Date('2026-04-24T08:36:00.000Z') },
      { id: 'cc4', chatId: 'community-c2-chat', senderId: 'user-oleg', text: 'Шеф просит подтвердить аллергию до 18:00.', clientMessageId: 'client-cc4', createdAt: new Date('2026-04-24T13:10:00.000Z') },
      { id: 'cc5', chatId: 'community-c2-chat', senderId: 'user-me', text: 'У меня всё ок, но я бы сел ближе к открытому кухонному столу.', clientMessageId: 'client-cc5', createdAt: new Date('2026-04-24T13:17:00.000Z') },
      { id: 'cc6', chatId: 'community-c3-chat', senderId: 'user-sonya', text: 'Адрес дропну за 45 минут до старта, следите за чатом.', clientMessageId: 'client-cc6', createdAt: new Date('2026-04-24T21:12:00.000Z') },
      { id: 'cc7', chatId: 'community-c3-chat', senderId: 'user-me', text: 'Ок, я уже рядом с Курской, готов подхватить тех, кто впервые.', clientMessageId: 'client-cc7', createdAt: new Date('2026-04-24T21:18:00.000Z') },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        id: 'n1',
        userId: 'user-me',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Анна Л: Тогда до восьми у входа?',
        chatId: 'p1',
        messageId: 'p6',
        actorUserId: 'user-anya',
        payload: { chatId: 'p1', messageId: 'p6', userId: 'user-anya', userName: 'Анна Л' },
        createdAt: new Date('2026-04-20T18:55:00.000Z'),
      },
      {
        id: 'n2',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Приглашение',
        body: 'Анна Л приглашает тебя на «Винный вечер на крыше» сегодня в 20:00',
        eventId: 'e1',
        actorUserId: 'user-anya',
        payload: { eventId: 'e1', userId: 'user-anya', userName: 'Анна Л', invite: true },
        createdAt: new Date('2026-04-20T18:48:00.000Z'),
      },
      {
        id: 'n3',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Новый участник',
        body: 'присоединился к встрече «Настолки и кофе»',
        eventId: 'e3',
        actorUserId: 'user-mark',
        payload: { eventId: 'e3', userId: 'user-mark', userName: 'Марк С' },
        createdAt: new Date('2026-04-20T17:50:00.000Z'),
      },
      {
        id: 'n4',
        userId: 'user-me',
        kind: 'message',
        title: 'Новый интерес',
        body: 'отметила вас как интересного человека',
        actorUserId: 'user-liza',
        payload: { userId: 'user-liza', userName: 'Лиза П' },
        readAt: new Date('2026-04-19T20:20:00.000Z'),
        createdAt: new Date('2026-04-19T20:10:00.000Z'),
      },
      {
        id: 'n5',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Напоминание',
        body: 'Завтра в 21:00 — «Кино под открытым небом»',
        eventId: 'e4',
        payload: { eventId: 'e4' },
        readAt: new Date('2026-04-19T18:10:00.000Z'),
        createdAt: new Date('2026-04-19T18:00:00.000Z'),
      },
      {
        id: 'n6',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Ещё участники',
        body: 'и ещё двое присоединились к «Вечерней пробежке»',
        eventId: 'e2',
        actorUserId: 'user-sonya',
        payload: { eventId: 'e2', userId: 'user-sonya', userName: 'Соня М' },
        readAt: new Date('2026-04-18T18:10:00.000Z'),
        createdAt: new Date('2026-04-18T18:00:00.000Z'),
      },
    ],
  });

  await prisma.trustedContact.createMany({
    data: [
      {
        id: 'tc1',
        userId: 'user-me',
        name: 'Мама',
        phoneNumber: '+79991112233',
        mode: 'all_plans',
      },
      {
        id: 'tc2',
        userId: 'user-me',
        name: 'Алина',
        phoneNumber: '+79994445566',
        mode: 'sos_only',
      },
    ],
  });

  await prisma.userBlock.createMany({
    data: [
      {
        id: 'ub1',
        userId: 'user-me',
        blockedUserId: 'user-mark',
      },
    ],
  });

  await prisma.userReport.createMany({
    data: [
      {
        id: 'ur1',
        reporterId: 'user-me',
        targetUserId: 'user-mark',
        reason: 'spam',
        details: 'Писал рекламу в личные сообщения',
        status: 'in_review',
        blockRequested: true,
      },
      {
        id: 'ur2',
        reporterId: 'user-me',
        targetUserId: 'user-sonya',
        reason: 'rude',
        details: 'Резко отвечала в чате встречи',
        status: 'open',
        blockRequested: false,
      },
    ],
  });

  await prisma.eventStory.createMany({
    data: [
      {
        id: 'st1',
        eventId: 'e1',
        authorId: 'user-anya',
        caption: 'Лучший столик у окна 🌆',
        emoji: '🥂',
      },
      {
        id: 'st2',
        eventId: 'e1',
        authorId: 'user-mark',
        caption: 'Вино и разговоры до закрытия.',
        emoji: '🎶',
      },
      {
        id: 'st3',
        eventId: 'e1',
        authorId: 'user-sonya',
        caption: 'Завтра кто на кофе после обеда?',
        emoji: '✨',
      },
    ],
  });

  await prisma.userSubscription.createMany({
    data: [
      {
        id: 'sub1',
        userId: 'user-me',
        plan: 'year',
        status: 'trial',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2027-04-18T08:00:00.000Z'),
        trialEndsAt: new Date('2026-04-25T08:00:00.000Z'),
      },
      {
        id: 'sub2',
        userId: 'user-sonya',
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        trialEndsAt: null,
      },
      {
        id: 'sub3',
        userId: 'user-oleg',
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        trialEndsAt: null,
      },
      {
        id: 'sub4',
        userId: 'user-liza',
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        trialEndsAt: null,
      },
      {
        id: 'sub5',
        userId: 'user-dima',
        plan: 'month',
        status: 'active',
        startedAt: new Date('2026-04-18T08:00:00.000Z'),
        renewsAt: new Date('2026-05-18T08:00:00.000Z'),
        trialEndsAt: null,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
