import {calculate} from './calculator.js';
const stats={damage:['Damage per hit','damage',b=>b.damage],speed:['Attack speed','rate',b=>b.rate],boss:['Boss damage per hit','bossDamage',b=>b.bossHitMultiplier],pierce:['Pierce','pierce',b=>b.pierce],range:['Range','range',b=>b.range],ability:['Ability cooldown','abilityCooldown',b=>1/b.abilityRate],dps:['Target DPS','targetDpsMultiplier',null]};
export function explainMultiplier(artifacts,state,stat) {
  if(!Object.hasOwn(stats,stat))throw new Error('Unknown multiplier.');
  const [label,key,independentFactor]=stats[stat],result=calculate(artifacts,state.selected,state.context);
  const factor=result.breakdown.some(b=>b.damageSet!==null)&&['damage','boss'].includes(stat)?null:independentFactor;
  const entries=result.breakdown.map(b=>{
    if(factor)return {id:b.id,name:b.name,rarity:b.rarity,value:factor(b),conversion:b.categoryConversion,note:b.note};
    const selected={...state.selected};delete selected[b.id];
    return {id:b.id,name:b.name,rarity:b.rarity,before:calculate(artifacts,selected,state.context)[key],after:result[key],conversion:b.categoryConversion,note:b.note};
  });
  return {label,value:result[key],entries,contextual:!factor,
    note:stat==='range'&&state.context.rangeMode==='global'?'Unlimited targeting: range factors do not change targeting range.':!factor?'Each row removes one artifact and recalculates the full build. These contextual changes include replacements/caps, flat bonuses, conversions and crit exclusions. Do not multiply or add the rows.':'Independent artifact factors multiply from ×1. Category conversions can enable factors on other selected artifacts.',
    exclusions:[...result.warnings,...result.unmodeled.map(name=>`${name}: excluded as a reference-only effect.`),...result.breakdown.flatMap(b=>b.excluded.map(e=>`${b.name}: ${e} excluded.`))]};
}
