import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults} from '../src/calculator.js';
import {createRunPlan} from '../src/run-planner.js';
import {runPlanSnapshot,parseRunPlan,maxPlanBytes} from '../src/run-plan-storage.js';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url)));
const artifacts=read('artifacts.json').artifacts,catalog=read('towers.json');
const setup={tower:'Dart Monkey',selected:{SlowerIsHarder:'Common'},stages:[{path:'000'},{path:'040',acquired:{PureDamage:'Rare'}},{path:'050',acquired:{PureDamage:'Legendary'}}]};
const context={...defaults,targetType:'ceramic',camo:true,aura:true,criticalMode:'expected'};
const preferences={priority:'pierce',rarities:{PureDamage:'Legendary'},inspected:{id:'PureDamage',rarity:'Legendary'}};
const snapshot=()=>runPlanSnapshot(artifacts,catalog,context,setup,preferences,57);

test('complete inputs round trip with exact recalculation and source/component/ability provenance',()=>{
  const saved=snapshot(),original=structuredClone(saved);
  const loaded=parseRunPlan(JSON.stringify(saved),artifacts,catalog,57);
  assert.equal(loaded.sourceChanged,false);assert.deepEqual(loaded.snapshot,saved);
  const before=createRunPlan(artifacts,catalog,context,setup),after=createRunPlan(artifacts,catalog,loaded.snapshot.context,loaded.snapshot.setup);
  assert.deepEqual(after.stages.map(s=>s.result),before.stages.map(s=>s.result));
  assert.ok(saved.setup.stages[1].abilityId);assert.ok(saved.setup.stages[1].componentId);
  assert.equal(saved.context.baseDamage,undefined);
  loaded.snapshot.setup.selected.SlowerIsHarder='Rare';assert.deepEqual(saved,original);
  saved.source.revision='older';assert.equal(parseRunPlan(JSON.stringify(saved),artifacts,catalog,57).sourceChanged,true);
});

test('malformed, oversized, unknown and invalid progression imports fail without mutating input',()=>{
  const mutations=[s=>s.version=2,s=>s.setup.selected.fake='Rare',s=>s.setup.stages[1].acquired.PureDamage='fake',
    s=>s.setup.stages[1].componentId='fake',s=>s.setup.stages[1].abilityId='fake',s=>s.setup.stages[2].path='500',
    s=>s.context.camo='true',s=>s.context.targetType='fake',s=>s.preferences.priority='survival',
    s=>s.preferences.rarities.fake='Common',s=>s.preferences.inspected.id='fake',s=>s.setup.stages[1].acquired=[],s=>s.setup.selected=null];
  for(const mutate of mutations){const saved=snapshot();mutate(saved);const original=structuredClone(saved);assert.throws(()=>parseRunPlan(JSON.stringify(saved),artifacts,catalog,57));assert.deepEqual(saved,original);}
  for(const value of ['{','null','[]',' '.repeat(maxPlanBytes+1)])assert.throws(()=>parseRunPlan(value,artifacts,catalog));
});

test('plan collection preserves annotations, independent snapshots and old source provenance',async()=>{
  const {createSavedPlan,exportPlanLibrary,parsePlanLibrary}=await import('../src/run-plan-storage.js');
  const annotated=runPlanSnapshot(artifacts,catalog,context,setup,preferences,57,{notes:'Try this\nwith friends',tags:[' Boss ','boss','Dart']});
  const first=createSavedPlan('First',annotated,'one');
  annotated.notes='Edited';assert.equal(first.snapshot.notes,'Try this\nwith friends');
  const second=createSavedPlan('Second',annotated,'two');second.snapshot.source.revision='older';
  const loaded=parsePlanLibrary(exportPlanLibrary([first,second],'two'),artifacts,catalog,57);
  assert.equal(loaded.activeId,'two');assert.deepEqual(loaded.plans,[first,second]);
  assert.deepEqual(first.snapshot.tags,['Boss','Dart']);
  assert.equal(parseRunPlan(JSON.stringify(loaded.plans[1].snapshot),artifacts,catalog,57).sourceChanged,true);
  for(const plans of [[first,first],Array(51).fill(first),[{...first,snapshot:{...first.snapshot,tags:[true]}}]])assert.throws(()=>parsePlanLibrary(exportPlanLibrary(plans),artifacts,catalog,57));
  assert.throws(()=>parsePlanLibrary('x'.repeat(2_000_001),artifacts,catalog,57));
  const legacy=snapshot();delete legacy.notes;delete legacy.tags;
  assert.deepEqual(parseRunPlan(JSON.stringify(legacy),artifacts,catalog,57).snapshot.tags,[]);
});
