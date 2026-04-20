import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

function mapOnboarding(onboarding: {
  intent: string | null;
  city: string | null;
  area: string | null;
  interests: unknown;
  vibe: string | null;
}) {
  return {
    intent: onboarding.intent,
    city: onboarding.city,
    area: onboarding.area,
    interests: Array.isArray(onboarding.interests)
      ? onboarding.interests.filter((item): item is string => typeof item === 'string')
      : [],
    vibe: onboarding.vibe,
  };
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOnboarding(userId: string) {
    const onboarding = await this.prismaService.client.onboardingPreferences.findUnique({
      where: { userId },
    });

    if (!onboarding) {
      throw new ApiError(404, 'onboarding_not_found', 'Onboarding not found');
    }

    return mapOnboarding(onboarding);
  }

  async updateOnboarding(userId: string, body: Record<string, unknown>) {
    if (body.interests !== undefined && body.interests !== null && !Array.isArray(body.interests)) {
      throw new ApiError(400, 'invalid_onboarding_payload', 'interests must be an array');
    }

    const interests = Array.isArray(body.interests)
      ? body.interests.filter((item): item is string => typeof item === 'string')
      : [];

    const onboarding = await this.prismaService.client.onboardingPreferences.update({
      where: { userId },
      data: {
        intent: typeof body.intent === 'string' ? body.intent : null,
        city: typeof body.city === 'string' ? body.city : null,
        area: typeof body.area === 'string' ? body.area : null,
        interests,
        vibe: typeof body.vibe === 'string' ? body.vibe : null,
      },
    });

    return mapOnboarding(onboarding);
  }
}
