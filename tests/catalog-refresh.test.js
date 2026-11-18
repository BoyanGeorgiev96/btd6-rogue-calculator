import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalize, applyRefresh } from '../scripts/refresh-data.mjs';
import { validateCatalog, reviewCatalog, diffCatalog } from '../scripts/catalog-validation.mjs';
const catalog = JSON.parse(await readFile(new URL('../data/artifacts.json', import.meta.url), 'utf8'));
const contracts = JSON.parse(await readFile(new URL('../data/catalog-contract.json', import.meta.url), 'utf8'));
const updated = () => structuredClone(catalog);
const find = (data, id = 'SlowerIsHarder') => data.artifacts.find(a => a.id === id);
const changeValue = data => {
  const variant = find(data).variants[0];
  variant.params[1] = 45; variant.sourceParams[1] = '45';
  variant.description = variant.sourceTemplate.replace(/\{(\d+)\}/g, (_, n) => variant.sourceParams[n]);
};
async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'rogue-refresh-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const url = pathToFileURL(directory + '/');
  await writeFile(new URL('artifacts.json', url), JSON.stringify(catalog));
  return url;
}

test('the bundled catalog matches its reviewed source contracts and rule bindings', () => {
  assert.deepEqual(reviewCatalog(catalog, contracts), []);
});

test('compatible numeric changes are reported without requiring a mechanics patch', async t => {
  const next = updated(); changeValue(next);
  const report = diffCatalog(catalog, next, contracts);
  assert.deepEqual(report.requiresReview, []);
  assert.deepEqual(report.changed.map(c => c.id), ['SlowerIsHarder']);
  const directory = await workspace(t);
  await writeFile(new URL('artifacts.candidate.json', directory), 'stale');
  const result = await applyRefresh(catalog, next, contracts, directory);
  assert.equal(result.status, 'updated');
  assert.deepEqual(JSON.parse(await readFile(new URL('artifacts.json', directory))), next);
  await assert.rejects(access(new URL('artifacts.candidate.json', directory)));
});

test('changed literal numbers require review and preserve the active catalog', async t => {
  const next = updated(), variant = find(next, 'OneMonkeyArmy').variants[0];
  variant.sourceTemplate = variant.sourceTemplate.replace('2x', '3x');
  variant.description = variant.sourceTemplate;
  const directory = await workspace(t);
  const original = await readFile(new URL('artifacts.json', directory), 'utf8');
  const result = await applyRefresh(catalog, next, contracts, directory);
  assert.equal(result.status, 'review-required');
  assert.ok(result.report.requiresReview.some(i => i.id === 'OneMonkeyArmy'));
  assert.equal(await readFile(new URL('artifacts.json', directory), 'utf8'), original);
  assert.deepEqual(JSON.parse(await readFile(new URL('artifacts.candidate.json', directory))), next);
  assert.match(await readFile(new URL('refresh-report.md', directory), 'utf8'), /Manual source review/);
});

test('new and removed artifacts, rarity changes, and parameter layouts are flagged', () => {
  for (const mutate of [
    d => d.artifacts.push({ ...structuredClone(d.artifacts[0]), id: 'NewArtifact' }),
    d => d.artifacts.pop(),
    d => find(d).variants.pop(),
    d => { const v = find(d).variants[0]; v.params.push(7); v.sourceParams.push('7'); }
  ]) {
    const next = updated(); mutate(next);
    assert.ok(diffCatalog(catalog, next, contracts).requiresReview.length);
  }
});

test('missing or nonnumeric modeled parameters are rejected even for inactive effects', () => {
  const next = updated(), variant = find(next).variants[0];
  variant.params[1] = 'unknown'; variant.sourceParams[1] = 'unknown';
  variant.description = variant.sourceTemplate.replace(/\{(\d+)\}/g, (_, n) => variant.sourceParams[n]);
  const issues = reviewCatalog(next, contracts);
  assert.ok(issues.some(i => /Invalid source parameter/.test(i.reason)));
});

test('malformed catalogs fail before any file is overwritten', async t => {
  const directory = await workspace(t), next = updated();
  next.artifacts.push(structuredClone(next.artifacts[0]));
  const original = await readFile(new URL('artifacts.json', directory), 'utf8');
  await assert.rejects(applyRefresh(catalog, next, contracts, directory), /duplicate artifact ID/);
  assert.equal(await readFile(new URL('artifacts.json', directory), 'utf8'), original);
  const nullParameter = updated(); find(nullParameter).variants[0].params[1] = null;
  assert.throws(() => validateCatalog(nullParameter), /inconsistent parameter/);
});

test('a check-date-only change does not create a spurious update', async t => {
  const next = updated(); next.checked = '2099-01-01';
  const directory = await workspace(t);
  const original = await readFile(new URL('artifacts.json', directory), 'utf8');
  assert.equal((await applyRefresh(catalog, next, contracts, directory)).status, 'unchanged');
  assert.equal(await readFile(new URL('artifacts.json', directory), 'utf8'), original);
});

test('upstream normalization retains templates and text parameters without null coercion', () => {
  const rogue = { artifacts: { Demo1: { tier: 0, baseId: 'Demo', nameLocKey: 'name', descriptionLocKey: 'desc', descriptionParams: ['20', '0-1-1'], rarityFrameType: 'AllMonkeyTowerSets', isBossArtifact: 0 } } };
  const english = { name: 'Demo {0}', desc: 'Damage {0}%, adds a {1} Monkey' };
  const result = normalize(rogue, english, { projectContentVersion: 57 });
  assert.equal(result.artifacts[0].name, 'Demo');
  assert.deepEqual(result.artifacts[0].variants[0].params, [20, '0-1-1']);
  assert.equal(result.artifacts[0].variants[0].sourceTemplate, english.desc);
  assert.throws(() => normalize(rogue, {}, { projectContentVersion: 57 }), /missing localization/);
  assert.throws(() => normalize(rogue, { ...english, desc: 'Bonus {4}' }, { projectContentVersion: 57 }), /missing parameter/);
});
