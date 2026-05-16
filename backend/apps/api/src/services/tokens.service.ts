import { Injectable } from '@nestjs/common';
import { Prisma, TokenLedgerReason } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';
import {
  findTokenPackProduct,
  findTokenPromotionOption,
  tokenPromotionOptions,
} from './payment-catalog';

type PrismaLike = Prisma.TransactionClient;

const ledgerNotes: Record<string, string> = {
  purchase: 'Пополнение токенов',
  promotion_spend: 'Продвижение',
  subscription_spend: 'Frendly+',
  reward_grant: 'Подарок сезона',
  admin_adjustment: 'Корректировка',
};

@Injectable()
export class TokensService {
  constructor(private readonly prismaService: PrismaService) {}

  async getWallet(userId: string, client: PrismaLike = this.prismaService.client) {
    const wallet = await this.ensureWallet(userId, client);
    const [history, promotions] = await Promise.all([
      client.tokenLedgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amount: true,
          reason: true,
          createdAt: true,
        },
      }),
      client.tokenPromotion.findMany({
        where: {
          userId,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { expiresAt: 'desc' },
        select: {
          eventId: true,
          chatId: true,
          optionId: true,
          expiresAt: true,
        },
      }),
    ]);

    return {
      balance: wallet.balance,
      history: history.map((entry) => ({
        id: entry.id,
        type: entry.amount >= 0 ? 'topup' : 'spend',
        amount: Math.abs(entry.amount),
        note: ledgerNotes[entry.reason] ?? 'Операция',
        timestamp: entry.createdAt.toISOString(),
      })),
      promoted: promotions
        .map((promotion) => ({
          targetId: promotion.eventId ?? promotion.chatId,
          optionId: promotion.optionId,
          expiresAt: promotion.expiresAt.toISOString(),
        }))
        .filter((promotion) => promotion.targetId != null),
      promoOptions: tokenPromotionOptions,
    };
  }

  async creditPurchasedTokens(
    userId: string,
    packId: string,
    paymentOrderId: string,
    client: PrismaLike = this.prismaService.client,
  ) {
    const pack = findTokenPackProduct(packId);
    const wallet = await this.ensureWallet(userId, client);
    await client.tokenLedgerEntry.create({
      data: {
        walletId: wallet.id,
        paymentOrderId,
        amount: pack.tokens,
        reason: 'purchase',
      },
    });
    await client.tokenWallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: pack.tokens,
        },
      },
    });
  }

  async spendTokens(
    userId: string,
    input: {
      amount: number;
      reason: Extract<TokenLedgerReason, 'promotion_spend' | 'subscription_spend'>;
    },
    client: PrismaLike = this.prismaService.client,
  ) {
    const wallet = await this.ensureWallet(userId, client);

    if (wallet.balance < input.amount) {
      throw new ApiError(402, 'tokens_insufficient', 'Not enough tokens');
    }

    const debit = await client.tokenWallet.updateMany({
      where: {
        id: wallet.id,
        balance: {
          gte: input.amount,
        },
      },
      data: {
        balance: {
          decrement: input.amount,
        },
      },
    });

    if (debit.count !== 1) {
      throw new ApiError(402, 'tokens_insufficient', 'Not enough tokens');
    }

    return client.tokenLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount: -input.amount,
        reason: input.reason,
      },
    });
  }

  async createPromotion(userId: string, body: Record<string, unknown>) {
    const targetKind = typeof body.targetKind === 'string' ? body.targetKind : '';
    const targetId = typeof body.targetId === 'string' ? body.targetId : '';
    const optionId = typeof body.optionId === 'string' ? body.optionId : '';
    const option = findTokenPromotionOption(optionId);

    if (targetKind !== 'event' && targetKind !== 'chat') {
      throw new ApiError(400, 'invalid_token_promotion_target', 'Promotion target is invalid');
    }
    if (!targetId) {
      throw new ApiError(400, 'invalid_token_promotion_target', 'Promotion target is invalid');
    }

    return this.prismaService.client.$transaction(async (client) => {
      await this.assertPromotionAccess(userId, targetKind, targetId, client);
      const ledgerEntry = await this.spendTokens(
        userId,
        {
          amount: option.cost,
          reason: 'promotion_spend',
        },
        client,
      );
      await client.tokenPromotion.create({
        data: {
          userId,
          eventId: targetKind === 'event' ? targetId : null,
          chatId: targetKind === 'chat' ? targetId : null,
          optionId: option.id,
          expiresAt: new Date(Date.now() + option.durationHours * 60 * 60 * 1000),
          ledgerEntryId: ledgerEntry.id,
        },
      });

      return this.getWallet(userId, client);
    });
  }

  private async ensureWallet(userId: string, client: PrismaLike) {
    return client.tokenWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        balance: 0,
      },
      select: {
        id: true,
        userId: true,
        balance: true,
      },
    });
  }

  private async assertPromotionAccess(
    userId: string,
    targetKind: 'event' | 'chat',
    targetId: string,
    client: PrismaLike,
  ) {
    if (targetKind === 'event') {
      const event = await client.event.findFirst({
        where: {
          id: targetId,
          hostId: userId,
          canceledAt: null,
        },
        select: { id: true },
      });
      if (!event) {
        throw new ApiError(403, 'token_promotion_forbidden', 'Promotion is forbidden');
      }
      return;
    }

    const member = await client.chatMember.findFirst({
      where: {
        chatId: targetId,
        userId,
      },
      select: { id: true },
    });
    if (!member) {
      throw new ApiError(403, 'token_promotion_forbidden', 'Promotion is forbidden');
    }
  }
}
