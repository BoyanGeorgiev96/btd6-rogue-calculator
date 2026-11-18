import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { artifactSummary } from '../src/artifact-summary.js';
import { heroRoster } from '../src/hero-roster.js';
import { getHeroVariant, getPresetVariant, getPresetSourceUrl, applyTowerPreset, restoreTowerContext, setManualStat, validateHeroCatalog } from '../src/tower-stats.js';
import { calculate, defaults, sanitizeState, supported } from '../src/calculator.js';
import { importHeroModel } from '../scripts/tower-import.mjs';
const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const data = read('../data/heroes.json');
const catalog = { ...read('../data/towers.json'), heroes: data.heroes };
const artifacts = read('../data/artifacts.json').artifacts;
const fixtures = read('./fixtures/hero-models.json').models;
const hero = (tower = 'Quincy', heroLevel = 1) => applyTowerPreset({ ...defaults, category: 'Hero', tower, heroLevel }, catalog);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('all 18 base heroes have 20 validated level snapshots from the pinned source', () => {
  validateHeroCatalog(data);
  assert.equal(data.heroes.length, 18);
  assert.deepEqual(data.heroes.map(h => h.id), heroRoster.map(h => h.id));
  for (const hero of data.heroes) assert.equal(Object.keys(hero.levels).length, 20);
});
test('hero selection and levels load real damage and cooldown without tower paths', () => {
  const first = hero(), last = hero('Quincy', 20);
  assert.equal(first.baseDamage, 1); near(first.baseRate, 1 / .95);
  assert.equal(last.baseBossDamage, 4); near(last.baseRate, 5);
  assert.equal(last.upgradePath, null); assert.equal(last.tier, 0); assert.equal(last.statMode, 'preset');
  assert.equal(getHeroVariant(catalog, 'Quincy', 21), null);
  assert.equal(getHeroVariant(catalog, 'Quincy', 1.5), null);
  assert.equal(getPresetVariant(catalog, first), data.heroes[0].levels['1']);
});
test('One Monkey Army doubles named heroes’ actual boss hit damage', () => {
  const c = hero('Quincy', 20), result = calculate(artifacts, { OneMonkeyArmy: 'Legendary' }, c);
  assert.equal(result.hit, 1); assert.equal(result.bossHit, 8); assert.equal(result.attacks, 5);
});
test('Heroic Specialty adds the named hero’s affinity only when equipped', () => {
  assert.ok(supported.has('HeroicSpecialty'));
  const artifact = artifacts.find(a => a.id === 'HeroicSpecialty');
  const summary = artifactSummary(artifact, artifact.variants[0], hero('Adora'));
  assert.match(summary, /Counts as Magic/); assert.doesNotMatch(summary, /every category/);
  const primary = { GreaterPrimaryPrecision: 'Common' };
  assert.equal(calculate(artifacts, primary, hero()).damage, 1);
  near(calculate(artifacts, { ...primary, HeroicSpecialty: 'Rare' }, hero()).damage, 1.16);
  assert.equal(calculate(artifacts, { ...primary, HeroicSpecialty: 'Rare' }, hero('Adora')).damage, 1);
  const magic = calculate(artifacts, { HeroicSpecialty: 'Rare', PureDamage: 'Legendary' }, hero('Adora'));
  assert.equal(magic.bossDamage, 4); assert.equal(magic.rate, .5);
});
test('affinity conversion and One Monkey Army union categories independently of artifact order', () => {
  const selected = { HeroicSpecialty: 'Legendary', OneMonkeyArmy: 'Legendary', PureDamage: 'Legendary', GreaterPrimaryPrecision: 'Common' };
  const context = hero('Adora');
  const result = calculate(artifacts, selected, context);
  near(result.damage, 1.16); near(result.bossDamage, 1.16 * 4 * 2);
  near(calculate([...artifacts].reverse(), selected, context).bossHit, result.bossHit);
});
test('Dreadbloon uses hero level 15 rather than tower upgrade tiers', () => {
  const selected = { EssenceOfDreadbloon: 'Legendary', PureDamage: 'Legendary' };
  assert.equal(calculate(artifacts, selected, hero('Quincy', 14)).bossDamage, 1);
  assert.equal(calculate(artifacts, selected, hero('Quincy', 15)).bossDamage, 4);
});
test('Malicious Mauling applies Striker Jones’s damage bonus without the Bomb-only slowdown', () => {
  const result = calculate(artifacts, { MaliciousMauling: 'Common' }, hero('Striker Jones'));
  assert.equal(result.bossHit, 6); assert.equal(result.rate, 1);
});
test('heroes keep distinct attack components rather than summing their damage', () => {
  const context = hero('Captain Churchill', 20);
  const components = getPresetVariant(catalog, context).components;
  assert.equal(components.length, 2);
  assert.equal(context.baseDamage, 25);
  const gun = applyTowerPreset(context, catalog, null, components[1].id);
  assert.equal(gun.baseDamage, 16); near(gun.baseRate, 10);
});
test('income, spirit spells, summons, and psychic destruction do not create fictional baseline DPS', () => {
  assert.equal(hero('Benjamin').baseDamage, 0); assert.equal(hero('Benjamin').baseRate, 0);
  for (const level of [1, 10, 20]) {
    assert.equal(hero('Corvus', level).baseDamage, 0);
    assert.equal(hero('Etienne', level).baseDamage, 0);
    assert.equal(hero('Psi', level).baseBossDamage, 0);
  }
  assert.match(getHeroVariant(catalog, 'Corvus', 20).notes.join(' '), /spells are excluded/);
  assert.match(getHeroVariant(catalog, 'Psi', 1).notes.join(' '), /Psychic destruction/);
});
test('hero presets and selected components survive saved/shared state validation', () => {
  const context = hero('Captain Churchill', 20);
  const components = getPresetVariant(catalog, context).components;
  const gun = applyTowerPreset(context, catalog, null, components[1].id);
  const restored = sanitizeState({ context: gun, selected: {} }, artifacts).context;
  assert.equal(restored.statMode, 'preset'); assert.equal(restored.upgradePath, null); assert.equal(restored.heroLevel, 20);
  assert.deepEqual(restoreTowerContext(restored, catalog), gun);
  const manual = setManualStat(gun, 'baseDamage', 100);
  assert.equal(restoreTowerContext(sanitizeState({ context: manual }, artifacts).context, catalog).baseDamage, 100);
});
test('legacy generic heroes keep manual values and do not acquire an invented affinity', () => {
  const old = sanitizeState({ context: { category: 'Hero', tower: 'Hero', heroLevel: 10, baseDamage: 3, baseRate: 2 } }, artifacts).context;
  assert.equal(old.tower, 'Hero'); assert.equal(old.statMode, 'manual'); assert.equal(old.baseDamage, 3);
  const result = calculate(artifacts, { HeroicSpecialty: 'Rare', GreaterPrimaryPrecision: 'Common' }, old);
  assert.equal(result.hit, 3); assert.equal(getPresetSourceUrl(catalog, old), null);
});
test('hero source links use export IDs and encoded level filenames', () => {
  assert.match(getPresetSourceUrl(catalog, hero('Quincy')), /Towers\/Quincy\/Quincy\.json$/);
  assert.match(getPresetSourceUrl(catalog, hero("Dan D'Monke", 20)), /Towers\/DanDMonke\/DanDMonke%2020\.json$/);
});
test('hero source fixtures reproduce the imported direct-hit snapshots', () => {
  for (const [filename, model] of Object.entries(fixtures)) {
    const identity = heroRoster.find(h => h.id === model.baseId);
    const result = importHeroModel(model, identity);
    assert.deepEqual({ range: result.range, rangeMode: result.rangeMode, components: result.components, abilities: result.abilities, notes: result.notes }, getHeroVariant(catalog, identity.name, result.level), filename);
  }
});
test('missing levels and mismatched hero models fail validation', () => {
  const invalid = structuredClone(data); delete invalid.heroes[0].levels['20'];
  assert.throws(() => validateHeroCatalog(invalid), /missing levels/);
  assert.throws(() => importHeroModel(fixtures.Quincy, { id: 'Adora' }), /Unexpected hero model/);
});
