import {artifactRules} from './artifact-rules.js';
import {defaults, towers, calculate} from './calculator.js';
import {matches, resolveCategories, bindParameters, multiplier, evaluateCritical, explainCondition} from './effect-engine.js';

export const conversionArtifacts = artifacts => artifacts.filter(a => artifactRules[a.id]?.categories?.length);

function entriesFor(artifacts, selected) {
  return artifacts.flatMap(artifact => {
    const definition = artifactRules[artifact.id];
    const variant = artifact.variants.find(v => v.rarity === selected[artifact.id]);
    return definition && variant ? [{artifact, definition, variant}] : [];
  });
}
function inspect(artifacts, selected, converter, context) {
  const without = {...selected};
  delete without[converter.id];
  const entries = entriesFor(artifacts, without);
  const before = resolveCategories(entries, context);
  const after = resolveCategories([...entries, {definition:artifactRules[converter.id]}], context);
  const added = [...after].filter(c => !before.has(c));
  const unlocks = [];
  if (added.length) for (const artifact of artifacts) {
    const definition = artifactRules[artifact.id];
    if (!definition || artifact.id === converter.id) continue;
    const owned = Boolean(selected[artifact.id]);
    const variant = artifact.variants.find(v => v.rarity === selected[artifact.id]) ?? artifact.variants[0];
    const values = bindParameters(definition, variant);
    const effects = definition.effects.flatMap(effect => {
      if (matches(effect.when, context, before) || !matches(effect.when, context, after)) return [];
      const value = multiplier(effect, values, variant, context);
      if (value === (effect.stat === 'flatDamage' ? 0 : 1)) return [];
      return [{stat:effect.stat, value, penalty:effect.stat !== 'flatDamage' && value < 1}];
    });
    if(definition.categories?.some(c=>c.chain&&!matches(c.when,context,before)&&matches(c.when,context,after)))effects.push({stat:'conversion',value:1,penalty:false});
    if (context.criticalMode === 'expected' && definition.critical && !matches(definition.critical.when, context, before)) {
      const critical = evaluateCritical(definition, variant, context, after);
      if (critical.active && critical.expected > 1) effects.push({stat:'critical', value:critical.expected, penalty:false});
    }
    if (effects.length) unlocks.push({id:artifact.id, name:artifact.name, rarity:variant.rarity, owned, effects});
  }
  return {before:[...before], after:[...after], added, unlocks};
}

// Compare conversion presence, retaining every other conversion in the build.
// Effect rows explain activation, not additive marginal DPS or net benefit.
export function findSynergies(artifacts, state, converterId) {
  const converter = conversionArtifacts(artifacts).find(a => a.id === converterId);
  if (!converter) throw new Error('Choose a modeled category conversion.');
  const context = {...defaults, ...state.context};
  const selected = state.selected ?? {};
  const rarity = selected[converter.id] ?? converter.variants[0].rarity;
  const current = inspect(artifacts, selected, converter, context);
  const without = {...selected}; delete without[converter.id];
  const withConversion = {...without, [converter.id]:rarity};
  const base = calculate(artifacts, without, context);
  const result = calculate(artifacts, withConversion, context);
  const conversions = artifactRules[converter.id].categories;
  const identity = new Set(current.after);
  const reasons = conversions.some(c => matches(c.when, context, identity)) ? []
    : [...new Set(conversions.flatMap(c => explainCondition(c.when, context, identity)))];
  const beneficiaries = Object.entries(towers).flatMap(([category, names]) => names.flatMap(tower => {
    // Identity exploration only: never carry another tower's paths or infer stats.
    const actor = {...context, category, tower, upgradePath:null,
      tier:category==='Powers'?Math.min(context.tier,tower==='Super Monkey Beacon'?3:0):context.tier};
    const analysis = inspect(artifacts, selected, converter, actor);
    const bonuses = analysis.unlocks.filter(u => u.effects.some(e => !e.penalty));
    if (!bonuses.length) return [];
    return [{category, tower, added:analysis.added, bonuses:bonuses.map(u => u.name),
      penalties:analysis.unlocks.filter(u => u.effects.some(e => e.penalty)).map(u => u.name)}];
  }));
  return {converter, rarity, owned:Boolean(selected[converter.id]), ...current, reasons, base, result, beneficiaries};
}
