export type ContentImportCity = {
  name: string;
  timezone: string;
  bbox: string;
  kudagoCode?: string;
  tomestoCode: string;
  overpassBbox: string;
};

export const RUSSIA_CONTENT_IMPORT_CITIES: readonly ContentImportCity[] = [
  { name: 'Москва', timezone: 'Europe/Moscow', bbox: '55.55,37.35,55.95,37.95', kudagoCode: 'msk', tomestoCode: 'moskva', overpassBbox: '55.55,37.35,55.95,37.95' },
  { name: 'Санкт-Петербург', timezone: 'Europe/Moscow', bbox: '59.75,30.05,60.10,30.65', kudagoCode: 'spb', tomestoCode: 'spb', overpassBbox: '59.75,30.05,60.10,30.65' },
  { name: 'Барнаул', timezone: 'Asia/Barnaul', bbox: '53.20,83.55,53.55,84.05', tomestoCode: 'barnaul', overpassBbox: '53.20,83.55,53.55,84.05' },
  { name: 'Волгоград', timezone: 'Europe/Volgograd', bbox: '48.55,44.30,48.90,44.70', tomestoCode: 'volgograd', overpassBbox: '48.55,44.30,48.90,44.70' },
  { name: 'Воронеж', timezone: 'Europe/Moscow', bbox: '51.55,39.05,51.80,39.35', tomestoCode: 'voronezh', overpassBbox: '51.55,39.05,51.80,39.35' },
  { name: 'Екатеринбург', timezone: 'Asia/Yekaterinburg', bbox: '56.70,60.35,56.95,60.85', kudagoCode: 'ekb', tomestoCode: 'ekaterinburg', overpassBbox: '56.70,60.35,56.95,60.85' },
  { name: 'Ижевск', timezone: 'Europe/Samara', bbox: '56.75,53.05,57.00,53.45', tomestoCode: 'izhevsk', overpassBbox: '56.75,53.05,57.00,53.45' },
  { name: 'Казань', timezone: 'Europe/Moscow', bbox: '55.65,48.85,55.95,49.35', kudagoCode: 'kzn', tomestoCode: 'kazan', overpassBbox: '55.65,48.85,55.95,49.35' },
  { name: 'Калининград', timezone: 'Europe/Kaliningrad', bbox: '54.60,20.35,54.85,20.70', tomestoCode: 'kaliningrad', overpassBbox: '54.60,20.35,54.85,20.70' },
  { name: 'Кемерово', timezone: 'Asia/Novokuznetsk', bbox: '55.20,85.95,55.55,86.35', tomestoCode: 'kemerovo', overpassBbox: '55.20,85.95,55.55,86.35' },
  { name: 'Краснодар', timezone: 'Europe/Moscow', bbox: '44.95,38.85,45.15,39.20', tomestoCode: 'krasnodar', overpassBbox: '44.95,38.85,45.15,39.20' },
  { name: 'Красноярск', timezone: 'Asia/Krasnoyarsk', bbox: '55.85,92.60,56.15,93.20', tomestoCode: 'krasnoyarsk', overpassBbox: '55.85,92.60,56.15,93.20' },
  { name: 'Махачкала', timezone: 'Europe/Moscow', bbox: '42.85,47.35,43.10,47.65', tomestoCode: 'mahachkala', overpassBbox: '42.85,47.35,43.10,47.65' },
  { name: 'Набережные Челны', timezone: 'Europe/Moscow', bbox: '55.60,52.20,55.85,52.60', tomestoCode: 'nabchelny', overpassBbox: '55.60,52.20,55.85,52.60' },
  { name: 'Нижний Новгород', timezone: 'Europe/Moscow', bbox: '56.15,43.75,56.40,44.20', kudagoCode: 'nnv', tomestoCode: 'nnovgorod', overpassBbox: '56.15,43.75,56.40,44.20' },
  { name: 'Новосибирск', timezone: 'Asia/Novosibirsk', bbox: '54.80,82.70,55.15,83.20', tomestoCode: 'novosibirsk', overpassBbox: '54.80,82.70,55.15,83.20' },
  { name: 'Омск', timezone: 'Asia/Omsk', bbox: '54.85,73.15,55.10,73.65', tomestoCode: 'omsk', overpassBbox: '54.85,73.15,55.10,73.65' },
  { name: 'Пермь', timezone: 'Asia/Yekaterinburg', bbox: '57.85,55.80,58.10,56.45', tomestoCode: 'perm', overpassBbox: '57.85,55.80,58.10,56.45' },
  { name: 'Ростов-на-Дону', timezone: 'Europe/Moscow', bbox: '47.15,39.55,47.35,39.90', tomestoCode: 'rostov', overpassBbox: '47.15,39.55,47.35,39.90' },
  { name: 'Самара', timezone: 'Europe/Samara', bbox: '53.05,49.85,53.35,50.35', tomestoCode: 'samara', overpassBbox: '53.05,49.85,53.35,50.35' },
  { name: 'Саратов', timezone: 'Europe/Saratov', bbox: '51.40,45.80,51.65,46.20', tomestoCode: 'saratov', overpassBbox: '51.40,45.80,51.65,46.20' },
  { name: 'Сочи', timezone: 'Europe/Moscow', bbox: '43.35,39.55,43.75,40.10', tomestoCode: 'sochi', overpassBbox: '43.35,39.55,43.75,40.10' },
  { name: 'Ставрополь', timezone: 'Europe/Moscow', bbox: '44.95,41.80,45.15,42.10', tomestoCode: 'stavropol', overpassBbox: '44.95,41.80,45.15,42.10' },
  { name: 'Тольятти', timezone: 'Europe/Samara', bbox: '53.40,49.20,53.65,49.65', tomestoCode: 'tolyatti', overpassBbox: '53.40,49.20,53.65,49.65' },
  { name: 'Томск', timezone: 'Asia/Tomsk', bbox: '56.35,84.80,56.60,85.20', tomestoCode: 'tomsk', overpassBbox: '56.35,84.80,56.60,85.20' },
  { name: 'Тюмень', timezone: 'Asia/Yekaterinburg', bbox: '57.00,65.35,57.25,65.75', tomestoCode: 'tyumen', overpassBbox: '57.00,65.35,57.25,65.75' },
  { name: 'Ульяновск', timezone: 'Europe/Ulyanovsk', bbox: '54.20,48.20,54.45,48.65', tomestoCode: 'ulyanovsk', overpassBbox: '54.20,48.20,54.45,48.65' },
  { name: 'Уфа', timezone: 'Asia/Yekaterinburg', bbox: '54.60,55.75,54.90,56.20', tomestoCode: 'ufa', overpassBbox: '54.60,55.75,54.90,56.20' },
  { name: 'Челябинск', timezone: 'Asia/Yekaterinburg', bbox: '55.05,61.15,55.35,61.65', tomestoCode: 'chelyabinsk', overpassBbox: '55.05,61.15,55.35,61.65' },
  { name: 'Ярославль', timezone: 'Europe/Moscow', bbox: '57.50,39.70,57.75,40.00', tomestoCode: 'yaroslavl', overpassBbox: '57.50,39.70,57.75,40.00' },
] as const;

export const CONTENT_IMPORT_CITY_NAMES = RUSSIA_CONTENT_IMPORT_CITIES.map((city) => city.name);

export function contentImportCity(city: string) {
  return RUSSIA_CONTENT_IMPORT_CITIES.find((item) => item.name === city) ?? null;
}

export function timezoneForContentCity(city: string) {
  return contentImportCity(city)?.timezone ?? 'Europe/Moscow';
}

export function bboxForContentCity(city: string) {
  return contentImportCity(city)?.bbox ?? null;
}

export function kudagoCityCode(city: string) {
  return contentImportCity(city)?.kudagoCode ?? null;
}

export function tomestoCityCode(city: string) {
  return contentImportCity(city)?.tomestoCode ?? null;
}

export function overpassBboxForContentCity(city: string) {
  return contentImportCity(city)?.overpassBbox ?? null;
}

export function isSupportedContentImportCity(city: string) {
  return contentImportCity(city) != null;
}
