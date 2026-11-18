import {sourceNotes} from './ui-notes.js';
import {getAbilityTimers} from './tower-stats.js';
import {multiplierMetrics} from './artifact-metrics.js';
export const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=value=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(value);
export const factor=value=>value===null?'Unavailable':'×'+fmt(value);
export const timingAssumptions='Nominal timing assumes recharge starts on activation and immediate reuse. Targets, charges, cooldown floors and round transitions can add downtime.';
export function timingText(timer) {
  return timer.durationSeconds===null?'Duration unknown · gap not estimated':`Duration ${fmt(timer.durationSeconds)}s (${timer.durationManual?'manual':'source'}) · ${timer.gapSeconds===null?'Gap not estimated: conditional / limited activation':timer.gapSeconds===0?'Potential continuous uptime · 0s nominal gap':`${fmt(timer.gapSeconds)}s nominal gap · ${fmt(timer.uptime*100)}% uptime`}`;
}
export function abilityTimings(context,catalog,result) {
  const timers=getAbilityTimers(context,catalog,result.abilityCooldown);
  return `<details class="all-ability-timings"><summary>All ability timings (${timers.length})</summary>${timers.length?timers.map(timer=>`<p><strong>${escape(timer.name)}</strong> · ${timer.seconds===null?'Unknown cooldown':fmt(timer.seconds)+'s cooldown'}<br>${escape(timingText(timer))}${timer.notes.length?'<br>'+escape(sourceNotes(timer.notes).join(' ')):''}</p>`).join(''):'<p>No imported fixed-cooldown ability.</p>'}${timers.length?`<p>${timingAssumptions}</p>`:''}</details>`;
}
export function multiplierCells(result) {
  return multiplierMetrics(result).map(m=>`<td>${factor(m.value)}</td>`).join('');
}
export function absoluteStats(result) {
  return `<details class="absolute-stats"><summary>Tower stats with artifacts applied</summary><p>Target DPS ${fmt(result.targetDpsValue)} · Damage / hit ${fmt(result.expectedTargetHit)} · Attacks / sec ${fmt(result.attacks)} · Pierce ${result.projectilePierce===null?'Unknown':fmt(result.projectilePierce)} · Range ${result.rangeMode==='global'?'Unlimited':result.attackRange===null?'Unknown':fmt(result.attackRange)} · Selected cooldown ${result.abilitySeconds===null?'Unknown / no ability':fmt(result.abilitySeconds)+'s'}</p></details>`;
}

// Keep disclosures open through recalculation without adding display state to builds.
export function rememberDetails(container) {
  const key=detail=>{
    const row=detail.closest('tr');
    const identity=row?JSON.stringify(row.dataset)+(row.querySelector('[data-offer-field="id"]')?.value??''):detail.closest('[data-ability-timer]')?.dataset.abilityTimer??detail.parentElement.querySelector('h3')?.textContent??'';
    return identity+'|'+detail.className+'|'+detail.querySelector(':scope > summary')?.textContent.replace(/\s*\(\d+\)$/, '');
  };
  const open=new Set([...container.querySelectorAll('details[open]')].map(key));
  return ()=>{for(const detail of container.querySelectorAll('details'))if(open.has(key(detail)))detail.open=true;};
}
