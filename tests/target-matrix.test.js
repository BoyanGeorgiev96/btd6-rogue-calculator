import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate, defaults} from '../src/calculator.js';
import {applyTowerPreset} from '../src/tower-stats.js';
import {compareTargets} from '../src/target-matrix.js';
const read = name => JSON.parse(readFileSync(new URL('../data/'+name, import.meta.url)));
const artifacts = read('artifacts.json').artifacts;
const catalog = {...read('towers.json'), heroes:read('heroes.json').heroes};
const preset = (tower, category, path) => applyTowerPreset({...defaults,tower,category},catalog,path);

test('matrix isolates five target contexts, fixes fortification, and preserves the build', () => {
  const state = {context:{...preset('Sniper Monkey','Military','300'),camo:true,fortified:true,early:true,aura:true},selected:{CeramicChunker:'Rare',EssenceOfDreadbloon:'Legendary'}};
  const original = structuredClone(state);
  const rows = compareTargets(artifacts,state);
  assert.deepEqual(rows.map(r => [r.targetType,r.context.fortified]), [['bloon',false],['ceramic',false],['ceramic',true],['moab',false],['boss',false]]);
  assert.equal(rows[0].result.targetHit,20);
  assert.equal(rows[1].result.targetHit,70);
  for (const row of rows) {
    assert.equal(row.context.camo,true);
    assert.equal(row.context.early,true);
    assert.equal(row.context.aura,true);
    assert.equal(row.result.targetDpsValue,calculate(artifacts,state.selected,row.context).targetDpsValue);
    assert.equal(row.gain,row.result.targetDpsValue-row.base.targetDpsValue);
  }
  rows[0].context.baseDamageModifiers.push({});
  assert.deepEqual(state,original);
});

test('fortified/ceramic overlap and category conversion are recalculated per column', () => {
  const state = {context:preset('Dart Monkey','Primary','400'), selected:{EssenceOfDreadbloon:'Legendary',GrandMagicPrecision:'Common'}};
  const rows = compareTargets(artifacts,state);
  assert.ok(Math.abs(rows[1].result.targetHit / rows[1].base.targetHit - rows[2].result.targetHit / rows[2].base.targetHit) < 1e-9);
  assert.ok(rows[1].result.targetHit>rows[0].result.targetHit);
  assert.ok(rows[0].result.breakdown.find(b => b.id === 'GrandMagicPrecision').active);
});

test('boss-only multipliers and status immunities remain separate from MOAB and bloon results', () => {
  const hero = applyTowerPreset({...defaults,category:'Hero',tower:'Quincy',heroLevel:20,frozen:true},catalog);
  const rows = compareTargets(artifacts,{context:hero,selected:{OneMonkeyArmy:'Legendary',CrystalCrash:'Legendary'}});
  assert.equal(rows[4].result.targetHit,rows[3].result.targetHit*2);
  assert.equal(rows[0].result.damage,3);
  assert.equal(rows[4].result.targetHit,rows[4].base.targetHit*2);
});

test('matrix retains normal hits and critical warnings independently for each target', () => {
  const context = applyTowerPreset({...defaults,category:'Hero',tower:'Adora',heroLevel:20,criticalMode:'expected'},catalog);
  const rows = compareTargets(artifacts,{context,selected:{OneMonkeyArmy:'Legendary',CriticalSuccess:'Legendary',DivineIntervention:'Legendary'}});
  assert.ok(rows.every(r => r.result.warnings.length && r.notes.some(n => n.includes('Multiple critical-hit artifacts'))));
  assert.ok(rows.every(r => r.result.targetHit === r.result.expectedTargetHit));
});

test('zero and unknown values are kept distinct and source exclusions do not imply universal eligibility', () => {
  const manual = compareTargets(artifacts,{context:{...defaults,baseDamage:0,baseRate:0},selected:{}});
  assert.ok(manual.every(r => r.result.targetDpsValue === 0 && r.result.projectilePierce === null && r.result.abilitySeconds === null && r.eligibility.startsWith('Unknown')));
  const ice = compareTargets(artifacts,{context:preset('Ice Monkey','Primary','000'),selected:{}});
  assert.equal(ice[3].result.targetDpsValue,0);
  assert.match(ice[3].eligibility,/Excluded/);
  assert.match(ice[0].eligibility,/Unknown/);
  const global = compareTargets(artifacts,{context:{...defaults,rangeMode:'global'},selected:{}});
  assert.ok(global.every(r => r.result.rangeMode === 'global' && r.result.attackRange === null));
});
