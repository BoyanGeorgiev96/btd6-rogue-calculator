import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {calculate,defaults,sanitizeState,supported,towers} from '../src/calculator.js';
import {heroRoster} from '../src/hero-roster.js';
import {artifactRules} from '../src/artifact-rules.js';import {artifactCoverage} from '../src/artifact-coverage.js';import {explainMultiplier} from '../src/multiplier-explanation.js';
import {findSynergies} from '../src/synergy-finder.js';import {applyTowerPreset} from '../src/tower-stats.js';
import {planConditions,runPlanSnapshot,parseRunPlan} from '../src/run-plan-storage.js';import {compareParty} from '../src/party-overview.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const data=read('data/artifacts.json'),artifacts=data.artifacts,catalog=read('data/towers.json'),audit=read('docs/artifact-calculation-audit.json');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const ctx=(category='Military',tower='Sniper Monkey')=>({...defaults,category,tower,baseDamage:20,baseBossDamage:25,baseRange:50,basePierce:2,baseRate:1,tier:4,upgradePath:'400'});
const calc=(selected,c=ctx())=>calculate(artifacts,selected,c);

test('all 117 artifact/rarity descriptions and rules have an explicit reviewed audit outcome',()=>{
 assert.equal(audit.artifacts.length,117);assert.equal(supported.size,80);
 assert.deepEqual(audit.artifacts.map(a=>a.id).sort(),artifacts.map(a=>a.id).sort());
 for(const a of artifacts){const row=audit.artifacts.find(r=>r.id===a.id);assert.deepEqual(row.rarities,a.variants.map(v=>v.rarity));assert.equal(row.descriptionSha256,createHash('sha256').update(JSON.stringify(a.variants.map(v=>({rarity:v.rarity,description:v.description})))).digest('hex'));
  assert.equal(row.status,supported.has(a.id)?'modeled':'reference-only');if(supported.has(a.id)){const r=artifactRules[a.id];assert.deepEqual(row.effects,[...new Set([...r.effects.map(e=>e.stat),...(r.categories?.length?['conversion']:[]),...(r.critical?['critical']:[])])]);}if(!supported.has(a.id)){assert.ok(row.reason.length>20);assert.ok(artifactCoverage([a]).every(r=>r.detail===row.reason));}}
 assert.equal(audit.reviewedSources.length,23);
 for(const r of audit.reviewedSources)assert.match(r.blob,/^[a-f0-9]{40}$/);
});
test('class conversions apply all rarities, range reductions and original-base-tower penalties independently of order',()=>{
 const pairs=[['Unification','Primary','Dart Monkey'],['Conscription','Military','Sniper Monkey'],['MonkeyAcademy','Magic','Wizard Monkey'],['MasterOfAllTrades','Support','Engineer Monkey']];
 for(const [id,own,tower] of pairs)for(const v of artifacts.find(a=>a.id===id).variants){
  const selected={[id]:v.rarity,GreaterPrimaryPrecision:'Common',EliteMilitaryPrecision:'Common',GrandMagicPrecision:'Common',FirstClassSupportPrecision:'Common'};
  const c=ctx(own,tower),r=calc(selected,c);near(r.damage,1.16**4);near(r.range,1-v.params[0]/100);
  const other=own==='Primary'?ctx('Military'):ctx('Primary','Dart Monkey');near(calc({[id]:v.rarity},other).damage,1-v.params[1]/100);
  const reversed=calculate([...artifacts].reverse(),selected,c);near(reversed.targetDpsValue,r.targetDpsValue);near(reversed.damage,r.damage);near(reversed.range,r.range);
 }
 const stacked=calc({Conscription:'Rare',MonkeyAcademy:'Rare',EssenceOfDreadbloon:'Legendary'},ctx());
 near(stacked.damage,.5);near(stacked.range,.85*.85); // identity-selected damage penalty remains after conversion
 const hero={...ctx('Hero','Captain Churchill'),heroLevel:10,tier:0,upgradePath:null};
 const selected={HeroicSpecialty:'Rare',Conscription:'Rare',GrandMagicPrecision:'Common'};
 near(calc(selected,hero).damage,1.16);near(calc(selected,hero).range,.85);
 assert.equal(calc({Conscription:'Rare'},hero).damage,1); // pinned penalty towerTypes excludes heroes
 const synergy=findSynergies(artifacts,{context:hero,selected:{HeroicSpecialty:'Rare',GrandMagicPrecision:'Common'}},'Conscription');
 assert.ok(synergy.added.includes('Magic'));assert.deepEqual(synergy.reasons,[]);
 assert.equal(calc({Conscription:'Rare',OneMonkeyArmy:'Legendary'}).targetDpsValue,0);
});
test('Dreadbloon does not exempt a tier-4 Wizard from Conscription or penalize a Sniper’s damage',()=>{
 const selected={EssenceOfDreadbloon:'Legendary',Conscription:'Rare',EliteMilitaryPrecision:'Common'};
 for(const [category,tower,penalty] of [['Military','Sniper Monkey',1],['Magic','Wizard Monkey',.5]]){
  const context=ctx(category,tower),r=calc(selected,context);
  near(r.damage,penalty*1.16);near(r.targetDpsMultiplier,penalty*1.16);near(r.range,.85);
  const conscription=r.breakdown.find(b=>b.id==='Conscription');
  near(conscription.damage,penalty);
  assert.ok(conscription.addedCategories.includes('Military'));
  const without=calc({EssenceOfDreadbloon:'Legendary',EliteMilitaryPrecision:'Common'},context);
  near(r.targetHit/without.targetHit,penalty);
  near(calculate([...artifacts].reverse(),selected,context).targetDpsValue,r.targetDpsValue);
 }
});
test('all class-converter damage penalties retain every base tower’s original identity after Dreadbloon',()=>{
 for(const [id,own] of [['Unification','Primary'],['Conscription','Military'],['MonkeyAcademy','Magic'],['MasterOfAllTrades','Support']]){
  for(const variant of artifacts.find(a=>a.id===id).variants){
   for(const category of ['Primary','Military','Magic','Support'])for(const tower of towers[category]){
    const context=ctx(category,tower);
    const selected={EssenceOfDreadbloon:'Legendary',[id]:variant.rarity};
    const expected=category===own?1:1-variant.params[1]/100;
    const r=calc(selected,context);
    near(r.damage,expected);near(r.targetDpsMultiplier,expected);
    near(r.range,1-variant.params[0]/100);
   }
  }
 }
});
test('hero affinities and Dreadbloon activate category effects without acquiring fixed base-tower damage penalties',()=>{
 for(const hero of heroRoster){
  const context={...ctx('Hero',hero.name),tier:0,upgradePath:null,heroLevel:10};
  const affinity={HeroicSpecialty:'Rare',Conscription:'Rare',EliteMilitaryPrecision:'Common'};
  const r=calc(affinity,context),military=hero.affinity==='Military';
  near(r.damage,military?1.16:1);near(r.range,military?.85:1);
  for(const id of ['Unification','Conscription','MonkeyAcademy','MasterOfAllTrades']){
   for(const variant of artifacts.find(a=>a.id===id).variants){
    const all=calc({HeroicSpecialty:'Rare',EssenceOfDreadbloon:'Legendary',[id]:variant.rarity},{...context,heroLevel:15});
    near(all.damage,1);near(all.targetDpsMultiplier,1);
    near(all.range,1-variant.params[0]/100);
   }
  }
 }
});
test('Phayze target damage is gated separately from detection, and Intelligence Agent applies a conditional source cooldown',()=>{
 for(const [c,expected] of [[{...ctx(),tier:3,camo:true},1],[{...ctx(),tier:4,camo:false},1],[{...ctx(),camo:true},3],[{...ctx('Hero','Quincy'),heroLevel:14,camo:true},1],[{...ctx('Hero','Quincy'),heroLevel:15,camo:true},3]])near(calc({EssenceOfPhayze:'Legendary'},c).targetDpsMultiplier,expected);
 assert.ok(artifactRules.EssenceOfPhayze.excluded.some(e=>e.includes('detection')));
 near(calc({IntelligenceAgent:'Common'},{...ctx(),aura:true}).rate,1/1.5);near(calc({IntelligenceAgent:'Rare'},{...ctx(),aura:true}).rate,1/1.4);assert.equal(calc({IntelligenceAgent:'Common'}).rate,1);
});
test('partial effects calculate only reviewed ordinary stats and warn about missing growth/density benefits',()=>{
 const druid=calc({GrowingSteady:'Legendary'},ctx('Magic','Druid'));near(druid.rate,1/1.2);assert.equal(druid.damage,1);assert.match(druid.warnings.join(' '),/round-dependent damage growth is excluded/);
 const glue={...ctx('Primary','Glue Gunner'),baseDamage:0,baseBossDamage:0};const r=calc({HighImpactGlue:'Rare'},glue);assert.equal(r.targetHit,3);assert.equal(r.targetDpsMultiplier,null);assert.match(r.warnings.join(' '),/density-dependent/);
 assert.equal(calc({HighImpactGlue:'Rare'},ctx()).targetHit,25);
});
test('Rubber Bullets replaces and caps ordinary damage, without enabling unknown crits or bypassing excluded targets',()=>{
 const c={...ctx(),targetType:'ceramic',baseDamageModifiers:[{tags:['Moabs'],multiplier:1,additive:5,all:false,inverse:false}]};
 const selected={RubberBullets:'Rare',SlowerIsHarder:'Legendary',OneShot:'Legendary'};
 const r=calc(selected,{...c,criticalMode:'expected'});assert.equal(r.hit,1);assert.equal(r.bossHit,1);assert.equal(r.targetHit,1);assert.equal(r.expectedTargetHit,1);near(r.damage,1/20);near(r.breakdown.find(b=>b.id==='RubberBullets').bossHitMultiplier,1/25);assert.equal(r.criticalMultiplier,1);assert.ok(r.warnings.some(w=>w.includes('critical interactions')));
 assert.equal(calc({RubberBullets:'Rare'},{...c,tier:3}).hit,20);
 assert.equal(calc(selected,{...c,targetType:'boss',baseCanHitMoab:false}).targetHit,0);
 assert.equal(calc({...selected,OneMonkeyArmy:'Legendary'},c).targetHit,0);
 assert.equal(calc(selected,{...c,baseDamageExcluded:true}).targetHit,0);
 const explanation=explainMultiplier(artifacts,{context:c,selected},'damage');assert.equal(explanation.contextual,true);assert.ok(explanation.entries.every(e=>'before'in e&&'after'in e));
});
test('Too Many Cooks uses explicit other-provider count, preserves it in plans and parties, and defaults old transfers to zero',()=>{
 const c={...ctx(),otherMilitaryCount:3};near(calc({TooManyCooks:'Common'},c).rate,1/.85/(1.05**3));
 assert.equal(calc({TooManyCooks:'Common'},{...c,category:'Primary',tower:'Dart Monkey'}).rate,1);
 const clean=sanitizeState({context:c},artifacts).context;assert.equal(clean.otherMilitaryCount,3);
 assert.equal(sanitizeState({context:{otherMilitaryCount:16}},artifacts).context.otherMilitaryCount,0);
 const setup={tower:'Sniper Monkey',selected:{TooManyCooks:'Common'},stages:[{path:'000'},{path:'300'},{path:'400'}]};
 const s=runPlanSnapshot(artifacts,catalog,c,setup,{},57);assert.equal(parseRunPlan(JSON.stringify(s),artifacts,catalog,57).snapshot.context.otherMilitaryCount,3);
 delete s.context.otherMilitaryCount;assert.equal(parseRunPlan(JSON.stringify(s),artifacts,catalog,57).snapshot.context.otherMilitaryCount,0);
 const current={context:c,selected:{TooManyCooks:'Common'}};
 const party=compareParty(artifacts,current,[{id:'s',name:'s',state:{context:applyTowerPreset(ctx(),catalog),selected:{}}}],catalog);
 assert.equal(party[0].context.otherMilitaryCount,3);near(party[0].result.rate,calc(current.selected,c).rate);
});
