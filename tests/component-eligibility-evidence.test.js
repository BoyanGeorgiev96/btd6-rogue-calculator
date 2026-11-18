import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {componentEligibilityEvidence, gitBlobHash} from '../scripts/component-eligibility-evidence.mjs';
import {importTowerModel} from '../scripts/tower-import.mjs';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const fixtures = read('tests/fixtures/tower-models.json').models;
const pointer = (model, path) => path.split('/').slice(1).reduce((value, key) => value[key], model);
const type = model => model.$type.split(',')[0].split('.').at(-1);

test('evidence paths resolve to the actual imported attacks, projectiles, and direct damage', () => {
  for (const model of Object.values(fixtures)) {
    const imported = importTowerModel(model, {id:model.baseId}, {evidence:true});
    const evidence = componentEligibilityEvidence(model, imported);
    assert.deepEqual(imported.components.map(({sourcePaths, ...component}) => component), importTowerModel(model, {id:model.baseId}).components);
    for (const component of evidence.components) {
      const paths = component.sourcePaths;
      assert.ok(Array.isArray(pointer(model, paths.attack).weapons));
      assert.equal(pointer(model, paths.weapon).projectile, pointer(model, paths.ancestors[0] ?? paths.projectile));
      assert.equal(type(pointer(model, paths.projectile)), 'ProjectileModel');
      for (const damage of paths.damage) {
        assert.equal(type(pointer(model, damage)), 'DamageModel');
        assert.ok(pointer(model, paths.projectile).behaviors.includes(pointer(model, damage)));
      }
    }
    for (const finding of evidence.findings) assert.equal(type(pointer(model, finding.path)), finding.type);
  }
});

test('primary explosion and triggered shrapnel retain independent masks and parent paths', () => {
  for (const id of ['BombShooter', 'SniperMonkey-320']) {
    const model = fixtures[id];
    assert.ok(model, id);
    const evidence = componentEligibilityEvidence(model, importTowerModel(model, {id:model.baseId}, {evidence:true}));
    const child = evidence.components.find(component => component.sourcePaths.ancestors.length);
    assert.ok(child);
    assert.equal(child.trigger, id === 'BombShooter' ? 'attack' : 'secondary');
    assert.ok(!child.sourcePaths.damage.some(path => child.sourcePaths.ancestors.includes(path)));
    const damage = evidence.findings.find(finding => finding.path === child.sourcePaths.damage[0]);
    assert.equal(damage.fields.immuneBloonProperties, pointer(model, child.sourcePaths.damage[0]).immuneBloonProperties);
  }
});

test('detection filters retain explicit false versus absent fields without inferring coverage', () => {
  const model = {$type:'Example.TowerModel', behaviors:[
    {$type:'Example.FilterInvisibleModel', isActive:false},
    {$type:'Example.FilterInvisibleModel'},
    {$type:'Example.DamageModel', immuneBloonProperties:0},
    {$type:'Example.DamageModel'}
  ]};
  const evidence = componentEligibilityEvidence(model, {components:[]});
  assert.deepEqual(evidence.findings.map(finding => finding.fields), [{isActive:false}, {}, {immuneBloonProperties:0}, {}]);
  assert.throws(() => componentEligibilityEvidence(model, {components:[{id:'manual'}]}), /evidence enabled/);
});

test('catalog review covers every active variant and keeps excluded attacks outside components', () => {
  const report = read('docs/component-eligibility-review.json');
  assert.deepEqual(report.source, read('data/tower-source.json'));
  const expected = new Map();
  for (const family of read('data/towers.json').towers) for (const [key, variant] of Object.entries(family.variants)) expected.set(`tower/${family.id}/${key}`, variant);
  for (const family of read('data/heroes.json').heroes) for (const [key, variant] of Object.entries(family.levels)) expected.set(`hero/${family.id}/${key}`, variant);
  assert.equal(report.models.length, expected.size);
  const seen = new Set();
  for (const model of report.models) {
    const key = `${model.kind}/${model.id}/${model.key}`;
    assert.ok(!seen.has(key)); seen.add(key);
    assert.match(model.blob, /^[a-f0-9]{40}$/);
    assert.ok(model.path.startsWith(`Towers/${model.id}/`));
    const profile = report.profiles[model.evidence];
    assert.deepEqual(profile.components.map(component => component.id), expected.get(key).components.map(component => component.id));
  }
  const corvus = report.models.find(model => model.id === 'Corvus' && model.key === '1');
  const evidence = report.profiles[corvus.evidence];
  assert.deepEqual(evidence.components, []);
  assert.ok(evidence.findings.some(finding => finding.type === 'DamageModel'));
});

test('Git blob validation hashes byte length and exact content', () => {
  const bytes = Buffer.from('source é\n');
  const expected = createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
  assert.equal(gitBlobHash(bytes), expected);
  assert.notEqual(gitBlobHash(Buffer.from('source é\r\n')), expected);
});
