import {savedMetadata} from './saved-metadata.js';
import {sanitizeState} from './calculator.js';
import {createRunPlan} from './run-planner.js';

export const runPlanKey = 'rogue-lab-run-plan-v1';
export const maxPlanBytes = 100_000;
const conditionKeys = ['targetType','camo','fortified','criticalMode','early','close','aura','frozen','glued','stunned','otherMilitaryCount'];
export function planConditions(context) {
  const clean = sanitizeState({context}, []).context;
  return Object.fromEntries(conditionKeys.map(key => [key,clean[key]]));
}

// Persist inputs, never derived results. Recalculate against bundled source data on load.
export function runPlanSnapshot(artifacts, catalog, context, setup, preferences = {}, artifactVersion = null, metadata = {}) {
  const plan = createRunPlan(artifacts,catalog,context,setup);
  const priority = preferences.priority ?? 'cadence';
  if (!['cadence','pierce','damage'].includes(priority)) throw new Error('Unknown planning preference.');
  const rarities = preferences.rarities ?? {};
  for (const [id,rarity] of Object.entries(rarities)) {
    if (!artifacts.find(a => a.id === id)?.variants.some(v => v.rarity === rarity)) throw new Error('Unknown inspection rarity.');
  }
  const inspected = preferences.inspected ?? {id:artifacts[0].id,rarity:artifacts[0].variants[0].rarity};
  if (!artifacts.find(a => a.id === inspected.id)?.variants.some(v => v.rarity === inspected.rarity)) throw new Error('Unknown inspected artifact or rarity.');
  return {format:'rogue-lab-run-plan',version:1,...savedMetadata(metadata),source:{...catalog.source,artifactVersion},context:planConditions(context),
    setup:{tower:plan.tower,selected:plan.selected,stages:plan.stages.map(stage => ({path:stage.path,componentId:stage.context.componentId,abilityId:stage.context.abilityId,acquired:stage.acquired}))},
    preferences:{priority,rarities:{...rarities},inspected:{id:inspected.id,rarity:inspected.rarity}}};
}
export function parseRunPlan(text, artifacts, catalog, artifactVersion = null) {
  if (typeof text !== 'string' || text.length > maxPlanBytes || new TextEncoder().encode(text).length > maxPlanBytes) throw new Error('Run plan must be at most 100 KB.');
  let raw;
  try { raw=JSON.parse(text); } catch { throw new Error('Run plan is not valid JSON.'); }
  if (raw?.format !== 'rogue-lab-run-plan' || raw.version !== 1 || !raw.setup || !raw.context || !raw.preferences) throw new Error('Unsupported or incomplete run-plan format.');
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(raw.setup.selected) || !Array.isArray(raw.setup.stages) || raw.setup.stages.some(stage => !object(stage) || !object(stage.acquired)) || !object(raw.preferences.rarities)) throw new Error('Invalid plan loadouts or snapshots.');
  const conditions=planConditions(raw.context);
  if (conditionKeys.some(key => (key==='otherMilitaryCount'&&raw.context[key]===undefined?0:raw.context[key]) !== conditions[key])) throw new Error('Invalid target or battle conditions.');
  const snapshot=runPlanSnapshot(artifacts,catalog,conditions,raw.setup,raw.preferences,artifactVersion,raw);
  return {snapshot,sourceChanged:JSON.stringify(raw.source) !== JSON.stringify(snapshot.source)};
}

export const runPlanLibraryKey = 'rogue-lab-run-plans-v1';
export const maxRunPlans = 50;
export const maxPlanLibraryBytes = 2_000_000;
export function createSavedPlan(name, snapshot, id, savedAt = new Date().toISOString()) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('Enter a plan name (up to 80 characters).');
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid plan identifier.');
  return {id,name:name.trim(),savedAt,snapshot:structuredClone(snapshot)};
}
export function exportPlanLibrary(plans, activeId = '') {
  const json = JSON.stringify({format:'rogue-lab-run-plans',version:1,activeId,plans},null,2);
  if (new TextEncoder().encode(json).length > maxPlanLibraryBytes) throw new Error('Plan collection must be at most 2 MB.');
  return json;
}
export function parsePlanLibrary(text, artifacts, catalog, artifactVersion) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > maxPlanLibraryBytes) throw new Error('Plan collection must be at most 2 MB.');
  let raw;
  try {raw=JSON.parse(text);} catch {throw new Error('Plan collection is not valid JSON.');}
  if (raw?.format !== 'rogue-lab-run-plans' || raw.version !== 1 || !Array.isArray(raw.plans) || raw.plans.length > maxRunPlans) throw new Error('Expected a plan collection (version 1, up to 50 plans).');
  const ids=new Set();
  const plans=raw.plans.map(entry=>{
    if (!entry || ids.has(entry.id)) throw new Error('Invalid or duplicate saved plan.');
    ids.add(entry.id);
    const loaded=parseRunPlan(JSON.stringify(entry.snapshot),artifacts,catalog,artifactVersion);
    // Retain original source provenance until explicitly updated by the user.
    const snapshot={...loaded.snapshot,source:entry.snapshot.source};
    return createSavedPlan(entry.name,snapshot,entry.id,typeof entry.savedAt==='string'&&!Number.isNaN(Date.parse(entry.savedAt))?entry.savedAt:'');
  });
  return {plans,activeId:plans.some(entry=>entry.id===raw.activeId)?raw.activeId:''};
}
