import { PrismaClient } from '@prisma/client';
import {
  ConcurrentIndexStatement,
  createConcurrentIndexes,
} from '../src/concurrent-indexes';

const prisma = new PrismaClient();

const statements: ConcurrentIndexStatement[] = [
  {
    name: 'User_displayName_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_displayName_id_idx" ON "User"("displayName", "id")',
  },
  {
    name: 'UserSettings_discoverable_userId_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserSettings_discoverable_userId_idx" ON "UserSettings"("discoverable", "userId")',
  },
  {
    name: 'Event_startsAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Event_startsAt_id_idx" ON "Event"("startsAt", "id")',
  },
  {
    name: 'Event_hostId_startsAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Event_hostId_startsAt_id_idx" ON "Event"("hostId", "startsAt", "id")',
  },
  {
    name: 'EventJoinRequest_status_reviewedById_createdAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "EventJoinRequest_status_reviewedById_createdAt_id_idx" ON "EventJoinRequest"("status", "reviewedById", "createdAt", "id")',
  },
  {
    name: 'EventJoinRequest_eventId_status_reviewedById_createdAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "EventJoinRequest_eventId_status_reviewedById_createdAt_id_idx" ON "EventJoinRequest"("eventId", "status", "reviewedById", "createdAt", "id")',
  },
  {
    name: 'TrustedContact_userId_createdAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "TrustedContact_userId_createdAt_id_idx" ON "TrustedContact"("userId", "createdAt", "id")',
  },
  {
    name: 'TrustedContact_userId_phoneNumber_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "TrustedContact_userId_phoneNumber_idx" ON "TrustedContact"("userId", "phoneNumber")',
  },
  {
    name: 'UserReport_reporterId_status_createdAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserReport_reporterId_status_createdAt_id_idx" ON "UserReport"("reporterId", "status", "createdAt", "id")',
  },
  {
    name: 'UserReport_targetUserId_status_createdAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserReport_targetUserId_status_createdAt_id_idx" ON "UserReport"("targetUserId", "status", "createdAt", "id")',
  },
  {
    name: 'ChatMember_userId_chatId_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMember_userId_chatId_idx" ON "ChatMember"("userId", "chatId")',
  },
  {
    name: 'ChatMember_userId_unreadCount_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMember_userId_unreadCount_idx" ON "ChatMember"("userId", "unreadCount") WHERE "unreadCount" > 0',
  },
  {
    name: 'Message_chatId_createdAt_senderId_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_chatId_createdAt_senderId_idx" ON "Message"("chatId", "createdAt", "senderId")',
  },
  {
    name: 'Notification_userId_unread_non_message_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_unread_non_message_idx" ON "Notification"("userId", "createdAt", "id") WHERE "readAt" IS NULL AND "kind" <> \'message\'::"NotificationKind"',
  },
  {
    name: 'OutboxEvent_pending_available_createdAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_pending_available_createdAt_id_idx" ON "OutboxEvent"("availableAt", "createdAt", "id") WHERE "status" = \'pending\'::"OutboxStatus"',
  },
  {
    name: 'OutboxEvent_processing_lockedAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_processing_lockedAt_id_idx" ON "OutboxEvent"("lockedAt", "id") WHERE "status" = \'processing\'::"OutboxStatus"',
  },
  {
    name: 'PushToken_userId_deviceId_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "PushToken_userId_deviceId_idx" ON "PushToken"("userId", "deviceId")',
  },
  {
    name: 'PushToken_userId_disabledAt_updatedAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "PushToken_userId_disabledAt_updatedAt_id_idx" ON "PushToken"("userId", "disabledAt", "updatedAt" DESC, "id" DESC)',
  },
  {
    name: 'DatingAction_actor_action_updatedAt_target_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "DatingAction_actor_action_updatedAt_target_idx" ON "DatingAction"("actorUserId", "action", "updatedAt" DESC, "targetUserId")',
  },
  {
    name: 'DatingAction_target_action_actor_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "DatingAction_target_action_actor_idx" ON "DatingAction"("targetUserId", "action", "actorUserId")',
  },
  {
    name: 'UserSubscription_status_renewsAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserSubscription_status_renewsAt_id_idx" ON "UserSubscription"("status", "renewsAt", "id")',
  },
  {
    name: 'UserSubscription_status_trialEndsAt_id_idx',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserSubscription_status_trialEndsAt_id_idx" ON "UserSubscription"("status", "trialEndsAt", "id")',
  },
];

async function main() {
  await createConcurrentIndexes(prisma, statements, {
    onProgress: (event) => {
      if (event.action === 'drop-invalid') {
        console.log(`[hot-path-indexes] drop invalid ${event.statement.name}`);
        return;
      }

      console.log(`[hot-path-indexes] ${event.statement.sql}`);
    },
  });

  console.log('[hot-path-indexes] done');
}

main()
  .catch((error) => {
    console.error('[hot-path-indexes] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
