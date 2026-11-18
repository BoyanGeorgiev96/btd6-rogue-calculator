import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {powerRoster} from '../src/power-roster.js';
import {importPowerModel} from '../scripts/power-import.mjs';
import {applyTowerPreset,getPresetVariant,getPresetSourceUrl,getAbilityTimers,restoreTowerContext,setManualStat,validatePowerCatalog} from '../src/tower-stats.js';
import {calculate,defaults,sanitizeState} from '../src/calculator.js';
import {snapshot,createSavedBuild,exportLibrary,parseLibrary,artifactCandidate} from '../src/build-tools.js';
import {createBuildHistory} from '../src/build-history.js';
import {compareTowerPresets} from '../src/tower-comparison.js';
import {compareUpgrades} from '../src/upgrade-comparison.js';
import {compareParty} from '../src/party-overview.js';
import {findSynergies} from '../src/synergy-finder.js';
import {exportBuildReport} from '../src/build-report.js';
import {setManualAbilityDuration} from '../src/ability-timing.js';
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url)));
const powers=read('data/powers.json'),catalog={...read('data/towers.json'),heroes:read('data/heroes.json').heroes,powers:powers.powers};
const artifacts=read('data/artifacts.json').artifacts,fixtures=read('tests/fixtures/power-models.json').models;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const preset=(tower='Battle Cat',path='000',componentId=null)=>applyTowerPreset({...defaults,category:'Powers',tower},catalog,path,componentId);
const calc=(context,selected={})=>calculate(artifacts,selected,context);

test('reviewed power models reproduce the bundled presets and reject unreviewed identities or paths',()=>{
 validatePowerCatalog(powers);
 assert.deepEqual(powers.source,catalog.source);
 for(const [file,raw] of Object.entries(fixtures)){
  const power=powerRoster.find(p=>p.id===(raw.tower??raw).baseId);
  const {path,...variant}=importPowerModel(raw,power);
  const {sourcePath,...bundled}=powers.powers.find(p=>p.id===power.id).variants[path];
  assert.deepEqual(variant,bundled,file);
 }
 const invalid=structuredClone(powers);invalid.powers[0].variants['400']=invalid.powers[0].variants['000'];assert.throws(()=>validatePowerCatalog(invalid));
 assert.throws(()=>preset('Super Monkey Beacon','220'),/available power/);
 assert.throws(()=>importPowerModel({...fixtures['Powers__CaveMonkey.json'],tower:{baseId:'CaveMonkey',towerSet:8}},powerRoster[1]),/Unexpected power/);
 const context=sanitizeState({context:{category:'Powers',tower:'Battle Cat',upgradePath:'400',tier:4}},artifacts).context;
 assert.equal(context.upgradePath,'000');assert.equal(context.tier,0);
});
test('normal and transformed Battle Cat attacks stay independent, and Cave Monkey uses its reviewed cadence',()=>{
 const normal=preset(),variant=getPresetVariant(catalog,normal);
 assert.equal(normal.baseDamage,2);near(normal.baseRate,1);assert.equal(normal.basePierce,20);
 const transformed=preset('Battle Cat','000',variant.components[1].id);
 assert.equal(transformed.baseDamage,20);assert.equal(calc(transformed).targetDpsValue,20);
 assert.match(variant.components[1].notes.join(' '),/4 rounds/);
 assert.equal(transformed.baseAbilityCooldown,null);assert.deepEqual(getAbilityTimers(transformed,catalog,1),[]);
 const cave=preset('Cave Monkey');assert.equal(cave.baseDamage,1);near(cave.baseRate,1/1.1);assert.equal(cave.basePierce,5);
 assert.match(getPresetSourceUrl(catalog,cave),/Powers\/CaveMonkey.json$/);
});
test('Divine artifacts affect Powers without making them heroes; Power Nexus grants Support and chains class conversions',()=>{
 for(const power of powerRoster)for(const rarity of ['Common','Rare','Legendary']){
  const c=preset(power.name,power.id==='SuperMonkeyBeacon'?'030':'000');
  const variant=id=>artifacts.find(a=>a.id===id).variants.find(v=>v.rarity===rarity);
  const divine=calc(c,{DivinePrecision:rarity,DivineQuickening:rarity,DivineInspiration:rarity});
  near(divine.damage,1+variant('DivinePrecision').params[0]/100);
  near(divine.pierce,1+variant('DivineInspiration').params[0]/100);
  near(divine.range,1+variant('DivineInspiration').params[1]/100);
  const index=['Common','Rare','Legendary'].indexOf(rarity);
  near(divine.rate,1/[.92,.9,.85][index]);
  near(divine.abilityCooldown,1/(1+variant('DivineQuickening').params[0]/100));
  const selected={PowerNexus:rarity,MasterOfAllTrades:'Rare',Conscription:'Rare',GrandMagicPrecision:'Common',OneMonkeyArmy:'Legendary'};
  const r=calc(c,selected);near(r.damage,(1+variant('PowerNexus').params[1]/100)*1.16);
  near(r.rate,1/[.9,.85,.75][index]);near(r.range,.85*.85);
  near(calculate([...artifacts].reverse(),selected,c).targetDpsValue,r.targetDpsValue);
 }
 assert.equal(calc(preset(),{HeroicSpecialty:'Rare',EssenceOfDreadbloon:'Legendary',SpiritOfAdventure:'Rare',GreaterPrimaryPrecision:'Common'}).damage,1);
 assert.equal(calc(preset(),{FirstClassSupportPrecision:'Common'}).damage,1);
 assert.equal(calc(preset(),{HeroicEdge:'Common'}).pierce,1);
 near(calc(preset(),{PowerNexus:'Common',HeroicEdge:'Common'}).pierce,1.1);
 assert.equal(calc({...defaults,category:'Hero',tower:'Quincy'},{HeroicEdge:'Common'}).pierce,1);
 near(calc({...defaults,category:'Hero',tower:'Quincy'},{HeroicSpecialty:'Rare',HeroicEdge:'Common'}).pierce,1.1);
 near(calc(preset(),{PowerNexus:'Common',FirstClassSupportPrecision:'Common'}).damage,1.5*1.16);
 assert.equal(calc({...defaults,category:'Support',tower:'Engineer Monkey'},{PowerNexus:'Rare'}).damage,1);
 const synergy=findSynergies(artifacts,{context:preset(),selected:{FirstClassSupportPrecision:'Common'}},'PowerNexus');
 assert.ok(synergy.added.includes('Support'));
 const tierFour=findSynergies(artifacts,{context:{...defaults,tier:4},selected:{GrandMagicPrecision:'Common'}},'EssenceOfDreadbloon');
 assert.ok(tierFour.beneficiaries.every(actor=>actor.category!=='Powers'));
});
test('Beacon presets expose ten legal paths, storm cooldowns and only the 0-3-0 repeatable attack',()=>{
 for(const path of powerRoster[2].paths){
  const c=preset('Super Monkey Beacon',path);
  assert.equal(c.statMode,'preset');assert.equal(c.baseAbilityCooldown,path==='010'?60:['020','030'].includes(path)?45:120);
  assert.equal(getAbilityTimers(c,catalog,1)[0].gapSeconds,null);
  if(path==='030'){assert.equal(c.baseDamage,1);near(c.baseRate,1/.045);assert.equal(c.basePierce,2);assert.equal(c.baseRange,60);}
  else{assert.equal(c.baseDamage,0);assert.equal(c.baseRate,0);assert.equal(calc(c,{PowerNexus:'Legendary'}).targetDpsMultiplier,null);}
 }
 const c=preset('Super Monkey Beacon','030'),state={context:c,selected:{PowerNexus:'Common',DivineQuickening:'Common'}};
 const manualDuration=setManualAbilityDuration(c,c.abilityId,999);
 const timer=getAbilityTimers(manualDuration,catalog,.001)[0];assert.equal(timer.durationManual,true);assert.equal(timer.gapSeconds,null);
 near(calc(c,state.selected).abilitySeconds,45/1.08);
 const upgrades=compareUpgrades(artifacts,state,catalog);assert.equal(upgrades.rows.length,10);
 assert.throws(()=>compareUpgrades(artifacts,state,catalog,{referencePath:'220'}),/available/);
 const rows=compareTowerPresets(artifacts,state.selected,c,catalog,[{tower:'Super Monkey Beacon',path:'030'},{tower:'Cave Monkey',path:'000'}]);
 assert.equal(rows[0].result.targetDpsValue,calc(c,state.selected).targetDpsValue);assert.equal(rows[1].context.category,'Powers');
 assert.throws(()=>compareTowerPresets(artifacts,{},c,catalog,[{tower:'Super Monkey Beacon',path:'220'}]),/available/);
});
test('power identity, transformed component and manual stats survive build transfer, history, comparisons and reports',()=>{
 const base=preset(),component=getPresetVariant(catalog,base).components[1].id;
 const context=preset('Battle Cat','000',component),state={context,selected:{PowerNexus:'Rare'}};
 const saved=createSavedBuild('Cat',state,artifacts,{},'cat');
 const loaded=parseLibrary(exportLibrary([saved]),artifacts)[0];
 assert.deepEqual(snapshot(loaded.state,artifacts,catalog),state);
 assert.deepEqual(restoreTowerContext(sanitizeState(JSON.parse(JSON.stringify(state)),artifacts).context,catalog),context);
 const history=createBuildHistory(state),candidate=artifactCandidate(state,artifacts.find(a=>a.id==='PowerNexus'),'Legendary');
 history.record(candidate);assert.deepEqual(history.undo(),state);assert.deepEqual(history.redo(),candidate);
 const manual=setManualStat(context,'baseDamage',77);assert.equal(snapshot({context:manual,selected:{}},artifacts,catalog).context.baseDamage,77);
 const party=compareParty(artifacts,state,[loaded],catalog);assert.equal(party[0].context.componentId,component);near(party[0].result.targetHit,40);
 const report=exportBuildReport({state,artifacts,towerCatalog:catalog,artifactVersion:57});assert.match(report,/Transformed Battle Cat/);assert.match(report,/4 rounds/);assert.match(report,/Powers\/BattleCat.json/);
 const beacon=preset('Super Monkey Beacon');assert.deepEqual(restoreTowerContext(sanitizeState({context:beacon},artifacts).context,catalog),beacon);
});
