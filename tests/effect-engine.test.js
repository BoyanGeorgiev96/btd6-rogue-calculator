import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, defaults, supported } from '../src/calculator.js';
import { artifactRules } from '../src/artifact-rules.js';
import { evaluateEffects, matches, multiplier, resolveCategories } from '../src/effect-engine.js';
import { artifactSummary } from '../src/artifact-summary.js';
const { artifacts } = JSON.parse(readFileSync(new URL('../data/artifacts.json', import.meta.url)));

test('a new artifact can use named effects without changing the calculator', () => {
  const definition = {
    parameters: { damageBonusPercent: 0, attackCooldown: 1 },
    effects: [
      { stat: 'damage', operation: 'percentIncrease', value: 'damageBonusPercent', when: { category: 'Magic', minTier: 3 } },
      { stat: 'attackRate', operation: 'cooldownMultiplier', value: 'attackCooldown', when: { flag: 'early' } }
    ]
  };
  const artifact = { id: 'TestArtifact', name: 'Test artifact', variants: [{ rarity: 'Common', params: [50, .8] }] };
  const context = { ...defaults, category: 'Magic', tower: 'Wizard Monkey', early: true };
  const result = calculate([artifact], { TestArtifact: 'Common' }, context, { TestArtifact: definition });
  assert.equal(result.damage, 1.5); assert.equal(result.rate, 1.25); assert.equal(result.bossDps, 1.875);
  const buffed = structuredClone(artifact); buffed.variants[0].params[0] = 100;
  assert.equal(calculate([buffed], { TestArtifact: 'Common' }, context, { TestArtifact: definition }).damage, 2);
  assert.deepEqual([...supported].sort(), Object.keys(artifactRules).sort());
});

test('composable conditions combine category, identity, tiers, hero level, and flags', () => {
  const condition = { all: [{ category: ['Magic', 'Support'] }, { tower: ['Druid', 'Alchemist'] }, { minTier: 3, maxTier: 4 }, { not: { flag: 'early' } }] };
  assert.ok(matches(condition, { ...defaults, tower: 'Druid' }, new Set(['Magic'])));
  assert.equal(matches(condition, { ...defaults, tower: 'Druid', tier: 5 }, new Set(['Magic'])), false);
  assert.ok(matches({ any: [{ minHeroLevel: 15 }, { flag: 'early' }] }, { ...defaults, heroLevel: 1, early: true }, new Set(['Hero'])));
});

test('category conversions are evaluated independently of definition order', () => {
  const entries = [
    { definition: { categories: [{ add: ['Magic'], when: { category: 'Hero' } }] } },
    { definition: { categories: [{ add: ['Support'], when: { category: 'Hero' } }] } }
  ];
  const context = { ...defaults, category: 'Hero' };
  assert.deepEqual([...resolveCategories(entries, context)].sort(), ['Hero', 'Magic', 'Support']);
  assert.deepEqual([...resolveCategories(entries.reverse(), context)].sort(), ['Hero', 'Magic', 'Support']);
});

test('invalid rules fail instead of producing plausible but incorrect estimates', () => {
  assert.throws(() => matches({ minimumTeir: 3 }, defaults, new Set(['Primary'])), /Unknown condition/);
  assert.throws(() => matches({ flag: 'ealry' }, defaults, new Set()), /Unknown flag/);
  assert.throws(() => multiplier({ stat: 'dammage', operation: 'multiplier', value: 2 }, {}), /Unknown stat/);
  assert.throws(() => multiplier({ stat: 'damage', operation: 'sum', value: 2 }, {}), /Unknown operation/);
  assert.throws(() => multiplier({ stat: 'damage', operation: 'multiplier', value: 'missing' }, {}), /Invalid effect value/);
  assert.throws(() => multiplier({ stat: 'attackRate', operation: 'cooldownMultiplier', value: 0 }, {}), /Invalid multiplier/);
  assert.throws(() => multiplier({ stat: 'attackRate', operation: 'percentDecrease', value: 110 }, {}), /Invalid multiplier/);
  assert.throws(() => evaluateEffects({ parameters: { bonus: 2 }, effects: [] }, { params: [10] }, defaults, new Set()), /Invalid source parameter/);
});

test('UI summaries derive conversions, boss-only bonuses, penalties, and exclusions from effects', () => {
  const one = artifacts.find(a => a.id === 'OneMonkeyArmy');
  const hero = artifactSummary(one, one.variants[0], { ...defaults, category: 'Hero', tower: 'Hero' });
  assert.match(hero, /every category/); assert.match(hero, /2× boss damage/); assert.doesNotMatch(hero, /MOAB/);
  assert.match(artifactSummary(one, one.variants[0], defaults), /-100% damage/);
  const sniper = artifacts.find(a => a.id === 'OneShot');
  assert.match(artifactSummary(sniper, sniper.variants[0], { ...defaults, category: 'Military', tower: 'Sniper Monkey' }), /2.8× expected crit damage/);
  const reference = artifacts.find(a => a.id === 'HomingProjectiles');
  assert.match(artifactSummary(reference, reference.variants[0], defaults), /artifact details/);
});
