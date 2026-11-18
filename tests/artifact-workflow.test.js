import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,defaults,sanitizeState} from '../src/calculator.js';
import {applyTowerPreset,getAbilityTimers,restoreTowerContext} from '../src/tower-stats.js';
import {setManualAbilityDuration} from '../src/ability-timing.js';
import {multiplierMetrics,multiplierScores,compareMultipliers} from '../src/artifact-metrics.js';
import {explainMultiplier} from '../src/multiplier-explanation.js';
import {findUptimeThresholds} from '../src/uptime-finder.js';
import {analyzeArtifact,sortArtifacts} from '../src/artifact-discovery.js';
import {exportBuildReport} from '../src/build-report.js';
import {createSavedBuild,parseLibrary,exportLibrary,snapshot} from '../src/build-tools.js';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));
const artifacts=read('artifacts.json').artifacts,catalog={...read('towers.json'),heroes:read('heroes.json').heroes};
const preset=(tower='Quincy',heroLevel=20)=>applyTowerPreset({...defaults,category:'Hero',tower,heroLevel},catalog);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const subset=ids=>artifacts.filter(a=>ids.includes(a.id)).map(a=>({...a,variants:[a.variants[0]]}));
test('artifact factor rankings survive changes to base stats, unknown timers and pierce',()=>{
 const selected={DivineQuickening:'Common',AbsoluteAbility:'Common'};
 const a=calculate(artifacts,selected,preset());
 const b=calculate(artifacts,selected,{...preset(),baseRate:100,baseDamage:100,baseBossDamage:100,basePierce:null,baseRange:null,baseAbilityCooldown:null});
 multiplierMetrics(a).forEach((m,i)=>near(m.value,multiplierMetrics(b)[i].value));
 const score=multiplierScores(calculate(artifacts,{},preset()),b,{abilityMode:'manual'});assert.ok(score.cooldown>0);
 const state={context:{...defaults,basePierce:null},selected:{}};
 const entries=artifacts.filter(a=>a.id==='GreaterPrimaryInspiration'||a.id==='SwellingSpikes').map(a=>analyzeArtifact(a,a.variants[0].rarity,state,artifacts));
 assert.ok(entries.every(e=>e.multiplierScores.pierce!==null));assert.ok(sortArtifacts(entries,'pierce').length);
 const zero=calculate(artifacts,{}, {...defaults,baseDamage:0,baseRate:0});assert.equal(multiplierMetrics(zero)[0].value,null);
 assert.ok(compareMultipliers(zero,zero).every(m=>m.delta===null||Number.isFinite(m.delta)));
 const global=calculate(artifacts,{}, {...defaults,rangeMode:'global'});assert.equal(multiplierMetrics(global).find(m=>m.key==='range').value,null);
});
test('per-stat explanations include boosts, penalties, conversions, flat bonuses and inactive effects',()=>{
 const state={context:preset(),selected:{DivineQuickening:'Common',AbsoluteAbility:'Common',OneMonkeyArmy:'Legendary',GreaterPrimaryQuickening:'Common'}};
 const speed=explainMultiplier(artifacts,state,'speed');
 near(speed.entries.reduce((v,e)=>v*e.value,1),speed.value);
 assert.ok(speed.entries.find(e=>e.id==='AbsoluteAbility').value<1);
 assert.ok(speed.entries.find(e=>e.id==='GreaterPrimaryQuickening').value>1);
 assert.ok(speed.entries.find(e=>e.id==='OneMonkeyArmy').conversion);
 const cooldown=explainMultiplier(artifacts,state,'ability');near(cooldown.entries.reduce((v,e)=>v*e.value,1),cooldown.value);
 const ceramic={context:{...defaults,targetType:'ceramic'},selected:{CeramicChunker:'Common'}};
 const dps=explainMultiplier(artifacts,ceramic,'dps');assert.equal(dps.contextual,true);assert.equal(dps.entries[0].before,1);assert.ok(dps.entries[0].after>1);
 const inactive=explainMultiplier(artifacts,{context:preset(),selected:{GrandMagicPrecision:'Common'}},'speed');assert.equal(inactive.entries[0].value,1);
});
test('uptime search finds a required pair and reports its attack-speed penalty without changing the build',()=>{
 const input={context:setManualAbilityDuration(preset(),'RapidShotAbility',35),selected:{}},original=structuredClone(input);
 const choices=subset(['AbsoluteAbility','DivineQuickening']);
 const single=findUptimeThresholds(choices,input,catalog,'RapidShotAbility',{maxChanges:1});assert.equal(single.matches.length,0);assert.equal(single.tested,2);
 const pair=findUptimeThresholds(choices,input,catalog,'RapidShotAbility',{maxChanges:2});assert.equal(pair.matches.length,1);assert.equal(pair.tested,3);assert.equal(pair.matches[0].changes.length,2);assert.equal(pair.matches[0].timer.gapSeconds,0);
 assert.ok(pair.matches[0].result.breakdown.find(b=>b.id==='AbsoluteAbility').rate<1);
 assert.deepEqual(input,original);
});
test('uptime candidates include category conversions and replace owned rarities without stacking copies',()=>{
 const choices=subset(['OneMonkeyArmy','GreaterPrimaryQuickening']);
 const input={context:setManualAbilityDuration(preset(),'RapidShotAbility',42),selected:{GreaterPrimaryQuickening:'Common'}};
 const result=findUptimeThresholds(choices,input,catalog,'RapidShotAbility',{maxChanges:1});assert.equal(result.matches[0].changes[0].id,'OneMonkeyArmy');
 const absolute=artifacts.find(a=>a.id==='AbsoluteAbility');
 const upgraded=findUptimeThresholds([absolute],{context:setManualAbilityDuration(preset(),'RapidShotAbility',33),selected:{AbsoluteAbility:'Common'}},catalog,'RapidShotAbility',{maxChanges:2});
 assert.ok(upgraded.matches.length);assert.ok(upgraded.matches.every(row=>row.changes.length===1&&row.changes[0].previous==='Common'));
 assert.ok(upgraded.matches.every(row=>Object.keys(row.state.selected).length===1));
});
test('unknown or restricted timing suppresses uptime searches, and existing zero gaps are explicit',()=>{
 const unknown={context:{...defaults,baseAbilityCooldown:60},selected:{}};
 assert.equal(findUptimeThresholds(artifacts,unknown,catalog,null).tested,0);
 const restricted={context:setManualAbilityDuration(preset('Benjamin'),'Biohack',100),selected:{}};
 const timer=getAbilityTimers(restricted.context,catalog,1).find(t=>t.name==='Biohack');assert.equal(timer.gapSeconds,null);
 assert.equal(findUptimeThresholds(artifacts,restricted,catalog,timer.id).tested,0);
 const covered={context:setManualAbilityDuration(preset(),'RapidShotAbility',50),selected:{}};
 assert.match(findUptimeThresholds(artifacts,covered,catalog,'RapidShotAbility').reason,/already/);
 assert.throws(()=>findUptimeThresholds(artifacts,covered,catalog,'RapidShotAbility',{maxChanges:3}));
});
test('manual durations round-trip through collections, shared state and source restoration; reset restores source',()=>{
 const context=setManualAbilityDuration(preset(),'RapidShotAbility',25),state={context,selected:{}};
 const saved=createSavedBuild('Manual duration',state,artifacts,{},'duration-test');
 const restored=snapshot(parseLibrary(exportLibrary([saved]),artifacts)[0].state,artifacts,catalog);
 assert.equal(getAbilityTimers(restored.context,catalog,1)[0].durationSeconds,25);
 assert.equal(getAbilityTimers(restored.context,catalog,1)[1].durationSeconds,3);
 const shared=JSON.parse(JSON.stringify(state));const clean=restoreTowerContext(sanitizeState(shared,artifacts).context,catalog);
 assert.equal(getAbilityTimers(clean,catalog,1)[0].durationManual,true);
 assert.equal(getAbilityTimers(setManualAbilityDuration(clean,'RapidShotAbility',null),catalog,1)[0].durationSeconds,12);
 assert.equal(getAbilityTimers(applyTowerPreset({...clean,tower:'Captain Churchill'},catalog),catalog,1)[0].durationSeconds,17.5);
 for(const value of [0,-1,NaN,Infinity,1e10])assert.throws(()=>setManualAbilityDuration(context,'RapidShotAbility',value));
 const invalid=sanitizeState({context:{durationOverrides:{'Quincy::RapidShotAbility':-1,'Quincy::other':Infinity,'no-scope':2}}},artifacts);assert.deepEqual(invalid.context.durationOverrides,{});
});
test('Churchill frame-based durations follow levels and reports include every ability with manual provenance',()=>{
 const low=getAbilityTimers(preset('Captain Churchill',3),catalog,1);near(low[0].durationSeconds,9);
 const high=getAbilityTimers(preset('Captain Churchill'),catalog,1);near(high[0].durationSeconds,17.5);near(high[1].durationSeconds,8.8);
 const output=exportBuildReport({state:{context:setManualAbilityDuration(preset(),'RapidShotAbility',50),selected:{}},artifacts,towerCatalog:catalog,artifactVersion:'57'});
 assert.ok(output.indexOf('## Artifact multipliers')<output.indexOf('## Estimated stats'));
 assert.match(output,/## All ability timings/);assert.match(output,/Rapid Shot/);assert.match(output,/Storm of Arrows/);assert.match(output,/manual override/);assert.match(output,/potential continuous uptime/);
});

test('manual durations cannot bypass explicit restrictions even on a known-duration source',()=>{
 const copy=structuredClone(catalog);copy.heroes.find(h=>h.name==='Quincy').levels['20'].abilities[0].timingRestricted=true;
 const context=setManualAbilityDuration(preset(),'RapidShotAbility',100);
 assert.equal(getAbilityTimers(context,copy,1)[0].gapSeconds,null);
});
