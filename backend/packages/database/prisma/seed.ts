import { PrismaClient, ChatKind, ChatOrigin } from '@prisma/client';

const { seededEvents, seededUsers }: typeof import('../src/seed-data') = require('../src/seed-data.ts');

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
  await prisma.userSubscription.deleteMany();
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
  await prisma.chatMember.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.eventParticipant.deleteMany();
  await prisma.event.deleteMany();
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
      { id: 'mc1', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Винный вечер на крыше', emoji: '🍷', eventId: 'e1' },
      { id: 'mc2', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Вечерняя пробежка по бульварам', emoji: '🌿', eventId: 'e2' },
      { id: 'mc3', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Настолки и кофе', emoji: '♟️', eventId: 'e3' },
      { id: 'mc4', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Кино под открытым небом', emoji: '🎬', eventId: 'e4' },
      { id: 'mc5', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Камерный ужин по заявкам', emoji: '🍝', eventId: 'e5' },
      { id: 'p1', kind: ChatKind.direct, origin: ChatOrigin.meetup, directKey: 'user-anya:user-me', sourceEventId: 'e1' },
      { id: 'p2', kind: ChatKind.direct, origin: ChatOrigin.meetup, directKey: 'user-mark:user-me', sourceEventId: 'e1' },
      { id: 'p3', kind: ChatKind.direct, origin: ChatOrigin.meetup, directKey: 'user-me:user-sonya', sourceEventId: 'e2' },
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
      { id: 'cm16', chatId: 'p1', userId: 'user-anya', lastReadMessageId: 'p6' },
      { id: 'cm17', chatId: 'p1', userId: 'user-me', lastReadMessageId: 'p3' },
      { id: 'cm18', chatId: 'p2', userId: 'user-mark', lastReadMessageId: 'p7' },
      { id: 'cm19', chatId: 'p2', userId: 'user-me', lastReadMessageId: 'p7' },
      { id: 'cm20', chatId: 'p3', userId: 'user-sonya', lastReadMessageId: 'p8' },
      { id: 'cm21', chatId: 'p3', userId: 'user-me', lastReadMessageId: 'p8-prev' },
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
        payload: { chatId: 'p1', messageId: 'p6', userId: 'user-anya', userName: 'Анна Л' },
        createdAt: new Date('2026-04-20T18:55:00.000Z'),
      },
      {
        id: 'n2',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Приглашение',
        body: 'Анна Л приглашает тебя на «Винный вечер на крыше» сегодня в 20:00',
        payload: { eventId: 'e1', userId: 'user-anya', userName: 'Анна Л', invite: true },
        createdAt: new Date('2026-04-20T18:48:00.000Z'),
      },
      {
        id: 'n3',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Новый участник',
        body: 'присоединился к встрече «Настолки и кофе»',
        payload: { eventId: 'e3', userId: 'user-mark', userName: 'Марк С' },
        createdAt: new Date('2026-04-20T17:50:00.000Z'),
      },
      {
        id: 'n4',
        userId: 'user-me',
        kind: 'message',
        title: 'Новый интерес',
        body: 'отметила вас как интересного человека',
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
