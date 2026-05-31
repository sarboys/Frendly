import { Injectable, Optional } from '@nestjs/common';
import { Prisma, TokenLedgerReason } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { DropsRewardService } from './drops-reward.service';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';
import {
  findTokenPackProduct,
  findTokenPromotionOption,
  tokenPromotionOptions,
} from './payment-catalog';

type PrismaLike = Prisma.TransactionClient;
const TOKEN_WALLET_CACHE_SECONDS = 5;

const ledgerNotes: Record<string, string> = {
  purchase: 'Пополнение токенов',
  promotion_spend: 'Продвижение',
  subscription_spend: 'Frendly+',
  dating_spend: 'Дейтинг',
  reward_grant: 'Подарок сезона',
  admin_adjustment: 'Корректировка',
};

@Injectable()
export class TokensService {
  private readonly pendingWalletLoads = new Map<string, Promise<any>>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly dropsRewardService?: DropsRewardService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async getWallet(userId: string, client: PrismaLike = this.prismaService.client) {
    if (client !== this.prismaService.client) {
      return this.loadFreshWallet(userId, client);
    }

    const cacheKey = this.walletCacheKey(userId);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingWalletLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshWallet(userId, client)
      .then(async (wallet) => {
        await this.redisCache?.setJson(cacheKey, wallet, TOKEN_WALLET_CACHE_SECONDS);
        return wallet;
      })
      .finally(() => {
        this.pendingWalletLoads.delete(cacheKey);
      });
    this.pendingWalletLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshWallet(userId: string, client: PrismaLike) {
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
    packInput: string | { packId: string; tokens: number; bonus?: number },
    paymentOrderId: string,
    client: PrismaLike = this.prismaService.client,
  ) {
    const pack = typeof packInput === 'string'
      ? findTokenPackProduct(packInput)
      : {
          id: packInput.packId,
          tokens: packInput.tokens + (packInput.bonus ?? 0),
        };
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
    await this.clearWalletCache(userId);
  }

  async spendTokens(
    userId: string,
    input: {
      amount: number;
      reason: Extract<
        TokenLedgerReason,
        'promotion_spend' | 'subscription_spend' | 'dating_spend'
      >;
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

    const ledgerEntry = await client.tokenLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount: -input.amount,
        reason: input.reason,
      },
    });
    await this.clearWalletCache(userId);
    return ledgerEntry;
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

    const wallet = await this.prismaService.client.$transaction(async (client) => {
      await this.assertPromotionAccess(userId, targetKind, targetId, client);
      const ledgerEntry = await this.spendTokens(
        userId,
        {
          amount: option.cost,
          reason: 'promotion_spend',
        },
        client,
      );
      const promotion = await client.tokenPromotion.create({
        data: {
          userId,
          eventId: targetKind === 'event' ? targetId : null,
          chatId: targetKind === 'chat' ? targetId : null,
          optionId: option.id,
          expiresAt: new Date(Date.now() + option.durationHours * 60 * 60 * 1000),
          ledgerEntryId: ledgerEntry.id,
        },
      });
      if (targetKind === 'event') {
        await this.grantDropsBoostReward(userId, promotion.id, targetId, client);
      }

      return this.getWallet(userId, client);
    });
    await this.clearWalletCache(userId);
    return wallet;
  }

  private async grantDropsBoostReward(
    userId: string,
    promotionId: string,
    eventId: string,
    client: PrismaLike,
  ) {
    if (!this.dropsRewardService) {
      return;
    }

    try {
      await this.dropsRewardService.grantBoostReward(
        userId,
        promotionId,
        eventId,
        new Date(Date.now()),
        client,
      );
    } catch {
      // Drops rewards must not block promotion activation.
    }
  }

  private async ensureWallet(userId: string, client: PrismaLike) {
    const wallet = await client.tokenWallet.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        balance: true,
      },
    });
    if (wallet != null) {
      return wallet;
    }

    return client.tokenWallet.create({
      data: {
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

  private walletCacheKey(userId: string) {
    return ['api', 'tokens-wallet', 'v1', userId].join(':');
  }

  private async clearWalletCache(userId: string) {
    this.pendingWalletLoads.delete(this.walletCacheKey(userId));
    await this.redisCache?.delete(this.walletCacheKey(userId));
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
