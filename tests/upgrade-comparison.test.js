import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate, defaults} from '../src/calculator.js';
import {applyTowerPreset, validUpgradePath} from '../src/tower-stats.js';
import {compareUpgrades} from '../src/upgrade-comparison.js';
const read = name => JSON.parse(readFileSync(new URL('../data/'+name, import.meta.url)));
const artifacts = read('artifacts.json').artifacts;
const catalog = {...read('towers.json'), heroes:read('heroes.json').heroes};
const state = {context:{...defaults,baseDamage:999,baseRate:999,baseAbilityCooldown:999,abilityMode:'manual',targetType:'ceramic',camo:true,fortified:true,early:true,aura:true},selected:{CeramicChunker:'Rare'}};

test('upgrade rows cover legal source crosspaths and isolate source stats from manual overrides', () => {
  const original = structuredClone(state);
  const comparison = compareUpgrades(artifacts,state,catalog,{tower:'Dart Monkey',referencePath:'000'});
  assert.equal(comparison.rows.length,64);
  assert.ok(comparison.rows.every(row => validUpgradePath(row.path)));
  assert.equal(comparison.reference.context.baseDamage,1);
  assert.equal(comparison.reference.result.targetHit,7);
  for (const row of comparison.rows) {
    assert.equal(row.context.category,'Primary');
    assert.equal(row.context.camo,true);
    assert.equal(row.context.fortified,true);
    assert.equal(row.context.early,true);
    assert.equal(row.context.aura,true);
    assert.equal(row.context.tier,Math.max(...row.path.split('').map(Number)));
    assert.equal(row.result.targetDpsValue,calculate(artifacts,state.selected,row.context).targetDpsValue);
    assert.equal(row.dpsChange,row.result.targetDpsValue-comparison.reference.result.targetDpsValue);
    assert.equal(row.artifactGain,row.result.targetDpsValue-row.base.targetDpsValue);
    assert.notEqual(row.context.baseAbilityCooldown,999);
  }
  comparison.rows[0].context.baseDamageModifiers.push({});
  assert.deepEqual(state,original);
});

test('tier filters retain an independently evaluated reference, including tier zero', () => {
  const all = compareUpgrades(artifacts,state,catalog,{tower:'Dart Monkey',referencePath:'300'});
  const filtered = compareUpgrades(artifacts,state,catalog,{tower:'Dart Monkey',referencePath:'300',tier:5});
  assert.equal(filtered.reference.path,'300');
  assert.ok(filtered.rows.length>0 && filtered.rows.every(row => row.context.tier===5 && !row.isReference));
  assert.deepEqual(filtered.rows,all.rows.filter(row => row.context.tier===5));
  assert.deepEqual(compareUpgrades(artifacts,state,catalog,{tower:'Dart Monkey',tier:0}).rows.map(row=>row.path),['000']);
});

test('components, source target exclusions, and abilities are evaluated per path without summing', () => {
  const options = {tower:'Sniper Monkey',referencePath:'320',components:{'320':'attack-0/weapon-0/child-0'}};
  const result = compareUpgrades(artifacts,{context:{...defaults,targetType:'boss'},selected:{}},catalog,options);
  assert.equal(result.reference.result.targetDpsValue,0);
  assert.match(result.reference.componentName,/Shrapnel/i);
  const ability = compareUpgrades(artifacts,{context:defaults,selected:{AbsoluteAbility:'Common'}},catalog,{tower:'Dart Monkey',referencePath:'040'}).reference;
  assert.equal(ability.context.baseAbilityCooldown,50);
  assert.equal(ability.result.abilitySeconds,40);
  const empty = compareUpgrades(artifacts,state,catalog,{tower:'Banana Farm'});
  assert.ok(empty.rows.every(row => row.result.targetDpsValue===0 && row.interval===null && row.intervalChange===null));
  const global = compareUpgrades(artifacts,state,catalog,{tower:'Sniper Monkey'});
  assert.ok(global.rows.every(row => row.result.rangeMode==='global' && row.result.attackRange===null));
});

test('attack interval exposes artifact slowdowns and category/tier effects recalculate per path', () => {
  const current = {context:defaults,selected:{SlowerIsHarder:'Common',EssenceOfDreadbloon:'Legendary',GrandMagicPrecision:'Common'}};
  const {rows} = compareUpgrades(artifacts,current,catalog,{tower:'Dart Monkey'});
  for (const row of rows) {
    assert.ok(row.interval>0);
    assert.equal(row.interval,1/row.result.attacks);
    const preset = applyTowerPreset({...defaults,tower:'Dart Monkey',category:'Primary'},catalog,row.path);
    assert.equal(row.result.targetDpsValue,calculate(artifacts,current.selected,preset).targetDpsValue);
  }
  assert.ok(rows.find(row=>row.path==='400').result.breakdown.some(entry=>entry.id==='GrandMagicPrecision' && entry.active));
  const normal = compareUpgrades(artifacts,{context:defaults,selected:{}},catalog,{tower:'Sniper Monkey'}).reference;
  const slowed = compareUpgrades(artifacts,{context:defaults,selected:{OneShot:'Common'}},catalog,{tower:'Sniper Monkey'}).reference;
  assert.equal(slowed.interval,normal.interval*2);
});

test('invalid towers, paths, filters, components, and abilities fail explicitly', () => {
  for (const options of [{tower:'Quincy'},{tower:'fake'},{tower:'Dart Monkey',referencePath:'555'},
    {tower:'Dart Monkey',tier:6},{tower:'Dart Monkey',tier:'4'},
    {tower:'Dart Monkey',components:{'555':'fake'}},{tower:'Dart Monkey',components:{'000':'fake'}},
    {tower:'Dart Monkey',abilities:{'000':'fake'}}]) assert.throws(()=>compareUpgrades(artifacts,state,catalog,options));
});
