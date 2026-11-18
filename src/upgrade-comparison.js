import {calculate} from './calculator.js';
import {applyTowerPreset, validUpgradePath} from './tower-stats.js';

// Independent source presets: never copy main-calculator manual stats or sum attacks.
export function compareUpgrades(artifacts, state, catalog, options = {}) {
  const tower = options.tower ?? state.context.tower;
  const actor = [...catalog.towers,...(catalog.powers??[])].find(entry => entry.name === tower);
  if (!actor) throw new Error('Choose a tower preset. Heroes do not have crosspaths.');
  const referencePath = options.referencePath ?? '000';
  if (!validUpgradePath(referencePath) || !actor.variants[referencePath]) throw new Error('Choose an available legal reference path.');
  const tier = options.tier ?? null;
  if (tier !== null && (!Number.isInteger(tier) || tier < 0 || tier > 5)) throw new Error('Choose a highest tier from 0 to 5.');
  const components = options.components ?? {}, abilities = options.abilities ?? {};
  for (const choices of [components, abilities]) for (const path of Object.keys(choices)) {
    if (!validUpgradePath(path) || !actor.variants[path]) throw new Error('Unavailable upgrade path.');
  }
  const rows = Object.entries(actor.variants).filter(([path]) => validUpgradePath(path)).sort(([a], [b]) => a.localeCompare(b)).map(([path, variant]) => {
    const componentId = components[path] ?? variant.components[0]?.id ?? null;
    const abilityId = abilities[path] ?? variant.abilities[0]?.id ?? null;
    if (componentId && !variant.components.some(entry => entry.id === componentId)) throw new Error('That attack component is unavailable.');
    if (abilityId && !variant.abilities.some(entry => entry.id === abilityId)) throw new Error('That ability is unavailable.');
    const context = structuredClone(applyTowerPreset({...structuredClone(state.context), tower:actor.name, category:actor.category, abilityId,durationOverrides:{}}, catalog, path, componentId));
    const component = variant.components.find(entry => entry.id === context.componentId);
    const ability = variant.abilities.find(entry => entry.id === context.abilityId);
    const base = calculate(artifacts, {}, context), result = calculate(artifacts, state.selected, context);
    const notes = [...variant.notes, ...(component?.notes ?? []), ...(ability?.notes ?? []), ...result.warnings,
      ...result.unmodeled.map(name => `${name}: reference only.`),
      ...result.breakdown.filter(entry => !entry.active).map(entry => `${entry.name}: ${entry.note}`),
      ...result.breakdown.flatMap(entry => entry.excluded.map(note => `${entry.name}: ${note} excluded.`))];
    return {path, context, components:variant.components, abilities:variant.abilities,
      componentName:component?.name ?? 'No direct attack', abilityName:ability?.name ?? 'No ability',
      base, result, artifactGain:result.targetDpsValue-base.targetDpsValue,
      interval:result.attacks > 0 ? 1/result.attacks : null, notes:[...new Set(notes)]};
  });
  const reference = rows.find(row => row.path === referencePath);
  return {tower, reference, rows:rows.filter(row => tier === null || row.context.tier === tier).map(row => ({...row,
    isReference:row.path === referencePath, dpsChange:row.result.targetDpsValue-reference.result.targetDpsValue,
    intervalChange:row.interval === null || reference.interval === null ? null : row.interval-reference.interval}))};
}
