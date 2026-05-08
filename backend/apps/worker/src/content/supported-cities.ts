import type { ExternalSourceCode } from './content-source.types';

type SupportedCity = {
  name: string;
  timezone: string;
  kudagoCode?: string;
  overpassBbox: string;
};

export const SUPPORTED_RUSSIA_MILLION_CITIES: readonly SupportedCity[] = [
  { name: 'Москва', timezone: 'Europe/Moscow', kudagoCode: 'msk', overpassBbox: '55.55,37.35,55.95,37.95' },
  { name: 'Санкт-Петербург', timezone: 'Europe/Moscow', kudagoCode: 'spb', overpassBbox: '59.75,30.05,60.10,30.65' },
  { name: 'Новосибирск', timezone: 'Asia/Novosibirsk', kudagoCode: 'nsk', overpassBbox: '54.80,82.70,55.15,83.20' },
  { name: 'Екатеринбург', timezone: 'Asia/Yekaterinburg', kudagoCode: 'ekb', overpassBbox: '56.70,60.35,56.95,60.85' },
  { name: 'Казань', timezone: 'Europe/Moscow', kudagoCode: 'kzn', overpassBbox: '55.65,48.85,55.95,49.35' },
  { name: 'Нижний Новгород', timezone: 'Europe/Moscow', kudagoCode: 'nnv', overpassBbox: '56.15,43.75,56.40,44.20' },
  { name: 'Красноярск', timezone: 'Asia/Krasnoyarsk', kudagoCode: 'krasnoyarsk', overpassBbox: '55.85,92.60,56.15,93.20' },
  { name: 'Челябинск', timezone: 'Asia/Yekaterinburg', overpassBbox: '55.05,61.15,55.35,61.65' },
  { name: 'Самара', timezone: 'Europe/Samara', kudagoCode: 'smr', overpassBbox: '53.05,49.85,53.35,50.35' },
  { name: 'Уфа', timezone: 'Asia/Yekaterinburg', kudagoCode: 'ufa', overpassBbox: '54.60,55.75,54.90,56.20' },
  { name: 'Ростов-на-Дону', timezone: 'Europe/Moscow', overpassBbox: '47.15,39.55,47.35,39.90' },
  { name: 'Краснодар', timezone: 'Europe/Moscow', kudagoCode: 'krd', overpassBbox: '44.95,38.85,45.15,39.20' },
  { name: 'Омск', timezone: 'Asia/Omsk', overpassBbox: '54.85,73.15,55.10,73.65' },
  { name: 'Воронеж', timezone: 'Europe/Moscow', overpassBbox: '51.55,39.05,51.80,39.35' },
  { name: 'Пермь', timezone: 'Asia/Yekaterinburg', overpassBbox: '57.85,55.80,58.10,56.45' },
  { name: 'Волгоград', timezone: 'Europe/Volgograd', overpassBbox: '48.55,44.30,48.90,44.70' },
] as const;

export const SUPPORTED_RUSSIA_MILLION_CITY_NAMES = SUPPORTED_RUSSIA_MILLION_CITIES.map((city) => city.name);

export function timezoneForCity(city: string) {
  return SUPPORTED_RUSSIA_MILLION_CITIES.find((item) => item.name === city)?.timezone ?? 'Europe/Moscow';
}

export function kudagoCityCode(city: string) {
  return SUPPORTED_RUSSIA_MILLION_CITIES.find((item) => item.name === city)?.kudagoCode ?? null;
}

export function overpassBboxForCity(city: string) {
  return SUPPORTED_RUSSIA_MILLION_CITIES.find((item) => item.name === city)?.overpassBbox ?? null;
}

export function isSupportedTicketlandCity(city: string) {
  return SUPPORTED_RUSSIA_MILLION_CITIES.some((item) => item.name === city);
}

export function cityCodesForSource(sourceCode: ExternalSourceCode): Record<string, string> {
  if (sourceCode === 'kudago') {
    return Object.fromEntries(
      SUPPORTED_RUSSIA_MILLION_CITIES
        .filter((city) => city.kudagoCode)
        .map((city) => [city.name, city.kudagoCode as string]),
    );
  }
  return Object.fromEntries(SUPPORTED_RUSSIA_MILLION_CITIES.map((city) => [city.name, city.name]));
}
