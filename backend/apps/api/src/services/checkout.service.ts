import { Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { DatingService } from './dating.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';
import { SubscriptionService } from './subscription.service';

type CheckoutSource = 'dating_swipe_limit' | 'plus_gate' | 'wallet';

type CheckoutSession = {
  userId: string;
  source: CheckoutSource;
  returnTo: string;
  expiresAt: string;
};

const SESSION_TTL_SECONDS = 15 * 60;
const memorySessions = new Map<string, CheckoutSession>();

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionService: SubscriptionService,
    private readonly datingService: DatingService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async createSession(userId: string, body: Record<string, unknown>) {
    const source = this.parseSource(body.source);
    const returnTo = this.parseReturnTo(body.returnTo);
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
      .toISOString();
    const session: CheckoutSession = {
      userId,
      source,
      returnTo,
      expiresAt,
    };

    await this.saveSession(token, session);

    return {
      checkoutUrl: `${this.checkoutBaseUrl()}/checkout/${token}`,
      expiresAt,
    };
  }

  async getPublicSession(token: string) {
    const session = await this.requireSession(token);
    const [user, catalog, subscription, datingLimits] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: session.userId },
        select: {
          displayName: true,
          email: true,
          phoneNumber: true,
        },
      }),
      this.paymentsService.getCatalog(session.userId),
      this.subscriptionService.getCurrent(session.userId),
      session.source === 'dating_swipe_limit'
        ? this.datingService.getLimits(session.userId)
        : Promise.resolve(null),
    ]);

    if (!user) {
      throw new ApiError(404, 'checkout_user_not_found', 'Checkout user not found');
    }

    return {
      token,
      source: session.source,
      returnTo: session.returnTo,
      expiresAt: session.expiresAt,
      user: {
        displayName: user.displayName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
      catalog,
      subscription,
      datingLimits,
      appReturnUrl: this.appReturnUrl(token, session.returnTo),
    };
  }

  async initPayment(token: string, body: Record<string, unknown>) {
    const session = await this.requireSession(token);
    return this.paymentsService.initCheckoutPayment(session.userId, {
      ...body,
      checkoutToken: token,
    });
  }

  async checkPayment(token: string, orderId: string) {
    const session = await this.requireSession(token);
    return this.paymentsService.checkPayment(session.userId, orderId);
  }

  private parseSource(value: unknown): CheckoutSource {
    return value === 'dating_swipe_limit' || value === 'plus_gate' || value === 'wallet'
      ? value
      : 'plus_gate';
  }

  private parseReturnTo(value: unknown) {
    if (typeof value !== 'string') {
      return '/dating';
    }
    const clean = value.trim();
    if (!clean.startsWith('/') || clean.startsWith('//') || clean.length > 120) {
      return '/dating';
    }
    return clean;
  }

  private async requireSession(token: string) {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new ApiError(404, 'checkout_session_not_found', 'Checkout session not found');
    }
    const session = await this.readSession(cleanToken);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      throw new ApiError(404, 'checkout_session_not_found', 'Checkout session not found');
    }
    return session;
  }

  private async readSession(token: string) {
    return (
      await this.redisCache?.getJson<CheckoutSession>(this.cacheKey(token))
    ) ?? memorySessions.get(token) ?? null;
  }

  private async saveSession(token: string, session: CheckoutSession) {
    memorySessions.set(token, session);
    await this.redisCache?.setJson(
      this.cacheKey(token),
      session,
      SESSION_TTL_SECONDS,
    );
  }

  private cacheKey(token: string) {
    return `checkout:session:v1:${token}`;
  }

  private checkoutBaseUrl() {
    return (
      process.env.CHECKOUT_PUBLIC_URL ??
      process.env.PUBLIC_LANDING_URL ??
      'https://frendly.tech'
    )
      .trim()
      .replace(/\/+$/, '');
  }

  private appReturnUrl(token: string, returnTo: string) {
    const scheme = process.env.APP_DEEP_LINK_SCHEME?.trim() || 'frendly';
    const params = new URLSearchParams({
      checkoutToken: token,
      returnTo,
    });
    return `${scheme}://payment/success?${params.toString()}`;
  }
}
