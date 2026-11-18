import {metadataFromFields} from './saved-metadata.js';
import {runPlanKey, runPlanLibraryKey, maxRunPlans, maxPlanLibraryBytes, parseRunPlan, parsePlanLibrary, createSavedPlan, exportPlanLibrary} from './run-plan-storage.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId=()=>crypto.randomUUID();

export function initRunPlanLibrary({artifacts,towerCatalog,artifactVersion,snapshot,restore,render}) {
  let plans=[],activeId='',savedActiveId='',deleted=null,pending=null,baseline='',unreadable=false;
  const status=text=>{$('#plan-storage-status').textContent=text;};
  const read=text=>parsePlanLibrary(text,artifacts,towerCatalog,artifactVersion);
  const selected=()=>plans.find(plan=>plan.id===$('#saved-plan').value);
  const signature=()=>JSON.stringify({name:$('#plan-name').value,snapshot:snapshot()});
  function changed() {
    try {return signature()!==baseline;} catch {return true;}
  }
  function refresh(id=$('#saved-plan').value) {
    $('#saved-plan').innerHTML='<option value="">Choose a saved plan</option>'+plans.map(plan=>`<option value="${escape(plan.id)}">${escape(plan.name)}${plan.snapshot.tags.length?' · '+escape(plan.snapshot.tags.join(', ')):''}</option>`).join('');
    $('#saved-plan').value=plans.some(plan=>plan.id===id)?id:'';
    for(const action of ['plan-load','plan-delete','plan-update'])$('#'+action).disabled=!selected();
    $('#plan-undo-delete').hidden=!deleted;
    $('#plans-export').disabled=!plans.length;
    onChange();
  }
  function onChange() {
    pending=null;$('#plan-discard-load').hidden=true;
    const active=plans.find(plan=>plan.id===activeId);
    $('#plan-library-info').textContent=`${plans.length} / ${maxRunPlans} plans saved.${active?' Editing “'+active.name+'”.':''}${changed()?' Unsaved changes.':''}`;
  }
  function persist(next,id=savedActiveId) {
    if(unreadable)throw new Error('Stored plans could not be read. Copy the original JSON before replacing this collection.');
    localStorage.setItem(runPlanLibraryKey,exportPlanLibrary(next,id));
    plans=next;savedActiveId=id;
  }
  function apply(entry) {
    const loaded=parseRunPlan(JSON.stringify(entry.snapshot),artifacts,towerCatalog,artifactVersion);
    restore(loaded.snapshot);activeId=entry.id;$('#plan-name').value=entry.name;
    baseline=signature();render();refresh(entry.id);
    status('Saved plan restored with its target and battle conditions.'+(loaded.sourceChanged?' The source has changed. Results use the bundled data.':''));
  }
  try {
    const stored=localStorage.getItem(runPlanLibraryKey);
    if(stored){const loaded=read(stored);plans=loaded.plans;activeId=savedActiveId=loaded.activeId;}
    else {
      const legacy=localStorage.getItem(runPlanKey);
      if(legacy){const loaded=parseRunPlan(legacy,artifacts,towerCatalog,artifactVersion);const raw=JSON.parse(legacy);plans=[createSavedPlan('My run plan',{...loaded.snapshot,source:raw.source},newId())];activeId=savedActiveId=plans[0].id;}
    }
    const active=plans.find(plan=>plan.id===activeId);if(active)apply(active);
  } catch(error) {
    unreadable=true;
    try {$('#plan-json').value=localStorage.getItem(runPlanLibraryKey)??localStorage.getItem(runPlanKey)??'';} catch {}
    status('Saved plans could not be restored: '+error.message+' Stored data has not been changed. Export text is available below.');
  }
  baseline=signature();refresh(activeId);
  function save(mode) {
    try {
      if(mode!=='update'&&plans.length>=maxRunPlans)throw new Error('This browser already has 50 saved plans. Export or remove one first.');
      const target=selected();if(mode==='update'&&!target)return;
      const name=$('#plan-name').value+(mode==='duplicate'?' copy':'');
      const entry=createSavedPlan(name,snapshot(),mode==='update'?target.id:newId());
      const next=mode==='update'?plans.map(plan=>plan.id===target.id?entry:plan):[...plans,entry];
      // Enforce the same per-plan limits as transfer, before touching storage.
      parseRunPlan(JSON.stringify(entry.snapshot),artifacts,towerCatalog,artifactVersion);
      persist(next,entry.id);activeId=entry.id;$('#plan-name').value=entry.name;baseline=signature();refresh(entry.id);
      status(`Complete plan saved: “${entry.name}”.`);
    } catch(error){status('Plan could not be saved: '+error.message+' Export JSON to retain it.');}
  }
  $('#plan-save').addEventListener('click',()=>save('new'));
  $('#plan-update').addEventListener('click',()=>save('update'));
  $('#plan-duplicate').addEventListener('click',()=>save('duplicate'));
  $('#saved-plan').addEventListener('change',()=>refresh());
  function load(entry) {
    try {persist(plans,entry.id);apply(entry);} catch(error){status('Plan could not be loaded: '+error.message);}
  }
  $('#plan-load').addEventListener('click',()=>{
    const entry=selected();if(!entry)return;
    if(changed()){pending=entry;$('#plan-discard-load').hidden=false;status('Unsaved changes. Save them as a new plan, update the selected plan, or discard them to load.');}
    else load(entry);
  });
  $('#plan-discard-load').addEventListener('click',()=>{if(pending)load(pending);});
  $('#plan-delete').addEventListener('click',()=>{
    const entry=selected();if(!entry)return;
    try {persist(plans.filter(plan=>plan.id!==entry.id),savedActiveId===entry.id?'':savedActiveId);if(activeId===entry.id){activeId='';baseline='';}deleted=entry;refresh();status(`Deleted “${entry.name}”. You can undo this deletion.`);}
    catch(error){status('Plan could not be deleted: '+error.message);}
  });
  $('#plan-undo-delete').addEventListener('click',()=>{
    if(!deleted)return;
    try {if(plans.length>=maxRunPlans)throw new Error('Remove a plan to make room first.');const id=deleted.id;persist([...plans,deleted]);deleted=null;refresh(id);status('Saved plan restored.');}
    catch(error){status(error.message);}
  });
  function download(json,name) {
    $('#plan-json').value=json;
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#plan-export').addEventListener('click',()=>{
    try {const current=snapshot();parseRunPlan(JSON.stringify(current),artifacts,towerCatalog,artifactVersion);download(JSON.stringify({...current,name:$('#plan-name').value},null,2),'rogue-lab-run-plan.json');status('Complete plan exported.');}
    catch(error){status(error.message);}
  });
  $('#plans-export').addEventListener('click',()=>{
    try {download(exportPlanLibrary(plans,savedActiveId),'rogue-lab-run-plans.json');status('Saved plan collection exported.');} catch(error){status(error.message);}
  });
  $('#plan-import').addEventListener('click',()=>{
    try {
      const text=$('#plan-json').value,loaded=parseRunPlan(text,artifacts,towerCatalog,artifactVersion),raw=JSON.parse(text);
      if(raw.name!==undefined&&(typeof raw.name!=='string'||raw.name.length>80))throw new Error('Invalid plan name.');
      restore(loaded.snapshot);$('#plan-name').value=raw.name??'Imported run plan';activeId='';render();refresh('');
      status('Plan imported with its target and conditions. Save the plan to keep it in this browser.'+(loaded.sourceChanged?' The source differs. Results use the bundled data.':''));
    }catch(error){status('Import rejected: '+error.message+' Current plan unchanged.');}
  });
  $('#plans-import').addEventListener('click',()=>{
    try {
      const imported=read($('#plan-json').value);
      if(plans.length+imported.plans.length>maxRunPlans)throw new Error('Import would exceed the 50-plan limit.');
      const additions=imported.plans.map(plan=>({...plan,id:newId()}));
      persist([...plans,...additions]);refresh(additions[0]?.id);status(`Imported ${additions.length} plans. Current workspace kept.`);
    }catch(error){status('Import rejected: '+error.message+' Saved plans unchanged.');}
  });
  $('#plan-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try {if(file.size>maxPlanLibraryBytes)throw new Error('File must be at most 2 MB.');$('#plan-json').value=await file.text();status('File ready to import.');}
    catch(error){status(error.message);}event.target.value='';
  });
  for(const id of ['plan-name','plan-notes','plan-tags'])$('#'+id).addEventListener('input',onChange);
  return {onChange};
}

export function planMetadata() {return metadataFromFields($('#plan-notes').value,$('#plan-tags').value);}
