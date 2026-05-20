import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type DrawTicket = {
  id: string;
  code: string;
  userId: string;
};

@Injectable()
export class DropsDrawService {
  constructor(private readonly prismaService: PrismaService) {}

  static hashSeed(seed: string) {
    return createHash('sha256').update(seed).digest('hex');
  }

  static orderTicketsForDraw<T extends DrawTicket>(
    secretSeed: string,
    dropId: string,
    tickets: readonly T[],
  ) {
    return [...tickets]
      .sort((left, right) => {
        const leftHash = this.ticketDrawHash(secretSeed, dropId, left.code, left.id);
        const rightHash = this.ticketDrawHash(secretSeed, dropId, right.code, right.id);
        return leftHash.localeCompare(rightHash) || left.id.localeCompare(right.id);
      });
  }

  static ticketDrawHash(
    secretSeed: string,
    dropId: string,
    ticketCode: string,
    stableIndex: string,
  ) {
    return createHash('sha256')
      .update(`${secretSeed}${dropId}${ticketCode}${stableIndex}`)
      .digest('hex');
  }

  async activateDrop(dropId: string) {
    const drop = await this.prismaService.client.drop.findUnique({
      where: { id: dropId },
      select: {
        id: true,
        status: true,
        seedHash: true,
        secretSeed: true,
      },
    });
    if (!drop) {
      throw new ApiError(404, 'drop_not_found', 'Drop not found');
    }
    if (drop.status !== 'draft' && drop.status !== 'scheduled') {
      throw new ApiError(409, 'drop_status_invalid', 'Drop status is invalid');
    }

    const secretSeed = drop.secretSeed ?? randomBytes(32).toString('hex');
    const seedHash = drop.seedHash ?? DropsDrawService.hashSeed(secretSeed);
    return this.prismaService.client.drop.update({
      where: { id: drop.id },
      data: {
        status: 'active',
        secretSeed,
        seedHash,
      },
      select: this.dropSelect(),
    });
  }

  async runDraw(
    dropId: string,
    options: { winnerCount?: number; reserveCount?: number } = {},
  ) {
    return this.prismaService.client.$transaction(async (tx) => {
      const drop = await tx.drop.findUnique({
        where: { id: dropId },
        select: {
          id: true,
          status: true,
          prizes: true,
          secretSeed: true,
          seedHash: true,
        },
      });
      if (!drop) {
        throw new ApiError(404, 'drop_not_found', 'Drop not found');
      }
      if (drop.status !== 'active' && drop.status !== 'drawing_pending') {
        throw new ApiError(409, 'drop_status_invalid', 'Drop status is invalid');
      }

      const secretSeed = drop.secretSeed ?? randomBytes(32).toString('hex');
      const seedHash = drop.seedHash ?? DropsDrawService.hashSeed(secretSeed);
      const tickets = await tx.dropTicket.findMany({
        where: {
          dropId,
          status: 'active',
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          code: true,
          userId: true,
        },
      });

      if (tickets.length === 0) {
        throw new ApiError(409, 'drop_has_no_tickets', 'Drop has no tickets');
      }

      const orderedTickets = DropsDrawService.orderTicketsForDraw(
        secretSeed,
        dropId,
        tickets,
      );
      const prizes = Array.isArray(drop.prizes) ? drop.prizes : [];
      const winnerCount = this.normalizePositiveInt(
        options.winnerCount,
        Math.max(1, prizes.length || 1),
      );
      const reserveCount = Math.max(0, Math.trunc(options.reserveCount ?? 0));
      const selected = orderedTickets.slice(0, winnerCount + reserveCount);
      const participantCount = new Set(tickets.map((ticket) => ticket.userId)).size;

      await tx.drop.update({
        where: { id: dropId },
        data: {
          status: 'drawing_pending',
          secretSeed,
          seedHash,
        },
      });
      await tx.dropDrawSnapshot.upsert({
        where: { dropId },
        update: {
          seedHash,
          secretSeed,
          ticketCount: tickets.length,
          participantCount,
          tickets: tickets as unknown as Prisma.InputJsonValue,
        },
        create: {
          dropId,
          seedHash,
          secretSeed,
          ticketCount: tickets.length,
          participantCount,
          tickets: tickets as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.dropTicket.updateMany({
        where: {
          dropId,
          status: 'active',
        },
        data: {
          status: 'used_in_draw',
        },
      });

      await tx.dropWinner.deleteMany({ where: { dropId } });
      for (const [index, ticket] of selected.entries()) {
        const reserve = index >= winnerCount;
        const position = reserve ? index - winnerCount + 1 : index + 1;
        await tx.dropWinner.create({
          data: {
            dropId,
            userId: ticket.userId,
            ticketId: ticket.id,
            position,
            reserve,
            prize: (prizes[index] ?? {}) as Prisma.InputJsonValue,
          },
        });
      }
      await tx.dropTicket.updateMany({
        where: {
          id: {
            in: selected.slice(0, winnerCount).map((ticket) => ticket.id),
          },
        },
        data: {
          status: 'winner',
        },
      });

      return tx.drop.update({
        where: { id: dropId },
        data: {
          status: 'finished',
          seedRevealedAt: new Date(),
        },
        select: this.dropSelect(),
      });
    });
  }

  private normalizePositiveInt(value: number | undefined, fallback: number) {
    const parsed = Math.trunc(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  private dropSelect() {
    return {
      id: true,
      title: true,
      type: true,
      status: true,
      startsAt: true,
      endsAt: true,
      drawAt: true,
      seedHash: true,
      secretSeed: true,
      seedRevealedAt: true,
    } satisfies Prisma.DropSelect;
  }
}
