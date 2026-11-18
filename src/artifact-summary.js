import { calculate, supported } from './calculator.js';
import { artifactRules } from './artifact-rules.js';
const format = value => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
const percent = value => `${value >= 1 ? '+' : ''}${format((value - 1) * 100)}%`;

// The UI describes evaluated effects rather than maintaining its own artifact rules.
export function artifactSummary(artifact, variant, context, artifacts = [artifact], selected = {}) {
  if (!supported.has(artifact.id)) return 'Explore the effect in artifact details.';
  const { breakdown } = calculate(artifacts, { ...selected, [artifact.id]: variant.rarity }, context);
  const effect = breakdown.find(b=>b.id===artifact.id);
  const parts = [];
  if (effect.categoryConversion) parts.push(effect.addedCategories.length === 4 ? 'Counts as every category' : `Counts as ${effect.addedCategories.join(', ')}`);
  if (effect.damageSet !== null) parts.push(`Base hit damage set to ${format(effect.damageSet)}`);
  if (effect.damage !== 1) parts.push(`${percent(effect.damage)} damage`);
  if (effect.rate !== 1) parts.push(`${percent(effect.rate)} attack rate`);
  if (effect.targetDamage !== 1) parts.push(`${percent(effect.targetDamage)} selected-target damage`);
  if (effect.flatDamage) parts.push(`+${format(effect.flatDamage)} selected-target damage`);
  if (effect.pierce !== 1) parts.push(`${percent(effect.pierce)} pierce`);
  if (effect.abilityRate !== 1) parts.push(`${percent(1/effect.abilityRate)} ability cooldown time`);
  if (effect.range !== 1) parts.push(`${percent(effect.range)} range`);
  if (effect.moabDamage !== 1) parts.push(`${percent(effect.moabDamage)} MOAB damage`);
  if (effect.bossOnlyDamage !== 1) parts.push(`${format(effect.bossOnlyDamage)}× boss damage`);
  if (effect.critical?.active) parts.push(`${format(effect.critical.expected)}× expected crit damage${context.criticalMode==='expected'?'':' (estimate off)'}`);
  return parts.join(' · ') || artifactRules[artifact.id].summary || effect.note;
}
