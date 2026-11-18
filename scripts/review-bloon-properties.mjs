import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {bloonPropertyEvidence, componentMaskInventory} from './bloon-property-evidence.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url));
const source = JSON.parse(await read('data/tower-source.json'));
const componentBytes = await read('docs/component-eligibility-review.json');
const components = JSON.parse(componentBytes);
if (source.repository !== 'Btd6ModHelper/btd6-game-data' || !/^[a-f0-9]{40}$/.test(source.revision)
    || JSON.stringify(components.source) !== JSON.stringify(source)) throw new Error('Invalid or mismatched pinned source');
const cacheIndex = process.argv.indexOf('--cache-dir');
if (cacheIndex >= 0 && (!process.argv[cacheIndex + 1] || process.argv[cacheIndex + 1].startsWith('--'))) throw new Error('--cache-dir requires a directory');
const cache = cacheIndex < 0 ? null : resolve(process.argv[cacheIndex + 1], source.revision);
async function fetchText(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
const tree = JSON.parse(await fetchText(`https://api.github.com/repos/${source.repository}/git/trees/${source.revision}?recursive=1`));
if (tree.sha !== source.revision || tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete or incorrect pinned tree');
const files = tree.tree.filter(file => file.type === 'blob' && /^Bloons\/[^/]+\/[^/]+\.json$/.test(file.path)).sort((a,b) => a.path.localeCompare(b.path, 'en'));
if (!files.length) throw new Error('No pinned bloon models');
const models = new Array(files.length);
let cursor = 0;
await Promise.all(Array.from({length:8}, async () => {
  while (cursor < files.length) {
    const index = cursor++, file = files[index];
    const local = cache && resolve(cache, file.path);
    let bytes;
    if (local) try { bytes = await readFile(local); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!bytes) bytes = Buffer.from(await fetchText(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${file.path}`));
    models[index] = bloonPropertyEvidence(bytes, file);
    if (local) { await mkdir(resolve(local, '..'), {recursive:true}); await writeFile(local, bytes); }
  }
}));
const representativeIds = ['Red', 'Lead', 'Black', 'White', 'Purple', 'Zebra', 'Ddt', 'DdtCamo', 'Ceramic', 'CeramicFortified', 'Moab', 'GlassBloon', 'GoldenLeadPurple', 'GoldenLeadPurpleZebra'];
const representatives = representativeIds.map(id => {
  const entry = models.find(model => model.fields.id === id);
  if (!entry) throw new Error(`Missing representative ${id}`);
  return entry;
});
const report = {schemaVersion:1, source,
  scope:'Pinned source observations and arithmetic mask overlaps only. Not a hit-eligibility evaluator. No collision algorithm, dynamic Frozen flag, detection precedence, aura or artifact grants inferred.',
  componentReviewSha256:createHash('sha256').update(componentBytes).digest('hex'),
  models, representatives:representatives.map(model => model.path),
  masks:componentMaskInventory(components, representatives)};
const output = new URL('../docs/bloon-property-review.json', import.meta.url);
const temporary = new URL(output.href + '.tmp');
// Keep large evidence entries on individual lines, as in the component review.
const {models:entries, masks, ...header} = report;
await writeFile(temporary, JSON.stringify(header, null, 2).slice(0, -2) + ',\n  "models": [\n'
  + entries.map(entry => '    ' + JSON.stringify(entry)).join(',\n') + '\n  ],\n  "masks": [\n'
  + masks.map(entry => '    ' + JSON.stringify(entry)).join(',\n') + '\n  ]\n}\n');
await rename(temporary, output);
console.log(`Reviewed ${models.length} integrity-checked bloon models and ${report.masks.length} distinct direct-damage mask fields. Runtime eligibility unchanged.`);
