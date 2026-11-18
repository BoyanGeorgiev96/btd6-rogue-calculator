import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { heroRoster } from '../src/hero-roster.js';
import { validateHeroCatalog } from '../src/tower-stats.js';
import { importHeroModel } from './tower-import.mjs';
const source = JSON.parse(await readFile(new URL('../data/tower-source.json', import.meta.url), 'utf8'));
if (source.repository !== 'Btd6ModHelper/btd6-game-data' || !/^[a-f0-9]{40}$/.test(source.revision)) throw new Error('Unrecognized hero source');
const cacheIndex = process.argv.indexOf('--cache-dir');
const cache = cacheIndex >= 0 ? resolve(process.argv[cacheIndex + 1], source.revision) : null;
if (cache) await mkdir(cache, { recursive: true });
async function load(hero, level) {
  const filename = `${hero.id}${level === 1 ? '' : ' ' + level}.json`;
  const cached = cache && resolve(cache, filename);
  if (cached) try { await access(cached); return JSON.parse(await readFile(cached, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const response = await fetch(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/Towers/${hero.id}/${encodeURIComponent(filename)}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const text = await response.text(), model = JSON.parse(text);
  if (cached) await writeFile(cached, text);
  return model;
}
const catalog = { schemaVersion: 4, source, checked: new Date().toISOString().slice(0, 10), heroes: heroRoster.map(hero => ({ id: hero.id, name: hero.name, levels: {} })) };
const jobs = heroRoster.flatMap((hero, index) => Array.from({ length: 20 }, (_, n) => ({ hero, index, level: n + 1 })));
let cursor = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < jobs.length) {
    const { hero, index, level } = jobs[cursor++];
    const result = importHeroModel(await load(hero, level), hero);
    if (result.level !== level) throw new Error(`Wrong hero level: ${hero.id}/${level}`);
    catalog.heroes[index].levels[String(level)] = { range: result.range, rangeMode: result.rangeMode, components: result.components, abilities: result.abilities, notes: result.notes };
  }
}));
validateHeroCatalog(catalog);
const target = process.argv.includes('--write') ? 'heroes.json' : 'heroes.candidate.json';
const output = new URL(`../data/${target}`, import.meta.url), temporary = new URL(output.href + '.tmp');
await writeFile(temporary, JSON.stringify(catalog, null, 2) + '\n');
await rename(temporary, output);
console.log(`${heroRoster.length} heroes, ${jobs.length} levels written to data/${target}. Source v${source.gameVersion} at ${source.revision}. Review before deployment.`);
