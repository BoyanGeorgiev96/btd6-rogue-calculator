import test from 'node:test';import assert from 'node:assert/strict';import {createBuildHistory} from '../src/build-history.js';
const state=n=>({context:{baseDamage:n,baseAbilityCooldown:null,rangeMode:'global'},selected:{}});
test('history clones full snapshots and restores changes in both directions',()=>{
 const initial=state(1);const history=createBuildHistory(initial);initial.context.baseDamage=99;const next=state(2);history.record(next);next.context.baseDamage=88;
 assert.equal(history.undo().context.baseDamage,1);const restored=history.redo();assert.equal(restored.context.baseDamage,2);restored.context.baseDamage=77;assert.equal(history.undo().context.baseDamage,1);
});
test('continuous numeric edits form one undo step and a blur starts a new step',()=>{
 const history=createBuildHistory(state(1));history.record(state(12),'damage');history.record(state(120),'damage');assert.deepEqual(history.counts,{undo:1,redo:0});assert.equal(history.undo().context.baseDamage,1);assert.equal(history.redo().context.baseDamage,120);
 history.endGroup();history.record(state(121),'damage');assert.equal(history.undo().context.baseDamage,120);
});
test('new edits discard redo while semantic no-ops preserve it',()=>{
 const initial={context:{value:1},selected:{One:'Rare',Two:'Common'}};const history=createBuildHistory(initial);history.record({...initial,context:{value:2}});history.undo();
 assert.equal(history.record({selected:{Two:'Common',One:'Rare'},context:{value:1}}),false);assert.equal(history.canRedo,true);
 history.record({...initial,context:{value:3}});assert.equal(history.canRedo,false);assert.equal(history.undo().context.value,1);
});
test('history is bounded and empty undo/redo are harmless',()=>{
 const history=createBuildHistory(state(0),{limit:2});assert.equal(history.undo(),null);assert.equal(history.redo(),null);
 for(let n=1;n<=4;n++)history.record(state(n));assert.equal(history.undo().context.baseDamage,3);assert.equal(history.undo().context.baseDamage,2);assert.equal(history.undo(),null);
 assert.throws(()=>createBuildHistory(state(0),{limit:0}));
});
test('clear/import restore complete selections, timer modes, and target flags',()=>{
 const before={context:{abilityMode:'manual',baseAbilityCooldown:60,targetType:'ceramic',fortified:true},selected:{AbsoluteAbility:'Rare'}};
 const history=createBuildHistory(before);history.record({...before,selected:{}});assert.deepEqual(history.undo(),before);history.redo();history.record({...before,selected:{OneMonkeyArmy:'Legendary'}});assert.deepEqual(history.undo().selected,{});
});
