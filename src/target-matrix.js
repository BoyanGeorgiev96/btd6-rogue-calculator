import {calculate} from './calculator.js';
import {snapshot} from './build-tools.js';

// Fortification is deliberately fixed per column; Camo and battle conditions
// are shared. Never infer detection from a positive damage estimate.
export const matrixTargets = Object.freeze([
  Object.freeze({id:'bloon', label:'Regular', targetType:'bloon', fortified:false}),
  Object.freeze({id:'ceramic', label:'Ceramic', targetType:'ceramic', fortified:false}),
  Object.freeze({id:'fortified-ceramic', label:'Fortified Ceramic', targetType:'ceramic', fortified:true}),
  Object.freeze({id:'moab', label:'MOAB-class', targetType:'moab', fortified:false}),
  Object.freeze({id:'boss', label:'Boss', targetType:'boss', fortified:false})
]);

export function compareTargets(artifacts, state) {
  const current = snapshot(state, artifacts);
  return matrixTargets.map(target => {
    const context = {...current.context, targetType:target.targetType, fortified:target.fortified};
    const base = calculate(artifacts, {}, context);
    const result = calculate(artifacts, current.selected, context);
    const notes = [...result.warnings,
      ...result.unmodeled.map(name => `${name}: reference only.`),
      ...result.breakdown.filter(b => !b.active).map(b => `${b.name}: ${b.note}`),
      ...result.breakdown.flatMap(b => b.excluded.map(note => `${b.name}: ${note} excluded.`))];
    const excluded = context.baseDamageExcluded || (context.targetType === 'moab' || context.targetType === 'boss') && !context.baseCanHitMoab;
    return {...target, context, base, result, gain:result.targetDpsValue-base.targetDpsValue,
      eligibility:excluded ? 'Excluded for this component / original target' : 'Unknown — detection and immunities not modeled',
      notes:[...new Set(notes)]};
  });
}
