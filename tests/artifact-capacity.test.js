import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artifactLimit,canAddArtifact,exceedsAdditionLimit,artifactCapacityWarning} from '../src/artifact-capacity.js';
import {calculate,sanitizeState} from '../src/calculator.js';

const {artifacts}=JSON.parse(readFileSync(new URL('../data/artifacts.json',import.meta.url)));
const selection=count=>Object.fromEntries(artifacts.slice(0,count).map(a=>[a.id,a.variants[0].rarity]));

test('normal capacity counts reference-only artifacts, but rarity replacements need no new slot',()=>{
  const full=selection(artifactLimit), existing=artifacts[0].id, extra=artifacts[artifactLimit].id;
  assert.equal(canAddArtifact(selection(49),extra),true);
  assert.equal(canAddArtifact(full,extra),false);
  assert.equal(canAddArtifact(full,existing),true);
  assert.equal(exceedsAdditionLimit(full,{...full,[extra]:'Common'}),true);
  assert.equal(exceedsAdditionLimit(full,{...full,[existing]:'Legendary'}),false);
  assert.equal(exceedsAdditionLimit(full,selection(49)),false);
});

test('hypothetical imported builds retain every selection and allow edits/removals while blocking new additions',()=>{
  const selected=selection(53), state=sanitizeState({context:{},selected},artifacts);
  assert.deepEqual(state.selected,selected);
  assert.equal(exceedsAdditionLimit(selected,{...selected,[artifacts[0].id]:'Legendary'}),false);
  assert.equal(exceedsAdditionLimit(selected,selection(52)),false);
  assert.equal(exceedsAdditionLimit(selected,selection(54)),true);
  assert.match(artifactCapacityWarning(53),/53 \/ 50.*hypothetical.*remove 3/);
});

test('engine warns about over-cap valid selections without truncating or altering hypothetical arithmetic',()=>{
  const selected=selection(51), original=structuredClone(selected);
  const result=calculate(artifacts,selected,{},{});
  assert.equal(result.unmodeled.length,51);
  assert.ok(result.warnings.some(w=>w.includes('51 / 50')));
  assert.equal(result.damage,1);
  assert.deepEqual(selected,original);
  assert.equal(artifactCapacityWarning(50),'');
  assert.equal(calculate(artifacts,{...selection(50),unknown:'Common'},{},{}).warnings.length,0);
});
