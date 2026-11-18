import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults} from '../src/calculator.js';
import {findSynergies} from '../src/synergy-finder.js';
const artifacts = JSON.parse(readFileSync(new URL('../data/artifacts.json', import.meta.url))).artifacts;
const state = (context = {}, selected = {}) => ({context:{...defaults, ...context}, selected});
const pairing = (result, id) => result.unlocks.find(u => u.id === id);

test('Dreadbloon respects tier gates and includes selected bonuses and specialist penalties', () => {
  const s = state({tier:4}, {GrandMagicPrecision:'Common', PrimarySpecialist:'Common'});
  const original = structuredClone(s);
  const r = findSynergies(artifacts, s, 'EssenceOfDreadbloon');
  assert.deepEqual(r.added, ['Military','Magic','Support']);
  assert.equal(pairing(r, 'GrandMagicPrecision').owned, true);
  assert.equal(pairing(r, 'GrandMagicPrecision').effects[0].stat, 'damage');
  assert.ok(pairing(r, 'PrimarySpecialist').effects.some(e => e.penalty));
  assert.ok(r.result.targetDpsValue > r.base.targetDpsValue);
  assert.deepEqual(s, original);
  const low = findSynergies(artifacts, state({tier:3}), 'EssenceOfDreadbloon');
  assert.equal(low.unlocks.length, 0);
  assert.match(low.reasons.join(' '), /tier 4/);
});
test('overlapping conversions do not claim already active effects', () => {
  const s = state({category:'Hero', tower:'Quincy'}, {OneMonkeyArmy:'Legendary'});
  const r = findSynergies(artifacts, s, 'EssenceOfDreadbloon');
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.unlocks, []);
  assert.equal(r.base.targetDpsValue, r.result.targetDpsValue);
  const affinity = findSynergies(artifacts, s, 'HeroicSpecialty');
  assert.deepEqual(affinity.added, []);
  assert.deepEqual(affinity.reasons, []);
});
test('Heroic Specialty uses named affinity while custom heroes remain unknown', () => {
  const named = findSynergies(artifacts, state({category:'Hero', tower:'Quincy'}), 'HeroicSpecialty');
  assert.deepEqual(named.added, ['Primary']);
  assert.equal(pairing(named, 'GreaterPrimaryPrecision').owned, false);
  const custom = findSynergies(artifacts, state({category:'Hero', tower:'Hero'}), 'HeroicSpecialty');
  assert.deepEqual(custom.added, []);
  assert.equal(pairing(named, 'Conscription'), undefined);
});
test('one monkey army includes own nonhero loss and hero boss bonus in totals', () => {
  const nonhero = findSynergies(artifacts, state(), 'OneMonkeyArmy');
  assert.equal(nonhero.result.targetDpsValue, 0);
  assert.deepEqual(nonhero.unlocks, []);
  const hero = findSynergies(artifacts, state({category:'Hero', tower:'Quincy', heroLevel:1}), 'OneMonkeyArmy');
  assert.equal(hero.result.targetDpsValue, 2 * hero.base.targetDpsValue);
  assert.equal(hero.added.length, 4);
});
test('target, status, paths, and crit settings gate potential pairings', () => {
  const s = state({tier:4, targetType:'ceramic', upgradePath:'040', criticalMode:'expected', frozen:true});
  const r = findSynergies(artifacts, s, 'EssenceOfDreadbloon');
  assert.ok(pairing(r, 'ImprovedSpelling'));
  assert.ok(pairing(r, 'CrystalCrash'));
  const off = findSynergies(artifacts, state({tier:4, targetType:'boss'}), 'EssenceOfDreadbloon');
  assert.equal(pairing(off, 'ImprovedSpelling'), undefined);
  assert.equal(pairing(off, 'CrystalCrash'), undefined);
  const hero = state({category:'Hero', tower:'Quincy', criticalMode:'expected'});
  assert.ok(pairing(findSynergies(artifacts, hero, 'OneMonkeyArmy'), 'CriticalSuccess'));
  hero.context.criticalMode = 'off';
  assert.equal(pairing(findSynergies(artifacts, hero, 'OneMonkeyArmy'), 'CriticalSuccess')?.effects.some(e => e.stat === 'critical') ?? false, false);
});
test('roster uses identities and current tier/level without borrowing paths or ranking net benefit', () => {
  const r = findSynergies(artifacts, state({tier:4, upgradePath:'040'}), 'EssenceOfDreadbloon');
  assert.ok(r.beneficiaries.some(b => b.tower === 'Sniper Monkey'));
  assert.ok(r.beneficiaries.every(b => !b.bonuses.includes('Improved Spelling')));
  const low = findSynergies(artifacts, state({tier:3, heroLevel:14}), 'EssenceOfDreadbloon');
  assert.deepEqual(low.beneficiaries, []);
  assert.throws(() => findSynergies(artifacts, state(), 'AbundantChoices'), /conversion/);
});
