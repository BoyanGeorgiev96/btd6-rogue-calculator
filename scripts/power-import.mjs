import { extractAttackComponents } from './tower-import.mjs';
const type = model => model?.$type?.split(',')[0].split('.').at(-1);

export function importPowerModel(raw, power) {
  const model = power.id === 'SuperMonkeyBeacon' ? raw : raw.tower;
  if (model?.baseId !== power.id || model.towerSet !== 64 || !model.isPowerTower || !power.paths.includes(model.tiers?.join(''))) throw new Error(`Unexpected power model: ${power.id}`);
  const result = extractAttackComponents(model, power);
  if (power.id === 'BattleCat') {
    const ability = model.behaviors.find(b => type(b) === 'AbilityModel' && b.modelName === 'Ability');
    const activation = ability?.behaviors.find(b => type(b) === 'ActivateAttackModel');
    const expiry = ability?.behaviors.find(b => type(b) === 'ExpireTowerAfterAbilityModel');
    if (ability?.maxActivationsPerRound !== 1 || expiry?.rounds !== 4 || !expiry.useRoundTime || !activation?.turnOffExisting || activation.attacks.length !== 1) throw new Error('Battle Cat transformation needs review');
    const transformed = extractAttackComponents({...model, behaviors:activation.attacks}, power);
    result.components.forEach(c => { c.name = 'Normal Battle Cat'; });
    result.components.push(...transformed.components.map(c => ({...c, id:`transformed/${c.id}`, name:'Transformed Battle Cat (4 rounds)', notes:[...c.notes,'Active transformation only: replaces the normal attack, expires after 4 rounds, and is not averaged over a run.']})));
    // The source uses a sentinel cooldown and round-based expiry, not a
    // repeatable seconds-based timer. Do not expose it to uptime searches.
    result.abilities = [];
    result.notes = result.notes.filter(n => n !== 'Ability attacks are excluded.');
    result.notes.push('Transformation is selected as an attack component; its sentinel timer is excluded. Four-round expiry is not a duration in seconds.');
  }
  if (power.id === 'CaveMonkey') result.notes.push('Stun chance, stun duration and target control are excluded.');
  if (power.id === 'SuperMonkeyBeacon') result.notes.push('Storm ability damage, repeated contacts, knockback, placement limits and recharge purchases are excluded. Only the 0-3-0 repeatable attack contributes attack DPS; storm cooldowns remain available.');
  result.notes.push('One placed power and one selected attack component; consumable quantities and encounter availability are not simulated.');
  return {path:model.tiers.join(''),...result};
}
