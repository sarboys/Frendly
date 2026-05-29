import {
  CONTENT_IMPORT_CITY_NAMES,
  RUSSIA_CONTENT_IMPORT_CITIES,
  bboxForContentCity,
  kudagoCityCode,
  tomestoCityCode,
} from '../../src/content-city-catalog';

const EXPECTED_CITY_NAMES = [
  'Москва',
  'Санкт-Петербург',
  'Барнаул',
  'Волгоград',
  'Воронеж',
  'Екатеринбург',
  'Ижевск',
  'Казань',
  'Калининград',
  'Кемерово',
  'Краснодар',
  'Красноярск',
  'Махачкала',
  'Набережные Челны',
  'Нижний Новгород',
  'Новосибирск',
  'Омск',
  'Пермь',
  'Ростов-на-Дону',
  'Самара',
  'Саратов',
  'Сочи',
  'Ставрополь',
  'Тольятти',
  'Томск',
  'Тюмень',
  'Ульяновск',
  'Уфа',
  'Челябинск',
  'Ярославль',
];

describe('content city catalog', () => {
  it('contains the requested 30 cities once and in product order', () => {
    expect(CONTENT_IMPORT_CITY_NAMES).toEqual(EXPECTED_CITY_NAMES);
    expect(new Set(CONTENT_IMPORT_CITY_NAMES).size).toBe(30);
    expect(RUSSIA_CONTENT_IMPORT_CITIES).toHaveLength(30);
  });

  it('keeps KudaGo codes for product cities accepted by the KudaGo locations API', () => {
    const citiesWithKudagoCode = RUSSIA_CONTENT_IMPORT_CITIES
      .filter((city) => city.kudagoCode)
      .map((city) => city.name);

    expect(citiesWithKudagoCode).toEqual([
      'Москва',
      'Санкт-Петербург',
      'Екатеринбург',
      'Казань',
      'Краснодар',
      'Красноярск',
      'Нижний Новгород',
      'Новосибирск',
      'Самара',
      'Сочи',
      'Уфа',
    ]);
    expect(kudagoCityCode('Барнаул')).toBeNull();
    expect(kudagoCityCode('Выборг')).toBeNull();
  });

  it('has Tomesto codes and geocoder bounding boxes for every import city', () => {
    for (const city of EXPECTED_CITY_NAMES) {
      expect(tomestoCityCode(city)).toEqual(expect.any(String));
      expect(bboxForContentCity(city)).toEqual(expect.any(String));
    }

    expect(tomestoCityCode('Нижний Новгород')).toBe('nnovgorod');
    expect(tomestoCityCode('Набережные Челны')).toBe('nabchelny');
    expect(tomestoCityCode('Махачкала')).toBe('mahachkala');
    expect(tomestoCityCode('Ростов-на-Дону')).toBe('rostov');
  });
});
