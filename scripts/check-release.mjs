import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function checkRelease({ tag, manifest, lock, changelog }) {
  const version = manifest.version;
  // Current policy uses normal X.Y.Z versions; beta is a release label.
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || tag !== `v${version}`) {
    throw new Error('Release tag must be vX.Y.Z and match package.json.');
  }
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('Release versions in package-lock.json must match package.json.');
  }
  const entries = [...changelog.matchAll(/^## (.+)$/gm)].map(match => match[1]);
  const entry = entries.find(text => text.startsWith(`${version} — `));
  const date = entry?.match(/ — (\d{4}-\d{2}-\d{2})(?: — Beta)?$/)?.[1];
  if (!date || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Release changelog needs a dated heading: ## X.Y.Z — YYYY-MM-DD (optionally followed by — Beta).');
  }
  if (entries.filter(text => text.startsWith(`${version} — `)).length !== 1) {
    throw new Error('Release changelog must contain exactly one entry for this version.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [manifest, lock, changelog] = await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('package-lock.json', 'utf8').then(JSON.parse),
    readFile('CHANGELOG.md', 'utf8')
  ]);
  checkRelease({ tag: process.env.RELEASE_TAG, manifest, lock, changelog });
  console.log(`Release v${manifest.version}: tag, lockfile and dated changelog agree.`);
}
