import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportBuildReport} from '../src/build-report.js';
import {calculate, defaults, supported} from '../src/calculator.js';
import {applyTowerPreset} from '../src/tower-stats.js';
const read = name => JSON.parse(readFileSync(new URL('../data/'+name, import.meta.url)));
const data = read('artifacts.json');
const catalog = {...read('towers.json'), heroes:read('heroes.json').heroes};
const report = state => exportBuildReport({state, artifacts:data.artifacts, towerCatalog:catalog, artifactVersion:data.version});

test('report uses exact current manual inputs and full engine while preserving state', () => {
  const context = {...applyTowerPreset(defaults,catalog,'300'), statMode:'manual', baseDamage:123.456, baseBossDamage:234.567, targetType:'ceramic', camo:true, fortified:true, early:true};
  const state = {context,selected:{CeramicChunker:'Rare'}};
  const original = structuredClone(state), result = calculate(data.artifacts,state.selected,context);
  const output = report(state), format = n => new Intl.NumberFormat('en',{maximumFractionDigits:6}).format(n);
  assert.match(output,/stats: manual/);
  assert.ok(output.includes(`| ${format(result.targetDpsValue)} |`));
  assert.ok(output.includes(`| ${format(result.targetHit)} |`));
  assert.match(output,/Ceramic Chunker \\?\| Rare/);
  assert.match(output,/Camo: on; Fortified: on/);
  assert.match(output,/First 20 seconds: on/);
  assert.ok(output.includes(catalog.source.revision));
  assert.ok(output.includes('Artifact descriptions: v'+data.version));
  assert.match(output,/Hit eligibility: Unknown/);
  assert.deepEqual(state,original);
});

test('report distinguishes unknown, unlimited, zero attacks, absent ability and component exclusion', () => {
  const state = {context:{...defaults,baseRate:0,rangeMode:'global',baseCanHitMoab:false,abilityMode:'none'},selected:{}};
  const output = report(state);
  assert.match(output,/\| Range \| Unlimited \| Unlimited \|/);
  assert.match(output,/\| Pierce \/ projectile \| Unknown \| Unknown \|/);
  assert.match(output,/\| Seconds between attacks \| Unknown \| Unknown \|/);
  assert.match(output,/\| Ability cooldown \(seconds\) \| No ability \| No ability \|/);
  assert.match(output,/Hit eligibility: Excluded for this component/);
  assert.match(output,/## Loadout \(0\)\n\n- None/);
});

test('report includes reference-only and inactive exclusions and escapes Markdown names', () => {
  const reference = data.artifacts.find(a=>!supported.has(a.id));
  const state = {context:{...defaults},selected:{[reference.id]:reference.variants[0].rarity,GrandMagicPrecision:'Legendary'}};
  const output = exportBuildReport({state,artifacts:data.artifacts,towerCatalog:catalog,artifactVersion:data.version,name:'<script>\n[link](bad)'});
  assert.ok(output.includes('\\<script\\> \\[link\\]\\(bad\\)'));
  assert.match(output,/Reference only; excluded from totals/);
  assert.match(output,/reference only; excluded from totals/);
  assert.match(output,/## Warnings, inactive effects, and selected exclusions/);
  assert.match(output,/DOT/);
  assert.match(output,/curse restrictions/);
});

test('hero report retains critical-overlap warning and selected level', () => {
  const state = {context:{...defaults,category:'Hero',tower:'Adora',heroLevel:12,criticalMode:'expected'},selected:{OneMonkeyArmy:'Legendary',CriticalSuccess:'Legendary',DivineIntervention:'Legendary'}};
  const output = report(state);
  assert.match(output,/hero level 12/);
  assert.match(output,/Multiple critical-hit artifacts apply/);
  assert.match(output,/critical damage is excluded/);
});
