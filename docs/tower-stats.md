# Tower presets

The site includes 26 base towers and the 64 legal normal crosspaths for each tower: 1,664 variants. A separate catalog also includes levels 1–20 for 18 named base heroes (360 snapshots). Paragons, hero skins, and three-path combinations are outside this import. Presets come from the BTD6 Mod Helper game-data export, not the artifact API or a prose parser.

## Provenance and version

`data/tower-source.json` pins the repository, commit, game version, and export date. The pinned source is `Btd6ModHelper/btd6-game-data`, commit `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`, labeled **56.0** by its upstream commit. The artifact snapshot is **57**; the UI shows the two source versions separately. Source links point to the exact raw tower model used, not the moving main branch. Tower and hero catalogs use schema version 4, which includes range metadata, recognized conditional damage modifiers, explicit MOAB-hit exclusions, and per-variant ability timers.

The exporter is a community project. Pinning a revision makes imports reproducible; it does not verify balance against the currently running game. These presets exclude Monkey Knowledge and external buffs/modifiers.

## UI behavior

- Choosing a tower loads its `0-0-0` component stats. Choosing top/middle/bottom upgrade levels loads that exact crosspath and derives the highest tier used by artifact rules.
- Illegal normal crosspaths are disabled: at most two paths may be upgraded, and at most one may exceed tier 2.
- Selecting an attack component loads its damage per projectile contact, boss/MOAB damage per contact, and attack rate (`1 / cooldownSeconds`).
- Typing in a base stat switches to manual mode. General and boss damage remain linked until different boss damage is entered. **Reload tower preset** restores source values.
- Preset builds reload their stats from the bundled catalog when opened. Manual builds keep the entered values. Builds from before presets retain their manual stats and highest-tier setting.
- Towers and heroes with no imported repeatable attack start at zero hit damage and zero attack rate. Some special hero mechanics remain manual, as described below.
- Selecting the Hero category offers named heroes and a legacy **Custom hero (manual)** entry. Named heroes load their level snapshot; changing their level reloads preset stats. Manual overrides and component selection work as for towers. Custom heroes retain manual stats when their level changes.
- Hero level is separate from tower upgrade tiers. Hero presets use tier 0 for ordinary tower-tier conditions; the calculator does not guess a level-to-tier equivalence. Explicit hero-level gates (such as Dreadbloon at level 15) use hero level.

For example, Sniper `0-0-0` loads 2 damage and a 1.59-second cooldown. Sniper `3-2-0` exposes the 20-damage main bullet and 4-damage shrapnel separately. Sniper `0-2-5` has separate ordinary and unconditional MOAB damage in the raw export.

## Component semantics and limits

`src/tower-stats.js` contains pure tower/hero selection, state, source-link, and schema logic. `scripts/tower-import.mjs` interprets the export; `scripts/import-towers.mjs` and `scripts/import-heroes.mjs` handle fetching/caching and candidate generation. Both imports share the same attack-component extractor. Each component contains:

| Field | Meaning |
| --- | --- |
| `damage` | Exported direct damage per projectile contact; not evaluated when `damageExcluded` is true |
| `damageExcluded` | Optional explicit exclusion from ordinary hit/DPS, pierce and artifact critical estimates; raw source fields remain evidence |
| `bossDamage` | Direct damage plus unconditional MOAB tag modifiers, or zero for an excluded secondary/or target filter |
| `damageModifiers`, `canHitMoab` | Ordered recognized target-tag modifiers and explicit MOAB-hit eligibility |
| `cooldownSeconds` | Repeatable weapon cooldown, or parent-shot cadence for a triggered component |
| `pierce` | Base projectile contact capacity; artifact modifiers are applied separately |
| `range`, `rangeMode` | Finite attack radius, or null plus `global` for unlimited targeting |
| `projectiles` | Known emitted projectile count, otherwise null |
| `trigger` | Root attack or triggered secondary projectile |
| `notes` | Important omitted behavior for that component |

Contact/exhaust splash projectiles that provide the root attack's damage are imported as the main hit component, including Bomb, Mortar, Alchemist, and Mermonkey attacks. Sniper shrapnel is a triggered component: parent-shot cadence is displayed, but damage to the original target is excluded, so it contributes zero boss damage for that target. Generic secondary projectiles are conservatively excluded from original-target boss damage until their specific rehit behavior is modeled. Alternate Buccaneer weapons use the parent shot's cadence rather than their internal 0.05-second ready check.

The calculator **does not sum components or multiply pierce/projectile count into single-target DPS**. Not every Tack Shooter projectile or shrapnel fragment necessarily hits the same boss. Current DPS is a one-projectile-contact estimate for the selected component.

Other limits include attack geometry, travel/arrival time, conditional buffs and unsupported damage tags, damage-over-time, crits, ability damage/DPS, summons, beast power, spike storage/repeated contacts, immunities beyond explicit MOAB exclusion filters, and special boss mechanics. Elite Defender's conditional rate increase, for example, is excluded. Some export components are dynamically gated; raw fields alone do not describe their full uptime. Artifact cooldowns use verified compatible exports where available; other modifiers remain description-based estimates.

## Druid vine scope review (2026-11-12)

Ninja Kiwi’s [official v53 notes](https://www.reddit.com/r/btd6/comments/1r2iecf/bloons_td_6_version_fifty_three_point_oh_update/) state that x3x Druid vines destroy targets and no longer crit with artifacts. The pinned v56 [Druid 030 model](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/Druid/Druid-030.json) identifies `AttackModel_JungleVine_`, with a `JungleVineEffectModel` and a 9,999,999-damage destruction projectile. This is not ordinary repeatable hit damage. Its contact-spawned ground vines also have repeated-contact behavior (`RefreshPierceModel` / `ClearHitBloonsModel`) whose total output is outside the one-contact engine.

The importer marks that projectile and its descendants `damageExcluded: true`, using the Druid identity and source behavior type rather than guessing from a numeric threshold. All 64 Druid models were checked against the pinned Git blob hashes in `docs/component-eligibility-review.json`; 30 components across 15 crosspaths are affected. Raw fields and component IDs remain in the catalog for provenance and saved-plan compatibility, with explicit excluded names/notes. Normal thorn/lightning components and all ability timers are unchanged. This review does not establish whether spawned ground vines can crit; their repeated-contact output remains unmodeled.

Preset contexts use zero modeled hit damage and attack rate and unknown modeled pierce for these components. The engine also blocks flat artifact damage and critical estimates, while retaining independent ability recharge calculations and artifact multipliers. Saved/shared source presets refresh to this exclusion without losing component IDs; explicit manual damage overrides remain manual, clear the exclusion and are not gameplay verification. Source component mappings and raw eligibility observations remain unchanged; this review does not resume deferred detection/immunity extraction.

## Regeneration and review

```sh
npm run towers:refresh
npm run heroes:refresh
```

The importer reads the pinned manifest, fetches the legal tower models with bounded concurrency, validates them, and writes a tower or hero candidate file only after successful extraction. `--cache-dir /absolute/path` caches raw JSON under the source revision, avoiding accidental reuse across revisions. The raw JSON is data and is never executed.

1. Review and update `data/tower-source.json` when adopting a newer game export. Do not infer a version just from the current date or artifact dataset.
2. Generate the candidate. Review its diff, component identities, unconditional versus conditional bonuses, and source schema changes.
3. Update the extractor for newly encountered mechanics; add source-based fixtures/tests for interpretations that change results.
4. Promote reviewed candidates to `data/towers.json` and `data/heroes.json` and remove the candidate files. Both active catalogs must match the pinned source manifest. `--write` is available for deliberate generation directly to the active file; it should not be used to skip review.
5. Run `npm test` and `npm run build`. Both source metadata and all component schemas are checked before deployment. Only the active catalog is bundled; source manifests, review files, and candidates stay in the repository.

The automatic artifact-update workflow does not refresh these pinned tower/hero exports. A tower-source upgrade is a separate reviewed code/data change.

## Hero-specific limits and artifact interactions

Hero presets import known repeatable hit components only, never ability DPS. Churchill’s cannon and machine gun, for example, remain separate. Benjamin’s income is not damage. Etienne’s drone/UCAV attacks, Corvus’s spirit and activated root-level spell attacks, Silas’s special vine/DOT behavior, and Psi’s psychic destruction are outside the current model. The UI shows those exclusions and leaves manual overrides available. Corvus spell components are deliberately removed rather than misreported as baseline DPS. Psi’s raw zero-damage projectile is not converted into instant-kill damage.

**Heroic Specialty** adds the named hero’s documented affinity category through the same conversion phase used by Dreadbloon and One Monkey Army. No hero gains that affinity innately. **One Monkey Army** still adds all four categories and doubles boss damage; the conversions union without depending on artifact order. **Malicious Mauling** applies its MOAB multiplier to named Striker Jones, while its attack-speed penalty remains specific to Bomb Shooter. Hero XP changes remain excluded.

The generic legacy Hero entry remains supported in saved/shared builds as Custom hero (manual); its name and stats are preserved, and no affinity is inferred. Named hero preset links save the hero, level, component, source revision, and manual/preset mode.

## Pierce and range calculation

The result panel calculates both the multipliers and absolute pierce/range values from the selected preset. Component range comes from the attack model, falling back to the tower model. Non-attacking towers retain their root influence radius, so Biggest Beacon can increase a Village’s radius even though it has no hit-damage component.

The export’s global-range flag and very large unlimited-range sentinel are represented as `rangeMode: "global"` with `range: null`, never JSON Infinity or the tower’s dummy selection radius. Finite range bonuses leave global targeting global. Users can override base pierce and range and explicitly select unlimited targeting; reload restores the source preset.

Pierce products retain fractional values as theoretical source-stat values; collision rounding, repeated contacts, and spike-pile damage are not simulated. Pierce and range are **not** multiplied into the single-target DPS estimate. Projectile lifespan/speed, placement geometry, support buffs from other towers, and the statistics of unmodeled spawned projectiles remain excluded. Legacy manual builds show unknown absolute pierce/range until supplied; their artifact multipliers are still calculated.

## Ability timer presets

Variants include an `abilities` array independently of attack components, so support towers/heroes can have timers even without imported hit DPS. Each ability stores `id`, display `name`, positive `cooldownSeconds`, and activation-limit/shared-cooldown notes. `scripts/ability-import.mjs` extracts enabled visible root AbilityModels and excludes passive, hidden, disabled, zero-timer, and dynamically scaled entries.

Ability selection and manual timer mode are independent of attack stat mode. Reloading a preset refreshes source timers; manual timer overrides survive saved/shared restoration. Missing ability IDs preserve the old timer in manual mode. Older builds without timer metadata retain unknown values until a preset/ability is deliberately loaded. See [ability cooldown scope](ability-cooldowns.md).

## Ability duration estimates

Per-ability optional `duration` metadata records reviewed seconds, exact source paths and whether a nominal gap may be estimated. See [duration review](ability-durations.md). Duration extraction is separate from attack stats and never changes DPS. The selected ability still supplies the single absolute cooldown metric. The expanded calculator, comparison details and reports also list all imported ability timings, durations, nominal gaps and manual-duration provenance. Optional `timingRestricted` metadata preserves activation constraints even when source duration is unknown.
