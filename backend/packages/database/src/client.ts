import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __bigBreakPrisma__: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!global.__bigBreakPrisma__) {
    global.__bigBreakPrisma__ = new PrismaClient();
  }

  return global.__bigBreakPrisma__;
}
