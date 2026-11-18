# Development and data updates

## Build

`npm run build` writes `dist/`, minifying JavaScript/CSS with esbuild and compacting the shipped JSON catalogs before generating offline integrity hashes. Source files remain readable; module and asset paths are preserved. All asset paths are relative, including the catalog fetch, so deployment under `/repository-name/` works. The only optional external UI request is Google Fonts; system sans-serif fonts are used if unavailable.

The build also requires `tar` (GNU tar or macOS bsdtar) and writes a release-matched source archive, manifest, and notices before generating the offline worker. The notices' linked tower/power reviews, their ability timing references, and the power source inventory ship alongside the mechanics notebook and remain available offline. Deploy all of `dist/`, including `source/`; the private repository is not the source offer. See [distribution terms](../DISTRIBUTION.md). `scripts/source-package.mjs` explicitly lists public source roots and rejects symlinks. Keep required build inputs in that list when adding new roots. Never put private notes or credentials inside those public source roots. Pending data candidates/reports and temporary files are excluded.

## Versioning and releases

App releases follow [Semantic Versioning](https://semver.org/), starting with 0.1.0 for the first public beta. During 0.x development, increment the patch for fixes and calculation corrections, and the minor for new features or breaking changes. Breaking changes during beta must be called out in the changelog. Version 1.0.0 marks the first stable release with documented compatibility commitments for shared links, saved builds/plans, and import/export formats. After 1.0.0, incompatible changes to those contracts require a major version; compatible features require a minor version, and fixes require a patch.

The app version comes from package.json; keep package-lock.json's root versions synchronized. Source preview and production builds use the same version to render the footer. BTD6 data versions remain separate in Reference. Storage schema versions remain separate from the app version and change only when their formats require it.

Maintain CHANGELOG.md with user-facing changes, significant calculation corrections, breaking changes, and known limitations. Use headings, single-line paragraphs, and bullet lists; the build renders these into the linked changelog.html page and includes both files offline. Keep pending changes marked unreleased; when actually releasing, replace that marker with the release date, tag the corresponding commit as vX.Y.Z, and never change the contents of an already released version. Every published update gets a new version.

### Release checklist

1. Merge focused feature/fix PRs into main after CI passes. Add their user-facing notes under `## Unreleased` in CHANGELOG.md. Merging into main does not deploy the website.
2. Open a release PR. Set the intended version in package.json and both root version fields in package-lock.json; group the pending notes under `## X.Y.Z — YYYY-MM-DD — Beta` (omit `— Beta` for stable releases). Leave an empty `## Unreleased` section for subsequent work.
3. Run `npm test`, `npm run build`, and `npm run test:browser`. Check the release metadata with `RELEASE_TAG=vX.Y.Z node scripts/check-release.mjs`. Merge the release PR after CI passes.
4. Tag the exact merged release commit as `vX.Y.Z` and push that tag. Publish a GitHub Release for that existing tag with the corresponding changelog notes. Mark beta releases as pre-releases in GitHub; the SemVer tag still uses the normal version, such as v0.1.0. Publishing a draft as a pre-release also triggers deployment. Creating a draft or pushing a tag alone does not deploy.
5. Confirm the complete build includes a working Reference source download, artifact notices, and GPL text. Update dated modification notices for catalog changes. The published release runs metadata validation, verifies that its commit belongs to main, and reruns the same unit/build and sharded browser checks as PRs. Deployment uses that exact commit only after every check passes. Follow the deployment job's URL to verify the public release.

The workflow rejects a mismatched tag/version, inconsistent lockfile versions, and a missing or undated release entry. Rerun a failed release workflow after resolving a transient infrastructure failure. For a code correction, prepare a new patch release instead of moving an existing tag. There is no manual branch-deployment bypass. A GitHub Release created using a workflow's GITHUB_TOKEN will not start another workflow; use the GitHub UI or an authenticated maintainer account to publish releases.

## Verification

`npm test` covers multiplicative stacking, rarity selection, Pure Damage, conditional boosts, tier gates, category conversion, boss status immunity, unsupported artifacts, and invalid shared/saved state. It also checks that all catalog variants produce finite nonnegative results in every tower category. Additional tests cover generic definitions, invalid rules, UI summaries, source-contract changes, compatible value refreshes, and preservation of the active catalog when an update requires review. PRs run tests and a validated production build.

The Check calculator workflow cancels older runs for the same PR/ref when a newer run is queued; separate PRs remain independent. Main runs each have a unique concurrency group, so newer commits do not cancel running or pending main checks. This uses [GitHub Actions workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Browser checks

`npm ci`, `npx playwright install chromium`, then `npm run test:browser` run the Chromium suite. Tests cover desktop layouts at 1440×900 and 1366×768 and phone/tablet layouts at 390×844 and 768×1024, persistent visibility of stats, ranking/filtering, previews, keyboard focus, real JSON downloads/uploads, storage failures, and clipboard fallback. CI runs the complete suite across two parallel shards with two workers each, installs Chromium with its system dependencies, and logs individual test timings. CI captures traces on the first retry and screenshots on failure; local runs retain traces for failed tests. Failed shards upload separate diagnostic artifacts. Playwright is development-only and is not included in the static runtime.

## Deployment

Published GitHub Releases trigger `.github/workflows/deploy.yml`, which validates the release, runs the full checks, and deploys `dist/` from the exact release commit. PR/main CI runs independently of deployment; merges and tag pushes do not deploy.

Deployment requires GitHub Pages configured to use GitHub Actions, the repository Actions variable `PAGES_ENABLED=true`, and a github-pages environment that permits version tags matching `v*` if deployment restrictions are enabled. The deployment job reports the live URL. Rerun a failed release workflow for transient infrastructure failures; use a new patch release for code corrections.

See [GitHub Pages configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) for hosting setup.

## Artifact data updates

Refresh the catalog with `npm run data:refresh` (network required). Compatible parameter changes update the active catalog; changes to source wording, literal numbers, rarities, layouts, or artifact membership create `data/artifacts.candidate.json` and a review report, preserving the active catalog. A review-required refresh exits with code 2; fetch/schema failures exit with code 1. No-change refreshes leave the files untouched.

`npm run data:check` validates the active catalog against reviewed source contracts and rule bindings; the build runs this check too. Refreshing descriptions does **not** implement new mechanics. Nothing scrapes or contacts a game API at runtime. The site works from its bundled data.

The weekly **Propose artifact data updates** GitHub workflow opens a draft PR with the changed data and report. It runs Mondays at 07:23 UTC and can be triggered manually. It keeps an existing open artifact-update review intact, and never merges or deploys updates. The repository must allow GitHub Actions to create pull requests. The workflow uses the built-in GitHub token, with no external service or extra secret. PR checks triggered by that token may require approval in GitHub; the refresh job also runs tests/build itself. See [GitHub workflow-trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Tower presets and updates

See [Tower-stat import and calculation scope](tower-stats.md). Presets are extracted from the [BTD6 Mod Helper game-data export](https://github.com/Btd6ModHelper/btd6-game-data), pinned to revision `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24` (export v56.0). The importer retains direct damage, repeatable cooldown, unconditional MOAB bonuses, projectile count, and pierce for known root/triggered components. It does not include the original rendering/audio assets.

```sh
npm run towers:refresh
npm run heroes:refresh
```

These commands fetch the pinned source and write `data/towers.candidate.json` and `data/heroes.candidate.json` for review. Neither follows the latest upstream branch. To update game versions, first review and change `data/tower-source.json`, regenerate both candidates, verify changes and tests, then promote the reviewed candidates to their active files. The build rejects a catalog whose source does not match the manifest. Weekly artifact refreshes do not update tower or hero stats.

Power candidates use `npm run powers:refresh` and a separate reviewed blob manifest; see [power refresh and validation](powers.md#refresh-and-validation).

## Offline build checks

`npm run dev` serves editable source without installing a worker or showing offline controls. To check offline behavior locally, run `npm run build`, then `PORT=5174 node scripts/serve.mjs dist` and open that separate port. Use a different origin/port for source development to avoid an installed production worker serving cached files. `scripts/offline-build.mjs` generates `dist/sw.js` from the complete output; there are no added runtime dependencies. Automated browser checks exercise real worker installation, offline routes and data, waiting updates, failed integrity checks, and repository-scoped caching.
