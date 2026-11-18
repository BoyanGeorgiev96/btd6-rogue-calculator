import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{defaults,supported}from'../src/calculator.js';import{compareArtifactOffers,bestOfferIndices}from'../src/artifact-offers.js';
const artifacts=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url))).artifacts;
const state=()=>({context:{...defaults,basePierce:2,baseRange:32,baseAbilityCooldown:60},selected:{}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('offers compare one candidate at a time without changing the original or combining offers',()=>{
 const s=state(),original=structuredClone(s);const r=compareArtifactOffers(artifacts,s,[{id:'SlowerIsHarder',rarity:'Legendary'},{id:'AbsoluteAbility',rarity:'Common'}]);
 assert.deepEqual(s,original);near(r.choices[0].result.targetDpsValue,1.3);near(r.choices[1].result.targetDpsValue,1/1.1);assert.deepEqual(bestOfferIndices(r,'dps'),[0]);assert.deepEqual(bestOfferIndices(r,'cooldown'),[1]);
 r.choices[0].state.context.baseDamage=999;assert.deepEqual(s,original);
});
test('an owned artifact replaces its rarity rather than stacking duplicate copies',()=>{
 const s=state();s.selected.SlowerIsHarder='Common';const r=compareArtifactOffers(artifacts,s,[{id:'SlowerIsHarder',rarity:'Legendary'},{id:'SlowerIsHarder',rarity:'Common'}]);
 assert.equal(r.choices[0].change,'replace');assert.equal(r.choices[0].previous,'Common');near(r.choices[0].result.hit,1.3);assert.equal(r.choices[1].change,'same');near(r.choices[1].scores.dps,0);
});
test('category conversions recalculate other owned artifacts and preserve manual ability values',()=>{
 const s=state();Object.assign(s.context,{category:'Hero',tower:'Quincy',abilityMode:'manual',baseAbilityCooldown:77});s.selected.GreaterPrimaryPrecision='Legendary';
 const r=compareArtifactOffers(artifacts,s,[{id:'OneMonkeyArmy',rarity:'Legendary'}]);assert.ok(r.choices[0].result.breakdown.find(b=>b.id==='GreaterPrimaryPrecision').active);assert.equal(r.choices[0].state.context.baseAbilityCooldown,77);assert.equal(r.choices[0].state.context.abilityMode,'manual');
});
test('unknown timers and global range do not become zero gains; reference offers are not ranked',()=>{
 const s=state();s.context.baseAbilityCooldown=null;s.context.rangeMode='global';const reference=artifacts.find(a=>!supported.has(a.id));const r=compareArtifactOffers(artifacts,s,[{id:'AbsoluteAbility',rarity:'Common'},{id:'HawksEye',rarity:'Common'},{id:reference.id,rarity:reference.variants[0].rarity}]);
 assert.equal(r.choices[0].scores.cooldown,null);assert.equal(r.choices[1].scores.range,null);assert.equal(r.choices[2].scores.dps,null);assert.match(r.choices[2].warnings.join(' '),/not ranked/);assert.deepEqual(bestOfferIndices(r,'range'),[]);
});
test('ties are explicit, losses are not labeled best, and zero baseline comparisons stay finite',()=>{
 const s=state();const offers=[{id:'SlowerIsHarder',rarity:'Legendary'},{id:'SlowerIsHarder',rarity:'Legendary'}];assert.deepEqual(bestOfferIndices(compareArtifactOffers(artifacts,s,offers),'dps'),[0,1]);
 const loss=compareArtifactOffers(artifacts,s,[{id:'AbsoluteAbility',rarity:'Common'}]);assert.deepEqual(bestOfferIndices(loss,'dps'),[]);
 s.selected.OneMonkeyArmy='Legendary';const zero=compareArtifactOffers(artifacts,s,offers);assert.equal(zero.baseline.targetDpsValue,0);assert.equal(zero.choices[0].scores.dps,0);assert.deepEqual(bestOfferIndices(zero,'dps'),[]);
});
test('critical interaction warnings follow each candidate and invalid offers fail',()=>{
 const s=state();Object.assign(s.context,{category:'Hero',tower:'Adora',criticalMode:'expected'});s.selected.OneMonkeyArmy='Legendary';s.selected.CriticalSuccess='Rare';
 const r=compareArtifactOffers(artifacts,s,[{id:'DivineIntervention',rarity:'Legendary'}]);assert.match(r.choices[0].warnings.join(' '),/Multiple critical/);assert.equal(r.choices[0].result.criticalMultiplier,1);
 for(const offers of [[{id:'fake',rarity:'Rare'}],[{id:'OneMonkeyArmy',rarity:'Common'}],Array(4).fill({id:'SlowerIsHarder',rarity:'Common'})])assert.throws(()=>compareArtifactOffers(artifacts,state(),offers));
 assert.throws(()=>bestOfferIndices(r,'price'));assert.equal(compareArtifactOffers(artifacts,state(),[]).choices.length,0);
});

test('a tiny positive gain never makes a neutral offer look positive',()=>{assert.deepEqual(bestOfferIndices({choices:[{scores:{dps:1e-12}},{scores:{dps:0}},{scores:{dps:null}}]},'dps'),[0]);});
