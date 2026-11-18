import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{calculate,defaults,sanitizeState}from'../src/calculator.js';import{getAbilityTimers,applyTowerPreset,applyAbilityPreset,setManualAbilityCooldown,setManualStat,restoreTowerContext,validateTowerCatalog}from'../src/tower-stats.js';
import{extractAbilities}from'../scripts/ability-import.mjs';import{artifactCandidate,compareBuilds}from'../src/build-tools.js';import{analyzeArtifact,artifactEvidence}from'../src/artifact-discovery.js';import{compareTowerPresets}from'../src/tower-comparison.js';
const read=f=>JSON.parse(readFileSync(new URL('../data/'+f,import.meta.url)));const artifacts=read('artifacts.json').artifacts;const catalog={...read('towers.json'),heroes:read('heroes.json').heroes};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const preset=(tower,category,path='000',heroLevel=20)=>applyTowerPreset({...defaults,tower,category,heroLevel},catalog,path);

test('base timer and cooldown multiplier are independent of ordinary attack DPS',()=>{
 const c={...defaults,baseAbilityCooldown:60};const r=calculate(artifacts,{AbsoluteAbility:'Common'},c);
 near(r.abilityRate,1.25);near(r.abilityCooldown,.8);near(r.abilitySeconds,48);near(r.rate,1/1.1);
 const alone=calculate(artifacts,{InnateAbility:'Common'},c);near(alone.abilitySeconds,80);assert.equal(alone.targetDpsValue,1);
});
test('faster and slower recharge estimates stack multiplicatively, with Psi exception',()=>{
 const selected={AbsoluteAbility:'Common',InnateAbility:'Common',AbilityStacking:'Common'};const c={...defaults,baseAbilityCooldown:60};near(calculate(artifacts,selected,c).abilitySeconds,80);
 const psi={...c,category:'Hero',tower:'Psi'};near(calculate(artifacts,{AbilityStacking:'Common'},psi).abilitySeconds,60);
 near(calculate(artifacts,{PureDamage:'Legendary'},{...c,category:'Magic',tower:'Wizard Monkey'}).abilitySeconds,120);
});
test('specialists use converted categories for both the positive and other-category penalty',()=>{
 const c={...defaults,category:'Hero',tower:'Quincy',baseAbilityCooldown:60};const r=calculate(artifacts,{OneMonkeyArmy:'Legendary',PrimarySpecialist:'Rare'},c);near(r.abilityRate,1.25*.85);
 assert.equal(calculate(artifacts,{PrimarySpecialist:'Rare'},c).abilityRate,1);
});
test('ability families retain their tower, category, and path gates',()=>{
 const c={...defaults,baseAbilityCooldown:60};assert.equal(calculate(artifacts,{FullBroadside:'Common'},c).abilityRate,1);
 near(calculate(artifacts,{FullBroadside:'Common'},{...c,tower:'Monkey Buccaneer',category:'Military'}).abilityRate,1.35);
 const wizard=preset('Wizard Monkey','Magic','040');const upgraded=calculate(artifacts,{ImprovedSpelling:'Common'},wizard);near(upgraded.abilityRate,1.15);near(upgraded.rate,.9);
 assert.equal(calculate(artifacts,{ImprovedSpelling:'Common'},{...wizard,upgradePath:'004'}).abilityRate,1);
 assert.equal(calculate(artifacts,{ImprovedSpelling:'Common'},{...wizard,upgradePath:null}).abilityRate,1);
});
test('ability-only artifacts are applicable with a timer and ranked by reduced seconds',()=>{
 const c={...defaults,baseAbilityCooldown:60};const state={context:c,selected:{}};const artifact=artifacts.find(a=>a.id==='InnateAbility');const result=analyzeArtifact(artifact,'Common',state,artifacts);assert.equal(result.applicable,true);assert.equal(result.scores.cooldown,-20);
 const withOne=artifactCandidate(state,artifact,'Common');const row=compareBuilds(artifacts,state,withOne).rows.find(r=>r.key==='abilitySeconds');assert.equal(row.delta,20);
 assert.equal(analyzeArtifact(artifact,'Common',{context:{...c,abilityMode:'none',baseAbilityCooldown:null},selected:{}},artifacts).applicable,false);
});
test('presets import tower upgrades, independently selectable hero abilities, and support abilities',()=>{
 const dart=preset('Dart Monkey','Primary','040');assert.equal(dart.baseAbilityCooldown,50);assert.equal(dart.abilityMode,'preset');
 const quincy=preset('Quincy','Hero');assert.equal(quincy.baseAbilityCooldown,45);const second=applyAbilityPreset(quincy,catalog,'StormOfArrowsAbility');assert.equal(second.baseAbilityCooldown,55);
 const village=preset('Monkey Village','Support','050');assert.equal(village.baseRate,0);assert.equal(village.baseAbilityCooldown,45);assert.equal(village.abilityMode,'preset');
 const first=preset('Quincy','Hero','000',1);assert.equal(first.abilityMode,'none');assert.equal(first.baseAbilityCooldown,null);
});
test('manual ability values survive reload independently of attack preset/manual mode',()=>{
 const source=preset('Dart Monkey','Primary','040');const manual=setManualAbilityCooldown(source,77);
 const restored=restoreTowerContext(sanitizeState({context:manual,selected:{}},artifacts).context,catalog);assert.equal(restored.baseAbilityCooldown,77);assert.equal(restored.statMode,'preset');
 const manualDamage=setManualStat(source,'baseDamage',999);const stale={...manualDamage,baseAbilityCooldown:222};const refreshed=restoreTowerContext(sanitizeState({context:stale},artifacts).context,catalog);assert.equal(refreshed.baseDamage,999);assert.equal(refreshed.baseAbilityCooldown,50);
 const missing=restoreTowerContext({...source,abilityId:'removed',baseAbilityCooldown:77},catalog);assert.equal(missing.baseAbilityCooldown,77);assert.equal(missing.abilityMode,'manual');
 const support=preset('Monkey Village','Support','050');assert.equal(restoreTowerContext({...support,baseAbilityCooldown:999},catalog).baseAbilityCooldown,45);
});
test('legacy unknown timers stay unknown, invalid values are sanitized, and zero timers are rejected',()=>{
 const c=sanitizeState({context:{baseAbilityCooldown:0,abilityMode:'made-up'}},artifacts).context;assert.equal(c.baseAbilityCooldown,null);assert.equal(c.abilityMode,'manual');assert.equal(calculate(artifacts,{},c).abilitySeconds,null);
 assert.equal(sanitizeState({context:{baseAbilityCooldown:99,abilityMode:'none'}},artifacts).context.baseAbilityCooldown,null);
 for(const n of [0,-1,Infinity,NaN])assert.throws(()=>setManualAbilityCooldown(defaults,n));
 const bad=structuredClone(catalog);bad.towers[0].variants['040'].abilities[0].cooldownSeconds=0;assert.throws(()=>validateTowerCatalog(bad),/invalid ability/);
});
test('root timer extraction excludes hidden, passive, disabled, dynamic, and zero-cooldown abilities',()=>{
 const base={$type:'Abilities.AbilityModel, Assembly',modelName:'one',displayName:'Ability',cooldown:60};
 const r=extractAbilities({behaviors:[base,{...base,modelName:'hidden',isHidden:true},{...base,modelName:'passive',IsPassive:true},{...base,modelName:'disabled',enabled:false},{...base,modelName:'zero',cooldown:0},{...base,modelName:'dynamic',cooldownSpeedScale:2}]});assert.equal(r.abilities.length,1);assert.equal(r.abilities[0].cooldownSeconds,60);assert.ok(r.notes.length);
});
test('comparison rows select their own ability and discard main-calculator manual timers',()=>{
 const rows=compareTowerPresets(artifacts,{AbsoluteAbility:'Common'},{...defaults,baseAbilityCooldown:999,abilityId:'RapidShotAbility'},catalog,[{tower:'Quincy',heroLevel:20,abilityId:'StormOfArrowsAbility'},{tower:'Dart Monkey',path:'040'}]);near(rows[0].result.abilitySeconds,44);near(rows[1].result.abilitySeconds,40);assert.equal(rows[0].context.abilityId,'StormOfArrowsAbility');
 assert.throws(()=>compareTowerPresets(artifacts,{},defaults,catalog,[{tower:'Quincy',heroLevel:20,abilityId:'unknown'}]),/unavailable/);
});
test('ability recharge evidence remains description-based even when attack rate uses a verified export',()=>{
 const a=artifacts.find(a=>a.id==='AbsoluteAbility');const evidence=artifactEvidence(a,a.variants[0]);assert.equal(evidence.find(e=>e.label==='Ability recharge rate').status,'Description estimate');assert.equal(evidence.find(e=>e.label==='Attack rate').status,'Verified export cooldown');
 const excluded=calculate(artifacts,{MaliciousMauling:'Common'},{...defaults,tower:'Bomb Shooter',category:'Primary',baseAbilityCooldown:60});assert.equal(excluded.abilitySeconds,60);assert.match(excluded.breakdown[0].excluded.join(' '),/Ability cooldown/);
});

test('a malformed ability rule cannot produce an infinite cooldown estimate',()=>{
 const a={id:'Invalid',name:'Invalid',variants:[{rarity:'Common',params:[]}]};const rules={Invalid:{parameters:{},effects:[{stat:'abilityRate',operation:'multiplier',value:0}]}};
 assert.throws(()=>calculate([a],{Invalid:'Common'},defaults,rules),/must be positive/);
});

test('all hero levels expose every imported timer, with independent manual overrides',()=>{
 for(const hero of catalog.heroes)for(let level=1;level<=20;level++){
  const context=preset(hero.name,'Hero','000',level);
  const timers=getAbilityTimers(context,catalog,.8);
  assert.deepEqual(timers.map(t=>t.id),hero.levels[level].abilities.map(a=>a.id));
  for(const timer of timers)near(timer.seconds,timer.cooldownSeconds*.8);
 }
 const quincy=preset('Quincy','Hero');
 const manual=getAbilityTimers(setManualAbilityCooldown(quincy,100),catalog,.8);
 near(manual.find(t=>t.id==='RapidShotAbility').seconds,80);
 near(manual.find(t=>t.id==='StormOfArrowsAbility').seconds,44);
 const unknown=getAbilityTimers(setManualAbilityCooldown(quincy,null),catalog,.8);
 assert.equal(unknown[0].seconds,null);near(unknown[1].seconds,44);
 const standalone=getAbilityTimers({...quincy,abilityMode:'manual',abilityId:null,baseAbilityCooldown:100},catalog,.8);
 assert.equal(standalone.length,3);near(standalone[2].seconds,80);
});
