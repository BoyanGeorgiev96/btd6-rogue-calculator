import { targetTags, damageTags } from './target-stats.js';
// No artifact IDs live here. Evaluate definitions independently of the UI.
const list = value => Array.isArray(value) ? value : [value];
const conditionKeys = new Set(['all', 'any', 'not', 'category', 'originalCategory', 'tower', 'flag', 'minTier', 'maxTier', 'minHeroLevel', 'minPath', 'targetTag']);
const flags = new Set(['early', 'close', 'aura', 'frozen', 'glued', 'stunned']);
const stats = new Set(['damage', 'regularDamage', 'attackRate', 'moabDamage', 'bossDamage', 'pierce', 'range', 'targetDamage', 'flatDamage', 'abilityRate', 'damageSet', 'damageCap']);
const operations = new Set(['multiplier', 'percentIncrease', 'percentDecrease', 'cooldownMultiplier', 'flat']);

export function validateCondition(condition) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) throw new Error('Invalid effect condition');
  for (const [key, value] of Object.entries(condition)) {
    if (!conditionKeys.has(key)) throw new Error(`Unknown condition: ${key}`);
    if (key === 'all' || key === 'any') {
      if (!Array.isArray(value) || !value.length) throw new Error(`Invalid ${key} condition`);
      value.forEach(validateCondition);
    } else if (key === 'minPath') {
      if (!Array.isArray(value) || value.length !== 3 || value.some(n => !Number.isInteger(n) || n < 0 || n > 5)) throw new Error('Invalid minPath condition');
    } else if(key === 'targetTag') {
      if(!list(value).length || list(value).some(t=>!damageTags.has(t)))throw new Error('Unknown target tag');
    } else if (key === 'not') validateCondition(value);
    else if (key === 'flag') { if (!flags.has(value)) throw new Error(`Unknown flag: ${value}`); }
    else if (key === 'category' || key === 'originalCategory' || key === 'tower') {
      if (!list(value).length || list(value).some(v => typeof v !== 'string' || !v)) throw new Error(`Invalid ${key} condition`);
    } else if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${key} condition`);
  }
}

export function matches(condition = {}, context, categories) {
  validateCondition(condition);
  return Object.entries(condition).every(([key, value]) => {
    if (key === 'all') return value.every(c => matches(c, context, categories));
    if (key === 'any') return value.some(c => matches(c, context, categories));
    if (key === 'not') return !matches(value, context, categories);
    if (key === 'category') return list(value).some(c => categories.has(c));
    if (key === 'originalCategory') return list(value).includes(context.category);
    if (key === 'tower') return list(value).includes(context.tower);
    if (key === 'flag') return context[value] === true;
    if (key === 'targetTag') return list(value).some(tag=>targetTags(context).has(tag));
    if (key === 'minPath') return typeof context.upgradePath === 'string' && /^[0-5]{3}$/.test(context.upgradePath) && value.every((n, i) => Number(context.upgradePath[i]) >= n);
    if (key === 'minTier') return context.tier >= value;
    if (key === 'maxTier') return context.tier <= value;
    if (key === 'minHeroLevel') return context.heroLevel >= value;
    return false;
  });
}

export function bindParameters(definition, variant) {
  const values = {};
  for (const [name, index] of Object.entries(definition.parameters)) {
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(variant.params[index])) throw new Error(`Invalid source parameter: ${name}`);
    values[name] = variant.params[index];
  }
  return values;
}

export function multiplier(effect, values, variant, context = {}) {
  if(effect.verified){
    const source=effect.verified[variant?.rarity];
    if(!source || JSON.stringify(source.expectedParams)!==JSON.stringify(variant.sourceParams)) throw new Error('Verified cooldown parameters changed; mechanics review required');
    if(!Number.isFinite(source.cooldown)||source.cooldown<=0)throw new Error('Invalid verified cooldown');
    return 1/source.cooldown;
  }
  if (!stats.has(effect.stat)) throw new Error(`Unknown stat: ${effect.stat}`);
  if (!operations.has(effect.operation)) throw new Error(`Unknown operation: ${effect.operation}`);
  const value = typeof effect.value === 'string' ? values[effect.value] : effect.value;
  if (!Number.isFinite(value)) throw new Error(`Invalid effect value: ${effect.value}`);
  const result = effect.operation === 'percentIncrease' ? 1 + value / 100
    : effect.operation === 'percentDecrease' ? 1 - value / 100
    : effect.operation === 'cooldownMultiplier' ? 1 / value : value;
  if (!Number.isFinite(result) || result < 0) throw new Error(`Invalid multiplier for ${effect.stat}`);
  if(effect.stackCount){
    if(effect.stackCount!=='otherMilitaryCount')throw new Error('Unknown effect stack count.');
    const count=context[effect.stackCount]??0;
    if(!Number.isInteger(count)||count<0||count>15)throw new Error('Invalid effect stack count.');
    const stacked=result**count;
    if(!Number.isFinite(stacked))throw new Error('Invalid stacked multiplier');
    return stacked;
  }
  return result;
}

export function evaluateEffects(definition, variant, context, categories) {
  const values = bindParameters(definition, variant);
  const totals = { damage: 1, regularDamage: 1, attackRate: 1, moabDamage: 1, bossDamage: 1, pierce: 1, range: 1, targetDamage: 1, flatDamage: 0, abilityRate: 1, damageSet: null, damageCap:null };
  for (const effect of definition.effects) {
    const factor = multiplier(effect, values, variant, context);
    if(effect.stat==='abilityRate'&&factor<=0)throw new Error('Ability recharge rate must be positive'); // Validate inactive effects too.
    if (matches(effect.when, context, categories)) { if(effect.stat==='damageSet')totals.damageSet=factor;else if(effect.stat==='damageCap')totals.damageCap=totals.damageCap===null?factor:Math.min(totals.damageCap,factor);else if(effect.stat==='flatDamage')totals.flatDamage+=factor;else totals[effect.stat]*=factor; }
  }
  return totals;
}

export function resolveCategories(entries, context) {
  const categories = new Set([context.category]);
  // First apply identity-based grants; reviewed class converters can then
  // consume those grants. Simultaneous rounds keep chaining order independent.
  const identity = new Set(categories);
  const conversions=entries.flatMap(({definition})=>definition.categories??[]);
  for(const conversion of conversions){
    if(!Array.isArray(conversion.add)||conversion.add.some(c=>typeof c!=='string'))throw new Error('Invalid category conversion');
    if(!conversion.chain&&matches(conversion.when,context,identity))for(const c of conversion.add)categories.add(c);
  }
  let changed;
  do {
    changed=false;const previous=new Set(categories);
    for(const conversion of conversions.filter(c=>c.chain))if(matches(conversion.when,context,previous))for(const c of conversion.add)if(!categories.has(c)){categories.add(c);changed=true;}
  } while(changed);
  return categories;
}

const flagLabels = { early: 'the first 20 seconds', close: 'Close targeting', aura: 'the artifact aura', frozen: 'a frozen target', glued: 'a glued target', stunned: 'a stunned or tranced target' };
export function explainCondition(condition = {}, context, categories) {
  if (matches(condition, context, categories)) return [];
  return Object.entries(condition).flatMap(([key, value]) => {
    if (key === 'all') return value.flatMap(c => explainCondition(c, context, categories));
    if (key === 'any') return value.some(c => matches(c, context, categories)) ? [] : [`Requires one of: ${value.flatMap(c => explainCondition(c, context, categories)).join('; ')}`];
    if (matches({[key]:value}, context, categories)) return [];
    if (key === 'not') return ['Excluded for this tower or condition.'];
    if (key === 'originalCategory') return [`Requires original ${list(value).join(' or ')} category.`];
    if (key === 'category') return [`Requires ${list(value).join(' or ')} category.`];
    if (key === 'tower') return [`Requires ${list(value).join(' or ')}.`];
    if (key === 'targetTag') return [`Requires ${list(value).join(' or ')} target.`];
    if (key === 'flag') return [`Requires ${flagLabels[value]}.`];
    if (key === 'minTier') return [`Requires tower tier ${value} or higher.`];
    if (key === 'maxTier') return [`Requires tower tier ${value} or lower.`];
    if (key === 'minHeroLevel') return [`Requires hero level ${value} or higher.`];
    if (key === 'minPath') return [`Requires ${value.map((n,i)=>n?`${['top','middle','bottom'][i]} path ${n}+`:null).filter(Boolean).join(', ')}.`];
    return [];
  });
}
export function evaluateCritical(definition, variant, context, categories) {
  if (!definition.critical) return null;
  const values = bindParameters(definition, variant), spec = definition.critical;
  const value = input => typeof input === 'string' ? values[input] : input;
  const chance = spec.oneIn !== undefined ? 1 / value(spec.oneIn) : value(spec.chance);
  const damageMultiplier = spec.damagePercent !== undefined ? value(spec.damagePercent) / 100 : value(spec.multiplier);
  if (!Number.isFinite(chance) || chance <= 0 || chance > 1 || !Number.isFinite(damageMultiplier) || damageMultiplier < 1) throw new Error('Invalid critical-hit definition');
  return { chance, damageMultiplier, expected: 1 + chance * (damageMultiplier - 1), active: matches(spec.when, context, categories) };
}
