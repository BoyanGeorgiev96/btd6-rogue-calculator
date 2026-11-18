import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,calculate} from '../src/calculator.js';
import {createRunPlan,inspectPlanOffer,suggestPlanOffers,planConversionPairs} from '../src/run-planner.js';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));
const artifacts=read('artifacts.json').artifacts;
const catalog={...read('towers.json'),heroes:read('heroes.json').heroes};
const setup={tower:'Dart Monkey',stages:[{path:'000'},{path:'300'},{path:'500'}],selected:{}};
const plan=(options={},context={})=>createRunPlan(artifacts,catalog,{...defaults,...context},{...setup,...options});

test('setup uses independent source snapshots, legal progression, and the chosen starting loadout',()=>{
  const context={...defaults,baseDamage:999,baseRate:999,baseAbilityCooldown:999,abilityMode:'manual',targetType:'ceramic',camo:true,fortified:true,aura:true};
  const input={...setup,selected:{CeramicChunker:'Rare'}};
  const original=structuredClone({context,input});
  const p=createRunPlan(artifacts,catalog,context,input);
  assert.equal(p.stages[0].context.baseDamage,1);
  assert.equal(p.stages[0].result.targetHit,7);
  for(const stage of p.stages){
    assert.equal(stage.context.camo,true);assert.equal(stage.context.fortified,true);assert.equal(stage.context.aura,true);
    assert.notEqual(stage.context.baseAbilityCooldown,999);
    assert.equal(stage.result.targetDpsValue,calculate(artifacts,input.selected,stage.context).targetDpsValue);
  }
  p.stages[0].context.baseDamageModifiers.push({});p.selected.CeramicChunker='Common';
  assert.deepEqual({context,input},original);
});

test('invalid identities, nonmonotonic paths, missing components, and bad loadouts fail explicitly',()=>{
  for(const options of [{tower:'Quincy'},{stages:[]},{stages:[{path:'000'},{path:'555'},{path:'500'}]},
    {stages:[{path:'200'},{path:'030'},{path:'050'}]}, {stages:[{path:'000',componentId:'fake'},{path:'300'},{path:'500'}]},
    {stages:[{path:'000',abilityId:'fake'},{path:'300'},{path:'500'}]}, {selected:{fake:'Common'}}, {selected:{OneMonkeyArmy:'Common'}}]) assert.throws(()=>plan(options));
  assert.doesNotThrow(()=>plan({stages:[{path:'000'},{path:'000'},{path:'000'}]}));
});

test('tier gates defer modeled benefits, replacement never stacks, and choices are independent',()=>{
  const p=plan({tower:'Ninja Monkey',stages:[{path:'000'},{path:'200'},{path:'300'}]});const original=structuredClone(p);
  const offer={id:'SwiftestToBusiness',rarity:'Common'};
  const inspected=inspectPlanOffer(artifacts,p,offer);
  assert.equal(inspected.firstBenefit,2);
  assert.match(inspected.stages[0].advice,/Defer.*Late/);
  assert.equal(inspected.stages[2].advice,'Consider if offered');
  for(const stage of inspected.stages) assert.equal(stage.result.targetDpsValue,calculate(artifacts,{[offer.id]:offer.rarity},stage.context).targetDpsValue);
  assert.deepEqual(p,original);
  const owned=plan({selected:{SlowerIsHarder:'Common'}});
  const replace=inspectPlanOffer(artifacts,owned,{id:'SlowerIsHarder',rarity:'Rare'});
  assert.equal(replace.previous,'Common');
  assert.equal(replace.stages[0].result.targetDpsValue,calculate(artifacts,{SlowerIsHarder:'Rare'},owned.stages[0].context).targetDpsValue);
  const same=inspectPlanOffer(artifacts,owned,{id:'SlowerIsHarder',rarity:'Common'});
  assert.ok(same.stages.every(stage=>stage.advice==='Already selected'));
  assert.throws(()=>inspectPlanOffer(artifacts,p,{id:'fake',rarity:'Common'}));
});

test('slowdowns, unknowns, unlimited range, absent attacks, and critical warnings remain explicit',()=>{
  const sniper=plan({tower:'Sniper Monkey'});
  const shot=inspectPlanOffer(artifacts,sniper,{id:'OneShot',rarity:'Common'});
  assert.equal(shot.stages[0].intervalAfter,shot.stages[0].intervalBefore*2);
  assert.ok(shot.stages[0].losses.includes('Attacks / sec'));
  assert.equal(shot.stages[0].advice,'Avoid for modeled stats');
  assert.equal(shot.stages[0].rows.find(row=>row.key==='attackRange').delta,null);
  assert.equal(shot.stages[0].result.rangeMode,'global');
  const farm=inspectPlanOffer(artifacts,plan({tower:'Banana Farm'}),{id:'SlowerIsHarder',rarity:'Common'});
  assert.equal(farm.stages[0].result.targetDpsValue,0);assert.equal(farm.stages[0].intervalAfter,null);
  const outside=inspectPlanOffer(artifacts,plan(),{id:'AbundantChoices',rarity:artifacts.find(a=>a.id==='AbundantChoices').variants[0].rarity});
  assert.equal(outside.modeled,false);assert.ok(outside.stages.every(stage=>stage.advice==='Outside model'));
  const critical=inspectPlanOffer(artifacts,plan({tower:'Sniper Monkey',selected:{CriticalSuccess:'Legendary',EssenceOfDreadbloon:'Legendary'},stages:[{path:'400'},{path:'400'},{path:'500'}]},{criticalMode:'expected'}),{id:'OneShot',rarity:'Legendary'});
  assert.ok(critical.stages.every(stage=>stage.result.warnings.some(warning=>warning.includes('Multiple critical-hit'))));
});

test('conversion pairing uses package totals and does not promise activation is beneficial',()=>{
  const p=plan({tower:'Dart Monkey',stages:[{path:'400'},{path:'400'},{path:'500'}]});
  const offer={id:'GrandMagicPrecision',rarity:'Common'};
  const pairs=planConversionPairs(artifacts,p,offer);
  const dread=pairs.find(pair=>pair.converter.id==='EssenceOfDreadbloon');
  assert.ok(dread?.stages[0].newlyActive);
  for(const pair of pairs)for(const [index,stage] of pair.stages.entries())assert.equal(stage.result.targetDpsValue,
    calculate(artifacts,{[offer.id]:offer.rarity,[pair.converter.id]:pair.rarity},p.stages[index].context).targetDpsValue);
  const army=pairs.find(pair=>pair.converter.id==='OneMonkeyArmy');
  if(army)assert.equal(army.stages[0].result.targetDpsValue,0);
  assert.ok(!planConversionPairs(artifacts,plan({selected:{EssenceOfDreadbloon:'Legendary'}}),offer).some(pair=>pair.converter.id==='EssenceOfDreadbloon'));
});

test('suggestions state their rarity, exclude owned duplicates, prioritize tradeoffs last, and do not mutate',()=>{
  const p=plan({selected:{SlowerIsHarder:'Common'}});const original=structuredClone(p);
  for(const priority of ['cadence','pierce','damage']){
    const offers=suggestPlanOffers(artifacts,p,{priority,limit:100,rarities:{PureDamage:'Legendary'}});
    assert.ok(offers.length>0);assert.ok(!offers.some(offer=>offer.same));
    const pure=offers.find(offer=>offer.artifact.id==='PureDamage');if(pure)assert.equal(pure.rarity,'Legendary');
    let sawTradeoff=false;
    for(const offer of offers){const tradeoff=offer.stages.some(stage=>stage.losses.length||stage.result.warnings.length);if(tradeoff)sawTradeoff=true;else assert.equal(sawTradeoff,false);}
  }
  assert.deepEqual(p,original);
  assert.throws(()=>suggestPlanOffers(artifacts,p,{priority:'survival'}));
});

test('explicit picks carry forward, replace rarities, and stay in independent offer baselines',()=>{
  const p=plan({selected:{SlowerIsHarder:'Common'},stages:[{path:'000'},
    {path:'300',acquired:{SlowerIsHarder:'Rare'}},{path:'500',acquired:{PureDamage:'Common'}}]});
  assert.equal(p.stages[0].selected.SlowerIsHarder,'Common');
  assert.equal(p.stages[1].selected.SlowerIsHarder,'Rare');
  assert.deepEqual(p.stages[2].selected,{SlowerIsHarder:'Rare',PureDamage:'Common'});
  for(const stage of p.stages)assert.equal(stage.result.targetDpsValue,calculate(artifacts,stage.selected,stage.context).targetDpsValue);
  const offer=inspectPlanOffer(artifacts,p,{id:'PureDamage',rarity:'Common'});
  assert.equal(offer.stages[2].advice,'Already selected');
  assert.equal(offer.stages[2].result.targetDpsValue,p.stages[2].result.targetDpsValue);
  const pairs=planConversionPairs(artifacts,p,{id:'GrandMagicPrecision',rarity:'Common'});
  for(const pair of pairs)for(const [index,stage] of pair.stages.entries())assert.equal(stage.result.targetDpsValue,
    calculate(artifacts,{...p.stages[index].selected,[pair.converter.id]:pair.rarity,GrandMagicPrecision:'Common'},p.stages[index].context).targetDpsValue);
  assert.throws(()=>plan({stages:[{path:'000',acquired:{PureDamage:'Common'}},{path:'300'},{path:'500'}]}));
  assert.throws(()=>plan({stages:[{path:'000'},{path:'300',acquired:{fake:'Common'}},{path:'500'}]}));
});
