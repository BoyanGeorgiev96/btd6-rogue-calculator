import { extractAbilities } from './ability-import.mjs';
import { damageTags } from '../src/target-stats.js';
import { validUpgradePath } from '../src/tower-stats.js';
const type = model => model?.$type?.split(',')[0].split('.').at(-1) ?? '';
const behaviors = model => Array.isArray(model?.behaviors) ? model.behaviors : [];
const title = name => (name ?? '').replace(/^[A-Za-z]+Model_/, '').replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
function count(emission) {
  const n = emission?.count ?? emission?.Count;
  if (Number.isInteger(n) && n > 0) return n;
  return /^(SingleEmissionModel|SingleEmmisionTowardsTargetModel|InstantDamageEmissionModel)$/.test(type(emission)) ? 1 : null;
}
function rangeStats(range, global = false) {
  if (global || range >= 1e6) return { range: null, rangeMode: 'global' };
  if (!Number.isFinite(range) || range < 0) throw new Error('Invalid raw range');
  return { range, rangeMode: 'finite' };
}
function modifiers(projectile, damage) {
  let bossDamage = damage;
  const notes = [], damageModifiers = [];
  for (const modifier of behaviors(projectile)) {
    if(type(modifier)==='DamageModifierForTagModel'){
      const tags=modifier.tags ?? modifier.tag?.split(',') ?? [];
      if(tags.length && tags.every(tag=>damageTags.has(tag)) && Number.isFinite(modifier.damageMultiplier) && Number.isFinite(modifier.damageAddative ?? modifier.damageAdditive))damageModifiers.push({tags,multiplier:modifier.damageMultiplier,additive:modifier.damageAddative ?? modifier.damageAdditive,all:Boolean(modifier.mustIncludeAllTags),inverse:Boolean(modifier.ignoreTag)});
    }
    if (type(modifier) === 'DamageModifierForTagModel' && !modifier.ignoreTag && (modifier.tag === 'Moabs' || modifier.tags?.includes('Moabs')) && (!modifier.mustIncludeAllTags || modifier.tags?.length === 1)) {
      if (!Number.isFinite(modifier.damageMultiplier) || !Number.isFinite(modifier.damageAddative ?? modifier.damageAdditive)) throw new Error('Unknown MOAB modifier layout');
      bossDamage = bossDamage * modifier.damageMultiplier + (modifier.damageAddative ?? modifier.damageAdditive);
    } else if (/DamageModifier/.test(type(modifier)) && !(type(modifier)==='DamageModifierForTagModel' && (modifier.tags ?? []).every(tag=>damageTags.has(tag)))) notes.push('Other conditional damage modifiers are excluded.');
  }
  const filters = [...(projectile.filters ?? []), ...behaviors(projectile).flatMap(b => b.filters ?? [])];
  const blocked=filters.some(f => type(f) === 'FilterOutTagModel' && ['Moabs', 'Boss'].includes(f.tag));
  if (blocked) {
    bossDamage = 0; notes.push('This projectile filters out MOAB-class targets.');
  }
  return { bossDamage, notes, damageModifiers, canHitMoab: !blocked };
}

export function importTowerModel(model, family, options) {
  if (model.baseId !== family.id || model.isParagon || !Array.isArray(model.tiers) || model.tiers.length !== 3) throw new Error(`Unexpected tower model: ${family.id}`);
  const path = model.tiers.join('');
  if (!validUpgradePath(path)) throw new Error(`Illegal crosspath: ${family.id}/${path}`);
  return { path, ...extractAttackComponents(model, family, options) };
}

export function importHeroModel(model, hero, options) {
  const level = model.tier;
  if (model.baseId !== hero.id || !Number.isInteger(level) || level < 1 || level > 20 || !behaviors(model).some(b => type(b) === 'HeroModel')) throw new Error(`Unexpected hero model: ${hero.id}`);
  const result = extractAttackComponents(model, hero, options);
  if (hero.id === 'Psi') result.notes.push('Psychic destruction and its charge duration are not ordinary hit damage and are excluded.');
  if (hero.id === 'Corvus') {
    result.components = []; // Root-level spell attacks are activated, not repeatable baseline attacks.
    result.notes.push('Spirit attacks, mana, and spells are excluded from these direct-hit presets; enter manual stats if needed.');
  }
  if (hero.id === 'Etienne') result.notes.push('Drone and UCAV attacks are summoned-unit attacks and are not imported; enter manual stats if needed.');
  if (hero.id === 'Silas') result.notes.push('Vine and damage-over-time mechanics are not ordinary hit damage and are excluded.');
  if (hero.id === 'Benjamin') result.notes.push('Income and support effects do not contribute ordinary hit damage.');
  result.notes.push('Hero ability damage, summoned units, and conditional buffs are excluded.');
  return { level, ...result };
}

export function extractAttackComponents(model, family, { evidence = false } = {}) {
  const components = [], notes = [];
  const attacks = behaviors(model).map((attack, index) => ({ attack, path: `/behaviors/${index}` })).filter(({ attack }) => Array.isArray(attack.weapons));
  if (behaviors(model).some(b => type(b) === 'AbilityModel')) notes.push('Ability attacks are excluded.');
  if (family.id === 'BeastHandler') notes.push('Beast attacks and beast-power scaling are excluded; only the handler’s own attack is imported.');
  if (family.id === 'SpikeFactory') notes.push('Spike-pile pierce, storage, and repeated contacts are excluded from component DPS.');
  function projectileComponents(projectile, options, depth = 0) {
    if (!projectile || depth > 4) return;
    const damageExcluded = options.damageExcluded || (family.id === 'Druid' && behaviors(projectile).some(b => type(b) === 'JungleVineEffectModel'));
    const damageModels = behaviors(projectile).filter(b => type(b) === 'DamageModel');
    const damage = damageModels.reduce((total, b) => total + b.damage, 0);
    if (damageModels.some(b => !Number.isFinite(b.damage) || b.damage < 0)) throw new Error('Invalid raw projectile damage');
    const spawns = behaviors(projectile).filter(b => b.projectile && /CreateProjectileOn|EmitOnDamageModel/.test(type(b)));
    // Money, buff, and spawning projectiles are not represented as hit damage.
    const nonDamage = behaviors(projectile).some(b => /Cash|CreateTower|AddBehaviorToBloon/.test(type(b)));
    if (damageModels.length || (!spawns.length && !nonDamage && projectile.canCollideWithBloons !== false)) {
      const extra = modifiers(projectile, damage);
      const componentNotes = [...options.notes, ...extra.notes];
      if (damageExcluded) componentNotes.push('Vine destruction and spawned ground vines are excluded from ordinary hit damage, attack DPS, pierce and artifact critical estimates.');
      const dot = behaviors(projectile).some(b => /DamageOverTime|AddBehaviorToBloon/.test(type(b)));
      if (dot) componentNotes.push('Damage-over-time effects are excluded.');
      const secondary = options.secondary;
      if (secondary) componentNotes.push('Triggered secondary projectile: parent-shot cadence is shown. Damage to the original target is excluded.');
      const label = title(projectile.id) || title(projectile.name) || 'Projectile';
      const weaponLabel = options.weaponName === 'Weapon' ? 'Main shot' : options.weaponName.replace(/^Weapon /, '') + ' shot';
      components.push({
        id: options.id, name: damageExcluded ? (options.secondary ? 'Ground vines (excluded)' : 'Vine destruction (excluded)') : label === 'Projectile' ? weaponLabel : `${weaponLabel} · ${label}`,
        ...(damageExcluded ? {damageExcluded:true} : {}),
        damage, bossDamage: secondary ? 0 : extra.bossDamage, damageModifiers: extra.damageModifiers, canHitMoab: !secondary && extra.canHitMoab,
        cooldownSeconds: options.cooldownSeconds, ...options.rangeStats,
        pierce: Number.isFinite(projectile.pierce) && projectile.pierce >= 0 ? projectile.pierce : 0,
        projectiles: options.projectiles, trigger: secondary ? 'secondary' : 'attack',
        ...(evidence ? { sourcePaths: { attack: options.attackPath, weapon: options.weaponPath, projectile: options.projectilePath, ancestors: options.ancestors, damage: behaviors(projectile).flatMap((b, index) => type(b) === 'DamageModel' ? [`${options.projectilePath}/behaviors/${index}`] : []) } } : {}),
        notes: [...new Set(componentNotes)]
      });
    }
    spawns.forEach((spawn, index) => {
      const primaryExplosion = depth === 0 && damageModels.length === 0;
      projectileComponents(spawn.projectile, {
        ...options, damageExcluded, projectilePath: `${options.projectilePath}/behaviors/${behaviors(projectile).indexOf(spawn)}/projectile`, ancestors: [...options.ancestors, options.projectilePath],
        id: `${options.id}/child-${index}`, projectiles: primaryExplosion ? (options.projectiles !== null && count(spawn.emission) !== null ? options.projectiles * count(spawn.emission) : null) : count(spawn.emission),
        secondary: options.secondary || !primaryExplosion,
        notes: primaryExplosion ? options.notes : [...options.notes, 'Secondary projectile requires a hit or expiry trigger.']
      }, depth + 1);
    });
  }
  attacks.forEach(({ attack, path: attackPath }, ai) => {
    if (attack.disableOnCreate) { notes.push('Initially disabled attacks are excluded.'); return; }
    attack.weapons.forEach((weapon, wi) => {
      if (!Number.isFinite(weapon.rate) || weapon.rate <= 0) throw new Error(`${family.id}: invalid weapon rate`);
      const weaponNotes = [];
      let cooldownSeconds = weapon.rate;
      if (behaviors(weapon).some(b => type(b) === 'FireWhenAlternateWeaponIsReadyModel')) {
        const parent = attack.weapons.find(w => behaviors(w).some(b => type(b) === 'FireAlternateWeaponModel' && b.weaponId === wi));
        if (!parent) { notes.push('An alternate weapon without a known parent cadence is excluded.'); return; }
        cooldownSeconds = parent.rate;
        weaponNotes.push('Alternate weapon uses its parent weapon’s cadence.');
      }
      if (behaviors(weapon).some(b => /Crit|Rate|AttackSpeed|FireFirst|FireUp|Wind|Charge/.test(type(b)))) weaponNotes.push('Critical hits and conditional attack-rate changes are excluded.');
      projectileComponents(weapon.projectile, {
        attackPath, weaponPath: `${attackPath}/weapons/${wi}`, projectilePath: `${attackPath}/weapons/${wi}/projectile`, ancestors: [],
        id: `attack-${ai}/weapon-${wi}`, weaponName: title(weapon.name) || `Weapon ${wi + 1}`,
        cooldownSeconds, rangeStats: rangeStats(attack.range ?? model.range, model.isGlobalRange), projectiles: count(weapon.emission), secondary: false, notes: weaponNotes
      });
    });
  });
  // No summed tower DPS: multi-projectile geometry, triggers, and buffs need
  // attack-specific modeling. Users inspect a single component at a time.
  const abilityData=extractAbilities(model);
  return { ...rangeStats(model.range, model.isGlobalRange), components, abilities:abilityData.abilities, notes: [...new Set([...notes,...abilityData.notes])] };
}
