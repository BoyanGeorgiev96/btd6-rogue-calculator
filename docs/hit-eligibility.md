# Hit-eligibility evidence review

This inventory records source evidence for future hit-eligibility work. Damage per contact is calculated separately from whether a projectile can hit; these findings do not establish detection or immunity coverage. The target matrix labels eligibility unknown, except for the existing explicit MOAB/original-target component exclusions.

Runtime eligibility and further exhaustive extraction are deferred. Keep the existing uncertainty labels until the remaining evidence is reviewed.

## Reproduce the inventory

Use Node 26 and run:

```sh
npm run eligibility:review -- --cache-dir /absolute/path/to/artifact-model-cache
```

The cache is optional. This fetches the complete `Artifacts/` tree at the exact revision in `data/tower-source.json`, scans all 571 artifact/item/trait models, and writes `docs/hit-eligibility-review.json`. Cached and downloaded files must match the pinned tree's Git blob SHA; a mismatched cache fails rather than being accepted or silently replaced. Remove the mismatched cache file and rerun to fetch it again. No active catalog or calculation rules are modified, and review files are not shipped in `dist/`.

The report inventories **all 117 active catalog artifacts**, with description/rarity snapshots, matching source model paths and blob hashes, JSON paths to relevant fields, and enclosing artifact selection gates. Eleven lack a matching model in this v56 export; their mechanics remain unknown. A model's numeric `sourceTier` is recorded as observed rather than deriving rarity from its filename suffix: Phayze's `1` suffix, for example, is not a Common variant.

The extractor finds visibility/filters, immunity and damage-type model names, and explicit immunity/property fields at any nesting depth. It retains the paths to secondary projectiles, DOT, and replacement damage models. This is a discovery aid: **no candidate fields found does not prove no eligibility effect**. New behavior types, inherited effects, mutators, and version differences still need manual review. Sheriff items and traits in the source are scanned but are not silently added to the active artifact roster.

## Direct and aura candidates

These links refer to the pinned community game-data export, v56.0 at `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`. Active artifact descriptions are v57, so raw source behavior is evidence for this snapshot, not proof of current-game behavior.

| Artifact | Observed raw fields | Review implications |
| --- | --- | --- |
| [Essence of Phayze](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/EssenceOfPhayze1.json) | Separate `OverrideCamoDetectionModel(detectCamo: true)` entries with tower `tiers: [4,4,4]` and hero `tiers: [15]`; separate Camo-tag damage modifiers | Detection and triple damage need separate reviewed gates. This export does **not** establish detection for a below-tier-4 camo-blind tower. Reproduce that case in-game before claiming it. |
| [General's Disposition](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/GeneralsDisposition3.json) | Hero-selected `VisibilitySupportModel`, local radius, `appliesToOwningTower: true`; a separate MOAB damage support model | Recipient detection depends on an eligible hero aura. The selected damage component need not belong to the aura provider. Aura ownership and placement must be explicit assumptions. |
| [Perceptive Crow](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/PerceptiveCrow3.json) | Buccaneer-selected `VisibilitySupportModel`, `tiers: [6,6,2]`, `appliesToOwningTower: false` | Verify bottom-path/provider gating independently from the receiving tower. A tower's own detection must not be inferred from an aura that excludes its owner. The Common description's granted boat is `1-0-1`; that is not itself a Crow's Nest provider. |
| [One Monkey Army](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/OneMonkeyArmy3.json) | Hero-selected `OverrideCamoDetectionModel`; non-hero replacement `DamageModel` with zero damage and immunity mask `-1` | Hero detection and non-hero damage removal are distinct. Category conversion does not turn a non-hero into a hero or remove projectile immunities. |
| [Intelligence Agent](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/IntelligenceAgent3.json) | Hero-selected `DamageTypeSupportModel`, immunity mask `0`, local radius, `appliesToOwningTower: true`, `ignoreSubTowers: true` | Model this as damage-type coverage with provider/recipient scope. It has no visibility grant in these models; “can hit all Bloon types” must not be treated as camo detection. Keep the independent attack-speed penalty. |

All exported rarities of each matching artifact are scanned, not only the linked example. The machine-readable report holds the full paths, fields, and gates for each variant.

## Additional attacks are separate coverage

The report also finds damage/immunity fields in artifacts such as Splody Darts, Corrosive Torp-E-Darts, Dazing Frostburn, Flaming Hot Punch-A-Rang, Fish Nova, Just Like Magic, and The Unspoken Heroes. Some belong to newly spawned projectiles, explosions, DOT, or summons. An explosion's immunity mask must never replace the selected dart component's mask. Coverage from a summon must never imply the owner can directly hit that target. Damage bonuses to frozen or Camo bloons likewise do not grant the ability to hit them.

Replacement effects also need care: One Monkey Army's replacement zero-damage model is different from adding an extra attack. Identity matching, category conversions, and source tier arrays must be reviewed per behavior rather than applying a description-wide gate to every effect.

## Per-component source review

The checked-in `docs/component-eligibility-review.json` extends the artifact inventory with **2,024 integrity-checked tower/hero models**: all 1,664 legal tower crosspaths and 360 hero levels. It maps **3,191 active components** to their exact root attack, weapon, projectile, ancestor projectile, and direct `DamageModel` paths. Each source model retains its filename and Git blob hash; 959 identical evidence profiles are shared across variants to avoid repeating the same observations.

Reproduce it with Node 26:

```sh
npm run eligibility:components -- --cache-dir /absolute/path/to/tower-model-cache
```

The cache layout matches the tower/hero importers: `<cache-dir>/<revision>/<filename>`. The command fetches the pinned upstream tree and checks every cached/downloaded model against its Git blob SHA. Wrong-revision, truncated trees, missing files, mismatched blobs, unexpected tower paths/hero levels, and differences from active component stats fail the review. It writes the report atomically only after all models pass. No active catalog or calculation rule changes. The report is not shipped in `dist/`.

Each model's `evidence` key references a profile containing `components` and `findings`. Component `sourcePaths` use JSON pointer paths into that model; attack IDs still use the calculator's filtered attack indices, so those IDs must **not** be interpreted as raw behavior-array offsets. `damage` lists only direct damage models on that component's projectile. `ancestors` lists parent projectiles, outermost first. A root bomb whose damage lives in its explosion remains an attack component; shrapnel triggered by a damaging bullet remains a secondary component with the existing original-target exclusion. Neither parent's nor child's immunity mask is copied to the other.

Findings preserve observed detection/targeting filters, active flags, direct damage/immunity fields, collision settings, and support candidates at their actual source paths. Explicit `false`, zero, and absent fields stay distinct. Nested ability, DOT, spell, summon, and support observations remain in the inventory even when they have no imported attack component. For example, Corvus's spell damage models do not become baseline components. A finding elsewhere in the model is **not** a tower-wide grant, and neither the absence of a filter nor an inactive filter establishes runtime camo coverage by itself.

Source extraction and component mapping are complete; damage-type decoding and eligibility evaluation are still pending. Manual overrides still have no inferred coverage. Runtime collision semantics, dynamic effects, property-bit meanings, artifact grants/precedence, and in-game gates remain to be reviewed below.

## Bloon property-mask review

`docs/bloon-property-review.json` inventories all **235 pinned bloon models**, with exact Git blob checks, source identity, property masks, tags, variant flags, invulnerability, and collision-group observations. Reproduce with Node 26:

```sh
npm run eligibility:bloons -- --cache-dir /absolute/path/to/bloon-model-cache
```

The cache uses `<cache-dir>/<revision>/Bloons/<baseId>/<id>.json`. A corrupt cache fails without replacing the report. An incomplete/wrong-revision tree or invalid model identity also fails. The report is written atomically after every model passes and retains a SHA-256 of the component review used for comparison. No runtime catalog is modified; neither evidence report ships in `dist/`.

Source-observed `bloonProperties` associations in this snapshot:

| Model | Mask | Interpretation supported by these model values |
| --- | --- | --- |
| Lead | 1 | Lead-associated bit |
| Black | 2 | Black-associated bit |
| White | 4 | White-associated bit; separate from Frozen |
| Purple | 8 | Purple-associated bit |
| Zebra | 6 | Black + White bits |
| Ddt / DdtCamo | 3 | Lead + Black bits; identical mask with different Camo flags |
| GlassBloon | 64 | Glass-associated bit; preserve rather than discarding it |
| GoldenLeadPurple | 9 | Lead + Purple bits |
| GoldenLeadPurpleZebra | 15 | Lead + Black + White + Purple bits |
| Red / Ceramic / CeramicFortified / Moab | 0 | No static property bits; does not prove hit eligibility |

Each named model's path and blob hash is in the report. All 235 masks are combinations of bits 1, 2, 4, 8, and 64. **No static model sets bit 16**. Direct component damage models frequently contain mask 17, but these static bloon models alone cannot identify the remaining bit or explain dynamic Frozen status. Never equate White's bit 4 with Frozen or infer Frozen immunity from absence in this inventory.

The cross-review covers **2,910 direct damage models** across active components, separately counting the current and original immunity fields. Each field has eleven distinct observed values: 0, 1, 2, 4, 5, 8, 12, 17, 64, 72, and 73. The report supplies arithmetic `mask & bloonProperties` overlaps against fourteen representative targets, plus an exact component/damage-path example for each value. Counts refer to direct damage-model occurrences across variants, not unique attacks, tower identities, or shots. Components without direct damage models do not acquire a guessed mask. Nested abilities and additional attacks outside the imported components remain excluded from this cross-review.

These are **arithmetic overlaps, not hit/no-hit decisions**. Zero overlap says nothing about detection, active filters, projectile collision, damage replacements, invulnerability, or dynamic status. Camo and Fortified use separate flags/tags and `propertyFlags`; they must not be decoded from this immunity mask. The export includes a non-Camo `Ddt` alongside `DdtCamo`, so identity alone cannot choose the runtime encounter variant. Current/original immunity fields remain independent observations; this review does not establish which the simulation uses after mutators.

Static target-property extraction is complete. Runtime filter/collision code, dynamic property assignments, artifact precedence, and reproducible in-game tests are still required before promoting these associations into eligibility claims.

## Limits on eligibility claims

The component and bloon-property inventories record static source observations, not a runtime hit/no-hit evaluator. Dynamic attacks, collision/filter semantics, current versus original immunity fields, artifact precedence, and the eleven missing source models remain unverified. Absence from the older export is not evidence of no effect.

Detection overrides, aura recipients, tower paths, hero levels, and triggered secondary attacks require evidence for their exact context. Source-observed fields, description estimates, and reproducible gameplay observations must remain distinguishable. Static property overlaps cannot establish coverage or survival, so the calculator preserves unknown eligibility except for explicit component exclusions.
