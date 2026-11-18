// Reviewed gameplay fields from the pinned v56 export. Never scan arbitrary
// lifespan fields: visual effects, projectiles and animation timers differ.
const fields={
  TurboModel:'lifespan',MonkeyFanClubModel:'lifespan',CallToArmsModel:'lifespan',
  LongArmOfLightModel:'lifespan',DroneSwarmModel:'duration',UCAVModel:'duration',
  FlightBoostAbilityModel:'lifespan',SyphonFundingModel:'lifespan',
  BiohackModel:'lifespan',BloodSacrificeModel:'buffDuration',
  BrickellFreezeMinesAbilityBuffModel:'lifespan',ImmunityModel:'lifespan',
  ActivateRateSupportZoneModel:'lifespan',ActivateTowerDamageSupportZoneModel:'lifespan',
  ActivatePierceSupportZoneModel:'lifespan',ActivateVisibilitySupportZoneModel:'lifespan',
  ActivateDamageModifierSupportZoneModel:'lifespan',ActivateIgnoreStunSupportZoneModel:'lifespan',
  ActivateTempTargetPrioSupportZoneModel:'lifespan',ActivateRangeSupportZoneModel:'lifespan',
  ActivateDamageBypassSupportZoneModel:'lifespan',ActivateProjectileSpeedSupportZoneModel:'lifespan',
  ActivateRicochetSupportZoneModel:'lifespan'
};
const sustainedAttacks=new Set(['TackShooter/Ability','MortarMonkey/Ability','DartlingGunner/RocketStorm','Alchemist/Ability','SpikeFactory/Ability','Ezili/HeartstopperAbility']);
const type=b=>b.$type?.split(',')[0].split('.').at(-1);
function child(node,kind,path) {
  const found=(node?.behaviors??[]).map((b,i)=>({node:b,path:`${path}.behaviors[${i}]`})).filter(b=>type(b.node)===kind);
  return found.length===1?found[0]:null;
}
function projectileDuration(ability,model) {
  const key=`${model.baseId}/${ability.modelName}`;
  if(!['Quincy/StormOfArrowsAbility','Gwendolin/WallOfFire','NinjaMonkey/Ability'].includes(key))return null;
  const attack=child(ability,'ActivateAttackModel','');
  const attacks=attack?.node.attacks;
  if(attacks?.length!==1||attacks[0].weapons?.length!==1)return null;
  let projectile={node:attacks[0].weapons[0].projectile,path:attack.path.slice(1)+'.attacks[0].weapons[0].projectile'};
  if(model.baseId!=='NinjaMonkey'){
    const spawn=child(projectile.node,'CreateProjectileOnExhaustFractionModel',projectile.path);
    if(!spawn)return null;
    projectile={node:spawn.node.projectile,path:spawn.path+'.projectile'};
  }
  const age=child(projectile.node,'AgeModel',projectile.path);
  return age&&Number.isFinite(age.node.lifespan)&&age.node.lifespan>0?{seconds:age.node.lifespan,path:age.path+'.lifespan',conditional:false}:null;
}
export function extractAbilityDuration(ability,model={}) {
  const matches=[];
  for(const [index,b] of (ability.behaviors??[]).entries()) {
    const t=type(b);
    const frameField=model.baseId==='CaptainChurchill'?(ability.modelName==='ArmorPiercingShells'&&['ChangeDamageTypeModel','MutateProjectileOnAbilityModel','MutateCreateProjectileOnExhaustPierceOnAbilityModel'].includes(t)?'lifespanFrames':ability.modelName==='MOABBarrage'&&t==='MoabBarrageModel'?'durationFrames':null):null;
    if(frameField&&Number.isFinite(b[frameField])&&b[frameField]>0)matches.push({seconds:b[frameField]/60,path:`behaviors[${index}].${frameField}`,frames:true,conditional:false});
    const field=fields[t]??(t==='ActivateAttackModel'&&b.isOneShot===false&&sustainedAttacks.has(`${model.baseId}/${ability.modelName}`)?'lifespan':null);
    if(field&&Number.isFinite(b[field])&&b[field]>0)matches.push({seconds:b[field],path:`behaviors[${index}].${field}`,conditional:['BiohackModel','BloodSacrificeModel'].includes(t)});
  }
  const projectile=projectileDuration(ability,model);
  if(projectile)matches.push(projectile);
  // Multi-phase abilities retain unknown duration until their phases are reviewed.
  if(!matches.length||matches.some(m=>m.seconds!==matches[0].seconds))return null;
  return {seconds:matches[0].seconds,sourcePaths:matches.map(m=>m.path),...(matches.some(m=>m.frames)?{framesPerSecond:60}:{}),gapEligible:!matches.some(m=>m.conditional)&&!(ability.behaviors??[]).some(b=>type(b)==='MorphTowerModel')&&!(ability.maxActivationsPerRound>0||ability.maxActivationsPerGame>0||ability.sharedCooldown||ability.additionalCharges>0||ability.livesCost>0)};
}

export function timingRestricted(ability) {
  return Boolean(ability.maxActivationsPerRound>0||ability.maxActivationsPerGame>0||ability.sharedCooldown||ability.additionalCharges>0||ability.livesCost>0||(ability.behaviors??[]).some(b=>['BiohackModel','BloodSacrificeModel','MorphTowerModel'].includes(type(b))));
}
