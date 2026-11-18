import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{parseRun,exportRun}from'../src/run-transfer.js';import{compareTowerPresets}from'../src/tower-comparison.js';import{defaults}from'../src/calculator.js';
const read=f=>JSON.parse(readFileSync(new URL('../data/'+f,import.meta.url)));const artifacts=read('artifacts.json').artifacts;const catalog={...read('towers.json'),heroes:read('heroes.json').heroes};
test('compact run roundtrips names and rarities, including reference-only artifacts',()=>{const selected={AbundantChoices:'Rare',OneMonkeyArmy:'Legendary',CeramicChunker:'Rare',Conscription:artifacts.find(a=>a.id==='Conscription').variants[0].rarity};const valid=Object.fromEntries(Object.entries(selected).filter(([id,rarity])=>artifacts.find(a=>a.id===id)?.variants.some(v=>v.rarity===rarity)));assert.deepEqual(parseRun(exportRun(valid,artifacts),artifacts),valid);assert.deepEqual(parseRun('# My run\n one monkey army | legendary \nCeramicChunker | RARE',artifacts),{OneMonkeyArmy:'Legendary',CeramicChunker:'Rare'});});
test('run import rejects unknown artifacts, unavailable rarities, duplicates and malformed text atomically',()=>{for(const text of ['','Rogue Lab run v1','invented | Rare','One Monkey Army | Common','Ceramic Chunker | Rare\nCeramicChunker | Common','Ceramic Chunker Rare','x'.repeat(50001)])assert.throws(()=>parseRun(text,artifacts));});
test('tower comparison retains run conditions, selects source components, and does not change current state',()=>{
 const context={...defaults,targetType:'ceramic',camo:true,baseDamage:999};const selected={CeramicChunker:'Rare'};const original=structuredClone({context,selected});
 const rows=compareTowerPresets(artifacts,selected,context,catalog,[{tower:'Dart Monkey',path:'000'},{tower:'Sniper Monkey',path:'300'}]);
 assert.equal(rows[0].context.baseDamage,1);assert.equal(rows[0].result.targetHit,7);assert.equal(rows[1].result.targetHit,70);assert.equal(rows[1].gain,0);assert.equal(rows[0].context.camo,true);assert.deepEqual({context,selected},original);
});
test('hero levels, non-attacking presets and explicit component exclusions stay distinct',()=>{
 const rows=compareTowerPresets(artifacts,{OneMonkeyArmy:'Legendary'},defaults,catalog,[{tower:'Quincy',heroLevel:20},{tower:'Banana Farm',path:'000'},{tower:'Sniper Monkey',path:'320',componentId:'attack-0/weapon-0/child-0'}]);
 assert.equal(rows[0].context.heroLevel,20);assert.ok(rows[0].result.targetDpsValue>0);assert.equal(rows[1].result.targetDpsValue,0);assert.equal(rows[1].relative,null);assert.equal(rows[2].result.targetDpsValue,0);const secondary=compareTowerPresets(artifacts,{},defaults,catalog,[{tower:'Sniper Monkey',path:'320',componentId:'attack-0/weapon-0/child-0'}])[0];assert.equal(secondary.result.targetDpsValue,0);
});
test('comparison rejects illegal paths, missing components and excessive rows',()=>{for(const specs of [[{tower:'fake',path:'000'}],[{tower:'Dart Monkey',path:'555'}],[{tower:'Quincy',heroLevel:21}],[{tower:'Sniper Monkey',path:'000',componentId:'missing'}],Array(9).fill({tower:'Dart Monkey',path:'000'})])assert.throws(()=>compareTowerPresets(artifacts,{},defaults,catalog,specs));});

test('artifact summaries reflect category conversions from the whole selected run',async()=>{
 const {artifactSummary}=await import('../src/artifact-summary.js');const artifact=artifacts.find(a=>a.id==='GrandMagicPrecision');const variant=artifact.variants.at(-1);
 const text=artifactSummary(artifact,variant,{...defaults,tier:4},artifacts,{EssenceOfDreadbloon:'Legendary'});assert.match(text,/damage/);assert.doesNotMatch(text,/Requires Magic/);
});
