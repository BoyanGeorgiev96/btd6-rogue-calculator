import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibilityEvidence} from '../scripts/eligibility-evidence.mjs';
const read = path => JSON.parse(readFileSync(new URL('../'+path, import.meta.url)));
const report = read('docs/hit-eligibility-review.json');
const artifact = id => report.artifacts.find(a => a.id === id);

test('review inventories every catalog artifact and keeps missing source models explicit', () => {
  assert.deepEqual(report.source,read('data/tower-source.json'));
  assert.equal(report.artifactDescriptionVersion,read('data/artifacts.json').version);
  assert.deepEqual(report.artifacts.map(a => a.id),read('data/artifacts.json').artifacts.map(a => a.id));
  const files = new Map(report.scanned.map(f => [f.path,f.blob]));
  assert.equal(files.size,report.scanned.length);
  for (const entry of report.artifacts) {
    for (const model of entry.models) assert.equal(files.get(model.path),model.blob);
    if (entry.status === 'missing-pinned-model') assert.deepEqual(entry.models,[]);
  }
  assert.equal(artifact('BattleCat').status,'missing-pinned-model');
});

test('audit separates all five detection/damage-type sources and preserves gates', () => {
  const kinds = id => new Set(artifact(id).models.flatMap(m => m.findings.map(f => f.kind)));
  for (const id of ['EssenceOfPhayze','OneMonkeyArmy']) assert.ok(kinds(id).has('detection-override'));
  for (const id of ['GeneralsDisposition','PerceptiveCrow']) assert.ok(kinds(id).has('detection-aura'));
  assert.ok(kinds('IntelligenceAgent').has('damage-type-aura'));
  assert.ok(!kinds('IntelligenceAgent').has('detection-aura'));
  const phayze = artifact('EssenceOfPhayze').models[0].findings.filter(f => f.kind === 'detection-override');
  assert.deepEqual(phayze.map(f => f.selection.tiers),[[4,4,4],[15]]);
  const crow = artifact('PerceptiveCrow').models[0].findings.find(f => f.kind === 'detection-aura');
  assert.deepEqual(crow.selection.towerTypes,['MonkeyBuccaneer']);
  assert.deepEqual(crow.selection.tiers,[6,6,2]);
  assert.equal(crow.fields.appliesToOwningTower,false);
});

test('discovery retains nested attack paths instead of calling their immunity mask a global grant', () => {
  const model = {artifactBehaviors:[{tiers:[4,4,4],behaviorModels:[{$type:'Example.CreateProjectileModel, Assembly',projectile:{$type:'Example.ProjectileModel, Assembly',behaviors:[{$type:'Example.DamageModel, Assembly',immuneBloonProperties:2}]}}]}]};
  const findings = eligibilityEvidence(model);
  assert.equal(findings.length,1);
  assert.equal(findings[0].kind,'damage-or-property-model');
  assert.equal(findings[0].path,'/artifactBehaviors/0/behaviorModels/0/projectile/behaviors/0');
  assert.deepEqual(findings[0].selection,{tiers:[4,4,4]});
  assert.equal(findings[0].fields.immuneBloonProperties,2);
});
