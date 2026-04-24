import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

function mapOnboarding(onboarding: {
  intent: string | null;
  gender: 'male' | 'female' | null;
  birthDate?: Date | string | null;
  city: string | null;
  area: string | null;
  interests: unknown;
  vibe: string | null;
}) {
  return {
    intent: onboarding.intent,
    gender: onboarding.gender,
    birthDate: formatDateOnly(onboarding.birthDate),
    city: onboarding.city,
    area: onboarding.area,
    interests: Array.isArray(onboarding.interests)
      ? onboarding.interests.filter((item): item is string => typeof item === 'string')
      : [],
    vibe: onboarding.vibe,
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

@Injectable()
export class OnboardingService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOnboarding(userId: string) {
    const onboarding = await this.prismaService.client.onboardingPreferences.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        interests: [],
      },
    });

    return mapOnboarding(onboarding);
  }

  async updateOnboarding(userId: string, body: Record<string, unknown>) {
    if (body.interests !== undefined && body.interests !== null && !Array.isArray(body.interests)) {
      throw new ApiError(400, 'invalid_onboarding_payload', 'interests must be an array');
    }

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

    const onboarding = await this.prismaService.client.$transaction(async (tx) => {
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
        },
      });

      await tx.profile.upsert({
        where: { userId },
        update: {
          gender,
          ...(hasBirthDate ? { birthDate, age } : {}),
          city,
          area,
        },
        create: {
          userId,
          gender,
          birthDate: birthDate ?? null,
          age: age ?? null,
          city,
          area,
        },
      });

      return updated;
    });

    return mapOnboarding(onboarding);
  }
}
