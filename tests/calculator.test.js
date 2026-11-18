import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,defaults,sanitizeState,supported,towers} from '../src/calculator.js';
const data=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url)));
const artifacts=data.artifacts;
const calc=(selected={},context={})=>calculate(artifacts,selected,{...defaults,...context});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} should equal ${b}`);
test('an empty build retains base stats',()=>{
  const r=calc({}, {baseDamage:4,baseRate:2});
  assert.equal(r.damage,1);assert.equal(r.rate,1);assert.equal(r.bossDps,1);assert.equal(r.hit,4);assert.equal(r.attacks,2);
});
test('damage and speed stack multiplicatively, using selected rarity',()=>{
  const r=calc({SlowerIsHarder:'Legendary',TitForTat:'Common'});
  near(r.damage,1.3);near(r.rate,1/.85);near(r.bossDps,1.3/.85);
});
test('Pure Damage boosts MOAB hit damage, not regular hit damage, and halves attack rate',()=>{
  const r=calc({PureDamage:'Legendary'},{category:'Magic',tower:'Wizard Monkey',baseDamage:5,baseRate:2});
  assert.equal(r.damage,1);assert.equal(r.rate,.5);assert.equal(r.bossDamage,4);assert.equal(r.bossHit,20);assert.equal(r.bossDps,2);
  assert.equal(calc({PureDamage:'Legendary'}).bossDamage,1);
});
test('early-round slowdown only activates in the first 20 seconds',()=>{
  assert.equal(calc({SlowAndSteady:'Common'}).rate,1);
  near(calc({SlowAndSteady:'Common'},{early:true}).rate,1/1.5);
  assert.equal(calc({SlowAndSteady:'Common'}).damage,1.5);
  assert.equal(calc({StartingStong:'Legendary'}).rate,1);
  near(calc({StartingStong:'Legendary'},{early:true}).rate,1/.7);
});
test('Bloonarius applies its tier threshold',()=>{
  assert.equal(calc({EssenceOfBloonarius:'Legendary'},{tier:3}).damage,1.5);
  const high=calc({EssenceOfBloonarius:'Legendary'},{tier:4});assert.equal(high.damage,1);assert.equal(high.rate,.84);
});
test('Dreadbloon category conversion is order independent and tier gated',()=>{
  const selected={PureDamage:'Legendary',EssenceOfDreadbloon:'Legendary'};
  assert.equal(calc(selected,{tier:3}).bossDamage,1);
  assert.equal(calc(selected,{tier:4}).bossDamage,4);
  assert.equal(calc(selected,{category:'Hero',tower:'Hero',heroLevel:14}).bossDamage,1);
  assert.equal(calc(selected,{category:'Hero',tower:'Hero',heroLevel:15}).bossDamage,4);
  assert.equal(calculate([...artifacts].reverse(),selected,{...defaults,tier:4}).bossDamage,4);
});
test('conditional and tower-specific effects do not leak to other towers',()=>{
  assert.equal(calc({OneShot:'Common'}).rate,1);
  assert.equal(calc({OneShot:'Common'},{category:'Military',tower:'Sniper Monkey'}).rate,.5);
  assert.equal(calc({StickySituation:'Legendary'}).damage,1);
  assert.ok(calc({StickySituation:'Legendary'},{glued:true}).damage>1);
});
test('unmodeled selections never silently affect totals',()=>{
  const r=calc({HomingProjectiles:'Legendary'});assert.equal(r.bossDps,1);assert.deepEqual(r.unmodeled,['Homing Projectiles']);
});
test('every modeled artifact exists; all valid combinations yield finite nonnegative stats',()=>{
  for(const id of supported)assert.ok(artifacts.some(a=>a.id===id),id);
  for(const a of artifacts)for(const v of a.variants)for(const category of Object.keys(towers)){
    const r=calc({[a.id]:v.rarity},{category,tower:towers[category][0],tier:5,early:true,close:true,aura:true,glued:true,frozen:true,stunned:true});
    for(const key of ['damage','rate','bossDamage','bossDps','pierce','range'])assert.ok(Number.isFinite(r[key])&&r[key]>=0,`${a.id}: ${key}`);
  }
});
test('shared and persisted state rejects unknown selections and invalid context',()=>{
  const r=sanitizeState({context:{category:'unknown',tower:'fake',tier:900,baseDamage:-20,baseRate:'bad',early:'yes'},selected:{PureDamage:'Made up',fake:'Legendary',SlowerIsHarder:'Rare'}},artifacts);
  assert.equal(r.context.category,'Primary');assert.equal(r.context.tower,'Dart Monkey');assert.equal(r.context.tier,5);assert.equal(r.context.baseDamage,0);assert.equal(r.context.baseRate,1);assert.equal(r.context.early,false);assert.deepEqual(r.selected,{SlowerIsHarder:'Rare'});
  assert.deepEqual(sanitizeState(null,artifacts),{context:defaults,selected:{}});
});
test('regular status damage does not overstate boss damage against immune targets',()=>{
  const r=calc({CrystalCrash:'Legendary'},{category:'Support',tower:'Engineer Monkey',frozen:true});
  assert.ok(r.damage>1);assert.equal(r.bossDamage,1);assert.equal(r.bossDps,1);
});
test('One Monkey Army doubles hero boss damage without doubling regular hit damage',()=>{
  const r=calc({OneMonkeyArmy:'Legendary'},{category:'Hero',tower:'Hero',heroLevel:1,baseDamage:5,baseRate:2});
  assert.equal(r.damage,1);assert.equal(r.hit,5);assert.equal(r.bossDamage,2);assert.equal(r.bossHit,10);assert.equal(r.bossDps,2);assert.equal(r.attacks,2);
  assert.deepEqual(r.unmodeled,[]);assert.ok(r.breakdown.find(b=>b.id==='OneMonkeyArmy').active);
});
test('One Monkey Army gives heroes category bonuses at any level independent of artifact order',()=>{
  const selected={OneMonkeyArmy:'Legendary',PureDamage:'Legendary',PrimarySpecialist:'Rare'};
  const context={...defaults,category:'Hero',tower:'Hero',heroLevel:1};
  const r=calc(selected,context);
  assert.equal(r.damage,1);assert.equal(r.bossDamage,8);near(r.rate,.5*1.25);near(r.bossDps,5);
  assert.deepEqual(calculate([...artifacts].reverse(),selected,context).bossDps,r.bossDps);
  const removed=calc({PureDamage:'Legendary',PrimarySpecialist:'Rare'},context);
  assert.equal(removed.bossDamage,1);assert.equal(removed.rate,1);
});
test('One Monkey Army suppresses non-hero hit damage even when other artifacts boost it',()=>{
  for(const category of ['Primary','Military','Magic','Support']){
    const r=calc({OneMonkeyArmy:'Legendary',SlowerIsHarder:'Legendary',TitForTat:'Common',PureDamage:'Legendary'},{category,tower:towers[category][0],baseDamage:20});
    for(const stat of ['damage','hit','bossDamage','bossHit','dps','bossDps'])assert.equal(r[stat],0,`${category}: ${stat}`);
    assert.ok(r.rate>0);
  }
  assert.equal(calc({SlowerIsHarder:'Legendary'}).damage,1.3);
});
test('invalid conversion artifact rarities do not activate conversions',()=>{
  const r=calc({OneMonkeyArmy:'Common',PureDamage:'Legendary'},{category:'Hero',tower:'Hero',heroLevel:1});
  assert.equal(r.bossDamage,1);assert.equal(r.rate,1);
});
