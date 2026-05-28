import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';
import { SubscriptionService } from './subscription.service';

const DEFAULT_FREE_MEETUP_WEEKLY_LIMIT = 7;
const DEFAULT_FREE_AI_DRAFT_WEEKLY_LIMIT = 3;

export async function assertCanCreateWeeklyMeetup(
  userId: string,
  prismaService: PrismaService,
  subscriptionService: SubscriptionService,
) {
  const client = prismaService.client as any;
  if (typeof client.event?.count !== 'function') {
    return;
  }

  const [premium, rules] = await Promise.all([
    typeof (subscriptionService as any).hasPremiumAccess === 'function'
      ? subscriptionService.hasPremiumAccess(userId)
      : Promise.resolve(false),
    typeof (subscriptionService as any).getPlusBenefitRules === 'function'
      ? (subscriptionService as any).getPlusBenefitRules()
      : Promise.resolve({
          freeMeetupMonthlyLimit: DEFAULT_FREE_MEETUP_WEEKLY_LIMIT,
          plusMeetupMonthlyLimit: null,
        }),
  ]);
  const limit = premium
    ? rules.plusMeetupMonthlyLimit
    : rules.freeMeetupMonthlyLimit;
  if (limit == null) {
    return;
  }

  const window = currentMoscowWeekWindow();
  const [createdEvents, createdAiDrafts] = await Promise.all([
    client.event.count({
      where: {
        hostId: userId,
        createdAt: {
          gte: window.start,
          lt: window.end,
        },
      },
    }),
    typeof client.eveningAiRouteDraft?.count === 'function'
      ? client.eveningAiRouteDraft.count({
          where: {
            userId,
            createdAt: {
              gte: window.start,
              lt: window.end,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  if (createdEvents + createdAiDrafts >= limit) {
    throw new ApiError(
      429,
      'event_weekly_limit_reached',
      'Weekly meetup creation limit reached',
      {
        limit,
        remaining: 0,
        resetAt: window.end.toISOString(),
      },
    );
  }
}

export async function assertCanCreateWeeklyAiDraft(
  userId: string,
  prismaService: PrismaService,
  subscriptionService: SubscriptionService,
) {
  const client = prismaService.client as any;
  if (typeof client.eveningAiRouteDraft?.count !== 'function') {
    return;
  }

  const premium =
    typeof (subscriptionService as any).hasPremiumAccess === 'function'
      ? await subscriptionService.hasPremiumAccess(userId)
      : false;
  if (premium) {
    return;
  }

  const window = currentMoscowWeekWindow();
  const createdAiDrafts = await client.eveningAiRouteDraft.count({
    where: {
      userId,
      createdAt: {
        gte: window.start,
        lt: window.end,
      },
    },
  });

  if (createdAiDrafts >= DEFAULT_FREE_AI_DRAFT_WEEKLY_LIMIT) {
    throw new ApiError(
      429,
      'event_weekly_limit_reached',
      'Weekly AI builder limit reached',
      {
        limit: DEFAULT_FREE_AI_DRAFT_WEEKLY_LIMIT,
        remaining: 0,
        resetAt: window.end.toISOString(),
      },
    );
  }
}

function currentMoscowWeekWindow() {
  const moscowOffsetMs = 3 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + moscowOffsetMs);
  const dayOfWeek = shifted.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const start = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysSinceMonday,
    ) - moscowOffsetMs,
  );
  const end = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysSinceMonday + 7,
    ) - moscowOffsetMs,
  );
  return { start, end };
}
