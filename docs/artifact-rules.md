# Adding and updating artifact rules

## Where changes belong

| Change | Edit |
| --- | --- |
| New damage or attack-rate modifier using existing mechanics | `src/artifact-rules.js` |
| Source percentage balance change | Refresh `data/artifacts.json`; review diff and tests |
| Fixed multiplier or condition changes | Artifact definition and affected source contract |
| A new kind of mechanic | Extend `src/effect-engine.js`, then declare its artifact effects |
| Source importer format changes | `scripts/refresh-data.mjs` and importer tests |

The supported artifact set is derived from the definition registry. Adding a definition automatically includes the artifact in the Modeled effects view. The UI derives summaries from the evaluated effects, including category conversion, boss-only bonuses, and exclusions. Keep the upstream artifact ID stable: saved/shared builds use it.

## Example definition

Slower Is Harder's source description uses `{0}` for projectile speed reduction and `{1}` for damage increase. We model the latter:

```js
SlowerIsHarder: {
  parameters: { damageBonusPercent: 1 },
  effects: [{
    stat: 'damage',
    operation: 'percentIncrease',
    value: 'damageBonusPercent',
    when: {}
  }]
}
```

`damageBonusPercent` names the local parameter; `1` binds it to the upstream placeholder index. The engine resolves that value from the selected rarity. For example, 30 produces a 1.3× damage multiplier. Updating it to 40 in a compatible source refresh produces 1.4× without an engine edit. It does not change projectile behavior because that mechanic is outside the model.

The registry has helper constructors for concise definitions and shared Precision/Quickening families. They produce plain objects. Literal multipliers such as One Monkey Army's `2` live in these definitions; they are never inferred by parsing English prose.

## Effect types

| `stat` | Contribution |
| --- | --- |
| `damage` | Regular and boss hit damage |
| `regularDamage` | Regular hit damage only, e.g. frozen/stunned target bonuses |
| `attackRate` | Attacks per second |
| `pierce` | Projectile contact-capacity multiplier |
| `range` | Attack range or non-attacking influence-radius multiplier |
| `moabDamage` | Additional MOAB multiplier included in boss estimates |
| `bossDamage` | Boss-only damage modifier |

Every effect has `operation`, `value`, and optional `when`. Values are literal numbers or names declared in `parameters`.

| `operation` | Input → multiplier |
| --- | --- |
| `multiplier` | `2` → 2× |
| `percentIncrease` | `25` → 1.25× |
| `percentDecrease` | `25` → 0.75× |
| `cooldownMultiplier` | `0.8` → 1.25× attack rate |

`cooldownMultiplier` converts a known timer factor to a rate. Compatible attack cooldowns can also use pinned verified values. Description percentages remain estimates; do not treat them as raw timers. `abilityRate` is a separate strictly positive stat: multiply recharge rates, then invert the total for a cooldown-time multiplier. Ability recharge estimates are independent of attack-rate verification.

Zero multipliers are valid and suppress hit damage. Negative/nonfinite factors, unknown stats, missing bindings, and unknown condition keys fail validation. Effects are multiplied independently; the engine doesn't assume additive stacking or infer special game interactions.

## Conditions and category conversions

Conditions support:

- `category`: one resolved category or an array (any matching category).
- `originalCategory`: original base-tower category; conversion does not erase fixed identity penalties.
- `tower`: one tower name or an array.
- `minTier`, `maxTier`, `minHeroLevel`.
- `minPath`: a three-element minimum upgrade array, e.g. `[0, 0, 2]` for Crow’s Nest. Unknown legacy upgrade paths do not satisfy it.
- `flag`: `early`, `close`, `aura`, `frozen`, `glued`, or `stunned`.
- Nested `all`, `any`, and `not`.

Sibling keys all need to match. Empty `{}` matches all contexts. Example:

```js
when: {
  all: [
    { category: 'Magic', minTier: 3 },
    { not: { flag: 'early' } }
  ]
}
```

A definition can also declare:

```js
categories: [{
  add: ['Primary', 'Military', 'Magic', 'Support'],
  when: { category: 'Hero' }
}]
```

Identity-based grants (One Monkey Army, Dreadbloon and Heroic Specialty) are resolved first. Reviewed class converters declare `chain: true` and consume granted membership in simultaneous rounds until stable, independently of catalog order. This enables Heroic Specialty → class conversion while retaining original tier/hero gates. Damage penalties use the pinned fixed base-tower identities (`originalCategory`), while range follows resolved membership. Heroic Specialty affinities use named identities from `src/hero-roster.js`; custom manual heroes have no inferred affinity. See the [complete audit](artifact-calculation-audit.md).

Optional `excluded` strings explain omitted mechanics; `summary` supplies fallback text for effects without direct numeric contributions.

## Reviewing a game-data update

1. Run `npm run data:refresh`.
2. Inspect `data/refresh-report.md` and the diff. Numeric parameter-only changes with unchanged source templates/layouts update the active catalog. Check-date-only changes are ignored.
3. If wording, literal numbers, source metadata, rarities, parameter types/counts, or artifact membership changed, the refresh preserves the active catalog and writes `data/artifacts.candidate.json`. Exit code 2 means a source review is needed, not a network failure.
4. Verify the changed mechanic and parameter meanings against reliable game data or an in-game check. Update affected definitions, including literal values and gates. New artifacts may stay reference-only. Review the corresponding coverage notes in `src/artifact-exclusions.js` and the per-effect evidence in `src/artifact-discovery.js`; keep unsupported clauses explicit and never extend a verified attack cooldown label to other effects.
5. Update **only the affected** entries in `data/catalog-contract.json` after that review. The structure is the output of `sourceContract(artifact)` in `scripts/catalog-validation.mjs`: metadata plus each rarity's template and parameter types. Do not regenerate the entire baseline just to silence validation errors.
6. For a candidate, run `npm run data:check -- --candidate`, then move the reviewed candidate to `data/artifacts.json`. Remove the stale candidate. For an ordinary value update, run `npm run data:check` directly.
7. Update regression expectations where balance changes intentionally alter results. Add interaction tests for new mechanics. Run `npm test` and `npm run build`, then commit and review the update.

Malformed or incomplete source payloads fail before writing catalog files. Active-catalog writes use a temporary file and rename. The production build validates the active catalog before replacing `dist/`, and bundles only the active data file, never pending candidates or review metadata.

The source contract catches changes to known source structure and wording; it cannot prove the upstream community dataset is accurate, current, or internally semantically correct. Changes to modeled game behavior require human review. Automated weekly draft PRs propose changes, never approve them.

Pierce and range use the same multiplicative evaluator as other stats but never multiply single-target DPS. Specialist penalties target the union of the other three categories, matching the raw export’s category masks; multi-category towers may therefore receive both a specialist bonus and its pierce penalty. Pierce assigned to newly spawned, unmodeled attacks (such as Duckageddon) is not applied to the selected base projectile. The four class-conversion artifacts include their damage and range penalties; upgrade prices are excluded. Optional `damageSet` / `damageCap` effects replace source base damage before target modifiers and cap ordinary hits after modeled damage factors. Critical expectations are excluded for capped replacement hits. These require contextual explanations rather than a product of independent damage factors. Optional `stackCount` on an effect uses the reviewed `otherMilitaryCount` (0–15); this does not infer provider availability or party membership.

Catalog, contract, or transformation changes must also update the dated modification notice in `data/ARTIFACT-NOTICES.md`. Keep copied source text under the distribution scope in [DISTRIBUTION.md](../DISTRIBUTION.md); every build packages the readable source and notices with the compacted catalog.
