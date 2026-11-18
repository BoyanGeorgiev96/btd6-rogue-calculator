import {rememberDetails,multiplierCells,absoluteStats,abilityTimings} from './comparison-ui.js';
import {getPresetVariant} from './tower-stats.js';
import {supported} from './calculator.js';
import {parseRun,exportRun} from './run-transfer.js';
import {compareTowerPresets} from './tower-comparison.js';
import {targetTypes} from './target-stats.js';
const $=s=>document.querySelector(s);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function initPlanningTools({artifacts,towerCatalog,getState,setState,message}){
 let pending=null;
 const clearRunPreview=()=>{pending=null;$('#apply-run').disabled=true;$('#run-preview').textContent='';};
 $('#run-text').addEventListener('input',clearRunPreview);
 $('#run-mode').addEventListener('change',clearRunPreview);
 $('#export-run').addEventListener('click',()=>{clearRunPreview();const text=exportRun(getState().selected,artifacts);$('#run-text').value=text;download(text,'rogue-lab-run.txt','text/plain');message('Artifact list exported.');});
 $('#preview-run').addEventListener('click',()=>{
  clearRunPreview();try{const selected=parseRun($('#run-text').value,artifacts);pending={selected,text:$('#run-text').value,mode:$('#run-mode').value};const reference=Object.keys(selected).filter(id=>!supported.has(id)).length;
   $('#run-preview').textContent=`${Object.keys(selected).length} artifacts ready to ${pending.mode==='merge'?'merge into':'replace'} your selections. ${reference?reference+' reference-only selections are excluded from totals.':''}`;$('#apply-run').disabled=false;
  }catch(error){$('#run-preview').textContent=error.message;}
 });
 $('#apply-run').addEventListener('click',()=>{
  if(!pending||pending.text!==$('#run-text').value||pending.mode!==$('#run-mode').value)return;
  const current=getState();const selected=pending.mode==='merge'?{...current.selected,...pending.selected}:{...pending.selected};
  setState({...current,selected});clearRunPreview();message('Artifact list imported.');
 });
 $('#run-file').addEventListener('change',async event=>{clearRunPreview();const file=event.target.files?.[0];if(!file)return;if(file.size>50_000){message('Run file is too large (maximum 50 KB).');return;}try{$('#run-text').value=await file.text();message('File ready to preview.');}catch{message('Could not read the run file.');}});
 const actors=[...towerCatalog.towers.map(t=>({...t,hero:false})),...towerCatalog.heroes.map(h=>({...h,hero:true})),...(towerCatalog.powers??[]).map(p=>({...p,hero:false}))];
 const currentSpec=()=>{const c=getState().context;const actor=actors.find(a=>a.name===c.tower);const validComponent=getPresetVariant(towerCatalog,c)?.components.some(component=>component.id===c.componentId);return actor?{tower:c.tower,...(actor.hero?{heroLevel:c.heroLevel}:{path:c.upgradePath??'000'}),componentId:validComponent?c.componentId:null,abilityId:getPresetVariant(towerCatalog,c)?.abilities.some(a=>a.id===c.abilityId)?c.abilityId:null}: {tower:'Dart Monkey',path:'000'};};
 let specs=[currentSpec(),{tower:getState().context.tower==='Sniper Monkey'?'Dart Monkey':'Sniper Monkey',path:'000'}];
 function renderTowers(){
  if(!$('#tower-comparison').open)return;
  const c=getState().context;$('#tower-comparison-context').textContent=`${targetTypes[c.targetType]}${c.camo?' · Camo':''}${c.fortified?' · Fortified':''} · ${Object.keys(getState().selected).length} selected artifacts · ${c.criticalMode==='expected'?'crit estimates':'normal hits'}.`;
  const rows=compareTowerPresets(artifacts,getState().selected,c,towerCatalog,specs).map((row,index)=>({...row,index}));
  const metric=$('#tower-comparison-sort').value;rows.sort((a,b)=>(metric==='dps'?b.result.targetDpsValue-a.result.targetDpsValue:metric==='gain'?b.gain-a.gain:(b.result.targetDpsMultiplier??-1)-(a.result.targetDpsMultiplier??-1))||a.index-b.index);
  const restoreDetails=rememberDetails($('#tower-comparison-rows'));
    $('#tower-comparison-rows').innerHTML=rows.map(row=>{
   const actor=actors.find(a=>a.name===row.spec.tower);const index=row.index;
   return `<tr data-comparison-index="${index}"><td><label>Preset<select data-comparison-field="tower">${actors.map(a=>`<option ${a.name===row.spec.tower?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label>${actor.hero?`<label>Level<input data-comparison-field="heroLevel" type="number" min="1" max="20" value="${row.spec.heroLevel}"></label>`:`<label>Path<input data-comparison-field="path" maxlength="3" pattern="[0-5]{3}" value="${row.spec.path}" aria-label="${escape(row.spec.tower)} upgrade path"></label>`}<label>Attack component<select data-comparison-field="componentId" ${row.components.length?'':'disabled'}>${row.components.length?row.components.map(component=>`<option value="${escape(component.id)}" ${component.id===row.context.componentId?'selected':''}>${escape(component.name)}</option>`).join(''):'<option>No direct attack</option>'}</select></label><label>Ability<select data-comparison-field="abilityId" ${row.abilities.length?'':'disabled'}>${row.abilities.length?row.abilities.map(ability=>`<option value="${escape(ability.id)}" ${ability.id===row.context.abilityId?'selected':''}>${escape(ability.name)}</option>`).join(''):'<option>No ability</option>'}</select></label><details><summary>Warnings &amp; exclusions</summary><p>${escape([...row.notes,...row.result.warnings,...row.result.unmodeled.map(n=>n+': reference only')].join(' ')||'One projectile contact per cycle; geometry, armor, detection and special scaling are excluded.')}</p></details><button class="text-button" data-remove-preset="${index}">Remove</button>${absoluteStats(row.result)}${abilityTimings(row.context,towerCatalog,row.result)}</td>${multiplierCells(row.result)}</tr>`;
  }).join('');restoreDetails();$('#add-tower-preset').disabled=specs.length>=8;
 }
 $('#tower-comparison').addEventListener('toggle',renderTowers);
 $('#open-tower-comparison').addEventListener('click',()=>{$('#tower-comparison').open=true;renderTowers();});
 $('#tower-comparison-sort').addEventListener('change',renderTowers);
 $('#add-tower-preset').addEventListener('click',()=>{if(specs.length<8){specs.push(currentSpec());renderTowers();}});
 $('#tower-comparison-rows').addEventListener('change',event=>{
  const field=event.target.dataset.comparisonField;if(!field)return;const index=Number(event.target.closest('tr').dataset.comparisonIndex);const next=specs.map(spec=>({...spec}));
  if(field==='tower'){const actor=actors.find(a=>a.name===event.target.value);next[index]={tower:actor.name,...(actor.hero?{heroLevel:1}:{path:'000'})};}
  else{next[index][field]=field==='heroLevel'?Number(event.target.value):event.target.value;if(field==='path'||field==='heroLevel'){delete next[index].componentId;delete next[index].abilityId;}}
  try{compareTowerPresets(artifacts,getState().selected,getState().context,towerCatalog,next);specs=next;event.target.setCustomValidity('');renderTowers();}
  catch(error){event.target.setCustomValidity(error.message);event.target.reportValidity();message(error.message);}
 });
 $('#tower-comparison-rows').addEventListener('click',event=>{const index=event.target.dataset.removePreset;if(index!==undefined){specs.splice(Number(index),1);renderTowers();}});
 return {onStateChanged:renderTowers};
}
