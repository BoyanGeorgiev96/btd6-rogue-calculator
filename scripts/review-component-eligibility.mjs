import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import {importTowerModel, importHeroModel} from './tower-import.mjs';
import {componentEligibilityEvidence, gitBlobHash} from './component-eligibility-evidence.mjs';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url)));
const source = await read('data/tower-source.json');
const towers = await read('data/towers.json'), heroes = await read('data/heroes.json');
if (source.repository !== 'Btd6ModHelper/btd6-game-data' || !/^[a-f0-9]{40}$/.test(source.revision)) throw new Error('Invalid pinned source');
for (const catalog of [towers, heroes]) if (JSON.stringify(catalog.source) !== JSON.stringify(source)) throw new Error('Catalog source mismatch');
const cacheIndex = process.argv.indexOf('--cache-dir');
if (cacheIndex >= 0 && (!process.argv[cacheIndex + 1] || process.argv[cacheIndex + 1].startsWith('--'))) throw new Error('--cache-dir requires a directory');
const cache = cacheIndex < 0 ? null : resolve(process.argv[cacheIndex + 1], source.revision);
if (cache) await mkdir(cache, {recursive:true});
async function fetchText(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
const tree = JSON.parse(await fetchText(`https://api.github.com/repos/${source.repository}/git/trees/${source.revision}?recursive=1`));
if (tree.sha !== source.revision || tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete or incorrect pinned tree');
const files = new Map(tree.tree.filter(f => f.type === 'blob').map(f => [f.path, f]));
const jobs = [
  ...towers.towers.flatMap(family => Object.entries(family.variants).map(([path, active]) => ({family, active, key:path, kind:'tower', filename:`${family.id}${path === '000' ? '' : '-' + path}.json`}))),
  ...heroes.heroes.flatMap(family => Object.entries(family.levels).map(([level, active]) => ({family, active, key:level, kind:'hero', filename:`${family.id}${level === '1' ? '' : ' ' + level}.json`})))
];
const entries = new Array(jobs.length);
let cursor = 0;
await Promise.all(Array.from({length:8}, async () => {
  while (cursor < jobs.length) {
    const index = cursor++, job = jobs[index];
    const path = `Towers/${job.family.id}/${job.filename}`, file = files.get(path);
    if (!file) throw new Error(`Missing pinned model: ${path}`);
    const local = cache && resolve(cache, basename(path));
    let content;
    if (local) try { content = await readFile(local); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!content) content = Buffer.from(await fetchText(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${path.split('/').map(encodeURIComponent).join('/')}`));
    if (gitBlobHash(content) !== file.sha) throw new Error(`${path}: cached/downloaded model differs from pinned blob`);
    const model = JSON.parse(content);
    const imported = (job.kind === 'hero' ? importHeroModel : importTowerModel)(model, job.family, {evidence:true});
    if (String(job.kind === 'hero' ? imported.level : imported.path) !== job.key) throw new Error(`Unexpected model identity: ${path}`);
    // Evidence must map exactly to the active components, without changing stats.
    const plain = imported.components.map(({sourcePaths, ...component}) => component);
    if (JSON.stringify(plain) !== JSON.stringify(job.active.components)) throw new Error(`Active component drift: ${path}; review stat imports first`);
    if (local) await writeFile(local, content);
    entries[index] = {path, blob:file.sha, kind:job.kind, id:job.family.id, key:job.key, ...componentEligibilityEvidence(model, imported)};
  }
}));
const profiles = {}, signatures = new Map();
const models = entries.map(({findings, components, ...entry}) => {
  const signature = JSON.stringify({findings, components});
  if (!signatures.has(signature)) {
    const id = `profile-${signatures.size}`;
    signatures.set(signature, id);
    profiles[id] = {findings, components};
  }
  return {...entry, evidence:signatures.get(signature)};
});
const report = {schemaVersion:1, source, scope:'Source evidence only, not runtime eligibility. Paths separate root attacks, parent projectiles, direct damage, and excluded nested mechanics. No bitmask meanings, detection precedence, artifact grants, or manual-stat eligibility inferred.', models, profiles};
const output = new URL('../docs/component-eligibility-review.json', import.meta.url);
const temporary = new URL(output.href + '.tmp');
// Identical evidence profiles are shared across source variants; each model
// retains its own provenance and exact active-component mapping.
const {models: modelEntries, profiles: profileEntries, ...header} = report;
const text = JSON.stringify(header, null, 2).slice(0, -2) + ',\n  \"models\": [\n'
  + modelEntries.map(entry => '    ' + JSON.stringify(entry)).join(',\n')
  + '\n  ],\n  \"profiles\": {\n'
  + Object.entries(profileEntries).map(([id, profile]) => '    ' + JSON.stringify(id) + ': ' + JSON.stringify(profile)).join(',\n')
  + '\n  }\n}\n';
await writeFile(temporary, text);
await rename(temporary, output);
console.log(`Reviewed ${entries.length} integrity-checked models; ${entries.reduce((sum, entry) => sum + entry.components.length, 0)} components match active stats. No active catalogs or hit totals changed.`);
