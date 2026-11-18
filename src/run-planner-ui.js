import {sourceNotes} from './ui-notes.js';
import {initRunPlanLibrary, planMetadata} from './run-plan-library-ui.js';
import {planConditions, runPlanSnapshot} from './run-plan-storage.js';
import {createRunPlan, inspectPlanOffer, suggestPlanOffers, planConversionPairs, planStages} from './run-planner.js';
import {targetTypes} from './target-stats.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>value===null?'Unknown':new Intl.NumberFormat('en',{maximumFractionDigits:3}).format(value);
const signed=value=>`${value>0?'+':''}${fmt(value)}`;
const timer=result=>result.attacks>0?fmt(1/result.attacks)+'s':'No modeled attacks';
const range=result=>result.rangeMode==='global'?'Unlimited':fmt(result.attackRange);

export function initRunPlanner({artifacts,towerCatalog,artifactVersion,getState,setState,message}) {
  const sorted=[...artifacts].sort((a,b)=>a.name.localeCompare(b.name));
  const c=getState().context;
  let tower=towerCatalog.towers.find(entry=>entry.name===c.tower)?.name??towerCatalog.towers[0].name;
  let stages=[{path:'000'},{path:'300'},{path:'500'}], selected=structuredClone(getState().selected), plan=null;
  let inspected={id:sorted[0].id,rarity:sorted[0].variants[0].rarity};
  let rarities={}, context=planConditions(c), library=null;
  function restore(snapshot) {
    tower=snapshot.setup.tower;stages=structuredClone(snapshot.setup.stages);selected=structuredClone(snapshot.setup.selected);
    context=snapshot.context;rarities=snapshot.preferences.rarities;inspected=snapshot.preferences.inspected;
    $('#plan-notes').value=snapshot.notes;$('#plan-tags').value=snapshot.tags.join(', ');
    $('#plan-tower').value=tower;
    $('#plan-priority').value=snapshot.preferences.priority;$('#plan-follow-context').checked=false;
  }
  $('#plan-tower').innerHTML=towerCatalog.towers.map(entry=>`<option ${entry.name===tower?'selected':''}>${escape(entry.name)}</option>`).join('');
  $('#plan-artifact').innerHTML=sorted.map(artifact=>`<option value="${escape(artifact.id)}">${escape(artifact.name)}</option>`).join('');
  function rarityControl() {
    const artifact=artifacts.find(entry=>entry.id===inspected.id);
    $('#plan-artifact').value=inspected.id;
    $('#plan-rarity').innerHTML=artifact.variants.map(variant=>`<option ${variant.rarity===inspected.rarity?'selected':''}>${escape(variant.rarity)}</option>`).join('');
  }
  rarityControl();
  function stageControls() {
    const actor=towerCatalog.towers.find(entry=>entry.name===tower);
    $('#plan-stage-controls').innerHTML=stages.map((spec,index)=>{
      const variant=actor.variants[spec.path];
      return `<fieldset data-plan-stage="${index}"><legend>${planStages[index]} snapshot</legend><label>Upgrade path<select data-plan-field="path" aria-label="${planStages[index]} upgrade path">${Object.keys(actor.variants).sort().map(path=>`<option ${path===spec.path?'selected':''}>${path}</option>`).join('')}</select></label><label>Attack component<select data-plan-field="componentId" aria-label="${planStages[index]} attack component" ${variant.components.length?'':'disabled'}>${variant.components.length?variant.components.map(component=>`<option value="${escape(component.id)}" ${component.id===spec.componentId?'selected':''}>${escape(component.name)}</option>`).join(''):'<option>No direct attack</option>'}</select></label><label>Ability<select data-plan-field="abilityId" aria-label="${planStages[index]} ability" ${variant.abilities.length?'':'disabled'}>${variant.abilities.length?variant.abilities.map(ability=>`<option value="${escape(ability.id)}" ${ability.id===spec.abilityId?'selected':''}>${escape(ability.name)}</option>`).join(''):'<option>No ability</option>'}</select></label></fieldset>`;
    }).join('');
  }
  // Result disclosures are presentation state, retained when inputs recalculate the rows.
  function replaceResults(id,html) {
    const container=$('#'+id), open=new Set([...container.querySelectorAll('details[open]')].map(el=>el.dataset.planDetail));
    const focused=document.activeElement?.closest('details')?.dataset.planDetail;
    container.innerHTML=html;
    for(const detail of container.querySelectorAll('details')) {
      if(open.has(detail.dataset.planDetail))detail.open=true;
      if(focused===detail.dataset.planDetail)detail.querySelector('summary')?.focus({preventScroll:true});
    }
  }
  function statCells(result,{dpsChange='',intervalChange='',detailKey,extra=''}={}) {
    return `<td>${fmt(result.targetDpsValue)}${dpsChange}</td><td>${timer(result)}${intervalChange}</td><td>${fmt(result.projectilePierce)}</td><td><details data-plan-detail="${detailKey}"><summary>Metrics &amp; source notes</summary><dl><dt>Damage / hit</dt><dd>${fmt(result.targetHit)}</dd><dt>Expected damage / hit</dt><dd>${fmt(result.expectedTargetHit)}</dd><dt>Range</dt><dd>${range(result)}</dd><dt>Ability timer</dt><dd>${result.abilitySeconds===null?'No ability':fmt(result.abilitySeconds)+'s'}</dd></dl>${extra}</details></td>`;
  }
  function inspect() {
    if(!plan)return;
    const offer=inspectPlanOffer(artifacts,plan,inspected);
    $('#plan-offer-description').textContent='Source description: '+offer.artifact.variants.find(variant=>variant.rarity===offer.rarity).description;
    $('#plan-offer-summary').textContent=`${offer.artifact.name} · ${offer.rarity}. ${plan.selected[inspected.id]===inspected.rarity?'Already in the starting loadout at this rarity.':offer.previous?'Replaces '+offer.previous+'.':'Added to each snapshot’s chosen loadout.'} ${offer.firstBenefit<0?'No measured positive stat change in these snapshots.':'First modeled benefit: '+planStages[offer.firstBenefit]+'.'}`;
    replaceResults('plan-offer-results',offer.stages.map(stage=>`<tr><th scope="row">${stage.label}<small>${escape(stage.advice)}</small><p>${escape(stage.benefits.length?'Gains: '+stage.benefits.join(', '):'No measured gain.')}</p><p>${escape(stage.losses.length?'Losses: '+stage.losses.join(', '):'No measured stat loss.')}</p>${stage.result.warnings.map(warning=>`<p class="result-caveat">${escape(warning)}</p>`).join('')}</th>${statCells(stage.result,{detailKey:'offer-'+stage.label,dpsChange:`<small>${signed(stage.result.targetDpsValue-stage.baseline.targetDpsValue)}</small>`,intervalChange:`<small>${stage.intervalBefore===null||stage.intervalAfter===null?'Change unavailable':signed(stage.intervalAfter-stage.intervalBefore)+'s'}</small>`,extra:`<p>${escape(sourceNotes(stage.notes).join(' ')||'No additional notes.')}</p>`})}</tr>`).join(''));
    const pairs=planConversionPairs(artifacts,plan,inspected);
    replaceResults('plan-pairings',pairs.length?pairs.map(pair=>`<details data-plan-detail="pair-${escape(pair.converter.id)}"><summary>${escape(pair.converter.name)} · ${escape(pair.rarity)} + ${escape(offer.artifact.name)} · ${escape(offer.rarity)}</summary><p>The conversion newly activates this artifact in at least one snapshot. Both artifacts must be offered and selected. These package totals include the conversion’s own effects and each snapshot’s chosen loadout. Activating an effect alone does not establish a net benefit.</p>${pair.stages.map(stage=>`<p>${stage.label}: ${fmt(stage.result.targetDpsValue)} DPS · ${timer(stage.result)} between attacks · pierce ${fmt(stage.result.projectilePierce)} · range ${range(stage.result)}. ${escape(stage.losses.length?'Losses: '+stage.losses.join(', ')+'. ':'')}${escape(stage.warnings.join(' '))}</p>`).join('')}</details>`).join(''):'<p>No additional modeled category conversion newly activates this artifact for these snapshots. Other pairings and unmodeled mechanics are not searched.</p>');
  }
  function render() {
    if(!$('#run-planner').open)return;
    stageControls();
    if($('#plan-follow-context').checked)context=planConditions(getState().context);
    const pickCount=stages.slice(1).reduce((count,spec)=>count+Object.keys(spec.acquired??{}).length,0);
    $('#plan-chosen-summary').textContent=`Chosen later acquisitions · ${pickCount} ${pickCount===1?'pick':'picks'}`;
    $('#plan-chosen').innerHTML=stages.slice(1).map((spec,i)=>`<div><h4>${planStages[i+1]} chosen acquisitions</h4><ul>${Object.entries(spec.acquired??{}).map(([id,rarity])=>`<li>${escape(artifacts.find(a=>a.id===id)?.name??id)} · ${escape(rarity)} <button class="text-button" data-plan-unpick="${escape(id)}" data-stage="${i+1}">Remove chosen pick</button></li>`).join('')||'<li>No chosen acquisitions.</li>'}</ul></div>`).join('');
    $('#plan-loadout').innerHTML=Object.entries(selected).map(([id,rarity])=>`<li>${escape(artifacts.find(artifact=>artifact.id===id).name)} · ${escape(rarity)} <button class="text-button" data-plan-remove="${escape(id)}">Remove</button></li>`).join('')||'<li>No starting artifacts selected.</li>';
    try {
      plan=createRunPlan(artifacts,towerCatalog,context,{tower,stages,selected});
      $('#plan-error').textContent='';$('#plan-apply').disabled=false;

      $('#plan-context').textContent=`${targetTypes[context.targetType]}${context.camo?' · Camo':''}${context.fortified?' · Fortified':''} · ${context.criticalMode==='expected'?'critical estimates':'normal hits'} · ${$('#plan-follow-context').checked?'current':'saved plan'} battle conditions (${['early','close','aura','frozen','glued','stunned'].filter(key=>context[key]).join(', ')||'none enabled'}) · ${context.otherMilitaryCount} other Military aura sources · tower export v${towerCatalog.source.gameVersion}. Main-calculator manual stats are replaced by source presets. Coverage eligibility is unknown.`;
      replaceResults('plan-baselines',plan.stages.map(stage=>`<tr><th scope="row">${stage.label} · ${stage.path}<small>${escape(stage.componentName)}</small>${[...stage.result.warnings,...stage.result.unmodeled.map(name=>name+': reference only.')].map(note=>`<p class="result-caveat">${escape(note)}</p>`).join('')}</th>${statCells(stage.result,{detailKey:'baseline-'+stage.label,extra:`<p>Loadout: ${escape(Object.entries(stage.selected).map(([id,rarity])=>(artifacts.find(a=>a.id===id)?.name??id)+' · '+rarity).join(', ')||'None')}</p><p>${escape(sourceNotes(stage.notes).join(' ')||'There are no additional source notes.')}</p>`})}</tr>`).join(''));
      const suggestions=suggestPlanOffers(artifacts,plan,{rarities,priority:$('#plan-priority').value});
      $('#plan-suggestions').innerHTML=suggestions.length?suggestions.map(offer=>`<li><button class="text-button" data-plan-inspect="${escape(offer.artifact.id)}">${escape(offer.artifact.name)} · ${escape(offer.rarity)}</button><span>First modeled benefit: ${planStages[offer.firstBenefit]}. ${offer.stages.map(stage=>stage.label+': '+escape(stage.advice)+(stage.losses.length?' (losses: '+escape(stage.losses.join(', '))+')':'')).join(' · ')}</span></li>`).join(''):'<li>No additional modeled stat gains found at these rarities. Inspect an actual offer below.</li>';
      inspect();
      for(const id of ['plan-save','plan-export','plan-duplicate','plan-pick-mid','plan-pick-late'])$('#'+id).disabled=false;
    } catch(error) {
      for(const id of ['plan-save','plan-export','plan-duplicate','plan-pick-mid','plan-pick-late'])$('#'+id).disabled=true;
      plan=null;$('#plan-context').textContent='Correct the upgrade progression to see results.';$('#plan-error').textContent=error.message;$('#plan-apply').disabled=true;
      for(const id of ['plan-baselines','plan-suggestions','plan-offer-results','plan-pairings'])$('#'+id).innerHTML='';
      $('#plan-offer-summary').textContent='Resolve the setup above before inspecting offers.';
      $('#plan-offer-description').textContent='';
    }
    library?.onChange();
  }
  $('#run-planner').addEventListener('toggle',render);
  $('#open-run-planner').addEventListener('click',()=>{$('#run-planner').open=true;render();$('#workspace-title').scrollIntoView({block:'start'});$('#workspace-title').focus({preventScroll:true});});
  $('#plan-tower').addEventListener('change',event=>{tower=event.target.value;stages=stages.map((spec,i)=>({path:['000','300','500'][i],acquired:spec.acquired??{}}));render();});
  $('#plan-stage-controls').addEventListener('change',event=>{
    const field=event.target.dataset.planField;if(!field)return;
    const index=Number(event.target.closest('fieldset').dataset.planStage);
    stages[index]=field==='path'?{path:event.target.value,acquired:stages[index].acquired??{}}:{...stages[index],[field]:event.target.value};render();
    $(`[data-plan-stage="${index}"] [data-plan-field="${field}"]`)?.focus({preventScroll:true});
  });
  $('#plan-copy-loadout').addEventListener('click',()=>{selected=structuredClone(getState().selected);render();});
  $('#plan-clear-loadout').addEventListener('click',()=>{selected={};render();});
  $('#plan-loadout').addEventListener('click',event=>{if(event.target.dataset.planRemove){delete selected[event.target.dataset.planRemove];render();}});
  $('#plan-artifact').addEventListener('change',event=>{const artifact=artifacts.find(entry=>entry.id===event.target.value);inspected={id:artifact.id,rarity:rarities[artifact.id]??selected[artifact.id]??artifact.variants[0].rarity};rarityControl();inspect();library?.onChange();});
  $('#plan-rarity').addEventListener('change',event=>{inspected.rarity=event.target.value;rarities[inspected.id]=inspected.rarity;render();});
  $('#plan-add-loadout').addEventListener('click',()=>{selected={...selected,[inspected.id]:inspected.rarity};render();});
  $('#plan-suggestions').addEventListener('click',event=>{const id=event.target.dataset.planInspect;if(!id)return;const artifact=artifacts.find(entry=>entry.id===id);inspected={id,rarity:rarities[id]??selected[id]??artifact.variants[0].rarity};rarityControl();inspect();library?.onChange();$('#plan-offer-summary').scrollIntoView({block:'start'});$('#plan-artifact').focus({preventScroll:true});});
  $('#plan-priority').addEventListener('change',render);
  $('#plan-apply').addEventListener('click',()=>{if(!plan)return;setState({context:structuredClone(plan.stages[0].context),selected:structuredClone(plan.selected)});message('Starting setup applied.');});

  $('#plan-follow-context').addEventListener('change',render);
  for(const [id,index] of [['plan-pick-mid',1],['plan-pick-late',2]])$('#'+id).addEventListener('click',()=>{
    stages[index].acquired={...stages[index].acquired,[inspected.id]:inspected.rarity};render();
  });
  $('#plan-chosen').addEventListener('click',event=>{
    const id=event.target.dataset.planUnpick;if(!id)return;
    delete stages[Number(event.target.dataset.stage)].acquired[id];render();
  });
  const snapshot=()=>runPlanSnapshot(artifacts,towerCatalog,context,{tower,stages,selected},{priority:$('#plan-priority').value,rarities,inspected},artifactVersion,planMetadata());
  library=initRunPlanLibrary({artifacts,towerCatalog,artifactVersion,snapshot,restore:loaded=>{restore(loaded);rarityControl();},render});
  return {onStateChanged:render};
}
