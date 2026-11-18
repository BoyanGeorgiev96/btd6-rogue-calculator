# Ability duration review

Reviewed 2026-11-12 against the pinned `Btd6ModHelper/btd6-game-data` revision `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`, export v56.0. The review checks 537 gameplay duration source paths, including the Churchill frame conversion below.

`extractAbilityDuration` in `scripts/ability-duration-import.mjs` records `seconds`, `sourcePaths` relative to the root AbilityModel, and `gapEligible`. Absent/null duration metadata means unknown. The runtime validates positive finite seconds and well-formed paths. Repeated root effects must agree on duration. Conflicting phases remain unknown. This duration represents the reviewed active effect/window, not every secondary effect caused by an ability.

## Reviewed source fields

| Gameplay behavior | Field / meaning |
| --- | --- |
| TurboModel | lifespan: rate buff (Rapid Shot, Turbo Charge) |
| MonkeyFanClubModel, CallToArmsModel | lifespan: transformation/support window |
| LongArmOfLightModel | lifespan: attack buff |
| DroneSwarmModel, UCAVModel | duration: active drones / UCAV window |
| FlightBoostAbilityModel | lifespan: flight boost |
| SyphonFundingModel | lifespan: funding effect |
| BiohackModel, BloodSacrificeModel | lifespan / buffDuration: buff only; gap excluded because of recovery or sacrifice conditions |
| BrickellFreezeMinesAbilityBuffModel, ImmunityModel | lifespan: buff / immunity window |
| Activate rate, damage, pierce, visibility, targeting, range, projectile-speed, ricochet and stun-immunity support zones | lifespan: support window; exact type names are allowlisted in the extractor |
| ActivateAttackModel | lifespan only for reviewed sustained emitters on Tack Shooter, Mortar, Dartling, Alchemist, Spike Factory and Ezili Heartstopper; one-shot emitters excluded |

Reviewed projectile paths are restricted by tower base ID, ability identity, and a single attack/weapon. Quincy Storm of Arrows and Gwendolin Cocktail of Fire use the AgeModel of the created area projectile, reached through CreateProjectileOnExhaustFractionModel. Ninja Sabotage uses its direct ability projectile AgeModel. These are explicit exceptions, not a recursive search for arbitrary lifespans. Exact array indices are retained in each catalog entry. Area effects may end early; gap estimates do not simulate that.

Examples: [Quincy level 20](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/Quincy/Quincy%2020.json) has Rapid Shot 12 seconds and Storm of Arrows 3 seconds. [Fan Club 040](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/DartMonkey/DartMonkey-040.json) uses MonkeyFanClubModel lifespan 15 despite its stale prose description saying 10. The gameplay field is retained. [Homeland 050](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/MonkeyVillage/MonkeyVillage-050.json) uses CallToArmsModel lifespan 20. Reduced hero fixtures retain the relevant gameplay fields from the same pinned source.

## Estimates and exclusions

`src/ability-timing.js` calculates nominal gap `max(0, effective cooldown − duration)` and uptime `min(1, duration / effective cooldown)`. It assumes cooldown begins at activation and immediate reuse. These are conditional arithmetic estimates, not verified runtime timing or guaranteed permanent uptime. Artifact recharge factors change cooldown only; duration remains the source value. A manual cooldown override retains the selected ability's duration; a standalone manual timer has unknown duration until manually overridden.

Activation caps, shared cooldowns, extra charges, lives costs, sacrifice/recovery conditions and morph phases suppress gap estimates even when a reviewed duration is available. Targets, round boundaries, cooldown floors, charge handling, reactivation delays and ability damage remain unmodeled. This feature does not add buffs or ability damage into the tower's hit DPS.

Visual/display/sound lifespans are ignored. Other unreviewed frame-only durations, Overclock's tier-dependent durations, permanent stacks, target-dependent sequences, unreviewed nested projectiles, DOT, summons, spells and ambiguous multi-phase durations remain unknown. Unknown is never treated as zero or permanent. Extending coverage requires reviewing raw gameplay fields, updating the explicit extractor and fixtures/tests, regenerating candidates and confirming unrelated catalog data remains unchanged.

## Churchill frame-duration review

Churchill stores these gameplay timers in frames. The [Mod Helper author documentation](https://gurrenm3.github.io/BTD-Mod-Helper/wiki/Making-a-Custom-Mutator) specifies 60 simulation frames per second for timed mutators. The pinned Churchill snapshots independently pair gameplay lifespanFrames with the same effect’s display lifespan at a 60:1 ratio (the display field is a cross-check, not the imported duration).

For `CaptainChurchill/ArmorPiercingShells`, import only ChangeDamageTypeModel, MutateProjectileOnAbilityModel and MutateCreateProjectileOnExhaustPierceOnAbilityModel lifespanFrames, divided by 60. All those gameplay fields agree: level 3 is 540 frames / 9 seconds; level 20 is 1050 frames / 17.5 seconds. For `CaptainChurchill/MOABBarrage`, MoabBarrageModel durationFrames is 528 / 8.8 seconds from level 10 onward. That is the firing-sequence window; the separate level-20 MutateDamageOnAbilityModel 480-frame buff is not substituted for the barrage window. Exact source paths and `framesPerSecond: 60` are retained. [Pinned level-20 model](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/CaptainChurchill/CaptainChurchill%2020.json).

All 537 duration source paths and 900 timing-restriction records were checked against the pinned source. Tower and hero catalogs record `timingRestricted` on imported abilities to preserve known caps, shared cooldowns, extra charges, lives costs, and sacrifice/recovery/morph restrictions even when duration is unknown.

## Manual durations and threshold search

`durationOverrides` stores at most 100 finite positive seconds values, keyed by tower and ability. Clearing an override restores current source metadata. A manual duration replaces only the duration, keeps known activation restrictions and never changes contact DPS. Standalone manual timers have no source duration. Source preset comparisons clear main-calculator overrides; saved-party rows retain their saved overrides.

`src/uptime-finder.js` exhaustively tests one or two artifact identity changes within the modeled recharge/conversion subset, using available higher rarities and replacing owned rarities rather than stacking copies. It recomputes the entire engine for every candidate. Zero-gap matches rank by number of changes then target-DPS factor; partial matches rank by gap reduction. Results apply only to that search scope and do not guarantee in-game uptime. Search results are temporary; applying a preview uses the existing current-build undo/history path.
