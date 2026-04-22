import { createHash, randomBytes, randomInt } from 'node:crypto';

export const TELEGRAM_AUTH_CODE_LENGTH = 6;
export const TELEGRAM_AUTH_TTL_MS = 10 * 60 * 1000;
export const TELEGRAM_AUTH_CONTACT_COOLDOWN_MS = 60 * 1000;
export const TELEGRAM_AUTH_MAX_ATTEMPTS = 5;
export const TELEGRAM_BOT_STATE_ID = 'default';

export interface TelegramAuthConfig {
  enabled: boolean;
  botToken?: string;
  botUsername?: string;
  pollIntervalMs: number;
}

export function getTelegramAuthConfig(): TelegramAuthConfig {
  const rawPollInterval = Number(process.env.TELEGRAM_POLL_INTERVAL_MS ?? '1500');
  const pollIntervalMs = Number.isFinite(rawPollInterval)
    ? Math.max(1000, Math.min(Math.trunc(rawPollInterval), 30_000))
    : 1500;

  return {
    enabled: process.env.TELEGRAM_AUTH_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
    botUsername: normalizeTelegramBotUsername(process.env.TELEGRAM_BOT_USERNAME),
    pollIntervalMs,
  };
}

export function normalizeTelegramBotUsername(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

export function generateTelegramStartToken() {
  return randomBytes(24).toString('hex');
}

export function buildTelegramBotStartPayload(startToken: string) {
  return `login_${startToken}`;
}

export function buildTelegramBotUrl(botUsername: string, startToken: string) {
  return `https://t.me/${botUsername}?start=${buildTelegramBotStartPayload(startToken)}`;
}

export function generateTelegramCode() {
  return `${randomInt(0, 10 ** TELEGRAM_AUTH_CODE_LENGTH)}`.padStart(
    TELEGRAM_AUTH_CODE_LENGTH,
    '0',
  );
}

export function generateTelegramCodeSalt() {
  return randomBytes(16).toString('hex');
}

export function deriveTelegramCodeFromSalt(salt: string) {
  const source = createHash('sha256').update(`telegram-code:${salt}`).digest('hex');
  const numeric = BigInt(`0x${source.slice(0, 12)}`) % BigInt(10 ** TELEGRAM_AUTH_CODE_LENGTH);
  return numeric.toString().padStart(TELEGRAM_AUTH_CODE_LENGTH, '0');
}

export function createTelegramCodePayload() {
  const salt = generateTelegramCodeSalt();
  const code = deriveTelegramCodeFromSalt(salt);

  return {
    salt,
    code,
    hash: hashTelegramCode(code, salt),
  };
}

export function hashTelegramCode(code: string, salt: string) {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export function maskPhoneNumber(raw: string) {
  const normalized = raw.trim();
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 2)} *** *** ${normalized.slice(-2)}`;
}
