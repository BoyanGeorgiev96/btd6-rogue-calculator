import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults, calculate} from '../src/calculator.js';
import {applyTowerPreset} from '../src/tower-stats.js';
import {compareParty} from '../src/party-overview.js';
const read = name => JSON.parse(readFileSync(new URL('../data/'+name, import.meta.url)));
const artifacts = read('artifacts.json').artifacts;
const catalog = {...read('towers.json'), heroes:read('heroes.json').heroes};
const manual = (id, extra={}) => ({id,name:id,state:{context:{...defaults,...extra},selected:{OneMonkeyArmy:'Legendary'}}});
test('party uses current loadout and environment but retains saved actor stats without mutation', () => {
  const builds = [manual('dart',{baseDamage:12,baseRate:2,basePierce:null,baseAbilityCooldown:60}),manual('quincy',{category:'Hero',tower:'Quincy',heroLevel:20})];
  const current = {context:{...defaults,targetType:'ceramic',fortified:true,aura:true,criticalMode:'expected'},selected:{CeramicChunker:'Rare'}};
  const original = structuredClone({builds,current});
  const rows = compareParty(artifacts,current,builds,catalog);
  assert.equal(rows[0].context.baseDamage,12);
  assert.equal(rows[0].context.aura,true);
  assert.equal(rows[0].context.fortified,true);
  assert.equal(rows[0].context.targetType,'ceramic');
  assert.equal(rows[0].context.criticalMode,'expected');
  assert.equal(rows[1].context.tower,'Quincy');
  assert.equal(rows[1].context.heroLevel,20);
  assert.equal(rows[0].result.projectilePierce,null);
  assert.equal(rows[0].result.abilitySeconds,60);
  assert.equal(rows[0].result.targetDpsValue,calculate(artifacts,current.selected,rows[0].context).targetDpsValue);
  assert.ok(rows[0].result.targetDpsValue>rows[0].base.targetDpsValue);
  assert.deepEqual({builds,current},original);
});
test('party refreshes separate saved components and independent ability overrides', () => {
  const context = applyTowerPreset({...defaults,tower:'Sniper Monkey',category:'Military'},catalog,'000');
  context.baseDamage = 999;
  context.abilityMode = 'manual';context.baseAbilityCooldown=77;
  const rows = compareParty(artifacts,{context:defaults,selected:{}},[{id:'preset',name:'preset',state:{context,selected:{}}},manual('manual',{baseDamage:999,rangeMode:'global'})],catalog);
  assert.equal(rows[0].context.baseDamage,2);
  assert.equal(rows[0].context.componentId,context.componentId);
  assert.equal(rows[0].result.abilitySeconds,77);
  assert.equal(rows[1].context.baseDamage,999);
  assert.equal(rows[1].result.rangeMode,'global');
  assert.equal(rows[1].metrics.find(m=>m.key==='attackRange').delta,null);
  assert.equal(rows[0].gain,0);
});
test('party applies category conversions independently and never sums components', () => {
  const rows = compareParty(artifacts,{context:defaults,selected:{OneMonkeyArmy:'Legendary',GreaterPrimaryPrecision:'Legendary'}},[manual('dart'),manual('hero',{category:'Hero',tower:'Quincy'})],catalog);
  assert.equal(rows[0].result.targetDpsValue,0);
  assert.ok(rows[1].result.targetDpsValue>rows[1].base.targetDpsValue);
  assert.ok(rows[1].result.breakdown.find(b=>b.id==='GreaterPrimaryPrecision').active);
  assert.throws(()=>compareParty(artifacts,{context:defaults,selected:{}},Array(9).fill(manual('x')),catalog));
  assert.deepEqual(compareParty(artifacts,{context:defaults,selected:{}},[],catalog),[]);
});

test('party labels missing saved components instead of silently switching attacks', () => {
  const build = manual('old', {statMode:'preset', upgradePath:'000', componentId:'missing', baseDamage:31, abilityMode:'preset', abilityId:'missing', baseAbilityCooldown:45});
  const row = compareParty(artifacts,{context:defaults,selected:{}},[build],catalog)[0];
  assert.equal(row.context.statMode,'manual');
  assert.equal(row.context.baseDamage,31);
  assert.equal(row.context.baseAbilityCooldown,45);
  assert.ok(row.notes.some(note=>note.includes('The saved component is unavailable')));
  assert.ok(row.notes.some(note=>note.includes('The saved ability is unavailable')));
});
