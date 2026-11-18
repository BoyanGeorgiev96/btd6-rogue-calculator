import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {calculate,defaults} from '../src/calculator.js';import {analyzeArtifact,sortArtifacts,artifactEvidence} from '../src/artifact-discovery.js';
const artifacts=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url))).artifacts;
const find=id=>artifacts.find(a=>a.id===id);
const state=()=>({context:{...defaults,basePierce:2,baseRange:32},selected:{}});
const analyze=(id,s,rarity='Legendary')=>analyzeArtifact(find(id),rarity,s,artifacts);
test('DPS ranking uses full-build contribution and preserves source order and state',()=>{
 const s=state();const original=structuredClone(s);const a=analyze('SlowerIsHarder',s),b=analyze('OneMonkeyArmy',s);
 assert.ok(a.scores.dps>0);assert.equal(b.scores.dps,-1);const entries=[b,a];assert.equal(sortArtifacts(entries,'dps')[0],a);assert.equal(entries[0],b);assert.deepEqual(s,original);
});
test('applicability respects targets, gates, category conversions, and critical estimate mode',()=>{
 const s=state();assert.equal(analyze('CeramicChunker',s).applicable,false);s.context.targetType='ceramic';assert.equal(analyze('CeramicChunker',s).applicable,true);
 assert.equal(analyze('GrandMagicPrecision',s).applicable,false);s.selected.EssenceOfDreadbloon='Legendary';s.context.tier=4;assert.equal(analyze('GrandMagicPrecision',s).applicable,true);
 s.context={...s.context,category:'Magic',tower:'Super Monkey'};assert.equal(analyze('DivineIntervention',s).applicable,false);s.context.criticalMode='expected';assert.equal(analyze('DivineIntervention',s).applicable,true);
});
test('reference-only and unknown or global-range gains are unranked rather than zero',()=>{
 const s=state();s.context.rangeMode='global';const range=analyze('HawksEye',s);assert.equal(range.scores.range,null);assert.equal(range.applicable,true);
 const reference=artifacts.find(a=>!analyzeArtifact(a,a.variants[0].rarity,s,artifacts).rows.length);const r=analyzeArtifact(reference,reference.variants[0].rarity,s,artifacts);assert.equal(r.applicable,false);assert.equal(r.scores.dps,null);
 const known={...range,multiplierScores:{...range.multiplierScores,range:-1},scores:{...range.scores,range:-1}};assert.equal(sortArtifacts([range,known],'range')[0],known);
});
test('accuracy evidence does not label a whole artifact verified because its rate is verified',()=>{
 const a=find('CriticalSuccess'),v=a.variants[0];const evidence=artifactEvidence(a,v);assert.ok(evidence.some(e=>e.label==='Attack rate'&&e.status==='Verified export cooldown'));assert.ok(evidence.some(e=>e.label==='Critical hits'&&e.status==='Unverified mechanics'));
 const mixed=find('Discord');assert.ok(artifactEvidence(mixed,mixed.variants[0]).some(e=>e.status==='Description estimate'));
 const changed={...v,sourceParams:['999']};assert.equal(artifactEvidence(a,changed).some(e=>e.status==='Verified export cooldown'),false);
});
test('trace ends at exactly the reported DPS with target tags, flat bonuses, multipliers and critical exclusions',()=>{
 for(const targetType of ['bloon','ceramic','moab','boss'])for(const criticalMode of ['off','expected']){
  const c={...defaults,targetType,criticalMode,baseRate:3,baseDamage:2,baseDamageModifiers:[{tags:['Ceramic'],all:false,inverse:false,multiplier:2,additive:5}]};
  const r=calculate(artifacts,{CeramicChunker:'Rare',SlowerIsHarder:'Legendary',CriticalSuccess:'Legendary'},c);
  assert.equal(r.trace.at(-1).after,r.targetDpsValue);assert.equal(r.trace.find(s=>s.label==='Artifact Boss-only bonuses').after,r.targetHit);
  if(targetType==='ceramic')assert.equal(r.trace.find(s=>s.label==='Source Ceramic bonus').after,9);
 }
});
test('MOAB exclusions appear in the trace and cannot acquire flat bonus damage',()=>{
 const r=calculate(artifacts,{}, {...defaults,baseCanHitMoab:false});assert.equal(r.targetDpsValue,0);assert.ok(r.trace.some(s=>s.label.includes('cannot hit')));
});
