import { targetTypes, targetDamageTrace, validDamageModifiers } from './target-stats.js';
import {artifactCapacityWarning} from './artifact-capacity.js';
// Estimates use verified compatible cooldowns where available and descriptions
// elsewhere. Keep attack rate separate from damage per hit.
import { heroRoster } from './hero-roster.js';
import { powerRoster } from './power-roster.js';
import { validUpgradePath } from './tower-stats.js';
import { artifactRules } from './artifact-rules.js';
import { evaluateEffects, evaluateCritical, explainCondition, matches, resolveCategories } from './effect-engine.js';
export const supported = new Set(Object.keys(artifactRules));
export const towers = {
  Primary: ['Dart Monkey','Boomerang Monkey','Bomb Shooter','Tack Shooter','Ice Monkey','Glue Gunner','Desperado'],
  Military: ['Sniper Monkey','Monkey Sub','Monkey Buccaneer','Monkey Ace','Heli Pilot','Mortar Monkey','Dartling Gunner'],
  Magic: ['Wizard Monkey','Super Monkey','Ninja Monkey','Alchemist','Druid','Mermonkey','Skywarden'],
  Support: ['Banana Farm','Spike Factory','Monkey Village','Engineer Monkey','Beast Handler'],
  Hero: [...heroRoster.map(hero => hero.name), 'Hero'],
  Powers: powerRoster.map(power => power.name)
};
export const defaults = { category:'Primary', tower:'Dart Monkey', tier:3, heroLevel:15, baseDamage:1, baseRate:1, baseBossDamage:null, basePierce:null, baseRange:null, rangeMode:'finite', upgradePath:null, componentId:null, statMode:'manual', presetRevision:null, abilityId:null, baseAbilityCooldown:null, durationOverrides:{}, abilityMode:'manual', criticalMode:'off', targetType:'boss', camo:false, fortified:false, baseDamageModifiers:[], baseCanHitMoab:true, baseDamageExcluded:false, otherMilitaryCount:0, early:false, close:false, aura:false, frozen:false, glued:false, stunned:false };
export function calculate(artifacts, selected, context, rules = artifactRules) {
  const c = {...defaults, ...context};
  if(c.baseDamageExcluded){c.baseDamage=0;c.baseBossDamage=0;c.baseRate=0;c.basePierce=null;c.baseDamageModifiers=[];}
  const entries = [];
  const unmodeled = [];
  for (const artifact of artifacts) {
    const variant = artifact.variants.find(v => v.rarity === selected[artifact.id]);
    if (!variant) continue;
    const definition = Object.hasOwn(rules, artifact.id) ? rules[artifact.id] : null;
    if (!definition) { unmodeled.push(artifact.name); continue; }
    entries.push({ artifact, variant, definition });
  }
  const categories = resolveCategories(entries, c);
  const capped=entries.some(({definition})=>definition.effects.some(e=>e.stat==='damageCap'&&matches(e.when,c,categories)));
  let damage = 1, rate = 1, bossDamage = 1, pierce = 1, range = 1, generalDamage = 1, moabDamage = 1, bossOnlyDamage = 1, targetDamage = 1, flatDamage = 0, abilityRate = 1, damageSet = null, damageCap=null;
  const breakdown = [], criticals = [];
  for (const { artifact, variant, definition } of entries) {
    const effects = evaluateEffects(definition, variant, c, categories);
    const critical = c.baseDamageExcluded || capped ? null : evaluateCritical(definition, variant, c, categories);
    if (critical?.active && c.criticalMode === 'expected') criticals.push({ id: artifact.id, ...critical });
    const inactiveReasons = [...new Set([...definition.effects.map(e=>e.when ?? {}), ...(definition.categories ?? []).map(e=>e.when ?? {}), ...(definition.critical?[definition.critical.when ?? {}]:[])].flatMap(when=>explainCondition(when,c,categories)))];
    const d = effects.damage * effects.regularDamage;
    const r = effects.attackRate;
    const m = effects.moabDamage * effects.bossDamage;
    const bossHitMultiplier = effects.damage * m;
    const addedCategories = [...new Set((definition.categories ?? []).filter(conversion => matches(conversion.when, c, conversion.chain?categories:new Set([c.category]))).flatMap(conversion => conversion.add))];
    const categoryConversion = addedCategories.length > 0;
    const active = d !== 1 || r !== 1 || m !== 1 || effects.pierce !== 1 || effects.range !== 1 || categoryConversion || effects.targetDamage!==1 || effects.flatDamage!==0 || effects.damageSet!==null || effects.abilityRate!==1 || Boolean(critical?.active && c.criticalMode === 'expected');
    if(effects.damageSet!==null)damageSet=effects.damageSet;
    if(effects.damageCap!==null)damageCap=damageCap===null?effects.damageCap:Math.min(damageCap,effects.damageCap);
    abilityRate*=effects.abilityRate;
    generalDamage*=effects.damage;moabDamage*=effects.moabDamage;bossOnlyDamage*=effects.bossDamage;targetDamage*=effects.targetDamage;flatDamage+=effects.flatDamage;
    damage *= d;
    rate *= r;
    bossDamage *= bossHitMultiplier;
    pierce *= effects.pierce;
    range *= effects.range;
    const normalRatio=effects.damageSet!==null&&c.baseDamage>0?effects.damageSet/c.baseDamage:1;
    const originalBoss=c.baseBossDamage??c.baseDamage;
    const replacementBoss=effects.damageSet===null?originalBoss:targetDamageTrace({...c,baseDamage:effects.damageSet,baseBossDamage:effects.damageSet,targetType:'moab'}).value;
    const bossRatio=effects.damageSet!==null&&originalBoss>0?Math.min(replacementBoss,effects.damageCap??Infinity)/originalBoss:1;
    breakdown.push({
      id: artifact.id, name: artifact.name, rarity: variant.rarity,
      damage: d*normalRatio, rate: r, boss: m, bossHitMultiplier:bossHitMultiplier*bossRatio, damageSet:effects.damageSet, pierce: effects.pierce, range: effects.range,
      abilityRate:effects.abilityRate, moabDamage: effects.moabDamage, bossOnlyDamage: effects.bossDamage,
      categoryConversion, addedCategories, critical, inactiveReasons, targetDamage:effects.targetDamage, flatDamage:effects.flatDamage, excluded: definition.excluded ?? [],
      note: active ? 'Applied to this tower.' : critical?.active && c.criticalMode==='off' ? 'Critical-hit estimates are switched off.' : inactiveReasons.join(' ') || 'No modeled stat change at this rarity.', active
    });
  }
  const criticalMultiplier = criticals.length === 1 ? criticals[0].expected : 1;
  const warnings = criticals.length > 1 ? ['Multiple critical-hit artifacts apply. Their interaction is unverified, so critical damage is excluded from this estimate.'] : [];
  const capacityWarning=artifactCapacityWarning(entries.length+unmodeled.length);
  if(capacityWarning)warnings.push(capacityWarning);
  if(c.baseDamageExcluded)warnings.push('Selected component is excluded from ordinary hit damage, attack DPS, pierce and artifact critical estimates. Ability timers remain independent.');
  for(const {definition} of entries)if(definition.caveat&&matches(definition.caveat.when,c,categories))warnings.push(definition.caveat.text);
  for(const {definition} of entries)if(definition.countNote&&matches(definition.countNote.when,c,categories))warnings.push(`${definition.countNote.label}: ${c[definition.countNote.key]}.`);
  const sourceTrace=targetDamageTrace(c);
  const baseTargetDamage=sourceTrace.value;
  const trace=[...sourceTrace.steps];
  const targetIsMoab=c.targetType==='moab'||c.targetType==='boss';
  const replacement=damageSet!==null&&!c.baseDamageExcluded?targetDamageTrace({...c,baseDamage:damageSet,baseBossDamage:damageSet}):null;
  let targetHit=replacement?.value??baseTargetDamage;
  if(replacement)trace.push({label:'Artifact base damage replacement (source target modifiers reapplied)',operation:'set',value:replacement.value,after:targetHit});
  const flatBonus=c.baseDamageExcluded||(c.baseCanHitMoab===false&&targetIsMoab)?0:flatDamage;
  targetHit+=flatBonus;trace.push({label:'Flat artifact target bonuses',operation:'add',value:flatBonus,after:targetHit});
  for(const [label,factor] of [['General artifact damage',targetIsMoab?generalDamage:damage],['Artifact target bonuses',targetDamage],['Artifact MOAB bonuses',targetIsMoab?moabDamage:1],['Artifact Boss-only bonuses',c.targetType==='boss'?bossOnlyDamage:1]]){
    targetHit*=factor;trace.push({label,operation:'multiply',value:factor,after:targetHit});
  }
  if(damageCap!==null){targetHit=Math.min(targetHit,damageCap);trace.push({label:'Artifact maximum ordinary hit damage',operation:'cap',value:damageCap,after:targetHit});}
  const expectedTargetHit=targetHit*criticalMultiplier;
  trace.push({label:criticals.length>1?'Critical damage excluded: overlapping mechanics':c.criticalMode==='off'?'Normal hits (critical estimates off)':'Expected artifact critical damage',operation:'multiply',value:criticalMultiplier,after:expectedTargetHit});
  const targetDpsValue=expectedTargetHit*c.baseRate*rate;
  trace.push({label:'Base attacks per second',operation:'multiply',value:c.baseRate,after:expectedTargetHit*c.baseRate});
  trace.push({label:'Artifact attack-rate multiplier',operation:'multiply',value:rate,after:targetDpsValue});
  const abilityCooldown=1/abilityRate;
  const abilitySeconds=c.baseAbilityCooldown===null?null:c.baseAbilityCooldown*abilityCooldown;
  const hitBase=damageSet!==null&&!c.baseDamageExcluded?damageSet:c.baseDamage;
  const bossBase=damageSet!==null&&!c.baseDamageExcluded?targetDamageTrace({...c,baseDamage:damageSet,baseBossDamage:damageSet,targetType:'moab'}).value:c.baseBossDamage??c.baseDamage;
  const hit=Math.min(hitBase*damage,damageCap??Infinity),bossHit=Math.min(bossBase*bossDamage,damageCap??Infinity);
  const damageFactor=damageSet!==null&&c.baseDamage>0?hit/c.baseDamage:damage;
  const bossFactor=damageSet!==null&&(c.baseBossDamage??c.baseDamage)>0?bossHit/(c.baseBossDamage??c.baseDamage):bossDamage;
  return { abilityRate, abilityCooldown, abilitySeconds, trace, targetHit, expectedTargetHit, targetDpsValue, baseTargetDamage, targetDpsMultiplier:baseTargetDamage*c.baseRate>0?targetDpsValue/(baseTargetDamage*c.baseRate):null, criticalMultiplier, warnings, expectedHit: hit * criticalMultiplier, expectedBossHit: bossHit * criticalMultiplier, damage:damageFactor, rate, bossDamage:bossFactor, pierce, range, projectilePierce: c.basePierce === null ? null : c.basePierce * pierce, attackRange: c.rangeMode === 'global' || c.baseRange === null ? null : c.baseRange * range, rangeMode: c.rangeMode, dps: damageFactor * rate * criticalMultiplier, bossDps: bossFactor * rate * criticalMultiplier,
    hit, bossHit, attacks: c.baseRate * rate,
    breakdown, unmodeled };
}
export function sanitizeState(raw, artifacts) {
  const context={...defaults};
  if(raw?.context && typeof raw.context==='object') {
    const c=raw.context;
    if(Object.hasOwn(towers,c.category))context.category=c.category;
    if(towers[context.category].includes(c.tower))context.tower=c.tower;
    else context.tower=towers[context.category][0];
    for(const [key,min,max] of [['tier',0,5],['heroLevel',1,20],['baseDamage',0,1e9],['baseBossDamage',0,1e9],['baseRate',0,1e6],['basePierce',0,1e9],['baseRange',0,1e9]])
      if(Number.isFinite(c[key]))context[key]=Math.max(min,Math.min(max,c[key]));
    context.targetType=Object.hasOwn(targetTypes,c.targetType)?c.targetType:'boss';
    context.camo=c.camo===true;context.fortified=c.fortified===true;
    context.baseCanHitMoab=c.baseCanHitMoab!==false;
    context.baseDamageExcluded=c.baseDamageExcluded===true;
    if(Number.isInteger(c.otherMilitaryCount)&&c.otherMilitaryCount>=0&&c.otherMilitaryCount<=15)context.otherMilitaryCount=c.otherMilitaryCount;
    if(validDamageModifiers(c.baseDamageModifiers))context.baseDamageModifiers=structuredClone(c.baseDamageModifiers);
    if(typeof c.abilityId==='string'&&c.abilityId.length<=150)context.abilityId=c.abilityId;
    if(Number.isFinite(c.baseAbilityCooldown)&&c.baseAbilityCooldown>0)context.baseAbilityCooldown=Math.min(1e9,c.baseAbilityCooldown);
    if(c.durationOverrides&&typeof c.durationOverrides==='object'&&!Array.isArray(c.durationOverrides))context.durationOverrides=Object.fromEntries(Object.entries(c.durationOverrides).filter(([k,v])=>k.length<=220&&k.includes('::')&&Number.isFinite(v)&&v>0&&v<=1e9).slice(0,100));
    context.abilityMode=['preset','none'].includes(c.abilityMode)?c.abilityMode:'manual';
    if(context.abilityMode==='none'){context.abilityId=null;context.baseAbilityCooldown=null;}
    context.criticalMode=c.criticalMode==='expected'?'expected':'off';
    context.rangeMode=c.rangeMode==='global'?'global':'finite';
    if(context.rangeMode==='global')context.baseRange=null;
    context.tier=Math.round(context.tier);context.heroLevel=Math.round(context.heroLevel);
    if (validUpgradePath(c.upgradePath)) { context.upgradePath=c.upgradePath; context.tier=Math.max(...[...c.upgradePath].map(Number)); }
    if (typeof c.componentId==='string' && c.componentId.length<=150) context.componentId=c.componentId;
    if (context.category==='Hero') { context.upgradePath=null; context.tier=0; }
    if (context.category==='Powers') {
      const power=powerRoster.find(p=>p.name===context.tower);
      if (!power.paths.includes(context.upgradePath)) context.upgradePath='000';
      context.tier=Math.max(...[...context.upgradePath].map(Number));
    }
    const presetSupported=context.category==='Hero' ? heroRoster.some(hero=>hero.name===context.tower) : Boolean(context.upgradePath);
    context.statMode=c.statMode==='preset' && presetSupported ? 'preset' : 'manual';
    if (typeof c.presetRevision==='string' && /^[a-f0-9]{40}$/.test(c.presetRevision)) context.presetRevision=c.presetRevision;
    for(const key of ['early','close','aura','frozen','glued','stunned'])context[key]=c[key]===true;
  }
  const selected={};
  for(const a of artifacts)if(a.variants.some(v=>v.rarity===raw?.selected?.[a.id]))selected[a.id]=raw.selected[a.id];
  return {context,selected};
}
