import {artifactRules} from './artifact-rules.js';

export const artifactEffectFilters=[
  ['damage','Damage',['damage','regularDamage','moabDamage','bossDamage','targetDamage','flatDamage','damageSet','damageCap']],
  ['speed','Attack speed',['attackRate']],
  ['boss','Boss / MOAB damage',['moabDamage','bossDamage']],
  ['pierce','Pierce',['pierce']],
  ['range','Range',['range']],
  ['cooldown','Ability cooldown',['abilityRate']],
  ['critical','Critical hits',[]],
  ['conversion','Category conversion',[]]
];

// Full-build counterfactual changes: selected artifacts are without -> with;
// unselected artifacts are current -> addition. Positive always means a boost.
export function artifactImpactChanges(before,after) {
  const damage=after.damage-before.damage,boss=after.bossDamage-before.bossDamage;
  const hit=after.expectedTargetHit-before.expectedTargetHit;
  const changes={damage:[damage,boss,hit],boss:[boss],speed:[after.rate-before.rate],pierce:[after.pierce-before.pierce],range:before.rangeMode==='global'||after.rangeMode==='global'?[]:[after.range-before.range],cooldown:[before.abilityCooldown-after.abilityCooldown],critical:[after.criticalMultiplier-before.criticalMultiplier]};
  const all=Object.values(changes).flat();
  return {...changes,conversion:all,all};
}

export function filterArtifactEntries(entries,{effect='all',impact='all',rarity='all'}={}) {
  const spec=artifactEffectFilters.find(([id])=>id===effect);
  if(effect!=='all'&&!spec)throw new Error('Unknown artifact effect filter.');
  if(!['all','boost','penalty'].includes(impact))throw new Error('Unknown artifact impact filter.');
  return entries.filter(entry=>{
    if(rarity!=='all'&&!entry.artifact.variants.some(v=>v.rarity===rarity))return false;
    const definition=Object.hasOwn(artifactRules,entry.artifact.id)?artifactRules[entry.artifact.id]:null;
    if(effect!=='all'&&(!definition||!(effect==='critical'?definition.critical:effect==='conversion'?definition.categories?.length:definition.effects.some(e=>spec[2].includes(e.stat)))))return false;
    if(impact==='all')return true;
    return (entry.impactChanges?.[effect]??[]).some(value=>Number.isFinite(value)&&(impact==='boost'?value>0:value<0));
  });
}
