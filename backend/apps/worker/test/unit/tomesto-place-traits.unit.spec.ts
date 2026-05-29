import {
  extractTomestoPlaceTraits,
  type TomestoPlaceTraitInput,
} from '../../src/content/tomesto-place-traits';

describe('extractTomestoPlaceTraits', () => {
  it.each([
    {
      title: 'Black Harp',
      description: 'Паб с 20 сортами крафта и сидров, где показывают спортивные события на экранах.',
      expectedTags: [
        'place:pub',
        'place:bar',
        'set:craft_beer',
        'set:cider',
        'feature:sports_broadcasts',
      ],
    },
    {
      title: 'Аврора',
      description: 'Ресторан морской кухни, рыбы и морепродуктов.',
      expectedTags: ['place:restaurant', 'cuisine:seafood', 'set:fish'],
    },
    {
      title: 'Царская рюмочная',
      description: 'Русская гастрономия, эксклюзивные настойки, авторские коктейли, дог-френдли.',
      expectedTags: [
        'place:bar',
        'cuisine:russian',
        'set:nastoyki',
        'set:cocktails',
        'feature:dog_friendly',
      ],
    },
    {
      title: 'Diktatura Estetika',
      description: 'Коктейльный бар с уникальным дизайном интерьера для романтического ужина.',
      expectedTags: [
        'place:bar',
        'set:cocktails',
        'feature:beautiful_interior',
        'feature:romantic',
      ],
    },
  ])('extracts expected traits for $title', ({ title, description, expectedTags }) => {
    const result = extractTomestoPlaceTraits(placeInput({
      title,
      description,
    }));

    expect(result.tags).toEqual(expect.arrayContaining(expectedTags));
    for (const tag of expectedTags) {
      expect(result.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tag,
            confidence: expect.any(Number),
            evidence: expect.any(String),
          }),
        ]),
      );
    }
  });

  it('normalizes case and yo before matching traits', () => {
    const result = extractTomestoPlaceTraits(placeInput({
      title: 'Ё-бар',
      description: 'БАР с авторскими КОКТЕЙЛЯМИ.',
    }));

    expect(result.tags).toEqual(expect.arrayContaining(['place:bar', 'set:cocktails']));
  });
});

function placeInput(overrides: Partial<TomestoPlaceTraitInput>): TomestoPlaceTraitInput {
  return {
    title: 'Place',
    description: null,
    category: '',
    categoryLabels: [],
    features: [],
    sets: [],
    cuisine: [],
    pageText: '',
    sourceUrl: 'https://tomesto.ru/moskva/places/place',
    ...overrides,
  };
}
