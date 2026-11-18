import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyTowerPreset, getTowerVariant, restoreTowerContext, setManualStat, validUpgradePath, validateTowerCatalog} from '../src/tower-stats.js';
import {calculate, defaults, sanitizeState, towers} from '../src/calculator.js';
import {importTowerModel} from '../scripts/tower-import.mjs';
const catalog=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
const artifacts=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url))).artifacts;
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/tower-models.json',import.meta.url))).models;
const sniper={...defaults,category:'Military',tower:'Sniper Monkey'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('the tower catalog covers all roster base towers and 64 legal crosspaths each',()=>{
  validateTowerCatalog(catalog);
  const roster=Object.entries(towers).filter(([c])=>!['Hero','Powers'].includes(c)).flatMap(([,names])=>names);
  assert.deepEqual(catalog.towers.map(t=>t.name).sort(),roster.sort());
  assert.equal(catalog.towers.length,26);
  for(const tower of catalog.towers)assert.equal(Object.keys(tower.variants).length,64,tower.name);
});
test('path validation rejects illegal crosspaths and supports standard paths',()=>{
  for(const path of ['000','203','520','025','220'])assert.ok(validUpgradePath(path));
  for(const path of ['555','330','111','600','02','2-0-3','abc',null])assert.equal(validUpgradePath(path),false);
  assert.throws(()=>applyTowerPreset(sniper,catalog,'555'),/Invalid upgrade/);
});
test('a base Sniper loads 2 damage and the actual 1.59-second cooldown',()=>{
  const context=applyTowerPreset(sniper,catalog);
  assert.equal(context.baseDamage,2);assert.equal(context.baseBossDamage,2);near(context.baseRate,1/1.59);assert.equal(context.tier,0);assert.equal(context.statMode,'preset');
  const result=calculate(artifacts,{},context);
  assert.equal(result.hit,2);near(result.bossHit*result.attacks,2/1.59);
});
test('upgrades change base stats and artifact applicability using the full crosspath',()=>{
  const context=applyTowerPreset(sniper,catalog,'203');
  assert.equal(context.baseDamage,7);assert.equal(context.tier,3);assert.equal(context.upgradePath,'203');
  const boosted=calculate(artifacts,{SlowerIsHarder:'Legendary'},context);
  near(boosted.hit,7*1.3);near(boosted.attacks,context.baseRate);
  const tier4=applyTowerPreset(sniper,catalog,'402');
  assert.equal(calculate(artifacts,{EssenceOfBloonarius:'Legendary'},tier4).rate,.84);
});
test('base MOAB damage is independent of normal damage and stacks with artifacts',()=>{
  const context=applyTowerPreset(sniper,catalog,'025');
  assert.equal(context.baseDamage,2);assert.equal(context.baseBossDamage,6);
  const result=calculate(artifacts,{SlowerIsHarder:'Legendary'},context);
  near(result.hit,2.6);near(result.bossHit,7.8);
});
test('Sniper bullets and shrapnel remain separate components without summing their DPS',()=>{
  const variant=getTowerVariant(catalog,'Sniper Monkey','320');
  assert.equal(variant.components.length,2);
  const bullet=applyTowerPreset(sniper,catalog,'320',variant.components[0].id);
  const shrapnel=applyTowerPreset(sniper,catalog,'320',variant.components[1].id);
  assert.equal(bullet.baseDamage,20);assert.equal(shrapnel.baseDamage,4);assert.equal(shrapnel.baseBossDamage,0);
  assert.equal(calculate(artifacts,{},bullet).hit,20);assert.equal(calculate(artifacts,{},shrapnel).bossHit,0);
  assert.equal(variant.components[1].projectiles,5);
});
test('manual overrides persist, with linked boss damage until it is explicitly overridden',()=>{
  let context=applyTowerPreset(sniper,catalog);
  context=setManualStat(context,'baseDamage',8);assert.equal(context.baseBossDamage,8);assert.equal(context.statMode,'manual');
  context=setManualStat(context,'baseBossDamage',15);
  context=setManualStat(context,'baseDamage',10);assert.equal(context.baseBossDamage,15);
  assert.deepEqual(restoreTowerContext(context,catalog),context);
  assert.equal(applyTowerPreset(context,catalog).baseDamage,2);
  assert.throws(()=>setManualStat(context,'baseDamage',NaN),/Invalid manual/);
});
test('switching towers reloads presets instead of retaining the previous tower’s values',()=>{
  const context=applyTowerPreset({...applyTowerPreset(sniper,catalog),category:'Primary',tower:'Dart Monkey'},catalog);
  assert.equal(context.baseDamage,1);near(context.baseRate,1/.95);
});
test('zero-damage towers do not get fabricated DPS and generic heroes remain manual',()=>{
  const farm=applyTowerPreset({...defaults,category:'Support',tower:'Banana Farm'},catalog);
  assert.equal(farm.baseDamage,0);assert.equal(farm.baseRate,0);assert.equal(farm.statMode,'manual');
  assert.equal(calculate(artifacts,{},farm).bossHit,0);
  const hero=applyTowerPreset({...defaults,category:'Hero',tower:'Hero'},catalog);
  assert.equal(hero.upgradePath,null);assert.equal(hero.statMode,'manual');
});
test('saved/shared builds retain valid paths and manual values while old links still work',()=>{
  const context=applyTowerPreset(sniper,catalog,'320');
  const saved=sanitizeState({context,selected:{}},artifacts).context;
  assert.equal(saved.upgradePath,'320');assert.equal(saved.componentId,context.componentId);assert.equal(saved.baseBossDamage,20);
  assert.deepEqual(restoreTowerContext(saved,catalog),saved);
  const legacy=sanitizeState({context:{category:'Military',tower:'Sniper Monkey',tier:3,baseDamage:7,baseRate:2},selected:{}},artifacts).context;
  assert.equal(legacy.upgradePath,null);assert.equal(legacy.statMode,'manual');assert.equal(legacy.baseDamage,7);assert.equal(calculate(artifacts,{},legacy).bossHit,7);
  const invalid=sanitizeState({context:{...context,upgradePath:'555'}},artifacts).context;
  assert.equal(invalid.upgradePath,null);assert.equal(invalid.statMode,'manual');
});
test('stale preset values reload from the catalog; removed components preserve manual values',()=>{
  const context=applyTowerPreset(sniper,catalog,'320');
  assert.equal(restoreTowerContext({...context,baseDamage:999},catalog).baseDamage,20);
  const missing=restoreTowerContext({...context,componentId:'removed-component',baseDamage:999},catalog);
  assert.equal(missing.statMode,'manual');assert.equal(missing.baseDamage,999);
});
test('source fixtures reproduce the imported base, crosspath, splash, and alternate attacks',()=>{
  for(const [filename,model] of Object.entries(fixtures)){
    const id=model.baseId;const family=catalog.towers.find(t=>t.id===id);
    const result=importTowerModel(model,family);
    assert.deepEqual({range:result.range,rangeMode:result.rangeMode,components:result.components,abilities:result.abilities,notes:result.notes},family.variants[result.path],filename);
  }
  assert.equal(getTowerVariant(catalog,'Mortar Monkey','000').components[0].bossDamage,2);
  const boat=getTowerVariant(catalog,'Monkey Buccaneer','000');
  assert.equal(boat.components[1].cooldownSeconds,1); // Not the alternate weapon's raw 0.05s internal timer.
});
test('conditional Fortified modifiers are not treated as unconditional MOAB bonuses',()=>{
  const model=fixtures['Alchemist-020'];
  const variant=importTowerModel(model,{id:'Alchemist'});
  assert.equal(variant.components[0].damage,1);
  assert.equal(variant.components[0].bossDamage,5); // +4 to all MOABs, not the additional +15 requiring Fortified.
});
test('imported tower data rejects malformed stats and mismatched models',()=>{
  const invalid=structuredClone(catalog);invalid.towers[0].variants['000'].components[0].cooldownSeconds=0;
  assert.throws(()=>validateTowerCatalog(invalid),/invalid cooldown/);
  assert.throws(()=>importTowerModel(fixtures.SniperMonkey,{id:'DartMonkey'}),/Unexpected tower/);
});
