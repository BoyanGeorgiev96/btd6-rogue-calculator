import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { towers } from '../src/calculator.js';
import { validUpgradePath, validateTowerCatalog } from '../src/tower-stats.js';
import { importTowerModel } from './tower-import.mjs';
const source = JSON.parse(await readFile(new URL('../data/tower-source.json', import.meta.url), 'utf8'));
if (source.repository !== 'Btd6ModHelper/btd6-game-data' || !/^[a-f0-9]{40}$/.test(source.revision)) throw new Error('Unrecognized tower source');
const families = Object.entries(towers).filter(([category]) => !['Hero','Powers'].includes(category)).flatMap(([category, names]) => names.map(name => ({ id: name.replaceAll(' ', ''), name, category })));
const cacheIndex = process.argv.indexOf('--cache-dir');
const cache = cacheIndex >= 0 ? resolve(process.argv[cacheIndex + 1], source.revision) : null;
if (cache) await mkdir(cache, { recursive: true });
async function load(family, path) {
  const filename = `${family.id}${path === '000' ? '' : '-' + path}.json`;
  const cached = cache && resolve(cache, filename);
  if (cached) try { await access(cached); return JSON.parse(await readFile(cached, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const url = `https://raw.githubusercontent.com/${source.repository}/${source.revision}/Towers/${family.id}/${filename}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const text = await response.text();
  const model = JSON.parse(text);
  if (cached) await writeFile(cached, text);
  return model;
}
const paths = [];
for (let n = 0; n <= 555; n++) { const path = String(n).padStart(3, '0'); if (validUpgradePath(path)) paths.push(path); }
const catalog = { schemaVersion: 4, source, checked: new Date().toISOString().slice(0, 10), towers: families.map(f => ({ ...f, variants: {} })) };
const jobs = families.flatMap((family, index) => paths.map(path => ({ family, index, path })));
let cursor = 0, completed = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < jobs.length) {
    const { family, index, path } = jobs[cursor++];
    const model = await load(family, path);
    const result = importTowerModel(model, family);
    if (result.path !== path) throw new Error(`Wrong tower path: ${family.id}/${path}`);
    catalog.towers[index].variants[path] = { range: result.range, rangeMode: result.rangeMode, components: result.components, abilities: result.abilities, notes: result.notes };
    completed++;
    if (completed % 250 === 0) console.log(`${completed}/${jobs.length} tower variants imported`);
  }
}));
for (const tower of catalog.towers) tower.variants = Object.fromEntries(Object.entries(tower.variants).sort(([a], [b]) => a.localeCompare(b)));
validateTowerCatalog(catalog);
const target = process.argv.includes('--write') ? 'towers.json' : 'towers.candidate.json';
const output = new URL(`../data/${target}`, import.meta.url);
const temporary = new URL(output.href + '.tmp');
await writeFile(temporary, JSON.stringify(catalog, null, 2) + '\n');
await rename(temporary, output);
console.log(`${families.length} towers, ${completed} crosspaths written to data/${target}. Source v${source.gameVersion} at ${source.revision}. Review before deployment.`);
