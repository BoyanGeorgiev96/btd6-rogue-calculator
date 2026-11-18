// Artifact factors are independent of absolute tower stats, except target DPS
// and target-hit ratios that include flat bonuses and can have a zero baseline.
export function multiplierMetrics(result) {
  return [
    ['dps','Target DPS',result.targetDpsMultiplier],
    ['hit','Target damage / hit',result.baseTargetDamage>0?result.expectedTargetHit/result.baseTargetDamage:null],
    ['speed','Attack speed',result.rate],
    ['pierce','Pierce',result.pierce],
    ['range','Range',result.rangeMode==='global'?null:result.range],
    ['cooldown','Ability cooldown',result.abilityCooldown]
  ].map(([key,label,value])=>({key,label,value}));
}
export function compareMultipliers(before,after) {
  const a=multiplierMetrics(before);
  return multiplierMetrics(after).map((metric,i)=>({...metric,before:a[i].value,after:metric.value,delta:metric.value===null||a[i].value===null?null:metric.value-a[i].value}));
}
export function multiplierScores(before,after,context={}) {
  const rows=compareMultipliers(before,after);
  const delta=key=>rows.find(row=>row.key===key).delta;
  return {dps:delta('dps'),pierce:delta('pierce'),range:delta('range'),cooldown:context.abilityMode==='none'||delta('cooldown')===null?null:-delta('cooldown')};
}
