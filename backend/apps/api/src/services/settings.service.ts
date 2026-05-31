import { Injectable, Optional } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';

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

const settingsResponseSelect = {
  allowLocation: true,
  allowPush: true,
  allowContacts: true,
  autoSharePlans: true,
  hideExactLocation: true,
  quietHours: true,
  showAge: true,
  discoverable: true,
  darkMode: true,
};
const SETTINGS_CACHE_SECONDS = 30;

@Injectable()
export class SettingsService {
  private readonly pendingSettingsLoads = new Map<string, Promise<ReturnType<typeof mapSettings>>>();

  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async getSettings(userId: string) {
    const cacheKey = this.settingsCacheKey(userId);
    const cached = await this.redisCache?.getJson<ReturnType<typeof mapSettings>>(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingSettingsLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshSettings(userId)
      .then(async (settings) => {
        await this.redisCache?.setJson(cacheKey, settings, SETTINGS_CACHE_SECONDS);
        return settings;
      })
      .finally(() => {
        this.pendingSettingsLoads.delete(cacheKey);
      });
    this.pendingSettingsLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshSettings(userId: string) {
    const existing = await this.prismaService.client.userSettings.findUnique({
      where: { userId },
      select: settingsResponseSelect,
    });
    if (existing != null) {
      return mapSettings(existing);
    }

    const created = await this.prismaService.client.userSettings.create({
      data: {
        userId,
      },
      select: settingsResponseSelect,
    });

    return mapSettings(created);
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
      select: settingsResponseSelect,
    });
    await this.clearSettingsCache(userId);

    return mapSettings(settings);
  }

  async updateTestingAccess(userId: string, body: Record<string, unknown>) {
    if (process.env.ENABLE_TESTING_ACCESS !== 'true') {
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
    await this.clearSettingsCache(userId);

    return {
      frendlyPlusEnabled,
      afterDarkEnabled,
    };
  }

  private settingsCacheKey(userId: string) {
    return ['api', 'settings', 'v1', userId].join(':');
  }

  private async clearSettingsCache(userId: string) {
    this.pendingSettingsLoads.delete(this.settingsCacheKey(userId));
    await this.redisCache?.delete(this.settingsCacheKey(userId));
  }
}
