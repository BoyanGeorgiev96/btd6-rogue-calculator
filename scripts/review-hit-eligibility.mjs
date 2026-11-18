import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {eligibilityEvidence} from './eligibility-evidence.mjs';

const source = JSON.parse(await readFile(new URL('../data/tower-source.json', import.meta.url)));
const catalog = JSON.parse(await readFile(new URL('../data/artifacts.json', import.meta.url)));
if (source.repository !== 'Btd6ModHelper/btd6-game-data' || !/^[a-f0-9]{40}$/.test(source.revision)) throw new Error('Invalid pinned source');
const cacheIndex = process.argv.indexOf('--cache-dir');
if (cacheIndex >= 0 && !process.argv[cacheIndex+1]) throw new Error('--cache-dir requires a directory');
const cache = cacheIndex < 0 ? null : resolve(process.argv[cacheIndex+1]);
if (cache) await mkdir(cache, {recursive:true});
async function fetchText(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
// Always get the tree from the pinned upstream revision. Cached content must
// match its Git blob hash; a cache from a different source cannot pass silently.
const tree = JSON.parse(await fetchText(`https://api.github.com/repos/${source.repository}/git/trees/${source.revision}?recursive=1`));
if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete pinned source tree');
const files = tree.tree.filter(f => f.type === 'blob' && /^Artifacts\/[^/]+\.json$/.test(f.path)).sort((a,b) => a.path.localeCompare(b.path));
if (!files.length) throw new Error('No artifact models in pinned source');
const models = new Map(), scanned = [];
let cursor = 0;
await Promise.all(Array.from({length:8}, async () => {
  while (cursor < files.length) {
    const file = files[cursor++];
    const local = cache && resolve(cache, basename(file.path));
    let content;
    if (local) try {content = await readFile(local);} catch (error) {if (error.code !== 'ENOENT') throw error;}
    if (!content) {
      content = Buffer.from(await fetchText(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${file.path}`));
    }
    const hash = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    if (hash !== file.sha) throw new Error(`${file.path}: cached/downloaded model differs from pinned blob`);
    const data = JSON.parse(content);
    if (local) await writeFile(local, content);
    const model = data.itemArtifactModel;
    scanned.push({path:file.path, blob:file.sha});
    if (!model) continue;
    const entry = {path:file.path, blob:file.sha, sourceTier:model.tier, findings:eligibilityEvidence(model)};
    if (!models.has(model.baseId)) models.set(model.baseId, []);
    models.get(model.baseId).push(entry);
  }
}));
const report = {
  schemaVersion:1, source, artifactDescriptionVersion:catalog.version,
  scope:'Evidence inventory, not implemented eligibility. Raw fields do not prove runtime behavior. Added attacks/DOT do not grant their coverage to the selected component. Source v56 and description v57 differences require review.',
  scanned:scanned.sort((a,b) => a.path.localeCompare(b.path)),
  artifacts:catalog.artifacts.map(artifact => {
    const entries = (models.get(artifact.id) ?? []).sort((a,b) => a.path.localeCompare(b.path));
    return {id:artifact.id, name:artifact.name,
      descriptions:artifact.variants.map(v => ({rarity:v.rarity, description:v.description})),
      status:!entries.length ? 'missing-pinned-model' : entries.some(e => e.findings.length) ? 'review-candidate-fields' : 'no-candidate-fields-found',
      models:entries};
  })
};
await writeFile(new URL('../docs/hit-eligibility-review.json', import.meta.url), JSON.stringify(report,null,2)+'\n');
console.log(`Scanned ${files.length} pinned models; inventoried all ${report.artifacts.length} catalog artifacts. ${report.artifacts.filter(a => a.status === 'missing-pinned-model').length} lack a matching pinned model. No active calculation rules changed.`);
