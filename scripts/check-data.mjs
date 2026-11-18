import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateTowerCatalog, validateHeroCatalog, validatePowerCatalog } from '../src/tower-stats.js';
import { reviewCatalog } from './catalog-validation.mjs';

export async function checkData({ candidate = false } = {}) {
  const [catalog, contracts] = await Promise.all([candidate ? 'artifacts.candidate.json' : 'artifacts.json', 'catalog-contract.json'].map(name => readFile(new URL(`../data/${name}`, import.meta.url), 'utf8').then(JSON.parse)));
  const towerCatalog = JSON.parse(await readFile(new URL('../data/towers.json', import.meta.url), 'utf8'));
  validateTowerCatalog(towerCatalog);
  const heroCatalog = JSON.parse(await readFile(new URL('../data/heroes.json', import.meta.url), 'utf8'));
  validateHeroCatalog(heroCatalog);
  if (JSON.stringify(heroCatalog.source) !== JSON.stringify(towerCatalog.source)) throw new Error('Hero catalog does not match the pinned tower source.');
  const powerCatalog=JSON.parse(await readFile(new URL('../data/powers.json',import.meta.url),'utf8'));
  validatePowerCatalog(powerCatalog);
  if(JSON.stringify(powerCatalog.source)!==JSON.stringify(towerCatalog.source))throw new Error('Power catalog does not match the pinned tower source.');
  const towerSource = JSON.parse(await readFile(new URL('../data/tower-source.json', import.meta.url), 'utf8'));
  if (JSON.stringify(towerCatalog.source) !== JSON.stringify(towerSource)) throw new Error('Tower catalog does not match the pinned source manifest. Regenerate and review it.');
  const issues = reviewCatalog(catalog, contracts);
  if (issues.length) throw new Error(issues.map(issue => `${issue.id}: ${issue.reason}`).join('\n'));
  console.log(`Catalog v${catalog.version}: source contracts and calculation rules validated.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await checkData({ candidate: process.argv.includes('--candidate') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
