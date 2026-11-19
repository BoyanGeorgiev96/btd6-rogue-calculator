# Distribution and editable source

Rogue Lab is distributed as a combined work under the GNU General Public License,
version 3 only (GPL-3.0-only). See LICENSE for the complete terms. Copyright
(c) 2026 Boyan Georgiev for original project contributions. This work comes
without warranty; see GPLv3 sections 15–16.

Distribution terms adopted on 2026-11-18. Rather than rely on a mere-aggregation
claim for the engine and artifact catalog, the project distributes the combined
calculator under GPLv3. Original project code, documentation, and custom CSS/SVG
artwork are offered under GPLv3.

## Covered material and retained rights

For distribution, the GPL-covered scope includes the original application,
build/import/review scripts, tests, documentation, and the API Explorer-derived
artifact catalog and associated adaptations wherever they appear. In particular:

- data/artifacts.json contains normalized names, descriptions, source templates,
  source parameters, categories, and rarity variants.
- data/catalog-contract.json repeats names, templates, and parameter contracts.
- src/ rule bindings, evidence, and presentation modules; scripts/ validation and
  normalization; tests/ expectations and fixtures; and docs/ reviews may repeat
  imported names, text, and parameters. These are included in the source package,
  rather than assuming copied text outside the main catalog is exempt.

This is a conservative distribution scope, not a claim that every fact is
copyrightable or that upstream owns all game-derived fields. Preserve applicable
upstream attribution, license, and warranty notices. See
THIRD_PARTY_NOTICES.md and data/ARTIFACT-NOTICES.md. Ninja Kiwi's underlying
content, names, trademarks, and other third-party rights remain separate;
this project grants only rights it can grant. The license of export tooling is
not a license for the exported game content. No additional noncommercial
restriction is imposed on GPL-covered contributions.

## Preferred editable source

The readable, normalized JSON catalogs in data/ are the project's maintained,
preferred form for editing the bundled data. In particular, artifacts.json
retains sourceTemplate and sourceParams as well as substituted descriptions;
catalog-contract.json and the review scripts maintain the reviewed rules.
Changes must follow docs/artifact-rules.md. Upstream raw exports are optional
refresh inputs, not prerequisites for editing these catalogs or rebuilding this
release. A moving upstream URL is not offered as the matching release source.

Every production build includes source/rogue-lab-source.tar.gz, linked from
Reference, with the exact readable application, active catalogs, source contracts,
review manifests, scripts, tests, documentation, notices, package lockfile, and
build configuration used for that build. source/manifest.json lists source-file
SHA-256 hashes, the app version, and the archive hash. SOURCE-MANIFEST.json inside
the archive lists the same source-file hashes. It deliberately excludes pending
candidates/reports, Git metadata, dependencies, build outputs, and private local
maintainer notes. The source archive is available alongside the application at
no charge and included in its offline copy. Keep it with every distributed build,
including older releases; a private repository link is not a substitute.

Extract the archive into an empty directory, install Node.js 26 and tar, then run:

```sh
npm ci
npm test
npm run build
npm run test:browser
```

For browser checks, first run `npx playwright install chromium`. npm ci needs
network access to fetch the pinned development tooling; building from installed
dependencies does not fetch gameplay data. No original game installation,
private file, upstream refresh, or account is needed to build. The build produces
the same application/data from these inputs; archive timestamps and compressed
bytes need not be identical. esbuild and Playwright are development tooling and
are not bundled as runtime dependencies.

## Subsequent changes and releases

Retain these notices and the full GPL text. Modified versions must carry
prominent modification notices with relevant dates and satisfy GPLv3's applicable
source and redistribution requirements. Update data/ARTIFACT-NOTICES.md when
changing the catalog/contracts or their transformations; describe other changes
and dates in CHANGELOG.md or an accompanying modification notice.

Do not upload only the compacted runtime files. Deploy dist/ in full so its
relative source link resolves to that release's own source archive. Repository
visibility and deployment are separate maintainer decisions; preparing this
package does not publish the repository or enable Pages.
