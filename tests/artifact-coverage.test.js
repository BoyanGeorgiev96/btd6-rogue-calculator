import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artifactCoverage,filterCoverage,coverageStatuses} from '../src/artifact-coverage.js';
const artifacts=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url))).artifacts;
const rows=artifactCoverage(artifacts);
test('coverage includes every artifact rarity with unique rows and shipped evidence paths',()=>{
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  for(const artifact of artifacts)for(const variant of artifact.variants)assert.ok(rows.some(r=>r.artifactId===artifact.id&&r.rarity===variant.rarity&&r.description===variant.description));
  for(const row of rows){
    assert.ok(coverageStatuses.includes(row.status));assert.ok(row.links.length);
    for(const link of row.links)if(link.href.startsWith('./'))assert.ok(readFileSync(new URL('../'+link.href.slice(2),import.meta.url)).length);
  }
});
test('verified evidence is effect-specific and tied to the reviewed rarity parameters',()=>{
  const mixed=rows.filter(r=>r.artifactId==='AbsoluteAbility'&&r.rarity==='Common');
  const attack=mixed.find(r=>r.label==='Attack rate'),ability=mixed.find(r=>r.label==='Ability recharge rate');
  assert.equal(attack.status,'Verified export cooldown');assert.match(attack.links.at(-1).href,/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24\/Artifacts\/AbsoluteAbility1.json$/);
  assert.equal(ability.status,'Description estimate');assert.ok(!ability.links.some(l=>l.href.includes('/Artifacts/')));
  const artifact=structuredClone(artifacts.find(a=>a.id==='AbsoluteAbility'));artifact.variants[0].sourceParams=['999'];
  assert.ok(!artifactCoverage([artifact]).filter(r=>r.rarity==='Common').some(r=>r.status==='Verified export cooldown'));
});
test('partial and reference-only exclusions remain visible beside optional crit estimates',()=>{
  assert.ok(rows.some(r=>r.artifactId==='FullBroadside'&&r.label==='Extra ability charges'&&r.status==='Unmodeled'));
  assert.ok(rows.some(r=>r.artifactId==='GeneralsDisposition'&&r.label==='Camo detection'&&r.status==='Unmodeled'));
  assert.ok(rows.some(r=>r.artifactId==='OneShot'&&r.label==='Critical hits'&&r.status==='Unverified mechanics'));
  assert.ok(rows.some(r=>r.label==='All effects'&&r.status==='Unmodeled'));
});
test('filters combine case-insensitive search and evidence status without mutating the inventory',()=>{
  const snapshot=structuredClone(rows);
  const result=filterCoverage(rows,{search:'  absolute ability ',status:'Description estimate'});
  assert.equal(result.length,3);assert.ok(result.every(r=>r.label==='Ability recharge rate'));
  assert.equal(filterCoverage(rows,{search:'no matching artifact xyz'}).length,0);
  assert.deepEqual(rows,snapshot);
});
