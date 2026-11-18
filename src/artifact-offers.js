import {compareMultipliers,multiplierScores} from './artifact-metrics.js';
import {calculate,supported} from './calculator.js';
import {artifactCandidate,compareResults} from './build-tools.js';
export const maxOffers=3;
export function compareArtifactOffers(artifacts,state,offers){
 if(!Array.isArray(offers)||offers.length>maxOffers)throw new Error('Compare up to three artifact offers.');
 const baseline=calculate(artifacts,state.selected,state.context);
 const choices=offers.map(offer=>{
  const artifact=artifacts.find(a=>a.id===offer?.id);const variant=artifact?.variants.find(v=>v.rarity===offer.rarity);
  if(!artifact||!variant)throw new Error('Choose an existing artifact and one of its available rarities.');
  const candidate=artifactCandidate(state,artifact,variant.rarity);
  const result=calculate(artifacts,candidate.selected,candidate.context);
  const rows=compareResults(baseline,result);
  const modeled=supported.has(artifact.id),previous=state.selected[artifact.id]??null;
  const delta=key=>modeled?rows.find(row=>row.key===key).delta:null;
  const cooldownDelta=delta('abilitySeconds');
  return {artifact,variant,state:candidate,result,rows,multiplierRows:compareMultipliers(baseline,result),multiplierScores:modeled?multiplierScores(baseline,result,state.context):{dps:null,pierce:null,range:null,cooldown:null},modeled,previous,
   change:previous===variant.rarity?'same':previous?'replace':'add',
   scores:{dps:delta('targetDpsValue'),pierce:delta('projectilePierce'),range:delta('attackRange'),cooldown:cooldownDelta===null?null:-cooldownDelta},
   warnings:[...result.warnings,...(!modeled?['Reference-only offer: its effects are excluded, so it is not ranked.']:[])]};
 });
 return {baseline,choices};
}
export function bestOfferIndices(comparison,metric,mode='absolute'){
 if(!['dps','pierce','range','cooldown'].includes(metric))throw new Error('Unknown offer comparison metric.');
 const scores=comparison.choices.map(choice=>(mode==='multiplier'?choice.multiplierScores:choice.scores)[metric]);
 const positive=scores.filter(score=>Number.isFinite(score)&&score>0);
 if(!positive.length)return [];
 const best=Math.max(...positive),tolerance=1e-10*Math.max(1,Math.abs(best));
 return scores.flatMap((score,index)=>Number.isFinite(score)&&score>0&&Math.abs(score-best)<=tolerance?[index]:[]);
}
