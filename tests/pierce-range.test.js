import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,defaults,sanitizeState,supported} from '../src/calculator.js';
import {applyTowerPreset,setManualStat,restoreTowerContext,validateTowerCatalog} from '../src/tower-stats.js';
import {matches} from '../src/effect-engine.js';
import {artifactSummary} from '../src/artifact-summary.js';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));
const artifacts=read('artifacts.json').artifacts;
const catalog={...read('towers.json'),heroes:read('heroes.json').heroes};
const preset=(tower='Dart Monkey',category='Primary',path='000')=>applyTowerPreset({...defaults,tower,category,heroLevel:1},catalog,path);
const calc=(selected,context=preset())=>calculate(artifacts,selected,context);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('base presets load projectile pierce and finite or global attack range',()=>{
 const dart=preset();assert.equal(dart.basePierce,2);assert.equal(dart.baseRange,32);assert.equal(dart.rangeMode,'finite');
 const sniper=preset('Sniper Monkey','Military');assert.equal(sniper.basePierce,1);assert.equal(sniper.rangeMode,'global');assert.equal(sniper.baseRange,null);
});
test('independent pierce and range boosts stack multiplicatively without inflating DPS',()=>{
 const c=preset(),base=calc({},c),r=calc({FrostedTips:'Common',GreaterPrimaryInspiration:'Common',HawksEye:'Common'},c);
 near(r.pierce,1.15*1.2);near(r.range,1.15*1.1*1.05);near(r.projectilePierce,2*1.15*1.2);near(r.attackRange,32*1.15*1.1*1.05);assert.equal(r.bossDps,base.bossDps);
});
test('Pure Damage and Swelling Spikes include their pierce boosts and attack penalties',()=>{
 const magic=calc({PureDamage:'Legendary'},preset('Wizard Monkey','Magic'));assert.equal(magic.pierce,2);assert.equal(magic.rate,.5);
 const spikes=calc({SwellingSpikes:'Common'},preset('Spike Factory','Support'));near(spikes.projectilePierce,5*2.15);assert.equal(spikes.rate,.5);assert.equal(spikes.bossDps,.5);
});
test('specialist penalties target other categories, including converted towers',()=>{
 const primary=calc({PrimarySpecialist:'Rare'});assert.equal(primary.pierce,1);
 const military=calc({PrimarySpecialist:'Rare'},preset('Sniper Monkey','Military'));near(military.pierce,.85);
 const all=calc({EssenceOfDreadbloon:'Legendary',PrimarySpecialist:'Rare',SupportSpecialist:'Rare'},preset('Dart Monkey','Primary','400'));near(all.pierce,.85*.85);near(all.rate,1.25*1.25);
});
test('Crow range penalty requires Crow’s Nest on the bottom upgrade path',()=>{
 const enabled=calc({PerceptiveCrow:'Common'},preset('Monkey Buccaneer','Military','002'));near(enabled.range,.65);
 assert.equal(calc({PerceptiveCrow:'Common'},preset('Monkey Buccaneer','Military','200')).range,1);
 assert.equal(calc({PerceptiveCrow:'Common'},{...defaults,tower:'Monkey Buccaneer',category:'Military',tier:3}).range,1);
});
test('global range remains global and serializes without Infinity',()=>{
 const c=preset('Sniper Monkey','Military'),r=calc({HawksEye:'Common'},c);assert.equal(r.rangeMode,'global');assert.equal(r.attackRange,null);near(r.range,1.05);assert.doesNotMatch(JSON.stringify(c),/Infinity/);
});
test('non-attacking support towers retain their influence range',()=>{
 const village=preset('Monkey Village','Support');assert.equal(village.baseRange,40);assert.equal(village.basePierce,null);
 assert.equal(calc({BiggestBeacon:'Legendary'},village).attackRange,100);
 near(calc({BiggestBeacon:'Legendary'},preset('Spike Factory','Support')).range,1.2);
});
test('legacy manual builds keep unknown base values instead of fabricated stats',()=>{
 const c=sanitizeState({context:{baseDamage:7,baseRate:1}},artifacts).context;
 const r=calc({HeroicEdge:'Common',HawksEye:'Common'},c);assert.equal(r.projectilePierce,null);assert.equal(r.attackRange,null);near(r.pierce,1.1);near(r.range,1.05);
});
test('manual pierce/range overrides and global flags survive saved builds and reset',()=>{
 let c=setManualStat(preset(),'basePierce',10);c=setManualStat(c,'baseRange',50);const saved=sanitizeState({context:c},artifacts).context;
 assert.equal(saved.basePierce,10);assert.equal(saved.baseRange,50);assert.deepEqual(restoreTowerContext(saved,catalog),saved);assert.equal(applyTowerPreset(c,catalog).baseRange,32);
 const global=sanitizeState({context:{...c,rangeMode:'global'}},artifacts).context;assert.equal(global.rangeMode,'global');assert.equal(global.baseRange,null);
});
test('range-only artifacts are active and explain their effects in summaries',()=>{
 const a=artifacts.find(a=>a.id==='HawksEye'),r=calc({HawksEye:'Common'});assert.ok(r.breakdown[0].active);assert.match(artifactSummary(a,a.variants[0],preset()),/5% range/);assert.ok(supported.has('GreaterPrimaryInspiration'));
});
test('heroes receive Divine Inspiration and their own General’s Disposition range penalty',()=>{
 const c=preset('Quincy','Hero');const r=calc({DivineInspiration:'Common',GeneralsDisposition:'Common'},c);near(r.pierce,1.2);near(r.range,1.1*.8);
});
test('invalid range modes and broken path conditions fail validation',()=>{
 const invalid=structuredClone(catalog);invalid.towers[0].variants['000'].rangeMode='forever';assert.throws(()=>validateTowerCatalog(invalid),/invalid range/);
 assert.throws(()=>matches({minPath:[0,0,7]},defaults,new Set()),/Invalid minPath/);
});
