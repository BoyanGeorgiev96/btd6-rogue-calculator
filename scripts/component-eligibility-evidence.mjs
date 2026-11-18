// Source observations only. No bitmask decoding or runtime eligibility claims.
import {createHash} from 'node:crypto';

const shortType = model => model?.$type?.split(',')[0].split('.').at(-1) ?? '';
const fields = ['detectCamo', 'isActive', 'immuneBloonProperties', 'immuneBloonPropertiesOriginal',
  'bloonProperties', 'canCollideWithBloons', 'collisionPass', 'collisionPasses',
  'ignoreImmunityDestroy', 'ignoreNonTargetable', 'dontUseCollisionChecker',
  'tag', 'tags', 'inclusive', 'invert', 'damage', 'distributeToChildren',
  'appliesToOwningTower', 'ignoreSubTowers', 'isGlobal', 'isCustomRadius', 'customRadius'];

export function componentEligibilityEvidence(model, imported) {
  const findings = [];
  function walk(value, path) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((item, index) => walk(item, `${path}/${index}`)); return; }
    const type = shortType(value);
    if (type && (/Camo|Filter|Visibility|Immun|DamageType|BloonPropert/.test(type) || ['DamageModel', 'ProjectileModel'].includes(type) || ['detectCamo', 'immuneBloonProperties', 'immuneBloonPropertiesOriginal', 'bloonProperties'].some(key => Object.hasOwn(value, key)))) {
      findings.push({path, type, fields: Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]))});
    }
    for (const [key, child] of Object.entries(value)) if (child && typeof child === 'object') walk(child, `${path}/${key}`);
  }
  walk(model, '');
  return {
    // All findings remain at their actual paths, including omitted spells,
    // abilities, DOT, supports, and summons. They are not global grants.
    findings,
    components: imported.components.map(component => {
      if (!component.sourcePaths) throw new Error('Import with evidence enabled before reviewing components');
      return {id: component.id, trigger: component.trigger, sourcePaths: component.sourcePaths};
    })
  };
}

export function gitBlobHash(content) {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}
