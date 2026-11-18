import {artifactImpactChanges} from './artifact-filters.js';
import {compareMultipliers,multiplierScores} from './artifact-metrics.js';
import { calculate, supported } from './calculator.js';
import { artifactCandidate, compareResults } from './build-tools.js';
import { artifactRules } from './artifact-rules.js';
import { artifactExclusions, referenceArtifactReasons } from './artifact-exclusions.js';

const exportRevision = 'f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24';
const descriptionLink = {label:'Bundled v57 description',href:'./data/artifacts.json'};
const ruleLink = {label:'Implemented rule & conditions',href:'./src/artifact-rules.js'};

export function analyzeArtifact(artifact, rarity, state, artifacts, currentResult = calculate(artifacts, state.selected, state.context)) {
  if (!supported.has(artifact.id)) return { artifact, rarity, applicable: false, rows: [], scores: {dps:null,pierce:null,range:null,cooldown:null} };
  const selected = Boolean(state.selected[artifact.id]);
  const alternative = artifactCandidate(state, artifact, selected ? null : rarity);
  const other = calculate(artifacts, alternative.selected, alternative.context);
  const before = selected ? other : currentResult, after = selected ? currentResult : other;
  const effect = after.breakdown.find(b => b.id === artifact.id);
  const moab = ['moab','boss'].includes(state.context.targetType);
  const applicable = Boolean(effect && ((moab ? effect.bossHitMultiplier : effect.damage) !== 1 || effect.rate !== 1 || (effect.abilityRate !== 1 && state.context.abilityMode!=='none') || effect.pierce !== 1 || effect.range !== 1 || effect.targetDamage !== 1 || effect.flatDamage !== 0 || effect.damageSet !== null || effect.categoryConversion || (effect.critical?.active && state.context.criticalMode === 'expected' && after.criticalMultiplier !== 1)));
  const rows = compareResults(before, after);
  return {artifact, rarity, applicable, rows,impactChanges:artifactImpactChanges(before,after),multiplierRows:compareMultipliers(before,after),multiplierScores:multiplierScores(before,after,state.context), scores: {
    dps: rows.find(r=>r.key==='targetDpsValue').delta,
    pierce: rows.find(r=>r.key==='projectilePierce').delta,
    range: rows.find(r=>r.key==='attackRange').delta,
    cooldown:rows.find(r=>r.key==='abilitySeconds').delta===null?null:-rows.find(r=>r.key==='abilitySeconds').delta
  }};
}
export function sortArtifacts(entries, metric = 'name') {
  return [...entries].sort((a,b) => {
    if (metric !== 'name') {
      const x=(a.multiplierScores??a.scores)[metric], y=(b.multiplierScores??b.scores)[metric];
      if(x === null && y !== null)return 1;
      if(y === null && x !== null)return -1;
      if(Number.isFinite(x) && Number.isFinite(y) && x !== y)return y-x;
    }
    return a.artifact.name.localeCompare(b.artifact.name);
  });
}
export function artifactEvidence(artifact, variant) {
  const definition = artifactRules[artifact.id];
  if(!definition)return [{label:'All effects',status:'Unmodeled',detail:referenceArtifactReasons[artifact.id]??'This effect is excluded from calculated totals. Consult the complete source description.',links:[descriptionLink]}];
  const labels={damageCap:'Maximum ordinary hit damage',damageSet:'Base damage replacement',damage:'Damage',regularDamage:'Status damage',attackRate:'Attack rate',abilityRate:'Ability recharge rate',moabDamage:'MOAB damage',bossDamage:'Boss damage',pierce:'Pierce',range:'Range',targetDamage:'Target damage',flatDamage:'Flat target damage'};
  const entries=definition.effects.map(effect=>{
    const source=effect.verified?.[variant.rarity];
    const verified=source && JSON.stringify(source.expectedParams)===JSON.stringify(variant.sourceParams);
    return {links:verified?[descriptionLink,ruleLink,{label:`Pinned v56.0 ${source.file}`,href:`https://github.com/Btd6ModHelper/btd6-game-data/blob/${exportRevision}/Artifacts/${encodeURIComponent(source.file)}`}]:[descriptionLink,ruleLink],label:labels[effect.stat],status:verified?'Verified export cooldown':'Description estimate',detail:verified?`Pinned v56.0 export: ${source.file}. The description parameters match. This verifies the source value, not current-game behavior.`:'This estimate uses reviewed description values and modeled conditions. Stacking and runtime behavior remain unverified.'};
  });
  if(definition.categories?.length)entries.push({label:'Category conversion',status:'Description estimate',detail:'Category conversions apply before stat effects and can use categories granted by other artifacts. Fixed tower identities retain their penalties.'});
  if(definition.critical)entries.push({label:'Critical hits',status:'Unverified mechanics',detail:'Optional description-based expected value. Innate tower crits are excluded. Overlapping artifact crits have no assumed stacking rule.'});
  for(const excluded of [...(definition.excluded ?? []),...(artifactExclusions[artifact.id] ?? [])])entries.push({label:excluded,status:'Unmodeled',detail:'Excluded from calculated totals.',links:[descriptionLink,{label:'Reviewed exclusion notes',href:artifactExclusions[artifact.id]?.includes(excluded)?'./src/artifact-exclusions.js':'./src/artifact-rules.js'}]});
  return entries.map(entry=>({...entry,links:entry.links??[descriptionLink,ruleLink]}));
}
