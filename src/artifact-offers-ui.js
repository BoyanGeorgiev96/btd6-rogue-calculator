import {rememberDetails,abilityTimings,absoluteStats,factor} from './comparison-ui.js';
import {compareArtifactOffers,bestOfferIndices,maxOffers} from './artifact-offers.js';
import {targetTypes} from './target-stats.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(value);
const signed=value=>`${value>0?'+':''}${fmt(value)}`;
const metricLabels={dps:'DPS multiplier gain',pierce:'pierce multiplier gain',range:'range multiplier gain',cooldown:'cooldown factor reduction'};
function metricCell(row){
 const value=factor(row.after);
 const delta=row.delta===null?row.beforeGlobal&&row.afterGlobal?'Unchanged':'Not measurable':Math.abs(row.delta)<1e-10?'No change':`${signed(row.delta)} factor points`;
 return `<td>${value}<small>${escape(delta)}</small></td>`;
}
export function initArtifactOffers({artifacts,towerCatalog,getState,previewArtifact}){
 let slots=[null,null];
 const sorted=[...artifacts].sort((a,b)=>a.name.localeCompare(b.name));
 function render(){
  if(!$('#offer-comparison').open)return;
  const state=getState(),context=state.context,filled=slots.filter(Boolean);
  const comparison=compareArtifactOffers(artifacts,state,filled);
  const metric=$('#offer-metric').value,best=bestOfferIndices(comparison,metric,'multiplier');
  $('#offer-context').textContent=`${context.tower} · ${context.category==='Hero'?'Level '+context.heroLevel:context.upgradePath??'Manual'} · ${targetTypes[context.targetType]}${context.camo?' · Camo':''}${context.fortified?' · Fortified':''} · ${context.criticalMode==='expected'?'crit estimates':'normal hits'}. Current target-DPS multiplier: ${factor(comparison.baseline.targetDpsMultiplier)}.`;
  $('#offer-ranking').textContent=!filled.length?'':best.length?`Highlighted: ${best.length>1?'tied highest':'highest'} modeled ${metricLabels[metric]} among these choices.`:'No measured positive gain for this metric.';
  let cursor=0;
  const restoreDetails=rememberDetails($('#offer-rows'));
    $('#offer-rows').innerHTML=slots.map((slot,index)=>{
   const choice=slot?comparison.choices[cursor++]:null,choiceIndex=cursor-1;
   const controls=`<label>Artifact<select data-offer-field="id" aria-label="Offer ${index+1} artifact"><option value="">Choose an artifact</option>${sorted.map(a=>`<option value="${escape(a.id)}" ${slot?.id===a.id?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label><label>Rarity<select data-offer-field="rarity" aria-label="Offer ${index+1} rarity" ${choice?'':'disabled'}>${choice?choice.artifact.variants.map(v=>`<option ${v.rarity===slot.rarity?'selected':''}>${escape(v.rarity)}</option>`).join(''):'<option>Choose an artifact first</option>'}</select></label>`;
   const change=choice?(choice.change==='same'?'Already owned at this rarity.':choice.change==='replace'?`Replaces your ${choice.previous} rarity.`:''):'';
   const badge=choice&&best.includes(choiceIndex)?`<span class="offer-best">${best.length>1?'Tied best':'Best'} modeled ${escape(metricLabels[metric])}</span>`:'';
   const warnings=choice?[...choice.warnings,...(choice.result.breakdown.find(b=>b.id===choice.artifact.id)?.excluded??[])]:[];
   return `<tr data-offer-index="${index}"><td>${controls}${choice?absoluteStats(choice.result)+abilityTimings(choice.state.context,towerCatalog,choice.result):''}${change?`<p>${escape(change)}</p>`:''}${badge}${warnings.length?`<p class="offer-warning">${escape(warnings.join(' '))}</p>`:''}<div class="build-actions"><button data-preview-offer="${index}" ${!choice||choice.change==='same'?'disabled':''}>Preview this offer</button><button data-remove-offer="${index}">Remove row</button></div></td>${choice?choice.multiplierRows.map(metricCell).join(''):'<td colspan="6">—</td>'}</tr>`;
  }).join('');
    restoreDetails();
  $('#add-offer').disabled=slots.length>=maxOffers;
 }
 $('#offer-comparison').addEventListener('toggle',render);
 $('#open-offers').addEventListener('click',()=>{$('#offer-comparison').open=true;render();});
 $('#offer-metric').addEventListener('change',render);
 $('#add-offer').addEventListener('click',()=>{if(slots.length<maxOffers){slots.push(null);render();}});
 $('#offer-rows').addEventListener('change',event=>{
  const field=event.target.dataset.offerField;if(!field)return;
  const index=Number(event.target.closest('tr').dataset.offerIndex);
  if(field==='id'){
   const artifact=artifacts.find(a=>a.id===event.target.value);slots[index]=artifact?{id:artifact.id,rarity:stateRarity(artifact)}:null;
  }else if(slots[index])slots[index]={...slots[index],rarity:event.target.value};
  render();$(`#offer-rows tr[data-offer-index="${index}"] [data-offer-field="${field}"]`)?.focus({preventScroll:true});
 });
 function stateRarity(artifact){return getState().selected[artifact.id]??artifact.variants[0].rarity;}
 $('#offer-rows').addEventListener('click',event=>{
  const preview=event.target.dataset.previewOffer,remove=event.target.dataset.removeOffer;
  if(preview!==undefined&&slots[Number(preview)]){const offer=slots[Number(preview)];previewArtifact(offer.id,offer.rarity);}
  if(remove!==undefined){slots.splice(Number(remove),1);render();}
 });
 return {onStateChanged:render};
}
