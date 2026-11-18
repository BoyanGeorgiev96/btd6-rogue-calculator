import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bloonPropertyEvidence, componentMaskInventory, propertyMaskOverlap} from '../scripts/bloon-property-evidence.mjs';
const bytes = path => readFileSync(new URL('../' + path, import.meta.url));
const read = path => JSON.parse(bytes(path));
const report = read('docs/bloon-property-review.json');

test('pinned bloon bytes reject corruption and incorrect identity', () => {
  const raw = bytes('tests/fixtures/black-bloon-model.json');
  const entry = report.models.find(model => model.fields.id === 'Black');
  const file = {path:entry.path, sha:entry.blob};
  assert.deepEqual(bloonPropertyEvidence(raw, file), entry);
  assert.throws(() => bloonPropertyEvidence(Buffer.concat([raw, Buffer.from(' ')]), file), /pinned blob/);
  assert.throws(() => bloonPropertyEvidence(raw, {...file, path:'Bloons/White/White.json'}), /identity/);
});

test('mask arithmetic preserves missing, zero, sentinel, and unknown values', () => {
  assert.equal(propertyMaskOverlap(undefined, 1), null);
  assert.equal(propertyMaskOverlap(null, 1), null);
  assert.equal(propertyMaskOverlap(0, 3), 0);
  assert.equal(propertyMaskOverlap(-1, 3), 3);
  assert.equal(propertyMaskOverlap(17, 1), 1);
  assert.equal(propertyMaskOverlap(17, 8), 0);
  for (const invalid of [-2, 1.5, NaN, Infinity, '1', 0x80000000]) assert.equal(propertyMaskOverlap(invalid, 1), null);
  assert.equal(propertyMaskOverlap(1, undefined), null);
});

test('complete bloon inventory separates property masks from detection and fortified flags', () => {
  assert.deepEqual(report.source, read('data/tower-source.json'));
  assert.equal(report.models.length, 235);
  assert.equal(new Set(report.models.map(model => model.path)).size, report.models.length);
  const byId = new Map(report.models.map(model => [model.fields.id, model.fields]));
  for (const [id, mask] of Object.entries({Lead:1, Black:2, White:4, Purple:8, Zebra:6, Ddt:3, GlassBloon:64, GoldenLeadPurple:9, GoldenLeadPurpleZebra:15})) {
    assert.equal(byId.get(id).bloonProperties, mask);
  }
  assert.equal(byId.get('Ddt').isCamo, false);
  assert.equal(byId.get('DdtCamo').isCamo, true);
  assert.equal(byId.get('Ddt').bloonProperties, byId.get('DdtCamo').bloonProperties);
  assert.equal(byId.get('CeramicFortified').bloonProperties, 0);
  assert.equal(byId.get('CeramicFortified').isFortified, true);
  assert.ok(!report.models.some(model => model.fields.bloonProperties & 16), 'Frozen bit has no static bloon-model evidence');
  for (const model of report.models) {
    assert.match(model.blob, /^[a-f0-9]{40}$/);
    assert.equal(model.path, `Bloons/${model.fields.baseId}/${model.fields.id}.json`);
  }
});

test('mask inventory reproduces all direct component observations and rejects drift', () => {
  const raw = bytes('docs/component-eligibility-review.json'), review = JSON.parse(raw);
  assert.equal(report.componentReviewSha256, createHash('sha256').update(raw).digest('hex'));
  const representatives = report.representatives.map(path => report.models.find(model => model.path === path));
  assert.deepEqual(componentMaskInventory(review, representatives), report.masks);
  assert.equal(report.masks.filter(mask => mask.field === 'immuneBloonProperties').reduce((sum, mask) => sum + mask.directDamageModels, 0), 2910);
  const profile = {components:[{id:'dart', sourcePaths:{damage:['/damage']}}], findings:[]};
  const sample = {models:[{path:'sample', evidence:'sample'}], profiles:{sample:profile}};
  assert.throws(() => componentMaskInventory(sample, []), /missing direct damage/);
  profile.findings.push({path:'/damage', type:'DamageModel', fields:{immuneBloonProperties:0}});
  const masks = componentMaskInventory(sample, representatives);
  assert.equal(masks[0].present, true);
  assert.equal(masks[0].value, 0);
  assert.equal(masks[1].present, false);
  assert.ok(masks[1].overlaps.every(entry => entry.bits === null));
});
