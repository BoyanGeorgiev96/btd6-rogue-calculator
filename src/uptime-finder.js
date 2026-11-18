import {calculate,supported} from './calculator.js';
import {artifactRules} from './artifact-rules.js';
import {getAbilityTimers} from './tower-stats.js';
import {compareMultipliers} from './artifact-metrics.js';

// Exhaustive within the explicitly chosen one-/two-artifact scope. Reevaluate
// every candidate through the engine so conversions and penalties are included.
export function findUptimeThresholds(artifacts,state,catalog,abilityId,{maxChanges=2,limit=8}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('Choose between one and 50 results.');
  if(![1,2].includes(maxChanges))throw new Error('Search one or two artifact changes.');
  const baseline=calculate(artifacts,state.selected,state.context);
  const timerFor=result=>getAbilityTimers(state.context,catalog,result.abilityCooldown).find(timer=>timer.id===abilityId);
  const timer=timerFor(baseline);
  if(!timer)throw new Error('Choose an available ability.');
  if(timer.gapSeconds===null)return {timer,baseline,tested:0,matches:[],progress:[],reason:'A known duration, cooldown and unrestricted timing estimate are required. Set a labeled manual duration if the source is unknown.'};
  if(timer.gapSeconds===0)return {timer,baseline,tested:0,matches:[],progress:[],reason:'The current build already has a zero nominal gap. This does not establish guaranteed runtime uptime.'};
  const options=artifacts.filter(a=>supported.has(a.id)&&(artifactRules[a.id].effects.some(e=>e.stat==='abilityRate')||artifactRules[a.id].categories?.length)).flatMap(a=>{
    const owned=a.variants.findIndex(v=>v.rarity===state.selected[a.id]);
    return a.variants.flatMap((v,i)=>i>owned?[{id:a.id,name:a.name,rarity:v.rarity,previous:state.selected[a.id]??null}]:[]);
  });
  const matches=[],progress=[];let tested=0;
  function evaluate(changes) {
    const candidate={context:structuredClone(state.context),selected:{...state.selected,...Object.fromEntries(changes.map(c=>[c.id,c.rarity]))}};
    const result=calculate(artifacts,candidate.selected,candidate.context),after=timerFor(result);tested++;
    if(after.gapSeconds>=timer.gapSeconds)return;
    const row={changes,state:candidate,result,timer:after,multiplierRows:compareMultipliers(baseline,result)};
    (after.gapSeconds===0?matches:progress).push(row);
  }
  for(let i=0;i<options.length;i++) {
    evaluate([options[i]]);
    if(maxChanges===2)for(let j=i+1;j<options.length;j++)if(options[i].id!==options[j].id)evaluate([options[i],options[j]]);
  }
  const score=row=>row.result.targetDpsMultiplier??-1;
  matches.sort((a,b)=>a.changes.length-b.changes.length||score(b)-score(a)||b.result.rate-a.result.rate||a.changes.map(c=>c.name+c.rarity).join().localeCompare(b.changes.map(c=>c.name+c.rarity).join()));
  progress.sort((a,b)=>a.timer.gapSeconds-b.timer.gapSeconds||a.changes.length-b.changes.length||score(b)-score(a));
  return {timer,baseline,tested,matches:matches.slice(0,limit),progress:progress.slice(0,limit),reason:matches.length?'':'No zero-gap build in the tested scope. More than '+maxChanges+' changes, different conditions, or unsupported effects were not searched.'};
}
