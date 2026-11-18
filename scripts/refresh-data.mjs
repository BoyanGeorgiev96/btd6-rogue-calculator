import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateCatalog, diffCatalog, formatReport } from './catalog-validation.mjs';
const base = 'https://btd6apiexplorer.github.io/data/';
const get = async name => {
  const response = await fetch(base + name, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
};
export function normalize(rogue, english, constants) {
  if (!rogue?.artifacts || typeof rogue.artifacts !== 'object' || Array.isArray(rogue.artifacts)) throw new Error('Missing upstream artifacts');
  const groups = new Map();
  for (const item of Object.values(rogue.artifacts)) {
    if (!item || typeof item.baseId !== 'string') throw new Error('Invalid upstream artifact');
    if (item.isQuestArtifact || item.baseId.startsWith('Token')) continue;
    const name = english[item.nameLocKey], template = english[item.descriptionLocKey];
    if (typeof name !== 'string' || typeof template !== 'string' || !Array.isArray(item.descriptionParams)) throw new Error(`${item.baseId}: missing localization or parameters`);
    if (!groups.has(item.baseId)) groups.set(item.baseId, {
      id: item.baseId,
      name: name.replace(/\s*\{0\}|\s+(Common|Rare|Legendary)$/g, '').trim(),
      category: item.rarityFrameType === 'AllMonkeyTowerSets' ? 'All monkeys' : item.rarityFrameType,
      boss: Boolean(item.isBossArtifact), variants: []
    });
    const sourceTemplate = template.replaceAll('&amp;', '&');
    const sourceParams = item.descriptionParams.map(String);
    const description = sourceTemplate.replace(/\{(\d+)\}/g, (_, n) => {
      if (sourceParams[n] === undefined) throw new Error(`${item.baseId}: missing parameter ${n}`);
      return sourceParams[n];
    });
    groups.get(item.baseId).variants.push({
      rarity: ['Common', 'Rare', 'Legendary'][item.tier], description,
      params: sourceParams.map(p => p.trim() !== '' && Number.isFinite(Number(p)) ? Number(p) : p),
      sourceTemplate, sourceParams
    });
  }
  const catalog = {
    version: constants.projectContentVersion, checked: new Date().toISOString().slice(0, 10),
    source: 'https://github.com/HalfHydra/BTD6-API-Explorer',
    artifacts: [...groups.values()].sort((a,b) => a.name.localeCompare(b.name))
  };
  validateCatalog(catalog);
  return catalog;
}

// Fetch and validate before touching the active catalog. Write via rename so an
// interrupted write cannot truncate the previous snapshot.
async function atomicWrite(url, text) {
  const temporary = new URL(url.href + '.tmp');
  await writeFile(temporary, text);
  await rename(temporary, url);
}
export async function applyRefresh(previous, next, contracts, directory = new URL('../data/', import.meta.url)) {
  const report = diffCatalog(previous, next, contracts);
  const changed = report.fromVersion !== report.toVersion || report.added.length || report.removed.length || report.changed.length;
  if (!changed && !report.requiresReview.length) return { report, status: 'unchanged' };
  const status = report.requiresReview.length ? 'review-required' : 'updated';
  const target = status === 'updated' ? 'artifacts.json' : 'artifacts.candidate.json';
  await atomicWrite(new URL(target, directory), JSON.stringify(next, null, 2) + '\n');
  await atomicWrite(new URL('refresh-report.md', directory), formatReport(report));
  if (status === 'updated') await rm(new URL('artifacts.candidate.json', directory), { force: true });
  return { report, status };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [rogue, english, constants, previous, contracts] = await Promise.all([
      ...['rogueData.json','English.json','Constants.json'].map(get),
      readFile(new URL('../data/artifacts.json', import.meta.url), 'utf8').then(JSON.parse),
      readFile(new URL('../data/catalog-contract.json', import.meta.url), 'utf8').then(JSON.parse)
    ]);
    const { report, status } = await applyRefresh(previous, normalize(rogue, english, constants), contracts);
    console.log(`${status}: v${report.toVersion}; ${report.changed.length} changed, ${report.added.length} new, ${report.removed.length} removed.`);
    if (status === 'review-required') { console.error('Active catalog preserved. Review data/refresh-report.md and data/artifacts.candidate.json.'); process.exitCode = 2; }
  } catch (error) { console.error(`Refresh failed: ${error.message}`); process.exitCode = 1; }
}
