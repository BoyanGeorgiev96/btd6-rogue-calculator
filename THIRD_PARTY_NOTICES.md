# Third-party notices

Rogue Lab is distributed as a combined work under [GNU GPLv3](LICENSE) (GPL-3.0-only), including original code, documentation, custom CSS/SVG artwork, and covered artifact-catalog adaptations. See [distribution scope and matching source](DISTRIBUTION.md). No project license grants rights in upstream material beyond those available from its rights holders.

This document records provenance, upstream permissions, and license notices; it does not grant rights on behalf of upstream authors or Ninja Kiwi. Last updated: 2026-11-18.

## Bloons TD 6 / Ninja Kiwi

Bloons TD 6, its game content, and associated names and trademarks belong to Ninja Kiwi and their respective rights holders. Rogue Lab is an independent fan calculator and is not affiliated with or endorsed by Ninja Kiwi.

The project uses game-derived names, descriptions, identifiers, parameters, and gameplay statistics from the community sources below. The project does not grant Ninja Kiwi's underlying rights in these fields. The interface uses custom CSS/SVG artwork rather than copied game artwork; the tower importer does not bundle the original rendering or audio assets.

## Artifact catalog: HalfHydra's BTD6 API Explorer

- Upstream: [HalfHydra/BTD6-API-Explorer](https://github.com/HalfHydra/BTD6-API-Explorer), maintained by HalfHydra and upstream contributors.
- Source files: [rogueData.json](https://btd6apiexplorer.github.io/data/rogueData.json), [English.json](https://btd6apiexplorer.github.io/data/English.json), and [Constants.json](https://btd6apiexplorer.github.io/data/Constants.json).
- Bundled snapshot: game version 57, checked 2026-11-11, as recorded in `data/artifacts.json`.
- Use: artifact names, descriptions, source templates, rarity parameters, and reviewed source contracts in `data/artifacts.json` and `data/catalog-contract.json`; associated rule bindings, tests, and documentation also refer to these fields. The project transforms the source data into its own catalog and implements calculation logic separately.

On 2026-11-18, HalfHydra [approved the described data reuse](https://github.com/HalfHydra/BTD6-API-Explorer/issues/13#issuecomment-6967558966) and noted that API Explorer is updated manually and may lag behind game updates. The website and README credit HalfHydra's BTD6 API Explorer and identify the bundled BTD6 v57 artifact snapshot separately from the v56.0 tower/hero/power exports.

The upstream repository added the [GNU General Public License v3.0](https://github.com/HalfHydra/BTD6-API-Explorer/blob/2c435518b41b71f17c6c15324defaa63e75f329c/LICENSE) in commit `2c435518b41b71f17c6c15324defaa63e75f329c`. An unmodified copy is retained in [third-party/BTD6-API-Explorer-LICENSE.txt](third-party/BTD6-API-Explorer-LICENSE.txt) and included with the static/offline build. Rogue Lab transforms the source fields into the bundled artifact catalog; the catalog adaptations and combined calculator are distributed under GPLv3, preserving upstream notices. [Catalog modification notices](data/ARTIFACT-NOTICES.md) record the transformations and dates. Underlying Ninja Kiwi rights remain separate.

## Tower, hero, power, and gameplay exports: BTD6 Mod Helper game data

- Upstream: [Btd6ModHelper/btd6-game-data](https://github.com/Btd6ModHelper/btd6-game-data), maintained by BTD6 Mod Helper contributors.
- Export tooling: [BTD6 Mod Helper](https://github.com/gurrenm3/BTD-Mod-Helper), which facilitates the gameplay-data exports. The underlying game data belongs to Ninja Kiwi.
- Pinned revision: [`f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`](https://github.com/Btd6ModHelper/btd6-game-data/tree/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24), export game version 56.0, exported 2026-08-07, recorded in `data/tower-source.json`.
- Use: transformed component statistics, abilities, names, and identifiers in `data/towers.json`, `data/heroes.json`, and `data/powers.json`; reviewed artifact cooldowns in `src/verified-cooldowns.js`; and source evidence in manifests, tests, and review documentation.
- Import details: [tower/hero source review](docs/tower-stats.md), [power source review](docs/powers.md), and `data/power-source-models.json` for reviewed power-model hashes.

On 2026-11-16, repository member doombubbles [confirmed no objection to reuse or redistribution](https://github.com/Btd6ModHelper/btd6-game-data/issues/5#issuecomment-6928191140), identified Ninja Kiwi as the data owner, and suggested crediting the repository and/or BTD6 Mod Helper for facilitating the export. Rogue Lab credits Ninja Kiwi and links to both the export repository and Mod Helper project in its website Reference page, README, and these notices.

The response expresses the maintainer's view that this use is tolerated; it does not provide permission on Ninja Kiwi's behalf or establish a separate data license. A license covering the Mod Helper software must not be assumed to cover its exported game content. The project's distribution license does not establish a license for these underlying game-content rights.

## Reference links and externally loaded fonts

The [Bloons Wiki artifact reference](https://bloons.fandom.com/wiki/Artifacts) is linked as a community cross-reference. Its content is not the bundled artifact catalog source; this project's license does not cover content on that site.

`src/style.css` requests DM Sans and Space Grotesk through [Google Fonts](https://fonts.google.com/). Font files are fetched externally and are not vendored in the repository or static/offline bundle. Their respective font licenses apply independently of Rogue Lab's license; review and retain those licenses if font files are bundled in a future release. System fonts are used when external fonts are unavailable.

## Development dependencies and redistribution

The calculator has no third-party runtime JavaScript dependencies. Playwright, esbuild, and their transitive packages are development-only tooling recorded in `package-lock.json`; their own license and notice files remain applicable. They and the browser binaries are not copied into the static build. Redistributing development tooling requires retaining its applicable notices separately.

Preserve this document and `LICENSE` with redistributed project copies. When updating data sources or adding third-party assets, record the source revision, applicable license or permission evidence, and any required notices.
