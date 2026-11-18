import {calculate, supported} from './calculator.js';
import {applyTowerPreset, validUpgradePath} from './tower-stats.js';
import {compareResults} from './build-tools.js';
import {conversionArtifacts} from './synergy-finder.js';

export const planStages = ['Early', 'Mid', 'Late'];
export function createRunPlan(artifacts, catalog, context, setup) {
  const actor = catalog.towers.find(tower => tower.name === setup.tower);
  if (!actor) throw new Error('Choose a tower preset for this plan.');
  if (!Array.isArray(setup.stages) || setup.stages.length !== 3) throw new Error('Choose three upgrade snapshots.');
  const selected = structuredClone(setup.selected ?? {});
  for (const [id, rarity] of Object.entries(selected)) {
    if (!artifacts.find(artifact => artifact.id === id)?.variants.some(variant => variant.rarity === rarity)) throw new Error('Starting loadout contains an unknown artifact or rarity.');
  }
  let loadout = {...selected};
  const stages = setup.stages.map((spec, index) => {
    if (!validUpgradePath(spec.path) || !actor.variants[spec.path]) throw new Error('Choose available legal upgrade paths.');
    if (index && [...spec.path].some((tier, path) => Number(tier) < Number(setup.stages[index-1].path[path]))) throw new Error('Later paths must retain every earlier upgrade. Selling and respecs are not planned.');
    const acquired = spec.acquired ?? {};
    if (index === 0 && Object.keys(acquired).length) throw new Error('Use the starting loadout for Early acquisitions.');
    for (const [id, rarity] of Object.entries(acquired)) {
      if (!artifacts.find(artifact => artifact.id === id)?.variants.some(variant => variant.rarity === rarity)) throw new Error('Chosen acquisitions contain an unknown artifact or rarity.');
    }
    loadout = {...loadout, ...acquired};
    const variant = actor.variants[spec.path];
    if (spec.componentId && !variant.components.some(component => component.id === spec.componentId)) throw new Error('Choose an available attack component.');
    if (spec.abilityId && !variant.abilities.some(ability => ability.id === spec.abilityId)) throw new Error('Choose an available ability.');
    const c = structuredClone(applyTowerPreset({...context, tower:actor.name, category:actor.category, abilityId:spec.abilityId ?? null},catalog,spec.path,spec.componentId));
    const result = calculate(artifacts,loadout,c);
    return {label:planStages[index], selected:{...loadout}, acquired:{...acquired}, path:spec.path, context:c, result, components:variant.components, abilities:variant.abilities,
      componentName:variant.components.find(component => component.id === c.componentId)?.name ?? 'No direct attack',
      notes:[...variant.notes,...(variant.components.find(component => component.id === c.componentId)?.notes ?? []),
        ...(variant.abilities.find(ability => ability.id === c.abilityId)?.notes ?? [])]};
  });
  return {tower:actor.name, selected, stages};
}

const interval = result => result.attacks > 0 ? 1/result.attacks : null;
function changes(before, after) {
  const rows = compareResults(before,after);
  const metrics = rows.filter(row => row.key !== 'expectedTargetHit').map(row => ({...row,
    improvement:row.delta === null ? null : row.delta * (row.key === 'abilitySeconds' ? -1 : 1)}));
  const significant = row => row.improvement !== null && Math.abs(row.improvement) > 1e-10*Math.max(1,Math.abs(row.before ?? 0),Math.abs(row.after ?? 0));
  return {rows, benefits:metrics.filter(row => significant(row) && row.improvement > 0).map(row => row.label),
    losses:metrics.filter(row => significant(row) && row.improvement < 0).map(row => row.label),
    intervalBefore:interval(before), intervalAfter:interval(after)};
}

export function inspectPlanOffer(artifacts, plan, offer) {
  const artifact = artifacts.find(entry => entry.id === offer.id);
  const variant = artifact?.variants.find(entry => entry.rarity === offer.rarity);
  if (!variant) throw new Error('Choose an artifact and an available rarity.');
  const modeled = supported.has(artifact.id);
  const stages = plan.stages.map(stage => {
    const owned = stage.selected ?? plan.selected;
    const result = calculate(artifacts,{...owned,[artifact.id]:offer.rarity},stage.context);
    const delta = changes(stage.result,result);
    const effect = result.breakdown.find(entry => entry.id === artifact.id);
    return {...stage, same:owned[artifact.id] === offer.rarity, previous:owned[artifact.id] ?? null, baseline:stage.result, result, ...delta,
      notes:[...stage.notes,...result.warnings,...(effect ? [effect.note,...effect.excluded] : []),...result.unmodeled.map(name => `${name}: reference only.`)].filter(Boolean)};
  });
  const firstBenefit = modeled ? stages.findIndex(stage => !stage.same && stage.benefits.length) : -1;
  for (const [index, stage] of stages.entries()) {
    stage.advice = !modeled ? 'Outside model' : stage.same ? 'Already selected' : stage.losses.length ? (stage.benefits.length ? 'Review tradeoffs' : 'Avoid for modeled stats') : stage.result.warnings.length ? 'Review uncertainty'
      : stage.benefits.length ? 'Consider if offered' : firstBenefit > index ? `Defer modeled benefit to ${planStages[firstBenefit]}` : 'No measured benefit';
  }
  return {artifact, rarity:variant.rarity, modeled, same:stages.every(stage => stage.same), previous:plan.selected[artifact.id] ?? null, stages, firstBenefit};
}

// Ordering is an explicit stat preference, not a learned survival or offer policy.
export function suggestPlanOffers(artifacts, plan, {rarities = {}, priority = 'cadence', limit = 8} = {}) {
  if (!['cadence','pierce','damage'].includes(priority)) throw new Error('Choose a planning stat preference.');
  const candidates = artifacts.filter(artifact => supported.has(artifact.id)).map(artifact => inspectPlanOffer(artifacts,plan,
    {id:artifact.id,rarity:rarities[artifact.id] ?? plan.selected[artifact.id] ?? artifact.variants[0].rarity}));
  const score = offer => {
    const stage = offer.stages[offer.firstBenefit];
    if (!stage) return -Infinity;
    const key = {cadence:'attacks',pierce:'projectilePierce',damage:'targetDpsValue'}[priority];
    return stage.rows.find(row => row.key === key)?.relative ?? 0;
  };
  return candidates.filter(offer => !offer.same && offer.firstBenefit >= 0).sort((a,b) => {
    const risky=offer=>offer.stages.some(stage=>stage.losses.length || stage.result.warnings.length);
    return Number(risky(a))-Number(risky(b))
      || a.firstBenefit-b.firstBenefit || score(b)-score(a) || a.artifact.name.localeCompare(b.artifact.name);
  }).slice(0,limit);
}

export function planConversionPairs(artifacts, plan, offer) {
  return conversionArtifacts(artifacts).filter(artifact => artifact.id !== offer.id && !plan.selected[artifact.id]).map(converter => {
    const rarity=converter.variants[0].rarity;
    const alone=inspectPlanOffer(artifacts,plan,offer);
    const selected={...plan.selected,[converter.id]:rarity};
    const withConverter={...plan,selected,stages:plan.stages.map(stage => {
      const stageSelected={...(stage.selected ?? plan.selected),[converter.id]:stage.selected?.[converter.id] ?? rarity};
      return {...stage,selected:stageSelected,result:calculate(artifacts,stageSelected,stage.context)};
    })};
    const paired=inspectPlanOffer(artifacts,withConverter,offer);
    const stages=paired.stages.map((stage,index) => ({label:stage.label,result:stage.result,...changes(plan.stages[index].result,stage.result),
      newlyActive:!alone.stages[index].result.breakdown.find(entry=>entry.id===offer.id)?.active && Boolean(stage.result.breakdown.find(entry=>entry.id===offer.id)?.active),
      warnings:stage.result.warnings}));
    return {converter,rarity,stages};
  }).filter(pair => pair.stages.some(stage => stage.newlyActive));
}
