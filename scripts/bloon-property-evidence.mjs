// Source observations only: bit overlap is not a runtime collision algorithm.
import {gitBlobHash} from './component-eligibility-evidence.mjs';

const fields = ['id', 'baseId', 'bloonProperties', 'tags', 'isCamo', 'isGrow',
  'isFortified', 'isMoab', 'isBoss', 'isInvulnerable', 'isImmuneToSlow',
  'collisionGroup', 'basicTypeFlags', 'propertyFlags'];

export function bloonPropertyEvidence(bytes, file) {
  if (gitBlobHash(bytes) !== file.sha) throw new Error(`${file.path}: model differs from pinned blob`);
  const model = JSON.parse(bytes);
  if (model.$type?.split(',')[0].split('.').at(-1) !== 'BloonModel'
      || model.id !== file.path.split('/').at(-1).slice(0, -5)
      || model.baseId !== file.path.split('/').at(-2)
      || !Number.isSafeInteger(model.bloonProperties) || model.bloonProperties < 0
      || model.bloonProperties > 0x7fffffff) throw new Error(`${file.path}: invalid bloon identity/properties`);
  return {path:file.path, blob:file.sha,
    fields:Object.fromEntries(fields.filter(key => Object.hasOwn(model, key)).map(key => [key, model[key]]))};
}

export function propertyMaskOverlap(mask, properties) {
  // Retain unknown and the source's -1 sentinel distinctly from a zero mask.
  if (!Number.isInteger(mask) || mask < -1 || mask > 0x7fffffff
      || !Number.isInteger(properties) || properties < 0 || properties > 0x7fffffff) return null;
  return mask & properties;
}

export function componentMaskInventory(review, bloons) {
  const masks = new Map();
  for (const model of review.models) {
    const profile = review.profiles[model.evidence];
    for (const component of profile.components) for (const path of component.sourcePaths.damage) {
      const finding = profile.findings.find(entry => entry.path === path && entry.type === 'DamageModel');
      if (!finding) throw new Error(`${model.path}: missing direct damage evidence at ${path}`);
      // Current and original values stay separate; neither is silently preferred.
      for (const field of ['immuneBloonProperties', 'immuneBloonPropertiesOriginal']) {
        const present = Object.hasOwn(finding.fields, field), value = finding.fields[field];
        const key = `${field}/${present ? JSON.stringify(value) : 'absent'}`;
        if (!masks.has(key)) masks.set(key, {field, present, ...(present ? {value} : {}), directDamageModels:0,
          example:{model:model.path, blob:model.blob, component:component.id, path},
          overlaps:bloons.map(bloon => ({id:bloon.fields.id, bits:propertyMaskOverlap(value, bloon.fields.bloonProperties)}))});
        masks.get(key).directDamageModels++;
      }
    }
  }
  return [...masks.values()];
}
