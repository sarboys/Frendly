import { PrismaClient, ChatKind, ChatOrigin } from '@prisma/client';
import { seededEvents, seededUsers } from '../src/seed-data';

const prisma = new PrismaClient();

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
        phoneNumber:
          user.id === 'user-me'
            ? '+79990000001'
            : user.id === 'user-anya'
              ? '+79990000002'
              : null,
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
          create: {
            allowLocation: true,
            allowPush: true,
            allowContacts: user.id == 'user-me',
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
            status: user.verified ? 'verified' : 'not_started',
            selfieDone: user.verified,
            documentDone: user.verified,
            reviewedAt: user.verified ? new Date('2026-04-18T10:00:00.000Z') : null,
          },
        },
      },
    });
  }

  await prisma.event.createMany({
    data: seededEvents,
  });

  await prisma.eventParticipant.createMany({
    data: [
      { id: 'ep1', eventId: 'e1', userId: 'user-anya' },
      { id: 'ep2', eventId: 'e1', userId: 'user-mark' },
      { id: 'ep3', eventId: 'e1', userId: 'user-liza' },
      { id: 'ep4', eventId: 'e1', userId: 'user-me' },
      { id: 'ep5', eventId: 'e2', userId: 'user-dima' },
      { id: 'ep6', eventId: 'e2', userId: 'user-sonya' },
      { id: 'ep7', eventId: 'e2', userId: 'user-oleg' },
      { id: 'ep8', eventId: 'e2', userId: 'user-me' },
      { id: 'ep9', eventId: 'e3', userId: 'user-katya' },
      { id: 'ep10', eventId: 'e3', userId: 'user-pasha' },
      { id: 'ep11', eventId: 'e3', userId: 'user-ira' },
      { id: 'ep12', eventId: 'e3', userId: 'user-timur' },
      { id: 'ep13', eventId: 'e3', userId: 'user-lena' },
      { id: 'ep14', eventId: 'e3', userId: 'user-me' },
      { id: 'ep15', eventId: 'e4', userId: 'user-masha' },
      { id: 'ep16', eventId: 'e4', userId: 'user-artem' },
      { id: 'ep17', eventId: 'e4', userId: 'user-yulia' },
      { id: 'ep18', eventId: 'e4', userId: 'user-me' },
      { id: 'ep19', eventId: 'e5', userId: 'user-me' },
    ],
  });

  await prisma.eventAttendance.createMany({
    data: [
      { id: 'ea1', eventId: 'e1', userId: 'user-anya', status: 'checked_in', checkedInAt: new Date('2026-04-18T20:02:00.000Z'), checkedInById: 'user-anya', checkInMethod: 'host_manual' },
      { id: 'ea2', eventId: 'e1', userId: 'user-mark', status: 'checked_in', checkedInAt: new Date('2026-04-18T20:06:00.000Z'), checkedInById: 'user-anya', checkInMethod: 'host_manual' },
      { id: 'ea3', eventId: 'e1', userId: 'user-liza', status: 'checked_in', checkedInAt: new Date('2026-04-18T20:10:00.000Z'), checkedInById: 'user-anya', checkInMethod: 'host_manual' },
      { id: 'ea4', eventId: 'e1', userId: 'user-me', status: 'checked_in', checkedInAt: new Date('2026-04-18T20:12:00.000Z'), checkedInById: 'user-anya', checkInMethod: 'host_manual' },
      { id: 'ea5', eventId: 'e5', userId: 'user-me', status: 'checked_in', checkedInAt: new Date('2026-04-19T18:28:00.000Z'), checkedInById: 'user-me', checkInMethod: 'host_manual' },
    ],
  });

  await prisma.eventJoinRequest.createMany({
    data: [
      {
        id: 'jr1',
        eventId: 'e5',
        userId: 'user-sonya',
        note: 'Первый раз на встрече, хочу спокойный вечер.',
        status: 'pending',
        compatibilityScore: 87,
      },
      {
        id: 'jr2',
        eventId: 'e5',
        userId: 'user-artem',
        note: 'Можно ли присоединиться после 19:00?',
        status: 'approved',
        compatibilityScore: 61,
        reviewedById: 'user-me',
        reviewedAt: new Date('2026-04-19T15:10:00.000Z'),
      },
    ],
  });

  await prisma.eventLiveState.createMany({
    data: [
      {
        id: 'ls1',
        eventId: 'e1',
        status: 'live',
        startedAt: new Date('2026-04-18T20:00:00.000Z'),
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
      { id: 'mc2', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Настолки и кофе', emoji: '♟️', eventId: 'e3' },
      { id: 'mc3', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Вечерняя пробежка', emoji: '🌿', eventId: 'e2' },
      { id: 'mc4', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Кино под открытым небом', emoji: '🎬', eventId: 'e4' },
      { id: 'mc5', kind: ChatKind.meetup, origin: ChatOrigin.meetup, title: 'Камерный ужин по заявкам', emoji: '🍝', eventId: 'e5' },
      { id: 'p1', kind: ChatKind.direct, origin: ChatOrigin.meetup, directKey: 'user-anya:user-me', sourceEventId: 'e1' },
      { id: 'p2', kind: ChatKind.direct, origin: ChatOrigin.meetup, directKey: 'user-mark:user-me', sourceEventId: 'e1' },
      { id: 'p3', kind: ChatKind.direct, origin: ChatOrigin.meetup, directKey: 'user-me:user-sonya', sourceEventId: 'e2' },
      { id: 'p4', kind: ChatKind.direct, origin: ChatOrigin.people, directKey: 'user-liza:user-me' },
    ],
  });

  await prisma.chatMember.createMany({
    data: [
      { id: 'cm1', chatId: 'mc1', userId: 'user-anya', lastReadMessageId: 'm7' },
      { id: 'cm2', chatId: 'mc1', userId: 'user-mark', lastReadMessageId: 'm7' },
      { id: 'cm3', chatId: 'mc1', userId: 'user-liza', lastReadMessageId: 'm7' },
      { id: 'cm4', chatId: 'mc1', userId: 'user-me', lastReadMessageId: 'm2' },
      { id: 'cm5', chatId: 'mc2', userId: 'user-katya', lastReadMessageId: 'm8' },
      { id: 'cm6', chatId: 'mc2', userId: 'user-pasha', lastReadMessageId: 'm8' },
      { id: 'cm7', chatId: 'mc2', userId: 'user-ira', lastReadMessageId: 'm8' },
      { id: 'cm8', chatId: 'mc2', userId: 'user-timur', lastReadMessageId: 'm8' },
      { id: 'cm9', chatId: 'mc2', userId: 'user-lena', lastReadMessageId: 'm8' },
      { id: 'cm10', chatId: 'mc2', userId: 'user-me', lastReadMessageId: 'm8-prev' },
      { id: 'cm11', chatId: 'mc3', userId: 'user-dima', lastReadMessageId: 'm9' },
      { id: 'cm12', chatId: 'mc3', userId: 'user-sonya', lastReadMessageId: 'm9' },
      { id: 'cm13', chatId: 'mc3', userId: 'user-oleg', lastReadMessageId: 'm9' },
      { id: 'cm14', chatId: 'mc3', userId: 'user-me', lastReadMessageId: 'm9' },
      { id: 'cm15', chatId: 'mc4', userId: 'user-masha', lastReadMessageId: 'm10' },
      { id: 'cm16', chatId: 'mc4', userId: 'user-artem', lastReadMessageId: 'm10' },
      { id: 'cm17', chatId: 'mc4', userId: 'user-yulia', lastReadMessageId: 'm10' },
      { id: 'cm18', chatId: 'mc4', userId: 'user-me', lastReadMessageId: 'm10' },
      { id: 'cm19a', chatId: 'mc5', userId: 'user-me', lastReadMessageId: 'm11' },
      { id: 'cm19b', chatId: 'mc5', userId: 'user-artem', lastReadMessageId: 'm11' },
      { id: 'cm19', chatId: 'p1', userId: 'user-anya', lastReadMessageId: 'p6' },
      { id: 'cm20', chatId: 'p1', userId: 'user-me', lastReadMessageId: 'p3' },
      { id: 'cm21', chatId: 'p2', userId: 'user-mark', lastReadMessageId: 'p7' },
      { id: 'cm22', chatId: 'p2', userId: 'user-me', lastReadMessageId: 'p7' },
      { id: 'cm23', chatId: 'p3', userId: 'user-sonya', lastReadMessageId: 'p8' },
      { id: 'cm24', chatId: 'p3', userId: 'user-me', lastReadMessageId: 'p8-prev' },
      { id: 'cm25', chatId: 'p4', userId: 'user-liza', lastReadMessageId: 'p9' },
      { id: 'cm26', chatId: 'p4', userId: 'user-me', lastReadMessageId: 'p9' },
    ],
  });

  await prisma.message.createMany({
    data: [
      { id: 'm1', chatId: 'mc1', senderId: 'user-anya', text: 'Привет всем 👋 кто уже в пути?', clientMessageId: 'client-m1', createdAt: new Date('2026-04-18T19:42:00.000Z') },
      { id: 'm2', chatId: 'mc1', senderId: 'user-mark', text: 'Я через 20 минут буду', clientMessageId: 'client-m2', createdAt: new Date('2026-04-18T19:43:00.000Z') },
      { id: 'm3', chatId: 'mc1', senderId: 'user-mark', text: 'Захватить кому-то место?', clientMessageId: 'client-m3', createdAt: new Date('2026-04-18T19:43:30.000Z') },
      { id: 'm4', chatId: 'mc1', senderId: 'user-me', text: 'Да, придержи на одного', clientMessageId: 'client-m4', createdAt: new Date('2026-04-18T19:45:00.000Z') },
      { id: 'm5', chatId: 'mc1', senderId: 'user-me', text: 'Буду к восьми ровно', clientMessageId: 'client-m5', createdAt: new Date('2026-04-18T19:45:20.000Z') },
      { id: 'm6', chatId: 'mc1', senderId: 'user-liza', text: 'Я с подругой, ок?', clientMessageId: 'client-m6', createdAt: new Date('2026-04-18T19:48:00.000Z') },
      { id: 'm7', chatId: 'mc1', senderId: 'user-anya', text: 'Я возьму столик у окна, садитесь к нам', clientMessageId: 'client-m7', createdAt: new Date('2026-04-18T19:51:00.000Z') },
      { id: 'm8-prev', chatId: 'mc2', senderId: 'user-katya', text: 'Берите кофе заранее', clientMessageId: 'client-m8-prev', createdAt: new Date('2026-04-18T18:40:00.000Z') },
      { id: 'm8', chatId: 'mc2', senderId: 'user-pasha', text: 'Принесу Codenames, кто за?', clientMessageId: 'client-m8', createdAt: new Date('2026-04-18T18:48:00.000Z') },
      { id: 'm9', chatId: 'mc3', senderId: 'user-dima', text: 'Соберёмся у фонтана', clientMessageId: 'client-m9', createdAt: new Date('2026-04-18T18:00:00.000Z') },
      { id: 'm10', chatId: 'mc4', senderId: 'user-masha', text: 'Маша поделилась фото', clientMessageId: 'client-m10', createdAt: new Date('2026-04-17T21:00:00.000Z') },
      { id: 'm11', chatId: 'mc5', senderId: 'user-me', text: 'Жду вас к 18:30, адрес в карточке', clientMessageId: 'client-m11', createdAt: new Date('2026-04-19T17:55:00.000Z') },
      { id: 'p1', chatId: 'p1', senderId: 'user-anya', text: 'Привет 🙂 классно сегодня посидели', clientMessageId: 'client-p1', createdAt: new Date('2026-04-18T21:02:00.000Z') },
      { id: 'p2', chatId: 'p1', senderId: 'user-me', text: 'Согласен. Ты долго оставалась?', clientMessageId: 'client-p2', createdAt: new Date('2026-04-18T21:04:00.000Z') },
      { id: 'p3', chatId: 'p1', senderId: 'user-anya', text: 'Ещё час примерно', clientMessageId: 'client-p3', createdAt: new Date('2026-04-18T21:05:00.000Z') },
      { id: 'p4', chatId: 'p1', senderId: 'user-anya', text: 'В пятницу настолки, пойдёшь?', clientMessageId: 'client-p4', createdAt: new Date('2026-04-18T21:05:20.000Z') },
      { id: 'p5', chatId: 'p1', senderId: 'user-me', text: 'Пойду. Скинь детали', clientMessageId: 'client-p5', createdAt: new Date('2026-04-18T21:07:00.000Z') },
      { id: 'p6', chatId: 'p1', senderId: 'user-anya', text: 'Тогда до восьми у входа?', clientMessageId: 'client-p6', createdAt: new Date('2026-04-18T21:09:00.000Z') },
      { id: 'p7', chatId: 'p2', senderId: 'user-me', text: 'спасибо за вечер 🙏', clientMessageId: 'client-p7', createdAt: new Date('2026-04-18T20:42:00.000Z') },
      { id: 'p8-prev', chatId: 'p3', senderId: 'user-me', text: 'Если что, я буду возле метро', clientMessageId: 'client-p8-prev', createdAt: new Date('2026-04-18T17:50:00.000Z') },
      { id: 'p8', chatId: 'p3', senderId: 'user-sonya', text: 'Можем встретиться раньше', clientMessageId: 'client-p8', createdAt: new Date('2026-04-18T18:10:00.000Z') },
      { id: 'p9', chatId: 'p4', senderId: 'user-liza', text: 'Договорились 🌿', clientMessageId: 'client-p9', createdAt: new Date('2026-04-17T20:00:00.000Z') },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        id: 'n1',
        userId: 'user-me',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Аня К: Тогда до восьми у входа?',
        payload: { chatId: 'p1', messageId: 'p6' },
      },
      {
        id: 'n2',
        userId: 'user-me',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Паша: Принесу Codenames, кто за?',
        payload: { chatId: 'mc2', messageId: 'm8' },
      },
      {
        id: 'n3',
        userId: 'user-me',
        kind: 'event_joined',
        title: 'Новая заявка',
        body: 'Соня М хочет попасть на камерный ужин',
        payload: { eventId: 'e5', requestId: 'jr1' },
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
        blockedUserId: 'user-oleg',
      },
    ],
  });

  await prisma.userReport.createMany({
    data: [
      {
        id: 'ur1',
        reporterId: 'user-me',
        targetUserId: 'user-oleg',
        reason: 'spam',
        details: 'Писал рекламу в личные сообщения',
        status: 'in_review',
        blockRequested: true,
      },
      {
        id: 'ur2',
        reporterId: 'user-me',
        targetUserId: 'user-dima',
        reason: 'rude',
        details: 'Грубил в чате встречи',
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
        caption: 'Сомелье читает стихи. Мы плачем.',
        emoji: '🎶',
      },
      {
        id: 'st3',
        eventId: 'e1',
        authorId: 'user-liza',
        caption: 'Завтра пробежка, кто со мной?',
        emoji: '🌿',
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
