import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeArtifact} from '../src/artifact-discovery.js';
import {defaults,supported} from '../src/calculator.js';
import {artifactEffectFilters,filterArtifactEntries} from '../src/artifact-filters.js';
const artifacts=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url))).artifacts;
const state=(context={},selected={})=>({context:{...defaults,...context},selected});
const entry=(id,s=state(),rarity=null)=>{const a=artifacts.find(a=>a.id===id);return analyzeArtifact(a,rarity??a.variants[0].rarity,s,artifacts);};
const matches=(e,filters)=>filterArtifactEntries([e],filters).length===1;

test('effect filters classify modeled rules including penalties and optional effects rather than description keywords',()=>{
 const absolute=entry('AbsoluteAbility');
 assert.ok(matches(absolute,{effect:'speed'}));assert.ok(matches(absolute,{effect:'cooldown'}));assert.ok(!matches(absolute,{effect:'damage'}));
 assert.ok(matches(entry('OneMonkeyArmy',state(),'Legendary'),{effect:'conversion'}));
 assert.ok(matches(entry('CriticalSuccess'),{effect:'critical'}));
 assert.ok(matches(entry('CeramicChunker'),{effect:'damage'}));
 const reference=artifacts.find(a=>!supported.has(a.id));const unknown=analyzeArtifact(reference,reference.variants[0].rarity,state(),artifacts);
 assert.ok(matches(unknown,{}));
 for(const [effect] of artifactEffectFilters)assert.ok(!matches(unknown,{effect}));
 assert.ok(matches(entry('GeneralsDisposition'),{effect:'boss'}));
});
test('impact is scoped to the chosen effect and supports mixed tradeoffs, unknown base values and selected contributions',()=>{
 const absolute=entry('AbsoluteAbility');
 assert.ok(matches(absolute,{impact:'boost'}));assert.ok(matches(absolute,{impact:'penalty'}));
 assert.ok(matches(absolute,{effect:'speed',impact:'penalty'}));assert.ok(!matches(absolute,{effect:'speed',impact:'boost'}));
 assert.ok(matches(absolute,{effect:'cooldown',impact:'boost'}));assert.ok(!matches(absolute,{effect:'cooldown',impact:'penalty'}));
 const selected=entry('AbsoluteAbility',state({}, {AbsoluteAbility:'Common'}));assert.ok(matches(selected,{effect:'speed',impact:'penalty'}));assert.ok(matches(selected,{effect:'cooldown',impact:'boost'}));
 assert.ok(matches(entry('GreaterPrimaryInspiration',state({basePierce:null})),{effect:'pierce',impact:'boost'}));
 assert.ok(!matches(entry('HawksEye',state({rangeMode:'global'})),{effect:'range',impact:'boost'}));
});
test('conditional effects stay discoverable while impact follows gates, targets, conversions and critical mode',()=>{
 const inactive=entry('GrandMagicPrecision');assert.ok(matches(inactive,{effect:'damage'}));assert.ok(!matches(inactive,{effect:'damage',impact:'boost'}));
 const enabled=entry('GrandMagicPrecision',state({tier:4},{EssenceOfDreadbloon:'Legendary'}));assert.ok(matches(enabled,{effect:'damage',impact:'boost'}));
 const chunker=entry('CeramicChunker',state({targetType:'ceramic',baseDamage:0}));assert.ok(matches(chunker,{effect:'damage',impact:'boost'}));
 assert.ok(!matches(entry('CeramicChunker'),{effect:'damage',impact:'boost'}));
 const crit=entry('CriticalSuccess',state({criticalMode:'off'}));assert.ok(matches(crit,{effect:'critical'}));assert.ok(!matches(crit,{effect:'critical',impact:'boost'}));
 assert.ok(matches(entry('CriticalSuccess',state({criticalMode:'expected'})),{effect:'critical',impact:'boost'}));
});
test('available rarity composes with effect/impact without changing entries, selections or their displayed rarity',()=>{
 const entries=[entry('OneMonkeyArmy',state(),'Legendary'),entry('AbsoluteAbility')],before=structuredClone(entries);
 const result=filterArtifactEntries(entries,{effect:'cooldown',impact:'boost',rarity:'Rare'});
 assert.equal(result.length,1);assert.equal(result[0],entries[1]);assert.equal(result[0].rarity,'Common');
 assert.ok(!matches(entries[0],{rarity:'Common'}));assert.ok(matches(entries[0],{rarity:'Legendary'}));
 assert.deepEqual(entries,before);assert.deepEqual(filterArtifactEntries(entries),entries);
 assert.throws(()=>filterArtifactEntries(entries,{effect:'invented'}));assert.throws(()=>filterArtifactEntries(entries,{impact:'invented'}));
});
