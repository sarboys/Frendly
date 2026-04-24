import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';

export async function assertEventCapacityAvailable(
  tx: Prisma.TransactionClient,
  eventId: string,
) {
  const events = await tx.$queryRaw<Array<{ capacity: number }>>`
    SELECT "capacity"
    FROM "Event"
    WHERE "id" = ${eventId}
    FOR UPDATE
  `;
  const event = events[0];

  if (event == null) {
    throw new ApiError(404, 'event_not_found', 'Event not found');
  }

  const participantsCount = await tx.eventParticipant.count({
    where: { eventId },
  });

  if (participantsCount >= event.capacity) {
    throw new ApiError(409, 'event_full', 'Event capacity is full');
  }
}
