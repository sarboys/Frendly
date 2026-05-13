import { ApiError } from '../common/api-error';

export type PaymentProductKindValue = 'subscription' | 'tokens';

export type SubscriptionProduct = {
  kind: 'subscription';
  id: 'month' | 'year';
  label: string;
  description: string;
  amountKopecks: number;
  priceRub: number;
  priceMonthlyRub: number;
  trialDays: number;
  durationDays: number;
  badge: string | null;
};

export type TokenPackProduct = {
  kind: 'tokens';
  id: 'p1' | 'p2' | 'p3' | 'p4';
  label: string;
  description: string;
  amountKopecks: number;
  priceRub: number;
  tokens: number;
  bonus: number;
  best: boolean;
};

export type PaymentProduct = SubscriptionProduct | TokenPackProduct;

export type TokenPromotionOption = {
  id: 'boost-24' | 'boost-72' | 'spotlight';
  title: string;
  subtitle: string;
  cost: number;
  durationHours: number;
};

export const subscriptionProducts: readonly SubscriptionProduct[] = [
  {
    kind: 'subscription',
    id: 'month',
    label: 'Месячный',
    description: 'Frendly+ на месяц',
    amountKopecks: 79900,
    priceRub: 799,
    priceMonthlyRub: 799,
    trialDays: 0,
    durationDays: 30,
    badge: null,
  },
  {
    kind: 'subscription',
    id: 'year',
    label: 'Годовой',
    description: 'Frendly+ на год',
    amountKopecks: 478800,
    priceRub: 4788,
    priceMonthlyRub: 399,
    trialDays: 0,
    durationDays: 365,
    badge: '-50%',
  },
];

export const tokenPackProducts: readonly TokenPackProduct[] = [
  {
    kind: 'tokens',
    id: 'p1',
    label: 'Базовый',
    description: 'Frendly Tokens: 100',
    amountKopecks: 19900,
    priceRub: 199,
    tokens: 100,
    bonus: 0,
    best: false,
  },
  {
    kind: 'tokens',
    id: 'p2',
    label: 'Популярный',
    description: 'Frendly Tokens: 350',
    amountKopecks: 49900,
    priceRub: 499,
    tokens: 350,
    bonus: 0,
    best: true,
  },
  {
    kind: 'tokens',
    id: 'p3',
    label: 'Хост',
    description: 'Frendly Tokens: 900',
    amountKopecks: 99900,
    priceRub: 999,
    tokens: 900,
    bonus: 0,
    best: false,
  },
  {
    kind: 'tokens',
    id: 'p4',
    label: 'Pro',
    description: 'Frendly Tokens: 2700',
    amountKopecks: 249900,
    priceRub: 2499,
    tokens: 2700,
    bonus: 0,
    best: false,
  },
];

export const tokenPromotionOptions: readonly TokenPromotionOption[] = [
  {
    id: 'boost-24',
    title: 'Буст · 24 часа',
    subtitle: 'Топ ленты + бейдж',
    cost: 80,
    durationHours: 24,
  },
  {
    id: 'boost-72',
    title: 'Буст · 3 дня',
    subtitle: 'Закреп в карусели',
    cost: 200,
    durationHours: 72,
  },
  {
    id: 'spotlight',
    title: 'Spotlight · неделя',
    subtitle: 'Главный экран + push',
    cost: 500,
    durationHours: 168,
  },
];

export function findPaymentProduct(
  productKind: string,
  productId: string,
): PaymentProduct {
  const products =
    productKind === 'subscription'
      ? subscriptionProducts
      : productKind === 'tokens'
        ? tokenPackProducts
        : null;

  const product = products?.find((item) => item.id === productId);
  if (!product) {
    throw new ApiError(400, 'payment_product_not_found', 'Payment product not found');
  }
  return product;
}

export function findSubscriptionProduct(plan: string): SubscriptionProduct {
  const product = subscriptionProducts.find((item) => item.id === plan);
  if (!product) {
    throw new ApiError(400, 'invalid_subscription_plan', 'Subscription plan is invalid');
  }
  return product;
}

export function findTokenPackProduct(packId: string): TokenPackProduct {
  const product = tokenPackProducts.find((item) => item.id === packId);
  if (!product) {
    throw new ApiError(400, 'invalid_token_pack', 'Token pack is invalid');
  }
  return product;
}

export function findTokenPromotionOption(optionId: string): TokenPromotionOption {
  const option = tokenPromotionOptions.find((item) => item.id === optionId);
  if (!option) {
    throw new ApiError(400, 'invalid_token_promotion_option', 'Promotion option is invalid');
  }
  return option;
}
