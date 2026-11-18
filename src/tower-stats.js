import { abilityTiming, durationOverrideKey } from './ability-timing.js';
import { validDamageModifiers } from './target-stats.js';
import { powerRoster } from './power-roster.js';
// Pure preset selection and state transitions. No network or DOM access.
export function validUpgradePath(path) {
  if (typeof path !== 'string' || !/^[0-5]{3}$/.test(path)) return false;
  const tiers = [...path].map(Number).sort((a, b) => b - a);
  return tiers[1] <= 2 && tiers[2] === 0;
}
export function getTowerVariant(catalog, tower, path) {
  if (!validUpgradePath(path)) return null;
  return catalog.towers.find(t => t.name === tower)?.variants[path] ?? null;
}
export function getHeroVariant(catalog, hero, level) {
  if (!Number.isInteger(level) || level < 1 || level > 20) return null;
  return catalog.heroes?.find(h => h.name === hero)?.levels[String(level)] ?? null;
}
export function getPresetVariant(catalog, context) {
  if (context.category === 'Powers') return catalog.powers?.find(p => p.name === context.tower)?.variants[context.upgradePath ?? '000'] ?? null;
  return context.category === 'Hero'
    ? getHeroVariant(catalog, context.tower, context.heroLevel)
    : getTowerVariant(catalog, context.tower, context.upgradePath ?? '000');
}
export function getPresetSourceUrl(catalog, context) {
  if (context.category === 'Powers') {
    const path = getPresetVariant(catalog, context)?.sourcePath;
    return path ? `https://github.com/Btd6ModHelper/btd6-game-data/blob/${catalog.source.revision}/${path}` : null;
  }
  const hero = context.category === 'Hero';
  const actor = (hero ? catalog.heroes : catalog.towers)?.find(a => a.name === context.tower);
  if (!actor) return null;
  const suffix = hero ? (context.heroLevel === 1 ? '' : ` ${context.heroLevel}`)
    : (!context.upgradePath || context.upgradePath === '000' ? '' : `-${context.upgradePath}`);
  return `https://github.com/Btd6ModHelper/btd6-game-data/blob/${catalog.source.revision}/Towers/${actor.id}/${encodeURIComponent(actor.id + suffix + '.json')}`;
}
export function applyTowerPreset(context, catalog, path = '000', componentId = null) {
  const hero = context.category === 'Hero';
  if (!hero && !validUpgradePath(path)) throw new Error('Invalid upgrade path');
  const next = { ...context, upgradePath: hero ? null : path };
  const variant = getPresetVariant(catalog, next);
  if (context.category === 'Powers' && !variant) throw new Error('Choose an available power upgrade path.');
  const component = variant?.components.find(c => c.id === componentId) ?? variant?.components[0];
  const preset=Boolean(component || variant && context.category==='Powers');
  return applyAbilityPreset({
    ...next, tier: hero ? 0 : Math.max(...path.split('').map(Number)),
    componentId: component?.id ?? null, statMode: preset ? 'preset' : 'manual',
    baseDamageExcluded: component?.damageExcluded === true,
    baseDamage: component?.damageExcluded ? 0 : component?.damage ?? 0, baseBossDamage: component?.damageExcluded ? 0 : component?.bossDamage ?? 0,
    baseDamageModifiers: component?.damageModifiers ?? [], baseCanHitMoab: component?.canHitMoab ?? false,
    basePierce: component?.damageExcluded ? null : component?.pierce ?? null,
    baseRange: (component?.rangeMode ?? variant?.rangeMode) === 'global' ? null : (component?.range ?? variant?.range ?? null),
    rangeMode: component?.rangeMode ?? variant?.rangeMode ?? 'finite',
    baseRate: component?.cooldownSeconds && !component.damageExcluded ? 1 / component.cooldownSeconds : 0,
    presetRevision: preset ? catalog.source.revision : null
  },catalog,context.abilityId);
}
export function setManualStat(context, field, value) {
  if (!['baseDamage', 'baseBossDamage', 'baseRate', 'basePierce', 'baseRange'].includes(field) || !Number.isFinite(value) || value < 0) throw new Error('Invalid manual tower stat');
  const next = { ...context, statMode: 'manual', [field]: value };
  if(field === 'baseDamage'||field === 'baseBossDamage'){next.baseDamageModifiers=[];next.baseCanHitMoab=true;next.baseDamageExcluded=false;}
  if(field === 'baseRange')next.rangeMode='finite';
  // Keep ordinary and boss damage linked until a distinct boss value is chosen.
  if (field === 'baseDamage' && (context.baseBossDamage == null || context.baseBossDamage === context.baseDamage)) next.baseBossDamage = value;
  return next;
}
export function applyAbilityPreset(context,catalog,id=null) {
  const variant=getPresetVariant(catalog,context);
  const ability=variant?.abilities.find(a=>a.id===id)??variant?.abilities[0];
  return {...context,abilityId:ability?.id??null,baseAbilityCooldown:ability?.cooldownSeconds??null,abilityMode:ability?'preset':variant?'none':'manual'};
}
// All imported timers share the modeled artifact recharge factor. A manual
// override replaces only its selected ability; a standalone timer is additional.
export function getAbilityTimers(context,catalog,cooldownMultiplier) {
  const abilities=getPresetVariant(catalog,context)?.abilities??[];
  function timer(ability,baseSeconds,manual) {
    const seconds=baseSeconds===null?null:baseSeconds*cooldownMultiplier;
    const override=context.durationOverrides?.[durationOverrideKey(context,ability.id)];
    const durationManual=Number.isFinite(override)&&override>0&&override<=1e9;
    const duration=durationManual?{seconds:override,gapEligible:ability.duration?.gapEligible!==false&&!ability.timingRestricted}:ability.duration;
    return {...ability,manual,baseSeconds,seconds,durationManual,sourceDurationSeconds:ability.duration?.seconds??null,...abilityTiming(duration,seconds)};
  }
  const timers=abilities.map(ability=>{
    const manual=context.abilityMode==='manual'&&context.abilityId===ability.id;
    return timer(ability,manual?context.baseAbilityCooldown:ability.cooldownSeconds,manual);
  });
  if(context.abilityMode==='manual'&&!abilities.some(a=>a.id===context.abilityId))timers.push(timer({id:null,name:'Manual timer',notes:[],duration:null,timingRestricted:false},context.baseAbilityCooldown,true));
  return timers;
}
export function setManualAbilityCooldown(context,value) {
  if(value!==null&&(!Number.isFinite(value)||value<=0||value>1e9))throw new Error('Enter a positive ability cooldown in seconds.');
  return {...context,baseAbilityCooldown:value,abilityMode:'manual'};
}
export function restoreTowerContext(context, catalog) {
  let next=context;
  if(context.statMode==='preset'&&(context.category==='Hero'||validUpgradePath(context.upgradePath))){
    const variant=getPresetVariant(catalog,context);
    const available=variant?.components.some(c=>c.id===context.componentId)||(context.category==='Powers'&&variant?.components.length===0&&context.componentId===null);
    next=available?applyTowerPreset(context,catalog,context.upgradePath,context.componentId):{...context,statMode:'manual',presetRevision:null};
  }
  // Ability overrides are independent of manual attack stats.
  if(context.abilityMode==='manual')return {...next,abilityId:context.abilityId,abilityMode:'manual',baseAbilityCooldown:context.baseAbilityCooldown};
  if(context.abilityMode==='preset'){
    if(!getPresetVariant(catalog,context)?.abilities.some(a=>a.id===context.abilityId))return {...next,abilityId:context.abilityId,abilityMode:'manual',baseAbilityCooldown:context.baseAbilityCooldown};
    return applyAbilityPreset(next,catalog,context.abilityId);
  }
  return context.abilityMode==='none'?applyAbilityPreset(next,catalog):next;
}
function validateHeader(catalog, kind) {
  if (catalog?.schemaVersion !== 4 || !/^[a-f0-9]{40}$/.test(catalog.source?.revision ?? '') || typeof catalog.source.gameVersion !== 'string' || !Array.isArray(catalog[kind]) || !catalog[kind].length) throw new Error(`Invalid ${kind} catalog header`);
}
function validateRange(value, label) {
  if (!['finite','global'].includes(value.rangeMode) || (value.rangeMode === 'global' ? value.range !== null : !Number.isFinite(value.range) || value.range < 0)) throw new Error(`${label}: invalid range`);
}
function validateVariant(variant, label) {
  validateRange(variant, label);
  if (!variant || !Array.isArray(variant.components) || !Array.isArray(variant.notes) || variant.notes.some(n => typeof n !== 'string')) throw new Error(`${label}: invalid variant`);
  if(!Array.isArray(variant.abilities)||variant.abilities.length>100)throw new Error(`${label}: invalid abilities`);
  const abilityIds=new Set();
  for(const a of variant.abilities){if(typeof a.id!=='string'||!a.id||a.id.length>150||abilityIds.has(a.id)||typeof a.name!=='string'||!a.name||!Number.isFinite(a.cooldownSeconds)||a.cooldownSeconds<=0||!Array.isArray(a.notes)||a.notes.some(n=>typeof n!=='string'))throw new Error(`${label}: invalid ability`);if(a.duration!=null&&(!Number.isFinite(a.duration.seconds)||a.duration.seconds<=0||typeof a.duration.gapEligible!=='boolean'||!Array.isArray(a.duration.sourcePaths)||!a.duration.sourcePaths.length||a.duration.sourcePaths.some(p=>typeof p!=='string'||!/^behaviors\[\d+\](?:\.[A-Za-z]+(?:\[\d+\])?)+$/.test(p))))throw new Error(`${label}: invalid ability duration`);if(a.duration?.framesPerSecond!==undefined&&a.duration.framesPerSecond!==60)throw new Error(`${label}: invalid frame conversion`);if(a.timingRestricted!==undefined&&typeof a.timingRestricted!=='boolean')throw new Error(`${label}: invalid timing restriction`);abilityIds.add(a.id);}
  const ids = new Set();
  for (const c of variant.components) {
    if (!c.id || ids.has(c.id) || !c.name || !Array.isArray(c.notes) || c.notes.some(n => typeof n !== 'string') || !['attack', 'secondary'].includes(c.trigger)) throw new Error(`${label}: invalid component`);
    ids.add(c.id);
    validateRange(c, label);
    if(c.damageExcluded!==undefined && typeof c.damageExcluded!=='boolean')throw new Error(`${label}: invalid damage exclusion`);
    if(!validDamageModifiers(c.damageModifiers)||typeof c.canHitMoab!=='boolean')throw new Error(`${label}: invalid damage modifiers`);
    for (const stat of ['damage', 'bossDamage', 'pierce']) if (!Number.isFinite(c[stat]) || c[stat] < 0) throw new Error(`${label}: invalid ${stat}`);
    if (!Number.isFinite(c.cooldownSeconds) || c.cooldownSeconds <= 0) throw new Error(`${label}: invalid cooldown`);
    if (c.projectiles !== null && (!Number.isInteger(c.projectiles) || c.projectiles < 1)) throw new Error(`${label}: invalid projectile count`);
  }
}
export function validateTowerCatalog(catalog) {
  validateHeader(catalog, 'towers');
  const names = new Set();
  for (const tower of catalog.towers) {
    if (!tower.name || names.has(tower.name) || !tower.id || !tower.category || !tower.variants?.['000']) throw new Error('Invalid tower identity or missing base preset');
    names.add(tower.name);
    for (const [path, variant] of Object.entries(tower.variants)) {
      if (!validUpgradePath(path)) throw new Error(`${tower.name}: invalid upgrade path`);
      validateVariant(variant, `${tower.name}/${path}`);
    }
  }
}
export function validateHeroCatalog(catalog) {
  validateHeader(catalog, 'heroes');
  const names = new Set(), ids = new Set();
  for (const hero of catalog.heroes) {
    if (!hero.name || names.has(hero.name) || !hero.id || ids.has(hero.id) || !hero.levels || Object.keys(hero.levels).length !== 20) throw new Error('Invalid hero identity or missing levels');
    names.add(hero.name); ids.add(hero.id);
    for (let level = 1; level <= 20; level++) validateVariant(hero.levels[String(level)], `${hero.name}/level ${level}`);
  }
}
export function validatePowerCatalog(catalog) {
  validateHeader(catalog, 'powers');
  if (catalog.powers.length !== powerRoster.length) throw new Error('Invalid power roster');
  for (const power of powerRoster) {
    const actor = catalog.powers.find(p => p.id === power.id && p.name === power.name);
    if (!actor || actor.category !== 'Powers' || Object.keys(actor.variants ?? {}).sort().join() !== [...power.paths].sort().join()) throw new Error('Invalid power identity or paths');
    for (const [path, variant] of Object.entries(actor.variants)) {
      const expected=power.id==='SuperMonkeyBeacon'?`Towers/${power.id}/${power.id}${path==='000'?'':'-'+path}.json`:`Powers/${power.id}.json`;
      if (variant.sourcePath!==expected) throw new Error('Invalid power source path');
      validateVariant(variant, `${power.name}/${path}`);
    }
  }
}
