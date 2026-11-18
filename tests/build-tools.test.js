import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaults } from '../src/calculator.js';
import { artifactCandidate, compareBuilds, snapshot, createSavedBuild, parseLibrary, exportLibrary } from '../src/build-tools.js';
const read = f => JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url)));
const artifacts = read('artifacts.json').artifacts;
const catalog = {...read('towers.json'), heroes: read('heroes.json').heroes};
const state = () => ({context: {...defaults, basePierce: 2, baseRange: 32}, selected: {}});
const artifact = id => artifacts.find(a => a.id === id);

test('artifact preview is isolated and recalculates category-dependent effects', () => {
  const original = state(); original.context.category = 'Hero'; original.context.tower = 'Quincy';
  original.selected.GreaterPrimaryPrecision = 'Legendary';
  const candidate = artifactCandidate(original, artifact('OneMonkeyArmy'), 'Legendary');
  const comparison = compareBuilds(artifacts, original, candidate);
  assert.equal(original.selected.OneMonkeyArmy, undefined);
  assert.ok(comparison.rows[0].delta > 0);
  assert.ok(comparison.after.breakdown.find(b => b.id === 'GreaterPrimaryPrecision').active);
  assert.equal(comparison.before.breakdown.find(b => b.id === 'GreaterPrimaryPrecision').active, false);
  assert.throws(() => artifactCandidate(original, artifact('OneMonkeyArmy'), 'Common'));
});
test('removal impact includes damage suppression and handles zero baselines', () => {
  const original = state(); original.selected.OneMonkeyArmy = 'Legendary';
  const candidate = artifactCandidate(original, artifact('OneMonkeyArmy'));
  const row = compareBuilds(artifacts, original, candidate).rows[0];
  assert.equal(row.before, 0); assert.equal(row.after, 1); assert.equal(row.relative, null); assert.equal(row.delta, 1);
});
test('comparisons keep unknown and unlimited range distinct from zero', () => {
  const a = state(), b = state(); a.context.basePierce = null; a.context.rangeMode = 'global'; b.context.baseRange = 0;
  const rows = compareBuilds(artifacts, a, b).rows;
  assert.equal(rows[3].before, null); assert.equal(rows[3].delta, null);
  assert.equal(rows[4].beforeGlobal, true); assert.equal(rows[4].after, 0); assert.equal(rows[4].delta, null);
});
test('saved build export/import preserves manual values, target flags, and conditions', () => {
  const a = state(); Object.assign(a.context, {targetType:'ceramic', fortified:true, criticalMode:'expected', aura:true, baseDamage:77});
  a.selected.CeramicChunker = 'Rare';
  const saved = createSavedBuild('  My run  ', a, artifacts, {artifacts:'57',towers:'56.0'}, 'example');
  const restored = parseLibrary(exportLibrary([saved]), artifacts)[0];
  assert.equal(restored.name,'My run'); assert.deepEqual(restored.state,a); assert.deepEqual(restored.source,saved.source);
  restored.state.context.baseDamage = 3; assert.equal(a.context.baseDamage,77);
});
test('snapshot refreshes preset source values without mutating the original', () => {
  const a = state(); Object.assign(a.context,{tower:'Sniper Monkey',category:'Military',statMode:'preset',upgradePath:'000',componentId:'attack-0/weapon-0',baseDamage:999});
  const result = snapshot(a,artifacts,catalog); assert.equal(result.context.baseDamage,2); assert.equal(a.context.baseDamage,999);
  const manual = state(); manual.context.baseDamage=999; assert.equal(snapshot(manual,artifacts,catalog).context.baseDamage,999);
});
test('library rejects malformed, duplicate, excessive, and oversized imports', () => {
  for(const text of ['oops','{}', JSON.stringify({schemaVersion:1,builds:[{state:{}}]}), ' '.repeat(2_000_001)])assert.throws(()=>parseLibrary(text,artifacts));
  const saved=createSavedBuild('run',state(),artifacts,{},'one');
  assert.throws(()=>parseLibrary(exportLibrary([saved,saved]),artifacts));
  assert.throws(()=>parseLibrary(exportLibrary(Array(51).fill(saved)),artifacts));
  assert.throws(()=>createSavedBuild(' ',state(),artifacts,{},'one'));
});
test('import sanitizes unknown artifacts and invalid context fields', () => {
  const saved=createSavedBuild('<script>name</script>',state(),artifacts,{},'one');
  saved.state.selected={madeUp:'Legendary',OneMonkeyArmy:'Common'}; saved.state.context.baseDamage=-10;
  const result=parseLibrary(exportLibrary([saved]),artifacts)[0];
  assert.deepEqual(result.state.selected,{});assert.equal(result.state.context.baseDamage,0);
  assert.equal(result.name,'<script>name</script>');
});
test('rarity upgrades retain the original build and show all tracked metrics', () => {
  const a=state();a.selected.GreaterPrimaryInspiration='Common';
  const b=artifactCandidate(a,artifact('GreaterPrimaryInspiration'),'Legendary');
  const rows=compareBuilds(artifacts,a,b).rows;
  assert.ok(rows.find(r=>r.key==='projectilePierce').delta>0);
  assert.ok(rows.find(r=>r.key==='attackRange').delta>0);
  assert.equal(a.selected.GreaterPrimaryInspiration,'Common');
});

test('annotations survive build transfer and old collections default to empty metadata',()=>{
  const saved=createSavedBuild('Annotated',state(),artifacts,{},'notes',undefined,{notes:'Line one\n<script>literal</script>',tags:[' Boss ','boss','Test']});
  assert.deepEqual(saved.tags,['Boss','Test']);
  assert.deepEqual(parseLibrary(exportLibrary([saved]),artifacts),[saved]);
  delete saved.notes;delete saved.tags;
  const legacy=parseLibrary(exportLibrary([saved]),artifacts)[0];
  assert.equal(legacy.notes,'');assert.deepEqual(legacy.tags,[]);
  for(const metadata of [{notes:123},{notes:'x'.repeat(4001)},{tags:['x'.repeat(41)]},{tags:Array(21).fill('tag')},{tags:'boss'}])assert.throws(()=>createSavedBuild('Bad',state(),artifacts,{},'bad',undefined,metadata));
});
