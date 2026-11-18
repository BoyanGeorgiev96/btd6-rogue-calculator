import { extractAbilityDuration, timingRestricted } from './ability-duration-import.mjs';
// Only visible, enabled root abilities with a positive repeatable timer.
export function extractAbilities(model) {
  const abilities=[],notes=[];
  for(const behavior of model.behaviors ?? []) {
    if(!behavior.$type?.split(',')[0].endsWith('.AbilityModel'))continue;
    if(behavior.enabled===false||behavior.isHidden||behavior.IsPassive)continue;
    const cooldown=behavior.cooldown;
    if(!Number.isFinite(cooldown)||cooldown<=0||behavior.cooldownSpeedScale){notes.push('Abilities without a fixed positive cooldown are excluded from timer presets.');continue;}
    const id=behavior.modelName ?? behavior.name;
    if(typeof id!=='string'||!id||abilities.some(a=>a.id===id))throw new Error('Invalid or duplicate ability identity');
    const limits=[];
    if(behavior.maxActivationsPerRound>0)limits.push(`Limited to ${behavior.maxActivationsPerRound} activations per round; the cap is not simulated.`);
    if(behavior.maxActivationsPerGame>0)limits.push(`Limited to ${behavior.maxActivationsPerGame} activations per game.`);
    if(behavior.sharedCooldown)limits.push('This ability has a shared cooldown; sharing is not simulated.');
    abilities.push({id,name:behavior.displayName||id,cooldownSeconds:cooldown,duration:extractAbilityDuration(behavior,model),timingRestricted:timingRestricted(behavior),notes:limits});
  }
  return {abilities,notes:[...new Set(notes)]};
}
