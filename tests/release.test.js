import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRelease } from '../scripts/check-release.mjs';

const release = () => ({
  tag: 'v0.2.0', manifest: { version: '0.2.0' },
  lock: { version: '0.2.0', packages: { '': { version: '0.2.0' } } },
  changelog: '# Changelog\n\n## Unreleased\n\n## 0.2.0 — 2026-11-14 — Beta\n\n- New feature\n'
});

test('release accepts dated beta and stable entries, including an empty Unreleased section', () => {
  assert.doesNotThrow(() => checkRelease(release()));
  const stable = release();
  stable.changelog = stable.changelog.replace(' — Beta', '');
  assert.doesNotThrow(() => checkRelease(stable));
});

test('release rejects mismatched tags and lockfile versions', () => {
  for (const tag of [undefined, '0.2.0', 'v0.1.0', 'v0.2.0-beta.1']) {
    assert.throws(() => checkRelease({ ...release(), tag }), /Release tag/);
  }
  for (const field of ['root', 'package']) {
    const value = release();
    if (field === 'root') value.lock.version = '0.1.0';
    else value.lock.packages[''].version = '0.1.0';
    assert.throws(() => checkRelease(value), /package-lock/);
  }
});

test('release rejects pending, missing, invalid-date and duplicate version entries', () => {
  for (const heading of ['## 0.2.0 — Beta (unreleased)', '## 0.1.0 — 2026-11-14', '## 0.2.0 — 2026-02-30']) {
    assert.throws(() => checkRelease({ ...release(), changelog: heading }), /dated heading/);
  }
  const value = release();
  value.changelog += '\n## 0.2.0 — 2026-11-14\n';
  assert.throws(() => checkRelease(value), /exactly one/);
});
