export const targetTypes = { bloon: 'Regular Bloon', ceramic: 'Ceramic', moab: 'MOAB-class', boss: 'Boss' };
export const damageTags = new Set(['Bloons', 'Ceramic', 'Moabs', 'Boss', 'Bosses', 'Camo', 'Fortified']);
export function targetTags(context) {
  const tags = new Set(context.targetType === 'moab' || context.targetType === 'boss' ? ['Moabs'] : ['Bloons']);
  if(context.targetType==='ceramic')tags.add('Ceramic');
  if(context.targetType==='boss'){tags.add('Boss');tags.add('Bosses');}
  if(context.camo)tags.add('Camo');if(context.fortified)tags.add('Fortified');
  return tags;
}
export function validDamageModifiers(modifiers) {
  return Array.isArray(modifiers) && modifiers.length<=100 && modifiers.every(m=>m && Array.isArray(m.tags) && m.tags.length>0 && m.tags.every(t=>damageTags.has(t)) && Number.isFinite(m.multiplier) && m.multiplier>=0 && m.multiplier<=1e9 && Number.isFinite(m.additive) && Math.abs(m.additive)<=1e9 && typeof m.all==='boolean' && typeof m.inverse==='boolean');
}
export function targetDamageTrace(context) {
  const moab=context.targetType==='moab'||context.targetType==='boss';
  let damage=context.baseDamage;
  const steps=[{label:'Base component damage',operation:'base',value:damage,after:damage}];
  if(context.baseDamageExcluded){steps.push({label:'Component excluded from ordinary hit damage',operation:'set',value:0,after:0});return {value:0,steps};}
  if(moab && context.baseCanHitMoab===false){steps.push({label:'Component cannot hit this MOAB/Boss target',operation:'set',value:0,after:0});return {value:0,steps};}
  if(!context.baseDamageModifiers?.length){
    if(moab && context.baseBossDamage!=null){damage=context.baseBossDamage;steps.push({label:'Base MOAB/Boss damage',operation:'set',value:damage,after:damage});}
    return {value:damage,steps};
  }
  const tags=targetTags(context);
  for(const modifier of context.baseDamageModifiers){
    const match=modifier.all?modifier.tags.every(t=>tags.has(t)):modifier.tags.some(t=>tags.has(t));
    if(modifier.inverse?!match:match){
      damage=damage*modifier.multiplier+modifier.additive;
      steps.push({label:`Source ${modifier.inverse?'non-':''}${modifier.tags.join(' / ')} bonus`,operation:'targetModifier',factor:modifier.multiplier,additive:modifier.additive,after:damage});
    }
  }
  if(damage<0){damage=0;steps.push({label:'Clamp damage to zero',operation:'set',value:0,after:0});}
  return {value:damage,steps};
}
export function targetBaseDamage(context) { return targetDamageTrace(context).value; }
