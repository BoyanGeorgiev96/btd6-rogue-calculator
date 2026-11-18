import {snapshot, compareResults} from './build-tools.js';
import {calculate} from './calculator.js';
import {getPresetVariant} from './tower-stats.js';

const sharedFields = ['targetType','camo','fortified','criticalMode','early','close','aura','frozen','glued','stunned','otherMilitaryCount'];
// Saved actor/component stats are independent. Only the run's environment is shared.
export function compareParty(artifacts, current, builds, catalog) {
  if (!Array.isArray(builds) || builds.length > 8) throw new Error('Choose up to eight saved builds.');
  const run = snapshot(current, artifacts);
  return builds.map(build => {
    const saved = snapshot(build.state, artifacts);
    const context = snapshot(saved, artifacts, catalog).context;
    for (const key of sharedFields) context[key] = run.context[key];
    const variant = getPresetVariant(catalog, context);
    const component = variant?.components.find(c => c.id === context.componentId);
    const ability = variant?.abilities.find(a => a.id === context.abilityId);
    const base = calculate(artifacts, {}, context);
    const result = calculate(artifacts, run.selected, context);
    const notes = [...(variant?.notes ?? []), ...(component?.notes ?? []), ...(ability?.notes ?? []), ...result.warnings,
      ...result.breakdown.flatMap(item => item.excluded.map(note => `${item.name}: ${note}`)),
      ...result.unmodeled.map(name => `${name}: reference only.`)];
    if (context.statMode === 'manual') notes.push('Manual attack stats are retained. Source component values may differ.');
    if (saved.context.statMode === 'preset' && context.statMode !== 'preset') notes.push('The saved component is unavailable in the bundled catalog. Its stats are retained as manual values.');
    if (saved.context.abilityMode === 'preset' && context.abilityMode !== 'preset') notes.push('The saved ability is unavailable in the bundled catalog. Its timer is retained as a manual value.');
    return {id:build.id, name:build.name, context, componentName:component?.name ?? context.componentId ?? 'Manual attack',
      abilityName:ability?.name ?? (context.baseAbilityCooldown === null ? 'No ability' : 'Manual timer'), notes,
      base, result, metrics:compareResults(base, result), gain:result.targetDpsValue-base.targetDpsValue};
  });
}
