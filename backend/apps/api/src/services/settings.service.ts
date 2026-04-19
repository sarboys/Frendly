import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSettings(userId: string) {
    const settings = await this.prismaService.client.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      throw new ApiError(404, 'settings_not_found', 'Settings not found');
    }

    return settings;
  }

  async updateSettings(userId: string, body: Record<string, unknown>) {
    return this.prismaService.client.userSettings.update({
      where: { userId },
      data: {
        allowLocation: typeof body.allowLocation === 'boolean' ? body.allowLocation : undefined,
        allowPush: typeof body.allowPush === 'boolean' ? body.allowPush : undefined,
        allowContacts: typeof body.allowContacts === 'boolean' ? body.allowContacts : undefined,
        autoSharePlans:
            typeof body.autoSharePlans === 'boolean' ? body.autoSharePlans : undefined,
        hideExactLocation:
            typeof body.hideExactLocation === 'boolean' ? body.hideExactLocation : undefined,
        quietHours: typeof body.quietHours === 'boolean' ? body.quietHours : undefined,
        showAge: typeof body.showAge === 'boolean' ? body.showAge : undefined,
        discoverable: typeof body.discoverable === 'boolean' ? body.discoverable : undefined,
        darkMode: typeof body.darkMode === 'boolean' ? body.darkMode : undefined,
      },
    });
  }
}
