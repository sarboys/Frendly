import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

function mapSettings(settings: {
  allowLocation: boolean;
  allowPush: boolean;
  allowContacts: boolean;
  autoSharePlans: boolean;
  hideExactLocation: boolean;
  quietHours: boolean;
  showAge: boolean;
  discoverable: boolean;
  darkMode: boolean;
}) {
  return {
    allowLocation: settings.allowLocation,
    allowPush: settings.allowPush,
    allowContacts: settings.allowContacts,
    autoSharePlans: settings.autoSharePlans,
    hideExactLocation: settings.hideExactLocation,
    quietHours: settings.quietHours,
    showAge: settings.showAge,
    discoverable: settings.discoverable,
    darkMode: settings.darkMode,
  };
}

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

    return mapSettings(settings);
  }

  async updateSettings(userId: string, body: Record<string, unknown>) {
    const settings = await this.prismaService.client.userSettings.update({
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

    return mapSettings(settings);
  }
}
