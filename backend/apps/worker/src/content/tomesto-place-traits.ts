export type TomestoPlaceTraitInput = {
  title: string;
  description: string | null;
  category: string;
  categoryLabels: string[];
  features: string[];
  sets: string[];
  cuisine: string[];
  pageText: string;
  sourceUrl: string;
};

export type TomestoTraitEvidence = {
  tag: string;
  confidence: number;
  evidence: string;
  source: 'category' | 'description' | 'page_text' | 'feature' | 'set' | 'cuisine' | 'url';
};

export type TomestoPlaceTraits = {
  tags: string[];
  evidence: TomestoTraitEvidence[];
};

type EvidenceSource = TomestoTraitEvidence['source'];

type TextPart = {
  source: EvidenceSource;
  value: string;
};

type TraitRule = {
  tag: string;
  confidence: number;
  patterns: RegExp[];
  sources: EvidenceSource[];
};

const TEXT_SOURCES: EvidenceSource[] = [
  'category',
  'description',
  'page_text',
  'feature',
  'set',
  'cuisine',
];

const TRAIT_RULES: TraitRule[] = [
  trait('place:pub', 0.96, ['(^|[^а-яa-z])паб([^а-яa-z]|$)', '(^|[^а-яa-z])pub([^а-яa-z]|$)']),
  trait('place:bar', 0.95, ['(^|[^а-яa-z])бар([^а-яa-z]|$)', 'рюмочн', 'паб', 'cocktail bar', 'коктейльн']),
  trait('place:restaurant', 0.94, ['(^|[^а-яa-z])ресторан']),
  trait('place:cafe', 0.9, ['(^|[^а-яa-z])кафе([^а-яa-z]|$)', 'кофейн']),
  trait('cuisine:seafood', 0.94, ['(^|[^а-яa-z])морская кухня', 'морепродукт', 'seafood']),
  trait('cuisine:seafood', 0.94, ['морск', 'морепродукт', 'seafood'], ['cuisine']),
  trait('cuisine:russian', 0.94, ['(^|[^а-яa-z])русская кухня', '(^|[^а-яa-z])русская гастрономия']),
  trait('cuisine:russian', 0.94, ['русск', 'russian'], ['cuisine']),
  trait('set:fish', 0.9, [
    'рыбная кухня',
    '(^|[^а-яa-z])рыба и([^а-яa-z]|$)',
    '(^|[^а-яa-z])рыбы и морепродуктов([^а-яa-z]|$)',
    'блюда из рыбы',
  ]),
  trait('set:fish', 0.9, ['рыб'], ['cuisine', 'set']),
  trait('set:craft_beer', 0.93, ['крафт', 'craft beer', 'крафтов']),
  trait('set:cider', 0.92, ['сидр', 'cider']),
  trait('set:nastoyki', 0.93, ['настойк']),
  trait('set:cocktails', 0.93, ['коктейл', 'cocktail']),
  trait('feature:sports_broadcasts', 0.9, ['спортивн.{0,40}событ', 'спорт.{0,30}экран', 'трансляц']),
  trait('feature:dog_friendly', 0.93, ['дог.?френдли', 'dog.?friendly', 'pet.?friendly', 'с собак']),
  trait('feature:beautiful_interior', 0.9, ['дизайн.{0,30}интерьер', 'красив.{0,30}интерьер', 'уникальн.{0,30}дизайн']),
  trait('feature:romantic', 0.91, ['романтич', 'для свидан']),
];

export function extractTomestoPlaceTraits(input: TomestoPlaceTraitInput): TomestoPlaceTraits {
  const evidenceByTag = new Map<string, TomestoTraitEvidence>();
  const parts = inputParts(input);

  for (const rule of TRAIT_RULES) {
    const evidence = findEvidence(rule, parts);
    if (evidence) {
      evidenceByTag.set(rule.tag, evidence);
    }
  }

  const evidence = Array.from(evidenceByTag.values());
  return {
    tags: evidence.map((item) => item.tag),
    evidence,
  };
}

function trait(tag: string, confidence: number, patterns: string[], sources?: EvidenceSource[]): TraitRule {
  return {
    tag,
    confidence,
    patterns: patterns.map((pattern) => new RegExp(pattern, 'i')),
    sources: sources ?? TEXT_SOURCES,
  };
}

function inputParts(input: TomestoPlaceTraitInput): TextPart[] {
  const parts: TextPart[] = [
    { source: 'category' as const, value: input.category },
    ...input.categoryLabels.map((value) => ({ source: 'category' as const, value })),
    { source: 'description' as const, value: input.description ?? '' },
    ...input.features.map((value) => ({ source: 'feature' as const, value })),
    ...input.sets.map((value) => ({ source: 'set' as const, value })),
    ...input.cuisine.map((value) => ({ source: 'cuisine' as const, value })),
    { source: 'page_text' as const, value: input.title },
    { source: 'page_text' as const, value: input.pageText },
    { source: 'url' as const, value: input.sourceUrl },
  ];
  return parts.filter((part) => normalize(part.value).length > 0);
}

function findEvidence(rule: TraitRule, parts: TextPart[]): TomestoTraitEvidence | null {
  for (const part of parts) {
    if (!rule.sources.includes(part.source)) {
      continue;
    }
    const normalized = normalize(part.value);
    for (const pattern of rule.patterns) {
      const match = normalized.match(pattern);
      if (match?.[0]) {
        return {
          tag: rule.tag,
          confidence: rule.confidence,
          evidence: match[0],
          source: part.source,
        };
      }
    }
  }
  return null;
}

function normalize(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
}
