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
    const settings = await this.prismaService.client.userSettings.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });

    return mapSettings(settings);
  }

  async updateSettings(userId: string, body: Record<string, unknown>) {
    const settings = await this.prismaService.client.userSettings.upsert({
      where: { userId },
      update: {
        allowLocation:
            typeof body.allowLocation === 'boolean' ? body.allowLocation : undefined,
        allowPush: typeof body.allowPush === 'boolean' ? body.allowPush : undefined,
        allowContacts:
            typeof body.allowContacts === 'boolean' ? body.allowContacts : undefined,
        autoSharePlans:
            typeof body.autoSharePlans === 'boolean'
                ? body.autoSharePlans
                : undefined,
        hideExactLocation:
            typeof body.hideExactLocation === 'boolean'
                ? body.hideExactLocation
                : undefined,
        quietHours:
            typeof body.quietHours === 'boolean' ? body.quietHours : undefined,
        showAge: typeof body.showAge === 'boolean' ? body.showAge : undefined,
        discoverable:
            typeof body.discoverable === 'boolean' ? body.discoverable : undefined,
        darkMode: typeof body.darkMode === 'boolean' ? body.darkMode : undefined,
      },
      create: {
        userId,
        allowLocation:
            typeof body.allowLocation === 'boolean' ? body.allowLocation : false,
        allowPush: typeof body.allowPush === 'boolean' ? body.allowPush : false,
        allowContacts:
            typeof body.allowContacts === 'boolean' ? body.allowContacts : false,
        autoSharePlans:
            typeof body.autoSharePlans === 'boolean'
                ? body.autoSharePlans
                : false,
        hideExactLocation:
            typeof body.hideExactLocation === 'boolean'
                ? body.hideExactLocation
                : false,
        quietHours:
            typeof body.quietHours === 'boolean' ? body.quietHours : false,
        showAge: typeof body.showAge === 'boolean' ? body.showAge : true,
        discoverable:
            typeof body.discoverable === 'boolean' ? body.discoverable : true,
        darkMode: typeof body.darkMode === 'boolean' ? body.darkMode : false,
      },
    });

    return mapSettings(settings);
  }

  async updateTestingAccess(userId: string, body: Record<string, unknown>) {
    const testingAccessEnabled =
      process.env.ENABLE_TESTING_ACCESS === 'true' ||
      process.env.NODE_ENV !== 'production';
    if (!testingAccessEnabled) {
      throw new ApiError(404, 'testing_access_disabled', 'Testing access is disabled');
    }

    let frendlyPlusEnabled = body.frendlyPlusEnabled === true;
    const afterDarkEnabled = body.afterDarkEnabled === true;

    if (afterDarkEnabled) {
      frendlyPlusEnabled = true;
    }

    const now = new Date();
    const expiredAt = new Date(now.getTime() - 1000);

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.userSubscription.updateMany({
        where: { userId },
        data: {
          status: 'inactive',
          trialEndsAt: null,
          renewsAt: expiredAt,
        },
      });

      if (frendlyPlusEnabled) {
        await tx.userSubscription.create({
          data: {
            userId,
            plan: 'month',
            status: 'active',
            startedAt: now,
            renewsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            trialEndsAt: null,
          },
        });
      }

      await tx.userSettings.upsert({
        where: { userId },
        update: {
          afterDarkAgeConfirmedAt: afterDarkEnabled ? now : null,
          afterDarkCodeAcceptedAt: afterDarkEnabled ? now : null,
        },
        create: {
          userId,
          afterDarkAgeConfirmedAt: afterDarkEnabled ? now : null,
          afterDarkCodeAcceptedAt: afterDarkEnabled ? now : null,
        },
      });
    });

    return {
      frendlyPlusEnabled,
      afterDarkEnabled,
    };
  }
}
