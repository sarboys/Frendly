import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

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

    return onboarding;
  }

  async updateOnboarding(userId: string, body: Record<string, unknown>) {
    const interests = Array.isArray(body.interests) ? body.interests.filter((item): item is string => typeof item === 'string') : [];

    return this.prismaService.client.onboardingPreferences.update({
      where: { userId },
      data: {
        intent: typeof body.intent === 'string' ? body.intent : undefined,
        city: typeof body.city === 'string' ? body.city : undefined,
        area: typeof body.area === 'string' ? body.area : undefined,
        interests,
        vibe: typeof body.vibe === 'string' ? body.vibe : undefined,
      },
    });
  }
}
