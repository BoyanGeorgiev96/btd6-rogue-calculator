// Nominal timing only: cooldown starts at activation, immediate reactivation,
// no charge consumption, cooldown floor, downtime or activation restrictions.
export function abilityTiming(duration,cooldownSeconds) {
  const durationSeconds=duration?.seconds??null;
  const known=Number.isFinite(durationSeconds)&&durationSeconds>0&&duration?.gapEligible===true&&Number.isFinite(cooldownSeconds)&&cooldownSeconds>0;
  return {durationSeconds,gapSeconds:known?Math.max(0,cooldownSeconds-durationSeconds):null,uptime:known?Math.min(1,durationSeconds/cooldownSeconds):null};
}

export function durationOverrideKey(context,abilityId) {
  return `${context.tower}::${abilityId??'manual'}`;
}
export function setManualAbilityDuration(context,abilityId,seconds) {
  if(seconds!==null&&(!Number.isFinite(seconds)||seconds<=0||seconds>1e9))throw new Error('Enter a positive duration in seconds, or clear it to restore the source duration.');
  const overrides={...context.durationOverrides},key=durationOverrideKey(context,abilityId);
  if(seconds===null)delete overrides[key];else overrides[key]=seconds;
  if(Object.keys(overrides).length>100)throw new Error('Keep at most 100 manual duration overrides.');
  return {...context,durationOverrides:overrides};
}
