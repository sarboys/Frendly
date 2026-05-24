import {
  CONTENT_IMPORT_CITY_NAMES,
  RUSSIA_CONTENT_IMPORT_CITIES,
  isSupportedContentImportCity,
  kudagoCityCode as sharedKudagoCityCode,
  overpassBboxForContentCity,
  timezoneForContentCity,
  tomestoCityCode,
} from '@big-break/database';
import type { ExternalSourceCode } from './content-source.types';

export const SUPPORTED_RUSSIA_MILLION_CITIES = RUSSIA_CONTENT_IMPORT_CITIES;
export const SUPPORTED_RUSSIA_MILLION_CITY_NAMES = CONTENT_IMPORT_CITY_NAMES;

export function timezoneForCity(city: string) {
  return timezoneForContentCity(city);
}

export function kudagoCityCode(city: string) {
  return sharedKudagoCityCode(city);
}

export function overpassBboxForCity(city: string) {
  return overpassBboxForContentCity(city);
}

export function isSupportedTicketlandCity(city: string) {
  return isSupportedContentImportCity(city);
}

export function cityCodesForSource(sourceCode: ExternalSourceCode): Record<string, string> {
  if (sourceCode === 'kudago') {
    return Object.fromEntries(
      RUSSIA_CONTENT_IMPORT_CITIES
        .filter((city) => city.kudagoCode)
        .map((city) => [city.name, city.kudagoCode as string]),
    );
  }
  if (sourceCode === 'tomesto') {
    return Object.fromEntries(
      RUSSIA_CONTENT_IMPORT_CITIES.map((city) => [city.name, tomestoCityCode(city.name) ?? city.name]),
    );
  }
  return Object.fromEntries(RUSSIA_CONTENT_IMPORT_CITIES.map((city) => [city.name, city.name]));
}
