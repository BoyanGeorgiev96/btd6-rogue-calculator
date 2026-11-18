import {savedMetadata} from './saved-metadata.js';
import {compareMultipliers} from './artifact-metrics.js';
import { calculate, sanitizeState } from './calculator.js';
import { restoreTowerContext } from './tower-stats.js';

export const libraryKey = 'rogue-lab-builds-v1';
export const maxBuilds = 50;
const validState = value => value && typeof value === 'object' && !Array.isArray(value) && value.context && typeof value.context === 'object' && !Array.isArray(value.context) && value.selected && typeof value.selected === 'object' && !Array.isArray(value.selected);

export function snapshot(state, artifacts, towerCatalog) {
  const result = sanitizeState(state, artifacts);
  if (towerCatalog) result.context = restoreTowerContext(result.context, towerCatalog);
  return structuredClone(result);
}

// Rerun the full engine: a category conversion can change other artifacts too.
export function artifactCandidate(state, artifact, rarity = null) {
  const candidate = structuredClone(state);
  if (rarity === null) delete candidate.selected[artifact.id];
  else {
    if (!artifact.variants.some(v => v.rarity === rarity)) throw new Error('Unknown artifact rarity.');
    candidate.selected[artifact.id] = rarity;
  }
  return candidate;
}

export function compareResults(before, after) {
  return [
    ['targetDpsValue', 'Target DPS'], ['expectedTargetHit', 'Target damage / hit'],
    ['attacks', 'Attacks / sec'], ['projectilePierce', 'Pierce / projectile'], ['attackRange', 'Range'], ['abilitySeconds','Ability cooldown (sec)']
  ].map(([key, label]) => {
    const a = before[key], b = after[key];
    const beforeGlobal = key === 'attackRange' && before.rangeMode === 'global';
    const afterGlobal = key === 'attackRange' && after.rangeMode === 'global';
    const comparable = !beforeGlobal && !afterGlobal && Number.isFinite(a) && Number.isFinite(b);
    return { key, label, before: a, after: b, beforeGlobal, afterGlobal,
      delta: comparable ? b - a : null, relative: comparable && a !== 0 ? b / a - 1 : null };
  });
}

export function compareBuilds(artifacts, before, after) {
  const a = calculate(artifacts, before.selected, before.context);
  const b = calculate(artifacts, after.selected, after.context);
  return { before: a, after: b, rows: compareResults(a, b),multiplierRows:compareMultipliers(a,b) };
}

export function createSavedBuild(name, state, artifacts, source, id, now = new Date().toISOString(), metadata = {}) {
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  if (!cleanName) throw new Error('Enter a build name.');
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid build identifier.');
  return { id, name: cleanName, ...savedMetadata(metadata), savedAt: now, source: {
    artifacts: String(source?.artifacts ?? '').slice(0, 40), towers: String(source?.towers ?? '').slice(0, 40)
  }, state: sanitizeState(state, artifacts) };
}

export function readLibrary(raw, artifacts) {
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.builds) || raw.builds.length > maxBuilds) throw new Error('Expected a Rogue Lab build collection (version 1, up to 50 builds).');
  const ids = new Set();
  return raw.builds.map(build => {
    if (!validState(build?.state) || ids.has(build.id)) throw new Error('Invalid or duplicate saved build.');
    ids.add(build.id);
    const clean = createSavedBuild(build.name, build.state, artifacts, build.source, build.id,
      typeof build.savedAt === 'string' && !Number.isNaN(Date.parse(build.savedAt)) ? build.savedAt : '', build);
    return clean;
  });
}

export function parseLibrary(text, artifacts) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Build import is too large (maximum 2 MB).');
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('Build import must be valid JSON.'); }
  return readLibrary(raw, artifacts);
}

export function exportLibrary(builds) {
  return JSON.stringify({ schemaVersion: 1, builds }, null, 2);
}
