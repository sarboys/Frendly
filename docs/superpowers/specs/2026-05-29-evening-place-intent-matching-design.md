# Evening Place Intent Matching Design

## Goal

AI route generation should understand what kind of place the user asked for, then pick venues that match that meaning.

If an exact venue is not available, the route can use a weaker replacement. The user must see a clear warning, not a silent mismatch.

Example:

- User asks: `бар с вкусными коктейлями`
- Good match: cocktail bar, mixology bar, bar with confirmed cocktail tags
- Weak replacement: regular bar
- Bad silent result: beer pub shown as a good cocktail bar

This must work for many venue intents, not only cocktails.

## Current Context

The route AI flow already has an intent step and a route step:

- `POST /evening/routes/ai-drafts`
- intent returns ordered roles, hints, taxonomy tags, locations, date, area and budget
- backend ranks Tomesto, KudaGo and ticket candidates before the route model sees them
- structured taxonomy tags are already the main scoring and validation signal
- frontend shows each route step and allows accept or regenerate

This design extends that flow. It does not replace it.

## Intent Model

For each requested route step, intent should return a normalized place requirement object.

Shape:

```json
{
  "role": "bar",
  "mustHave": ["cocktails"],
  "niceToHave": ["good_drinks", "evening_vibe"],
  "avoid": ["beer_pub", "sports_bar"],
  "substitutionPolicy": "allow_with_warning"
}
```

Fields:

- `role`: broad place role, such as `restaurant`, `bar`, `cafe`, `show`, `cinema`, `club`, `activity`
- `mustHave`: traits the user clearly asked for
- `niceToHave`: soft traits that improve ranking
- `avoid`: traits that contradict the request
- `substitutionPolicy`: always `allow_with_warning` for this task

The intent model should derive these traits from natural language.

Examples:

```json
{
  "role": "cafe",
  "mustHave": ["quiet"],
  "niceToHave": ["cozy", "conversation_friendly"],
  "avoid": ["loud_music", "club_format"],
  "substitutionPolicy": "allow_with_warning"
}
```

```json
{
  "role": "restaurant",
  "mustHave": ["view"],
  "niceToHave": ["romantic", "evening"],
  "avoid": ["basement", "food_court"],
  "substitutionPolicy": "allow_with_warning"
}
```

```json
{
  "role": "bar",
  "mustHave": ["wine"],
  "niceToHave": ["date_vibe"],
  "avoid": ["beer_pub", "sports_bar"],
  "substitutionPolicy": "allow_with_warning"
}
```

## Candidate Matching

Backend should score each candidate against the normalized requirements.

Signals:

- source category and taxonomy tags
- venue title
- venue description
- parsed source metadata
- existing `taxonomyTags`
- explicit role match
- explicit contradiction from `avoid`

Match quality:

- `exact`: role and must-have traits are confirmed
- `partial`: role matches, but at least one must-have trait is not confirmed
- `substitution`: role is only a weak replacement or important traits are missing
- `rejected`: candidate contradicts the request too strongly

Ranking rules:

- confirmed `mustHave` traits boost strongly
- `niceToHave` traits boost lightly
- `avoid` traits penalize strongly
- missing `mustHave` does not always reject the candidate, it can become `partial` or `substitution`
- strong contradiction can reject the candidate

Example:

- Request: cocktail bar
- Candidate: cocktail bar, quality `exact`
- Candidate: regular bar with no cocktail data, quality `partial`
- Candidate: beer pub, quality `substitution` or `rejected`, depending on available alternatives

## Substitution Behavior

If there are exact or partial candidates, use them first.

If there are no good candidates, backend may select a weaker replacement.

Every replacement must include a reason:

```json
{
  "matchQuality": "substitution",
  "missingTraits": ["cocktails"],
  "substitutionReason": "Коктейли не подтверждены. Подобрали ближайший бар."
}
```

More examples:

- `Тихая атмосфера не подтверждена. Подобрали похожее кафе.`
- `Вид не подтвержден. Подобрали ресторан с подходящей атмосферой.`
- `Винная карта не подтверждена. Подобрали обычный бар.`

No silent substitutions.

## API Contract

Route draft steps should expose matching metadata to mobile.

Add optional fields to each AI route step payload:

```json
{
  "matchQuality": "exact",
  "matchedTraits": ["cocktails", "evening_vibe"],
  "missingTraits": [],
  "avoidHits": [],
  "substitutionReason": null
}
```

For a replacement:

```json
{
  "matchQuality": "substitution",
  "matchedTraits": ["bar"],
  "missingTraits": ["cocktails"],
  "avoidHits": ["beer_pub"],
  "substitutionReason": "Коктейли не подтверждены. Подобрали ближайший бар."
}
```

This metadata should also be stored in the draft. Confirmed routes should preserve it so existing sessions can explain why a point was chosen.

## Mobile UI

Mobile should show a small warning on route step cards when `matchQuality` is `partial` or `substitution`.

For `partial`:

`Не все пожелания подтверждены`

For `substitution`:

Use `substitutionReason`.

The place type label should stay honest:

- exact cocktail bar: `Коктейльный бар`
- regular replacement: `Бар`
- weak replacement: `Бар`, with warning below

The regenerate button should stay available. Regeneration should pass the current rejected step id, so backend avoids returning the same weak result again when possible.

## Error Handling

If there are no candidates at all for the requested role, keep existing hard error behavior where it already exists.

If there are candidates, but no exact match, return a draft with replacement metadata.

If intent output has unknown traits, backend should keep them as text traits for explanation, but should not crash.

If trait extraction fails, backend should fall back to the current role and taxonomy tag logic.

## Performance

This should not add an extra AI call.

Intent should return place requirements in the existing intent response.

Candidate scoring should happen inside the current backend ranking step. It should use already loaded candidate data.

No broad SQL text search expansion should be added for this task.

## Testing

Backend tests:

- cocktail bar request does not silently pick a beer pub as `exact`
- quiet cafe request marks loud or unknown places as `partial` or `substitution`
- view restaurant request warns when view is missing
- replacement includes `missingTraits` and `substitutionReason`
- strong `avoid` traits lower score
- unknown intent traits do not fail draft creation

Mobile tests:

- step card renders no warning for `exact`
- step card renders warning for `partial`
- step card renders `substitutionReason` for `substitution`

## Out Of Scope

- creating a full venue ontology editor
- adding a new external data source
- changing city or area selection
- rewriting the whole AI route prompt flow
- blocking all weak replacements

