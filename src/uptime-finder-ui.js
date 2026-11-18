import {calculate} from './calculator.js';
import {getAbilityTimers} from './tower-stats.js';
import {findUptimeThresholds} from './uptime-finder.js';
import {escape,fmt,factor,timingText,timingAssumptions} from './comparison-ui.js';
const $=s=>document.querySelector(s);
export function initUptimeFinder({artifacts,towerCatalog,getState,previewBuild}) {
  let results=[];
  function refresh(){
    const state=getState(),result=calculate(artifacts,state.selected,state.context),previous=$('#uptime-ability').value;
    const timers=getAbilityTimers(state.context,towerCatalog,result.abilityCooldown);
    $('#uptime-ability').innerHTML=timers.map(timer=>`<option value="${escape(timer.id??'__manual__')}">${escape(timer.name)}</option>`).join('');
    if(timers.some(t=>(t.id??'__manual__')===previous))$('#uptime-ability').value=previous;
    $('#find-uptime').disabled=!timers.length;
    results=[];$('#uptime-results').replaceChildren();$('#uptime-status').textContent=timers.length?'':'No available ability timer. Choose a preset with an ability, or enter a manual timer.';
  }
  function search(){
    const state=getState(),id=$('#uptime-ability').value;
    const answer=findUptimeThresholds(artifacts,state,towerCatalog,id==='__manual__'?null:id,{maxChanges:Number($('#uptime-changes').value)});
    results=answer.matches.length?answer.matches:answer.progress;
    $('#uptime-status').textContent=`${answer.timer.name}: ${timingText(answer.timer)}. ${answer.tested} candidates tested. ${answer.matches.length?'Ranked by fewest changes, then target-DPS multiplier.':answer.reason}`;
    $('#uptime-results').innerHTML=results.map((row,i)=>`<article class="uptime-choice"><h3>${row.changes.map(c=>`${escape(c.name)} · ${escape(c.rarity)}${c.previous?' (replaces '+escape(c.previous)+')':''}`).join(' + ')}</h3><p>${escape(timingText(row.timer))} · ${fmt(row.timer.seconds)}s cooldown</p><p>${row.multiplierRows.filter(m=>m.delta!==null&&Math.abs(m.delta)>1e-10).map(m=>`${escape(m.label)} ${factor(m.before)} → ${factor(m.after)}`).join(' · ')}</p>${row.result.warnings.length?'<p>'+escape(row.result.warnings.join(' '))+'</p>':''}<button data-preview-uptime="${i}">Preview these changes</button></article>`).join('');
  }
  $('#find-uptime').addEventListener('click',search);
  for(const id of ['uptime-ability','uptime-changes'])$('#'+id).addEventListener('change',()=>{results=[];$('#uptime-results').replaceChildren();$('#uptime-status').textContent='';});
  $('#uptime-results').addEventListener('click',e=>{const button=e.target.closest('[data-preview-uptime]');if(button&&results[Number(button.dataset.previewUptime)]){const row=results[Number(button.dataset.previewUptime)];previewBuild(row.state,'Ability uptime candidate');}});
  $('#uptime-assumptions').textContent=`${timingAssumptions} Searches modeled recharge artifacts and conversions within the selected scope. Prices and offer availability are excluded.`;
  refresh();return {onStateChanged:refresh};
}
