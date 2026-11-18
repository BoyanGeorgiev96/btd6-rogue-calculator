# Power preset source review — 2026-11-13

Source: Btd6ModHelper's gameplay export v56.0, revision `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`, shared with tower/hero presets. All 12 imported source files and 16 supporting artifact files matched the pinned tree's Git blob hashes. [The review inventory](../data/power-source-models.json) records the exact paths/hashes. The review interprets pinned source fields; no new gameplay trials were run, and current-game behavior is unverified. Artifact description contracts remain v57.

## Imported combat states

| Power / state | Source fields included | Explicit exclusions |
| --- | --- | --- |
| Battle Cat, normal | `Powers/BattleCat.json` → `tower.behaviors[5]`; root attack interval 1 s; triggered contact explosion damage 2, pierce 20, targeting range 26 | Multi-target geometry and hit eligibility |
| Battle Cat, transformed | Same file → `tower.behaviors[6].behaviors[2].attacks[0]`; interval 1 s, direct explosion damage 20, pierce 20, targeting range 26 | DOT, total multi-target output, encounter-average DPS |
| Cave Monkey | `Powers/CaveMonkey.json` → `tower.behaviors[3]`; interval 1.1 s; contact explosion damage 1, pierce 5, targeting range 24 | Stun chance/duration and crowd control |
| Super Monkey Beacon, 0-3-0 | `Towers/SuperMonkeyBeacon/SuperMonkeyBeacon-030.json`; root weapon damage 1, interval 0.045 s, pierce 2, targeting range 60 | Storm ability damage, knockback, burst/repeated contacts |
| Super Monkey Beacon, all ten exported paths | Root ability cooldown 120 s, 60 s at 0-1-0, 45 s at 0-2-0/0-3-0 | No imported seconds-based storm duration; no gap/uptime claim, purchase/recharge costs or availability simulation |

Beacon paths are exactly `000`, `100`, `200`, `300`, `010`, `020`, `030`, `001`, `002`, `003`. Other states have no repeatable root attack, so their ordinary attack DPS is zero. Ability-only burst damage is not divided by the cooldown and presented as ordinary attack DPS. Power paths cannot be raised to tier 4/5 or crosspathed through the UI or saved-state sanitizer. Consequently these presets do not meet Dreadbloon's tier-4 gate; Power Nexus plus Master of All Trades can still grant all four regular classes.

Battle Cat transformation has `ActivateAttackModel.turnOffExisting: true` and an `ExpireTowerAfterAbilityModel` with `rounds: 4`, `useRoundTime: true`. It replaces the normal attack; the two forms are separately selectable components and never summed. The ability has a sentinel `cooldown: 9999999` and activation attack `lifespan: 9999999`, neither of which represents a repeatable timer or a reviewed seconds-based transformation duration. The import excludes that timer. A component note retains the four-round restriction through reports and comparisons. Selecting the transformed component assumes it is active; activation at a particular encounter is not simulated.

Sources: [Battle Cat](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Powers/BattleCat.json), [Cave Monkey](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Powers/CaveMonkey.json), [base Beacon](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/SuperMonkeyBeacon/SuperMonkeyBeacon.json), [0-3-0 Beacon](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers/SuperMonkeyBeacon/SuperMonkeyBeacon-030.json).

## Artifact selection and category membership

- Imported powers have `towerSet: 64`, `isPowerTower: true`. They start with Powers membership and do not implicitly become Heroes or one of the four regular classes.
- Divine Precision, Inspiration and Quickening select `towerSets: [80]` (Hero 16 plus Powers 64), so their existing modeled damage, pierce, range, attack and recharge effects apply to Powers. Shot spread and projectile speed remain excluded. Attack-rate effects use existing reviewed cooldown factors; recharge retains the calculator's documented description estimate, including rounding differences at higher rarities.
- Power Nexus selects `[64]`, grants `alsoCountsAsList: [8]` (Support), damage factors 1.5 / 2 / 3 and attack-interval factors 0.90 / 0.85 / 0.75. Its matching description parameters are checked before using those source intervals. It does not contain a cooldown/recharge behavior, so it does not change ability cooldowns.
- Resolved Support membership can activate Master of All Trades, which can activate other class effects through the shared conversion engine. Range penalties follow resolved categories. Fixed base-tower damage-penalty lists contain neither these powers nor heroes, so granting Support/Military/etc. does not add those penalties.
- One Monkey Army's zero-damage behavior selects a fixed list of 26 regular base IDs; none of these powers are listed. Its hero category grant and boss bonus still select Heroes only. Powers neither lose damage nor gain those hero-only effects.
- Heroic Edge’s pierce boost selects regular-class mask `[15]`: Powers and Heroes need a granted regular class to receive it. Its expired hero projectile swords remain excluded. Heroic Specialty and Spirit of Adventure remain hero-only. Global artifact modifiers and compatible category effects use the shared evaluator. Aura-provider availability, projectile geometry, DOT, boss armor, and hit eligibility remain outside the model.

Supporting sources: [Power Nexus Common](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/PowerNexus1.json), [Divine Precision](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/DivinePrecision1.json), [Divine Inspiration](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/DivineInspiration1.json), [Divine Quickening](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/DivineQuickening1.json), [One Monkey Army](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/OneMonkeyArmy3.json).

## Other powers and integration scope

The pinned power inventory was checked for other candidates. Super Monkey Storm, Road Spikes and MOAB Mine are consumable/one-shot effects without an ordinary repeating weapon cadence. Energising Totem and Monkey Boost Pro primarily supply external buffs, which the calculator currently excludes. Banana Farmer Pro and Portable Lake Pro contain upgraded attacks in this export, but also collection/spawn/support mechanics; their Rogue Legends availability and per-attack artifact applicability have not been reviewed for inclusion. They remain outside the roster until that review is complete.

The calculator, saved builds, links, JSON/history, previews, reports, target matrix, party comparisons and preset comparisons share the same power contexts and engine. Beacon is also available in upgrade comparison. The existing Early/Mid/Late run planner remains regular-tower-only; consumable inventories, grant quantities, encounter acquisition and consumption are excluded. Grant-only artifacts retain reference status and direct the user to select the corresponding power preset rather than stacking a second actor onto the current attack.

## Refresh and validation

`npm run powers:refresh` writes a candidate, validates source identity/paths, and checks each downloaded/cached file against the reviewed blob manifest. Optional `--cache-dir /path` uses files named by replacing source-path slashes with `__`. Update the review manifest only after reviewing an intentional source revision change, then regenerate and inspect the candidate before promotion. Build checks reject mismatched power/tower manifests. No power data is fetched at runtime beyond the bundled static JSON.

Tests regenerate representative presets from reduced gameplay fixtures, check all rarities and conversion order, zero-DPS Beacon states, timing restrictions, path validation, save/share/history/report behavior and independent comparisons. Browser checks cover desktop before phone, legal path controls, transformation persistence and multiplier-only headline results.
