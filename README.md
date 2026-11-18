# Rogue Lab — BTD6 Rogue Legends calculator

Compare artifact bonuses for a tower, hero, or power in BTD6 Rogue Legends. Choose from 117 artifacts, set rarities and battle conditions, and inspect damage, attack speed, pierce, range, ability cooldowns, and estimated single-target DPS.

Results lead with artifact multipliers. Expand the stats for absolute tower values and ability timings. You can preview changes, compare builds and offers, plan Early/Mid/Late upgrades, and save or share builds without an account.

Current version: **0.1.0 · Beta**. See [CHANGELOG.md](CHANGELOG.md) for release notes and the [release policy](docs/development.md#versioning-and-releases) for versioning rules.

## Using the calculator

| Workspace | What it does |
| --- | --- |
| Calculator | Select a tower/hero/power, target, and artifacts; inspect bonuses and preview changes |
| Run planner | Plan three tower upgrade checkpoints, starting artifacts, and later picks |
| Compare | Compare offers, targets, upgrades, tower presets, saved parties, and category synergies |
| Reference | Check source versions, effect coverage, evidence, and exclusions |

The [user guide](docs/user-guide.md) covers comparisons, ability timing, saves, transfers, offline use, and what survives a reload.

## Calculation scope

The calculator models 80 artifacts; the other 37 are reference-only and do not affect totals. Some modeled artifacts have partial effects with explicit exclusions.

- Artifact multipliers use the selected tower, crosspath, hero level, target, and enabled conditions for applicability.
- DPS estimates cover one projectile contact per attack cycle for the selected component. Components, projectile counts, and pierce are not combined into total tower or party DPS.
- Detection and damage-type eligibility remain unknown except for explicit component exclusions. Positive damage does not prove the attack can hit.
- Ability recharge uses description-based estimates. Reviewed durations support nominal gap/uptime estimates assuming cooldown starts at activation and immediate reuse. Unknown or restricted timing cannot establish continuous uptime.
- Critical estimates are optional. Innate tower crits and overlapping unverified artifact crit mechanics are excluded.
- Prices, geometry, DOT, ability damage, omitted attacks, other buffs, and survival are outside the model.

See [calculation scope](docs/calculation-scope.md) for stacking rules, target modifiers, conversions, manual overrides, and exclusions. [Tower stats](docs/tower-stats.md), [powers](docs/powers.md), [ability cooldowns](docs/ability-cooldowns.md), and [durations](docs/ability-durations.md) document the imported fields and their limits.

## Data and attribution

Artifact descriptions and rarity parameters are a **BTD6 v57** snapshot from [HalfHydra's BTD6 API Explorer](https://github.com/HalfHydra/BTD6-API-Explorer). Tower, hero, power, and matching attack-cooldown data come from the [BTD6 Mod Helper export](https://github.com/Btd6ModHelper/btd6-game-data/tree/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24), pinned to revision `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24` (**v56.0**). API Explorer is updated manually and may lag behind game updates. These community snapshots are not a guarantee of current-game accuracy.

Presets include 26 towers with 1,664 legal crosspaths, 18 heroes at levels 1–20, and Battle Cat, Cave Monkey, and Super Monkey Beacon. Runtime calculations use bundled data; there is no live game API.

BTD6 and its game content belong to Ninja Kiwi. [BTD6 Mod Helper](https://github.com/gurrenm3/BTD-Mod-Helper) facilitates the gameplay exports linked above. Rogue Lab is an independent fan tool, unaffiliated with Ninja Kiwi. Interface artwork is custom CSS/SVG. The [Bloons Wiki](https://bloons.fandom.com/wiki/Artifacts) is an additional community reference.

Source provenance, upstream permissions, and license notices are recorded in [third-party notices](THIRD_PARTY_NOTICES.md). Data updates follow the [review process](docs/artifact-rules.md#reviewing-a-game-data-update); automated proposals never merge themselves. The [mechanics notebook](docs/mechanics-notebook.md) records research and prepared test protocols; no project gameplay trials have been run.

## Run locally

Use Node.js 26.x (`nvm install` and `nvm use` if you use nvm).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Set `PORT=5174` to use another port.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The static runtime has no JavaScript dependencies or backend. The build writes `dist/` and supports repository-relative GitHub Pages paths. See [development and data updates](docs/development.md) for browser diagnostics, source refreshes, offline checks, and publication setup.

## Feedback and contributions

Rogue Lab is maintained by Boyan Georgiev. Bug reports, feature ideas, and calculation corrections are welcome through [GitHub Issues](https://github.com/BoyanGeorgiev96/btd6-rogue-calculator/issues). External pull requests are currently not accepted. See [CONTRIBUTING.md](CONTRIBUTING.md) for reporting guidance.

## License

Rogue Lab is distributed as a combined work under [GNU GPLv3](LICENSE) (GPL-3.0-only), without warranty. Copyright (c) 2026 Boyan Georgiev for original contributions. The [earlier MIT notice](third-party/Rogue-Lab-MIT-NOTICE.txt) is preserved; previously granted MIT rights remain available for original material.

Every build includes matching editable source at `source/rogue-lab-source.tar.gz`, linked from Reference. See [distribution terms and rebuild instructions](DISTRIBUTION.md), [artifact modification notices](data/ARTIFACT-NOTICES.md), and [third-party notices](THIRD_PARTY_NOTICES.md). Imported game content, names, trademarks, and other third-party rights remain separate; this project grants only rights it can grant.
