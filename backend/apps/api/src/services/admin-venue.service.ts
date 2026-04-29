import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PartnerDto,
  PartnerOfferDto,
  VenueDto,
} from '@big-break/contracts';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const PARTNER_STATUSES = new Set(['active', 'inactive', 'draft']);
const VENUE_STATUSES = new Set(['open', 'closed', 'hidden']);
const OFFER_STATUSES = new Set(['active', 'inactive', 'draft']);
const OWNER_TYPES = new Set(['frendly', 'partner']);

@Injectable()
export class AdminVenueService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPartners(query: Record<string, unknown> = {}) {
    const city = this.optionalText(query.city);
    const status = this.optionalText(query.status);
    const partners = await this.prismaService.client.partner.findMany({
      where: {
        ...(city ? { city } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: this.parseLimit(query.limit),
    });

    return { items: partners.map((partner: any) => this.mapPartner(partner)) };
  }

  async createPartner(body: Record<string, unknown>): Promise<PartnerDto> {
    const partner = await this.prismaService.client.partner.create({
      data: {
        name: this.requiredText(body.name, 'partner_name_required'),
        city: this.requiredText(body.city, 'partner_city_required'),
        status: this.parseStatus(
          body.status,
          PARTNER_STATUSES,
          'active',
          'partner_status_invalid',
        ),
        contact: this.optionalText(body.contact),
        notes: this.optionalText(body.notes),
      },
    });

    return this.mapPartner(partner);
  }

  async updatePartner(
    partnerId: string,
    body: Record<string, unknown>,
  ): Promise<PartnerDto> {
    const data: Prisma.PartnerUpdateInput = {};
    this.setOptionalText(data, body, 'name');
    this.setOptionalText(data, body, 'city');
    this.setNullableText(data, body, 'contact');
    this.setNullableText(data, body, 'notes');
    if (body.status !== undefined) {
      data.status = this.parseStatus(
        body.status,
        PARTNER_STATUSES,
        'active',
        'partner_status_invalid',
      );
    }

    const partner = await this.prismaService.client.partner.update({
      where: { id: partnerId },
      data,
    });

    return this.mapPartner(partner);
  }

  async listVenues(query: Record<string, unknown> = {}) {
    const city = this.optionalText(query.city);
    const status = this.optionalText(query.status);
    const venues = await this.prismaService.client.venue.findMany({
      where: {
        ...(city ? { city } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: this.parseLimit(query.limit),
    });

    return { items: venues.map((venue: any) => this.mapVenue(venue)) };
  }

  async createVenue(body: Record<string, unknown>): Promise<VenueDto> {
    const ownerType = this.parseOwnerType(body.ownerType);
    const venue = await this.prismaService.client.venue.create({
      data: {
        ownerType,
        partnerId: this.optionalText(body.partnerId),
        source: this.optionalText(body.source) ?? 'manual',
        externalId: this.optionalText(body.externalId),
        moderationStatus: ownerType === 'partner' ? 'pending' : 'approved',
        trustLevel: ownerType === 'partner' ? 'unverified' : 'verified',
        city: this.requiredText(body.city, 'venue_city_required'),
        timezone: this.optionalText(body.timezone) ?? 'Europe/Moscow',
        area: this.optionalText(body.area),
        name: this.requiredText(body.name, 'venue_name_required'),
        address: this.requiredText(body.address, 'venue_address_required'),
        lat: this.parseCoordinate(body.lat, -90, 90, 'venue_lat_invalid'),
        lng: this.parseCoordinate(body.lng, -180, 180, 'venue_lng_invalid'),
        category: this.requiredText(body.category, 'venue_category_required'),
        tags: this.parseStringArray(body.tags),
        averageCheck: this.optionalInt(body.averageCheck),
        openingHours: this.optionalJson(body.openingHours),
        status: this.parseStatus(
          body.status,
          VENUE_STATUSES,
          'open',
          'venue_status_invalid',
        ),
      },
    });

    return this.mapVenue(venue);
  }

  async updateVenue(
    venueId: string,
    body: Record<string, unknown>,
  ): Promise<VenueDto> {
    const data: Prisma.VenueUpdateInput = {};
    if (body.ownerType !== undefined) {
      data.ownerType = this.parseOwnerType(body.ownerType);
    }
    this.setNullableText(data, body, 'partnerId');
    this.setOptionalText(data, body, 'source');
    this.setNullableText(data, body, 'externalId');
    this.setOptionalText(data, body, 'city');
    this.setOptionalText(data, body, 'timezone');
    this.setNullableText(data, body, 'area');
    this.setOptionalText(data, body, 'name');
    this.setOptionalText(data, body, 'address');
    this.setOptionalText(data, body, 'category');
    if (body.lat !== undefined) {
      data.lat = this.parseCoordinate(body.lat, -90, 90, 'venue_lat_invalid');
    }
    if (body.lng !== undefined) {
      data.lng = this.parseCoordinate(body.lng, -180, 180, 'venue_lng_invalid');
    }
    if (body.tags !== undefined) {
      data.tags = this.parseStringArray(body.tags);
    }
    if (body.averageCheck !== undefined) {
      data.averageCheck = this.optionalInt(body.averageCheck);
    }
    if (body.openingHours !== undefined) {
      data.openingHours = this.optionalJson(body.openingHours);
    }
    if (body.status !== undefined) {
      data.status = this.parseStatus(
        body.status,
        VENUE_STATUSES,
        'open',
        'venue_status_invalid',
      );
    }

    const venue = await this.prismaService.client.venue.update({
      where: { id: venueId },
      data,
    });

    return this.mapVenue(venue);
  }

  async listOffers(query: Record<string, unknown> = {}) {
    const partnerId = this.optionalText(query.partnerId);
    const venueId = this.optionalText(query.venueId);
    const status = this.optionalText(query.status);
    const offers = await this.prismaService.client.partnerOffer.findMany({
      where: {
        ...(partnerId ? { partnerId } : {}),
        ...(venueId ? { venueId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: this.parseLimit(query.limit),
    });

    return { items: offers.map((offer: any) => this.mapOffer(offer)) };
  }

  async createOffer(body: Record<string, unknown>): Promise<PartnerOfferDto> {
    const partnerId = this.requiredText(body.partnerId, 'partner_id_required');
    const venueId = this.requiredText(body.venueId, 'venue_id_required');
    await this.assertActivePartner(partnerId);
    await this.assertActiveVenue(venueId);

    const offer = await this.prismaService.client.partnerOffer.create({
      data: {
        partnerId,
        venueId,
        title: this.requiredText(body.title, 'offer_title_required'),
        description: this.requiredText(
          body.description,
          'offer_description_required',
        ),
        terms: this.optionalText(body.terms),
        shortLabel: this.optionalText(body.shortLabel),
        validFrom: this.optionalDate(body.validFrom),
        validTo: this.optionalDate(body.validTo),
        daysOfWeek: this.optionalJson(body.daysOfWeek),
        timeWindow: this.optionalJson(body.timeWindow),
        status: this.parseStatus(
          body.status,
          OFFER_STATUSES,
          'active',
          'offer_status_invalid',
        ),
      },
    });

    return this.mapOffer(offer);
  }

  async updateOffer(
    offerId: string,
    body: Record<string, unknown>,
  ): Promise<PartnerOfferDto> {
    const data: Prisma.PartnerOfferUpdateInput = {};
    if (body.partnerId !== undefined) {
      const partnerId = this.requiredText(body.partnerId, 'partner_id_required');
      await this.assertActivePartner(partnerId);
      data.partner = { connect: { id: partnerId } };
    }
    if (body.venueId !== undefined) {
      const venueId = this.requiredText(body.venueId, 'venue_id_required');
      await this.assertActiveVenue(venueId);
      data.venue = { connect: { id: venueId } };
    }
    this.setOptionalText(data, body, 'title');
    this.setOptionalText(data, body, 'description');
    this.setNullableText(data, body, 'terms');
    this.setNullableText(data, body, 'shortLabel');
    if (body.validFrom !== undefined) {
      data.validFrom = this.optionalDate(body.validFrom);
    }
    if (body.validTo !== undefined) {
      data.validTo = this.optionalDate(body.validTo);
    }
    if (body.daysOfWeek !== undefined) {
      data.daysOfWeek = this.optionalJson(body.daysOfWeek);
    }
    if (body.timeWindow !== undefined) {
      data.timeWindow = this.optionalJson(body.timeWindow);
    }
    if (body.status !== undefined) {
      data.status = this.parseStatus(
        body.status,
        OFFER_STATUSES,
        'active',
        'offer_status_invalid',
      );
    }

    const offer = await this.prismaService.client.partnerOffer.update({
      where: { id: offerId },
      data,
    });

    return this.mapOffer(offer);
  }

  private async assertActivePartner(partnerId: string) {
    const partner = await this.prismaService.client.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, status: true },
    });
    if (!partner) {
      throw new ApiError(404, 'partner_not_found', 'Partner not found');
    }
    if (partner.status !== 'active') {
      throw new ApiError(409, 'partner_inactive', 'Partner is inactive');
    }
  }

  private async assertActiveVenue(venueId: string) {
    const venue = await this.prismaService.client.venue.findUnique({
      where: { id: venueId },
      select: { id: true, status: true },
    });
    if (!venue) {
      throw new ApiError(404, 'venue_not_found', 'Venue not found');
    }
    if (venue.status !== 'open') {
      throw new ApiError(409, 'venue_inactive', 'Venue is inactive');
    }
  }

  private parseOwnerType(value: unknown) {
    const ownerType = this.optionalText(value) ?? 'frendly';
    if (!OWNER_TYPES.has(ownerType)) {
      throw new ApiError(400, 'venue_owner_type_invalid', 'Venue owner type is invalid');
    }
    return ownerType;
  }

  private parseStatus(
    value: unknown,
    allowed: Set<string>,
    fallback: string,
    code: string,
  ) {
    const status = this.optionalText(value) ?? fallback;
    if (!allowed.has(status)) {
      throw new ApiError(400, code, 'Status is invalid');
    }
    return status;
  }

  private parseCoordinate(
    value: unknown,
    min: number,
    max: number,
    code: string,
  ) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseFloat(value)
          : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new ApiError(400, code, 'Coordinate is invalid');
    }
    return parsed;
  }

  private optionalInt(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ApiError(400, 'number_invalid', 'Number is invalid');
    }
    return Math.floor(parsed);
  }

  private optionalDate(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, 'date_invalid', 'Date is invalid');
    }
    return date;
  }

  private optionalJson(value: unknown) {
    if (value == null) {
      return undefined;
    }
    return value as Prisma.InputJsonValue;
  }

  private parseStringArray(value: unknown) {
    if (value == null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new ApiError(400, 'tags_invalid', 'Tags must be an array');
    }
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  private parseLimit(value: unknown) {
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(100, Math.max(1, parsed));
      }
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(100, Math.max(1, Math.floor(value)));
    }
    return 50;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Required text is missing');
    }
    return text;
  }

  private setOptionalText(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
  ) {
    if (body[key] !== undefined) {
      data[key] = this.requiredText(body[key], `${key}_required`);
    }
  }

  private setNullableText(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
  ) {
    if (body[key] !== undefined) {
      data[key] = this.optionalText(body[key]);
    }
  }

  private mapPartner(partner: any): PartnerDto {
    return {
      id: partner.id,
      name: partner.name,
      city: partner.city,
      status: partner.status,
      contact: partner.contact ?? null,
      notes: partner.notes ?? null,
      createdAt: this.requiredDateToIso(partner.createdAt),
      updatedAt: this.requiredDateToIso(partner.updatedAt),
    };
  }

  private mapVenue(venue: any): VenueDto {
    return {
      id: venue.id,
      ownerType: venue.ownerType,
      partnerId: venue.partnerId ?? null,
      source: venue.source,
      externalId: venue.externalId ?? null,
      moderationStatus: venue.moderationStatus,
      trustLevel: venue.trustLevel,
      city: venue.city,
      timezone: venue.timezone,
      area: venue.area ?? null,
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      category: venue.category,
      tags: venue.tags,
      averageCheck: venue.averageCheck ?? null,
      openingHours: venue.openingHours ?? null,
      status: venue.status,
      createdAt: this.requiredDateToIso(venue.createdAt),
      updatedAt: this.requiredDateToIso(venue.updatedAt),
    };
  }

  private mapOffer(offer: any): PartnerOfferDto {
    return {
      id: offer.id,
      partnerId: offer.partnerId,
      venueId: offer.venueId,
      title: offer.title,
      description: offer.description,
      terms: offer.terms ?? null,
      shortLabel: offer.shortLabel ?? null,
      validFrom: this.dateToIso(offer.validFrom),
      validTo: this.dateToIso(offer.validTo),
      daysOfWeek: offer.daysOfWeek ?? null,
      timeWindow: offer.timeWindow ?? null,
      status: offer.status,
      createdAt: this.requiredDateToIso(offer.createdAt),
      updatedAt: this.requiredDateToIso(offer.updatedAt),
    };
  }

  private dateToIso(value: Date | null | undefined) {
    return value instanceof Date ? value.toISOString() : null;
  }

  private requiredDateToIso(value: Date | null | undefined) {
    return this.dateToIso(value) ?? '';
  }
}
