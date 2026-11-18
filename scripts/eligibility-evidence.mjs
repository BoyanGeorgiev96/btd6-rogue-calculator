// Evidence discovery only: do not turn model names, bitmasks, or tier arrays
// into runtime hit-eligibility rules without a separate mechanics review.
const shortType = model => model?.$type?.split(',')[0].split('.').at(-1) ?? '';
const fields = ['detectCamo','isActive','immuneBloonProperties','immuneBloonPropertiesOriginal','bloonProperties','appliesToOwningTower','isGlobal','isCustomRadius','customRadius','ignoreImmunityDestroy','filters','tag','tags'];
const gateFields = ['towerTypes','inverseTowerTypes','towerSets','towerSet','inverseSets','tiers','tiersMustBeEqual','inverseTiers','ignoreSubTowers','ignorePowerTowers','modelNameToAddTo','addOnlyIfScriptsExists','dontAddIfScriptsExists','replaceScriptNames','replaceScriptIds'];

export function eligibilityEvidence(model) {
  const findings = [];
  function walk(value, path, gate) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {value.forEach((item, index) => walk(item, `${path}/${index}`, gate));return;}
    const type = shortType(value);
    const isArtifactBehavior = path.match(/^\/artifactBehaviors\/\d+$/);
    const selection = isArtifactBehavior ? Object.fromEntries(gateFields.filter(key => Object.hasOwn(value,key)).map(key => [key,value[key]])) : gate;
    const observed = Object.fromEntries(fields.filter(key => Object.hasOwn(value,key)).map(key => [key,value[key]]));
    const interestingType = /Camo|Filter|Visibility|Immun|DamageType|BloonPropert/.test(type);
    if (type && (interestingType || fields.slice(2,5).some(key => Object.hasOwn(value,key)))) {
      const kind = type === 'OverrideCamoDetectionModel' ? 'detection-override'
        : type === 'VisibilitySupportModel' ? 'detection-aura'
        : type === 'DamageTypeSupportModel' ? 'damage-type-aura'
        : type === 'FilterInvisibleModel' ? 'visibility-filter'
        : 'damage-or-property-model';
      findings.push({path, type, kind, fields:observed, ...(selection ? {selection} : {})});
    }
    for (const [key,child] of Object.entries(value)) if (child && typeof child === 'object') walk(child, `${path}/${key}`, selection);
  }
  walk(model, '', null);
  return findings;
}
