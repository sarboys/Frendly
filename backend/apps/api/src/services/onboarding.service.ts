import { Injectable, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { mapProfilePhoto } from '../common/media-presenters';
import { PrismaService } from './prisma.service';
import { ProfileService } from './profile.service';
import { RedisCacheService } from './redis-cache.service';

type SessionProvider =
  | 'dev'
  | 'phone_otp'
  | 'session'
  | 'telegram'
  | 'google'
  | 'yandex';

const onboardingResponseSelect = {
  intent: true,
  gender: true,
  birthDate: true,
  city: true,
  area: true,
  interests: true,
  vibe: true,
  completedAt: true,
  user: {
    select: {
      displayName: true,
      email: true,
      phoneNumber: true,
      profile: {
        select: {
          bio: true,
          photos: {
            select: {
              id: true,
              sortOrder: true,
              mediaAsset: {
                select: {
                  id: true,
                  kind: true,
                  mimeType: true,
                  byteSize: true,
                  durationMs: true,
                  publicUrl: true,
                  variants: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  },
} satisfies Prisma.OnboardingPreferencesSelect;

function mapOnboarding(onboarding: {
  intent: string | null;
  gender: 'male' | 'female' | null;
  birthDate?: Date | string | null;
  city: string | null;
  area: string | null;
  interests: unknown;
  vibe: string | null;
  completedAt?: Date | string | null;
  user?: {
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    profile?: {
      bio?: string | null;
      photos?: Array<Parameters<typeof mapProfilePhoto>[0]>;
    } | null;
  };
  requiredContact?: 'email' | 'phone' | null;
}) {
  return {
    displayName: onboarding.user?.displayName ?? null,
    name: onboarding.user?.displayName ?? null,
    intent: onboarding.intent,
    gender: onboarding.gender,
    birthDate: formatDateOnly(onboarding.birthDate),
    city: onboarding.city,
    area: onboarding.area,
    interests: Array.isArray(onboarding.interests)
      ? onboarding.interests.filter((item): item is string => typeof item === 'string')
      : [],
    vibe: onboarding.vibe,
    bio: onboarding.user?.profile?.bio ?? null,
    email: onboarding.user?.email ?? null,
    phoneNumber: onboarding.user?.phoneNumber ?? null,
    requiredContact: onboarding.requiredContact ?? null,
    photos: (onboarding.user?.profile?.photos ?? []).map((photo) =>
      mapProfilePhoto(photo),
    ),
  };
}

function formatDateOnly(value?: Date | string | null) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function parseBirthDate(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_birth_date', 'birthDate must be YYYY-MM-DD');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ApiError(400, 'invalid_birth_date', 'birthDate must be YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ApiError(400, 'invalid_birth_date', 'birthDate is invalid');
  }

  const age = calculateAge(date);
  if (age < 18 || age > 100) {
    throw new ApiError(400, 'invalid_birth_date', 'Age must be from 18 to 100');
  }

  return date;
}

function calculateAge(birthDate: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

function normalizeEmail(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_email', 'email must be a string');
  }

  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ApiError(400, 'invalid_email', 'email is invalid');
  }
  return email;
}

function normalizePhoneNumber(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_phone_number', 'phoneNumber must be a string');
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('375')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }

  throw new ApiError(400, 'invalid_phone_number', 'phoneNumber is invalid');
}

function normalizeDisplayName(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_display_name', 'displayName must be a string');
  }

  const displayName = value.trim();
  if (!displayName) {
    throw new ApiError(400, 'invalid_display_name', 'displayName is required');
  }
  return displayName;
}

function normalizeOptionalProfileText(value: unknown, fieldName: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, 'invalid_onboarding_payload', `${fieldName} must be a string`);
  }

  const text = value.trim();
  return text.length === 0 ? null : text;
}

function requiredContactFor(provider: SessionProvider, user: {
  email: string | null;
  phoneNumber: string | null;
}) {
  if ((provider === 'phone_otp' || provider === 'telegram') && !user.email) {
    return 'email' as const;
  }
  if ((provider === 'google' || provider === 'yandex') && !user.phoneNumber) {
    return 'phone' as const;
  }
  return null;
}

@Injectable()
export class OnboardingService {
  private readonly pendingOnboardingLoads = new Map<string, Promise<any>>();

  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly redisCache?: RedisCacheService,
    @Optional() private readonly profileService?: ProfileService,
  ) {}

  async getOnboarding(userId: string, sessionId?: string) {
    const cacheKey = this.onboardingCacheKey(userId, sessionId);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingOnboardingLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshOnboarding(userId, sessionId)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 15);
        return response;
      })
      .finally(() => {
        this.pendingOnboardingLoads.delete(cacheKey);
      });
    this.pendingOnboardingLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshOnboarding(userId: string, sessionId?: string) {
    const [sessionProvider, onboarding] = await Promise.all([
      this.resolveSessionProvider(sessionId),
      this.findOrCreateOnboarding(userId),
    ]);

    return mapOnboarding({
      ...onboarding,
      requiredContact: requiredContactFor(sessionProvider, onboarding.user),
    });
  }

  async checkContactAvailability(
    userId: string,
    sessionId: string | undefined,
    body: Record<string, unknown>,
  ) {
    const [sessionProvider, user] = await Promise.all([
      this.resolveSessionProvider(sessionId),
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          phoneNumber: true,
        },
      }),
    ]);

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    const requiredContact = requiredContactFor(sessionProvider, user);
    const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email');
    const hasPhoneNumber = Object.prototype.hasOwnProperty.call(
      body,
      'phoneNumber',
    );
    const email = hasEmail ? normalizeEmail(body.email) : undefined;
    const phoneNumber = hasPhoneNumber
      ? normalizePhoneNumber(body.phoneNumber)
      : undefined;

    if (requiredContact === 'email') {
      if (!email) {
        throw new ApiError(400, 'required_email', 'email is required');
      }
      await this.assertEmailAvailable(userId, email);
      return { available: true, requiredContact };
    }

    if (requiredContact === 'phone') {
      if (!phoneNumber) {
        throw new ApiError(
          400,
          'required_phone_number',
          'phoneNumber is required',
        );
      }
      await this.assertPhoneAvailable(userId, phoneNumber);
      return { available: true, requiredContact };
    }

    if (email) {
      await this.assertEmailAvailable(userId, email);
    }
    if (phoneNumber) {
      await this.assertPhoneAvailable(userId, phoneNumber);
    }
    return { available: true, requiredContact: null };
  }

  async updateOnboarding(
    userId: string,
    sessionId: string | undefined,
    body: Record<string, unknown>,
  ) {
    if (
      body.interests !== undefined &&
      body.interests !== null &&
      !Array.isArray(body.interests)
    ) {
      throw new ApiError(
        400,
        'invalid_onboarding_payload',
        'interests must be an array',
      );
    }

    const sessionProvider = await this.resolveSessionProvider(sessionId);
    const interests = Array.isArray(body.interests)
      ? body.interests.filter((item): item is string => typeof item === 'string')
      : [];
    const gender =
      body.gender === 'male' || body.gender === 'female' ? body.gender : null;
    const hasBirthDate = Object.prototype.hasOwnProperty.call(body, 'birthDate');
    const birthDate = hasBirthDate ? parseBirthDate(body.birthDate) : undefined;
    const age =
      birthDate === undefined
        ? undefined
        : birthDate == null
          ? null
          : calculateAge(birthDate);
    const city = typeof body.city === 'string' ? body.city : null;
    const area = typeof body.area === 'string' ? body.area : null;
    const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email');
    const hasPhoneNumber = Object.prototype.hasOwnProperty.call(
      body,
      'phoneNumber',
    );
    const email = hasEmail ? normalizeEmail(body.email) : undefined;
    const phoneNumber = hasPhoneNumber
      ? normalizePhoneNumber(body.phoneNumber)
      : undefined;
    const hasBio = Object.prototype.hasOwnProperty.call(body, 'bio');
    const bio = hasBio ? normalizeOptionalProfileText(body.bio, 'bio') : undefined;
    const completedAt = new Date();

    try {
      const onboarding = await this.prismaService.client.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            displayName: true,
            email: true,
            phoneNumber: true,
          },
        });

        if (!user) {
          throw new ApiError(404, 'user_not_found', 'User not found');
        }

        const requiredContact = requiredContactFor(sessionProvider, user);
        if (requiredContact === 'email' && !email) {
          throw new ApiError(400, 'required_email', 'email is required');
        }
        if (requiredContact === 'phone' && !phoneNumber) {
          throw new ApiError(
            400,
            'required_phone_number',
            'phoneNumber is required',
          );
        }
        if (email) {
          await this.assertEmailAvailable(userId, email, tx);
        }
        if (phoneNumber) {
          await this.assertPhoneAvailable(userId, phoneNumber, tx);
        }

        const hasDisplayName =
          Object.prototype.hasOwnProperty.call(body, 'displayName') ||
          Object.prototype.hasOwnProperty.call(body, 'name');
        const displayName = hasDisplayName
          ? normalizeDisplayName(body.displayName ?? body.name)
          : undefined;
        const userUpdate: Prisma.UserUpdateInput = {};
        if (displayName !== undefined) {
          userUpdate.displayName = displayName;
        }
        if (email !== undefined) {
          userUpdate.email = email;
        }
        if (phoneNumber !== undefined) {
          userUpdate.phoneNumber = phoneNumber;
        }
        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({
            where: { id: userId },
            data: userUpdate,
          });
        }

        const updated = await tx.onboardingPreferences.upsert({
          where: { userId },
          update: {
            intent: typeof body.intent === 'string' ? body.intent : null,
            gender,
            ...(hasBirthDate ? { birthDate } : {}),
            city,
            area,
            interests,
            vibe: typeof body.vibe === 'string' ? body.vibe : null,
            completedAt,
          },
          create: {
            userId,
            intent: typeof body.intent === 'string' ? body.intent : null,
            gender,
            birthDate: birthDate ?? null,
            city,
            area,
            interests,
            vibe: typeof body.vibe === 'string' ? body.vibe : null,
            completedAt,
          },
          select: onboardingResponseSelect,
        });

        const profile = await tx.profile.upsert({
          where: { userId },
          update: {
            gender,
            ...(hasBirthDate ? { birthDate, age } : {}),
            city,
            area,
            ...(hasBio ? { bio } : {}),
          },
          create: {
            userId,
            gender,
            birthDate: birthDate ?? null,
            age: age ?? null,
            city,
            area,
            bio: bio ?? null,
          },
        });

        return {
          ...updated,
          user: updated.user
            ? {
                ...updated.user,
                profile: {
                  ...(updated.user.profile ?? {}),
                  bio: profile.bio,
                  photos: updated.user.profile?.photos ?? [],
                },
              }
            : updated.user,
        };
      });

      const response = mapOnboarding({
        ...onboarding,
        requiredContact: requiredContactFor(sessionProvider, onboarding.user),
      });
      await Promise.all([
        this.redisCache?.delete(this.onboardingCacheKey(userId, sessionId)),
        this.redisCache?.delete(['api', 'auth-me', 'v1', userId].join(':')),
        this.redisCache?.delete(['profile', 'me', 'v1', userId].join(':')),
        this.profileService?.clearProfileCache(userId),
      ]);
      return response;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw contactAlreadyUsedError(contactFieldFromUniqueError(error));
      }
      throw error;
    }
  }

  private async findOrCreateOnboarding(userId: string) {
    const existing = await this.prismaService.client.onboardingPreferences.findUnique({
      where: { userId },
      select: onboardingResponseSelect,
    });
    if (existing != null) {
      return existing;
    }

    try {
      return await this.prismaService.client.onboardingPreferences.create({
        data: {
          userId,
          interests: [],
        },
        select: onboardingResponseSelect,
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }
      const createdByConcurrentRequest =
        await this.prismaService.client.onboardingPreferences.findUnique({
          where: { userId },
          select: onboardingResponseSelect,
        });
      if (createdByConcurrentRequest == null) {
        throw error;
      }
      return createdByConcurrentRequest;
    }
  }

  private onboardingCacheKey(userId: string, sessionId?: string) {
    return ['api', 'onboarding', 'me', userId, sessionId ?? ''].join(':');
  }

  private async resolveSessionProvider(sessionId?: string): Promise<SessionProvider> {
    if (!sessionId) {
      return 'session';
    }

    const session = await this.prismaService.client.session.findUnique({
      where: { id: sessionId },
      select: { provider: true },
    });

    return (session?.provider ?? 'session') as SessionProvider;
  }

  private async assertEmailAvailable(
    userId: string,
    email: string,
    client: Prisma.TransactionClient | PrismaClient =
      this.prismaService.client,
  ) {
    const existing = await client.user.findFirst({
      where: {
        email,
        id: { not: userId },
      },
      select: { id: true },
    });
    if (existing) {
      throw contactAlreadyUsedError('email');
    }
  }

  private async assertPhoneAvailable(
    userId: string,
    phoneNumber: string,
    client: Prisma.TransactionClient | PrismaClient =
      this.prismaService.client,
  ) {
    const existing = await client.user.findFirst({
      where: {
        phoneNumber,
        id: { not: userId },
      },
      select: { id: true },
    });
    if (existing) {
      throw contactAlreadyUsedError('phoneNumber');
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

function contactAlreadyUsedError(field?: 'email' | 'phoneNumber') {
  return new ApiError(
    409,
    'contact_already_used',
    'Contact is already used',
    field ? { field } : undefined,
  );
}

function contactFieldFromUniqueError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return undefined;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  if (fields.includes('email')) {
    return 'email';
  }
  if (fields.includes('phoneNumber')) {
    return 'phoneNumber';
  }
  return undefined;
}
