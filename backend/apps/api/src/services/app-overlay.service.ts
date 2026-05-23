import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type AppPlatform = 'ios' | 'android';
type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
type AudienceKind = 'all' | 'selected_users';
type TriState = 'any' | 'yes' | 'no';
type ButtonAction = 'store_update' | 'app_route' | 'external_url';
type OverlaySource = 'version_policy' | 'campaign';
type OverlayEvent = 'impression' | 'cta_click' | 'dismiss';

type VersionPolicyRow = {
  id: string;
  platform: AppPlatform;
  enabled: boolean;
  minSupportedBuild: number;
  latestBuild: number | null;
  storeUrl: string | null;
  title: string;
  body: string;
  buttonLabel: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type UserContext = {
  id: string;
  verified: boolean;
  profile: { city: string | null } | null;
  subscriptions: Array<{
    status: string;
    renewsAt: Date | null;
    trialEndsAt: Date | null;
  }>;
};

type CampaignRow = {
  id: string;
  internalName: string;
  status: CampaignStatus;
  title: string;
  body: string;
  dismissible: boolean;
  priority: number;
  buttonEnabled: boolean;
  buttonLabel: string | null;
  buttonAction: ButtonAction | null;
  buttonValue: string | null;
  audienceKind: AudienceKind;
  platform: AppPlatform | null;
  minBuild: number | null;
  maxBuild: number | null;
  frendlyPlus: TriState;
  verified: TriState;
  cityNames: unknown;
  targetUsers: Array<{ userId: string }>;
  stats?: {
    impressionCount: number;
    ctaClickCount: number;
    dismissCount: number;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class AppOverlayService {
  constructor(private readonly prismaService: PrismaService) {}

  async resolveOverlay(
    userId: string,
    input: { platform?: unknown; buildNumber?: unknown },
  ) {
    const platform = this.parsePlatform(input.platform);
    const buildNumber = this.parseBuildNumber(input.buildNumber);
    const user = await this.loadUserContext(userId);
    const versionPolicy = await this.prismaService.client.appVersionPolicy.findUnique({
      where: { platform },
    });

    if (
      versionPolicy?.enabled === true &&
      buildNumber < versionPolicy.minSupportedBuild
    ) {
      return {
        overlay: this.mapVersionPolicyOverlay(versionPolicy as VersionPolicyRow),
        checkAfterSeconds: 300,
      };
    }

    const campaigns = await this.prismaService.client.appPopupCampaign.findMany({
      where: { status: 'active' },
      include: {
        targetUsers: { select: { userId: true } },
        stats: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    const selected = (campaigns as CampaignRow[])
      .sort((left, right) => this.compareCampaignPriority(left, right))
      .find((campaign) =>
        this.matchesCampaign(campaign, user, { platform, buildNumber }),
      );

    return {
      overlay: selected ? this.mapCampaignOverlay(selected) : null,
      checkAfterSeconds: 300,
    };
  }

  async recordEvent(
    _userId: string,
    input: { overlayId?: unknown; source?: unknown; event?: unknown },
  ) {
    const overlayId = this.requiredText(input.overlayId, 'overlayId');
    const source = this.parseOverlaySource(input.source);
    const event = this.parseOverlayEvent(input.event);

    if (source !== 'campaign') {
      return { ok: true };
    }

    const create = {
      campaignId: overlayId,
      impressionCount: event === 'impression' ? 1 : 0,
      ctaClickCount: event === 'cta_click' ? 1 : 0,
      dismissCount: event === 'dismiss' ? 1 : 0,
    };
    const update =
      event === 'impression'
        ? { impressionCount: { increment: 1 } }
        : event === 'cta_click'
          ? { ctaClickCount: { increment: 1 } }
          : { dismissCount: { increment: 1 } };

    await this.prismaService.client.appPopupCampaignStats.upsert({
      where: { campaignId: overlayId },
      create,
      update,
    });

    return { ok: true };
  }

  async listCampaigns(query: Record<string, unknown> = {}) {
    const status = this.optionalCampaignStatus(query.status);
    const rows = await this.prismaService.client.appPopupCampaign.findMany({
      where: status ? { status } : undefined,
      include: {
        targetUsers: { select: { userId: true } },
        stats: true,
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: this.parseLimit(query.limit),
    });

    return { items: (rows as CampaignRow[]).map((row) => this.mapAdminCampaign(row)) };
  }

  async createCampaign(body: Record<string, unknown>) {
    const input = this.parseCampaignInput(body, { partial: false });
    const targetUserIds = input.targetUserIds ?? [];
    const campaign = await this.prismaService.client.appPopupCampaign.create({
      data: {
        ...input.data,
        targetUsers:
          targetUserIds.length > 0
            ? {
                create: targetUserIds.map((userId) => ({ userId })),
              }
            : undefined,
        stats: { create: {} },
      } as any,
      include: {
        targetUsers: { select: { userId: true } },
        stats: true,
      },
    });

    return this.mapAdminCampaign(campaign as CampaignRow);
  }

  async updateCampaign(campaignId: string, body: Record<string, unknown>) {
    await this.ensureCampaignExists(campaignId);
    const input = this.parseCampaignInput(body, { partial: true });

    const campaign = await this.prismaService.client.$transaction(async (tx) => {
      if (input.targetUserIds != null) {
        await tx.appPopupTargetUser.deleteMany({ where: { campaignId } });
      }

      return tx.appPopupCampaign.update({
        where: { id: campaignId },
        data: {
          ...input.data,
          targetUsers:
            input.targetUserIds != null && input.targetUserIds.length > 0
              ? {
                  create: input.targetUserIds.map((userId) => ({ userId })),
                }
              : undefined,
        } as any,
        include: {
          targetUsers: { select: { userId: true } },
          stats: true,
        },
      });
    });

    return this.mapAdminCampaign(campaign as CampaignRow);
  }

  async setCampaignStatus(campaignId: string, status: CampaignStatus) {
    const campaign = await this.prismaService.client.appPopupCampaign.update({
      where: { id: campaignId },
      data: { status },
      include: {
        targetUsers: { select: { userId: true } },
        stats: true,
      },
    });

    return this.mapAdminCampaign(campaign as CampaignRow);
  }

  async listVersionPolicies() {
    const rows = await this.prismaService.client.appVersionPolicy.findMany({
      orderBy: { platform: 'asc' },
    });
    const byPlatform = new Map(
      (rows as VersionPolicyRow[]).map((row) => [row.platform, row]),
    );

    return {
      items: (['ios', 'android'] as const).map((platform) =>
        this.mapAdminVersionPolicy(byPlatform.get(platform) ?? this.defaultPolicy(platform)),
      ),
    };
  }

  async upsertVersionPolicy(platformInput: unknown, body: Record<string, unknown>) {
    const platform = this.parsePlatform(platformInput);
    const data = this.parseVersionPolicyInput(body);
    const policy = await this.prismaService.client.appVersionPolicy.upsert({
      where: { platform },
      create: { platform, ...data },
      update: data,
    });

    return this.mapAdminVersionPolicy(policy as VersionPolicyRow);
  }

  private async loadUserContext(userId: string): Promise<UserContext> {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        verified: true,
        profile: { select: { city: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            renewsAt: true,
            trialEndsAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }

    return user as UserContext;
  }

  private matchesCampaign(
    campaign: CampaignRow,
    user: UserContext,
    app: { platform: AppPlatform; buildNumber: number },
  ) {
    if (campaign.platform != null && campaign.platform !== app.platform) {
      return false;
    }
    if (campaign.minBuild != null && app.buildNumber < campaign.minBuild) {
      return false;
    }
    if (campaign.maxBuild != null && app.buildNumber > campaign.maxBuild) {
      return false;
    }
    if (
      campaign.audienceKind === 'selected_users' &&
      !campaign.targetUsers.some((target) => target.userId === user.id)
    ) {
      return false;
    }
    if (!this.matchesTriState(campaign.frendlyPlus, this.hasFrendlyPlus(user))) {
      return false;
    }
    if (!this.matchesTriState(campaign.verified, user.verified)) {
      return false;
    }
    const cityNames = this.normalizeStringArray(campaign.cityNames);
    if (cityNames.length > 0 && !cityNames.includes(user.profile?.city ?? '')) {
      return false;
    }

    return true;
  }

  private compareCampaignPriority(left: CampaignRow, right: CampaignRow) {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }
    const leftCreatedAt = left.createdAt?.getTime() ?? 0;
    const rightCreatedAt = right.createdAt?.getTime() ?? 0;
    if (leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }
    return right.id.localeCompare(left.id);
  }

  private hasFrendlyPlus(user: UserContext) {
    const subscription = user.subscriptions[0];
    if (!subscription) {
      return false;
    }
    const now = Date.now();
    const trialEndsAt = subscription.trialEndsAt?.getTime() ?? null;
    if (trialEndsAt != null && trialEndsAt > now) {
      return true;
    }
    const renewsAt = subscription.renewsAt?.getTime() ?? null;
    return (
      renewsAt != null &&
      renewsAt > now &&
      ['active', 'trial', 'canceled'].includes(subscription.status)
    );
  }

  private matchesTriState(value: TriState, actual: boolean) {
    return value === 'any' || (value === 'yes' && actual) || (value === 'no' && !actual);
  }

  private mapVersionPolicyOverlay(policy: VersionPolicyRow) {
    return {
      id: policy.id,
      source: 'version_policy' as const,
      kind: 'force_update' as const,
      title: policy.title,
      body: policy.body,
      dismissible: false,
      cta: {
        label: policy.buttonLabel,
        action: 'store_update' as const,
        value: policy.storeUrl,
      },
    };
  }

  private mapCampaignOverlay(campaign: CampaignRow) {
    return {
      id: campaign.id,
      source: 'campaign' as const,
      kind: 'announcement' as const,
      title: campaign.title,
      body: campaign.body,
      dismissible: campaign.dismissible,
      cta:
        campaign.buttonEnabled && campaign.buttonLabel && campaign.buttonAction
          ? {
              label: campaign.buttonLabel,
              action: campaign.buttonAction,
              value: campaign.buttonValue,
            }
          : null,
    };
  }

  private mapAdminCampaign(campaign: CampaignRow) {
    return {
      id: campaign.id,
      internalName: campaign.internalName,
      status: campaign.status,
      statusLabel: this.campaignStatusLabel(campaign.status),
      title: campaign.title,
      body: campaign.body,
      dismissible: campaign.dismissible,
      priority: campaign.priority,
      buttonEnabled: campaign.buttonEnabled,
      buttonLabel: campaign.buttonLabel,
      buttonAction: campaign.buttonAction,
      buttonActionLabel: campaign.buttonAction
        ? this.buttonActionLabel(campaign.buttonAction)
        : null,
      buttonValue: campaign.buttonValue,
      audienceKind: campaign.audienceKind,
      audienceKindLabel:
        campaign.audienceKind === 'selected_users'
          ? 'Только выбранные userId'
          : 'Все пользователи',
      platform: campaign.platform,
      platformLabel: campaign.platform ? this.platformLabel(campaign.platform) : 'Все платформы',
      minBuild: campaign.minBuild,
      maxBuild: campaign.maxBuild,
      frendlyPlus: campaign.frendlyPlus,
      frendlyPlusLabel: this.triStateLabel(campaign.frendlyPlus, 'Только Frendly+', 'Без Frendly+'),
      verified: campaign.verified,
      verifiedLabel: this.triStateLabel(campaign.verified, 'Только верифицированные', 'Без верификации'),
      cityNames: this.normalizeStringArray(campaign.cityNames),
      targetUserIds: campaign.targetUsers.map((target) => target.userId),
      stats: campaign.stats ?? {
        impressionCount: 0,
        ctaClickCount: 0,
        dismissCount: 0,
      },
      createdAt: campaign.createdAt?.toISOString() ?? null,
      updatedAt: campaign.updatedAt?.toISOString() ?? null,
    };
  }

  private mapAdminVersionPolicy(policy: VersionPolicyRow) {
    return {
      id: policy.id,
      platform: policy.platform,
      platformLabel: this.platformLabel(policy.platform),
      enabled: policy.enabled,
      enabledLabel: policy.enabled ? 'Да' : 'Нет',
      minSupportedBuild: policy.minSupportedBuild,
      latestBuild: policy.latestBuild,
      storeUrl: policy.storeUrl,
      title: policy.title,
      body: policy.body,
      buttonLabel: policy.buttonLabel,
      createdAt: policy.createdAt?.toISOString() ?? null,
      updatedAt: policy.updatedAt?.toISOString() ?? null,
    };
  }

  private parseCampaignInput(
    body: Record<string, unknown>,
    options: { partial: boolean },
  ): {
    data: Record<string, unknown>;
    targetUserIds?: string[];
  } {
    const data: Record<string, unknown> = {};
    const setRequiredText = (key: string) => {
      if (!options.partial || key in body) {
        data[key] = this.requiredText(body[key], key);
      }
    };

    setRequiredText('internalName');
    setRequiredText('title');
    setRequiredText('body');

    if (!options.partial || 'status' in body) {
      data.status = this.parseCampaignStatus(body.status, options.partial ? undefined : 'draft');
    }
    if (!options.partial || 'dismissible' in body) {
      data.dismissible = this.optionalBoolean(body.dismissible, true);
    }
    if (!options.partial || 'priority' in body) {
      data.priority = this.optionalInteger(body.priority, 0, 'priority');
    }
    if (!options.partial || 'buttonEnabled' in body) {
      data.buttonEnabled = this.optionalBoolean(body.buttonEnabled, false);
    }
    if (!options.partial || 'buttonLabel' in body) {
      data.buttonLabel = this.optionalText(body.buttonLabel);
    }
    if (!options.partial || 'buttonAction' in body) {
      data.buttonAction = this.optionalButtonAction(body.buttonAction);
    }
    if (!options.partial || 'buttonValue' in body) {
      data.buttonValue = this.optionalText(body.buttonValue);
    }
    if (!options.partial || 'audienceKind' in body) {
      data.audienceKind = this.parseAudienceKind(body.audienceKind);
    }
    if (!options.partial || 'platform' in body) {
      data.platform = this.optionalPlatform(body.platform);
    }
    if (!options.partial || 'minBuild' in body) {
      data.minBuild = this.optionalIntegerOrNull(body.minBuild, 'minBuild');
    }
    if (!options.partial || 'maxBuild' in body) {
      data.maxBuild = this.optionalIntegerOrNull(body.maxBuild, 'maxBuild');
    }
    if (!options.partial || 'frendlyPlus' in body) {
      data.frendlyPlus = this.parseTriState(body.frendlyPlus);
    }
    if (!options.partial || 'verified' in body) {
      data.verified = this.parseTriState(body.verified);
    }
    if (!options.partial || 'cityNames' in body) {
      data.cityNames = this.normalizeStringArray(body.cityNames);
    }

    return {
      data,
      targetUserIds:
        !options.partial || 'targetUserIds' in body
          ? this.normalizeStringArray(body.targetUserIds)
          : undefined,
    };
  }

  private parseVersionPolicyInput(body: Record<string, unknown>) {
    return {
      enabled: this.optionalBoolean(body.enabled, false),
      minSupportedBuild: this.optionalInteger(body.minSupportedBuild, 0, 'minSupportedBuild'),
      latestBuild: this.optionalIntegerOrNull(body.latestBuild, 'latestBuild'),
      storeUrl: this.optionalText(body.storeUrl),
      title: this.optionalText(body.title) ?? 'Обновите Frendly',
      body:
        this.optionalText(body.body) ??
        'Чтобы продолжить, установите последнюю версию приложения.',
      buttonLabel: this.optionalText(body.buttonLabel) ?? 'Обновить',
    };
  }

  private async ensureCampaignExists(campaignId: string) {
    const campaign = await this.prismaService.client.appPopupCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      throw new ApiError(404, 'app_popup_campaign_not_found', 'Campaign not found');
    }
  }

  private parsePlatform(value: unknown): AppPlatform {
    if (value === 'ios' || value === 'android') {
      return value;
    }
    throw new ApiError(400, 'invalid_app_platform', 'platform must be ios or android');
  }

  private optionalPlatform(value: unknown): AppPlatform | null {
    if (value == null || value === '') {
      return null;
    }
    return this.parsePlatform(value);
  }

  private parseBuildNumber(value: unknown) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ApiError(400, 'invalid_build_number', 'buildNumber must be a positive integer');
    }
    return parsed;
  }

  private parseOverlaySource(value: unknown): OverlaySource {
    if (value === 'version_policy' || value === 'campaign') {
      return value;
    }
    throw new ApiError(400, 'invalid_overlay_source', 'Invalid overlay source');
  }

  private parseOverlayEvent(value: unknown): OverlayEvent {
    if (value === 'impression' || value === 'cta_click' || value === 'dismiss') {
      return value;
    }
    throw new ApiError(400, 'invalid_overlay_event', 'Invalid overlay event');
  }

  private parseCampaignStatus(value: unknown, fallback?: CampaignStatus): CampaignStatus {
    if (value == null && fallback != null) {
      return fallback;
    }
    if (
      value === 'draft' ||
      value === 'active' ||
      value === 'paused' ||
      value === 'archived'
    ) {
      return value;
    }
    throw new ApiError(400, 'invalid_campaign_status', 'Invalid campaign status');
  }

  private optionalCampaignStatus(value: unknown): CampaignStatus | null {
    if (value == null || value === '') {
      return null;
    }
    return this.parseCampaignStatus(value);
  }

  private parseAudienceKind(value: unknown): AudienceKind {
    if (value == null || value === '') {
      return 'all';
    }
    if (value === 'all' || value === 'selected_users') {
      return value;
    }
    throw new ApiError(400, 'invalid_audience_kind', 'Invalid audience kind');
  }

  private parseTriState(value: unknown): TriState {
    if (value == null || value === '') {
      return 'any';
    }
    if (value === 'any' || value === 'yes' || value === 'no') {
      return value;
    }
    throw new ApiError(400, 'invalid_filter_value', 'Invalid filter value');
  }

  private optionalButtonAction(value: unknown): ButtonAction | null {
    if (value == null || value === '') {
      return null;
    }
    if (value === 'store_update' || value === 'app_route' || value === 'external_url') {
      return value;
    }
    throw new ApiError(400, 'invalid_button_action', 'Invalid button action');
  }

  private requiredText(value: unknown, field: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, `invalid_${field}`, `${field} is required`);
    }
    return text;
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private optionalBoolean(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
  }

  private optionalInteger(value: unknown, fallback: number, field: string) {
    if (value == null || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ApiError(400, `invalid_${field}`, `${field} must be a positive integer`);
    }
    return parsed;
  }

  private optionalIntegerOrNull(value: unknown, field: string) {
    if (value == null || value === '') {
      return null;
    }
    return this.optionalInteger(value, 0, field);
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      );
    }
    if (typeof value === 'string') {
      return this.normalizeStringArray(value.split(/\r?\n|,/));
    }
    return [];
  }

  private parseLimit(value: unknown) {
    const parsed = Number(value ?? 100);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return 100;
    }
    return Math.min(parsed, 200);
  }

  private defaultPolicy(platform: AppPlatform): VersionPolicyRow {
    return {
      id: `default-${platform}`,
      platform,
      enabled: false,
      minSupportedBuild: 0,
      latestBuild: null,
      storeUrl: null,
      title: 'Обновите Frendly',
      body: 'Чтобы продолжить, установите последнюю версию приложения.',
      buttonLabel: 'Обновить',
    };
  }

  private campaignStatusLabel(status: CampaignStatus) {
    return {
      draft: 'Черновик',
      active: 'Активна',
      paused: 'На паузе',
      archived: 'В архиве',
    }[status];
  }

  private buttonActionLabel(action: ButtonAction) {
    return {
      store_update: 'Открыть стор',
      app_route: 'Открыть экран приложения',
      external_url: 'Открыть внешнюю ссылку',
    }[action];
  }

  private platformLabel(platform: AppPlatform) {
    return platform === 'ios' ? 'iOS' : 'Android';
  }

  private triStateLabel(value: TriState, yes: string, no: string) {
    if (value === 'yes') {
      return yes;
    }
    if (value === 'no') {
      return no;
    }
    return 'Любой';
  }
}
