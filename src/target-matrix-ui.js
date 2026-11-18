import {sourceNotes} from './ui-notes.js';
import {multiplierMetrics} from './artifact-metrics.js';
import {rememberDetails,abilityTimings,factor} from './comparison-ui.js';
import {compareTargets} from './target-matrix.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => value === null ? 'Unknown' : new Intl.NumberFormat('en', {maximumFractionDigits:3}).format(value);
const signed = value => `${value > 0 ? '+' : ''}${fmt(value)}`;

export function initTargetMatrix({artifacts,towerCatalog, getState}) {
  function render() {
    if (!$('#target-matrix').open) return;
    const state = getState(), c = state.context;
    const rows = compareTargets(artifacts, state);
    $('#matrix-context').textContent = `${c.tower} · ${c.category === 'Hero' ? 'level '+c.heroLevel : c.upgradePath ?? 'manual tier '+c.tier} · ${c.statMode} stats · ${c.camo ? 'Camo on for every column' : 'Camo off for every column'} · ${c.criticalMode === 'expected' ? 'critical estimates enabled' : 'normal hits'}. Current artifacts, component, ability, and battle conditions apply to every column.`;
    $('#matrix-head').innerHTML = '<th scope="col">Modeled stat</th>'+rows.map(row => `<th scope="col">${escape(row.label)}</th>`).join('');
    const metrics = [
      ['normal-hit','Normal damage / hit',row => fmt(row.result.targetHit)],
      ...(c.criticalMode === 'expected' ? [['expected-hit','Expected damage / hit',row => fmt(row.result.expectedTargetHit)]] : []),
      ['attacks','Attacks / sec',row => fmt(row.result.attacks)],
      ['base-dps','Base DPS (no artifacts)',row => fmt(row.base.targetDpsValue)],
      ['build-dps','Build DPS',row => fmt(row.result.targetDpsValue)],
      ['gain','Artifact DPS change',row => signed(row.gain)],
      ['pierce','Pierce / projectile',row => fmt(row.result.projectilePierce)],
      ['range','Range',row => row.result.rangeMode === 'global' ? 'Unlimited' : fmt(row.result.attackRange)],
      ['ability','Ability cooldown (sec)',row => fmt(row.result.abilitySeconds)],
      ['eligibility','Hit eligibility',row => escape(row.eligibility)]
    ];
    $('#matrix-absolute-head').innerHTML=$('#matrix-head').innerHTML;
    $('#matrix-values').innerHTML=multiplierMetrics(rows[0].result).map((metric,index)=>`<tr><th scope="row">${metric.label} ×</th>${rows.map(row=>`<td>${factor(multiplierMetrics(row.result)[index].value)}</td>`).join('')}</tr>`).join('');
    $('#matrix-absolute-values').innerHTML = metrics.map(([id,label,value]) => `<tr data-matrix-metric="${id}"><th scope="row">${label}</th>${rows.map(row => `<td data-matrix-target="${row.id}">${value(row)}</td>`).join('')}</tr>`).join('');
    const restoreDetails=rememberDetails($('#matrix-notes'));
    $('#matrix-notes').innerHTML = rows.map(row => `<details><summary>${escape(row.label)} — calculation notes</summary><p>${escape(sourceNotes(row.notes).join(' ') || 'No additional artifact warnings.')}</p>${abilityTimings(row.context,towerCatalog,row.result)}</details>`).join('');
    restoreDetails();
  }
  $('#target-matrix').addEventListener('toggle', render);
  $('#open-target-matrix').addEventListener('click', () => {
    $('#target-matrix').open = true;
    render();
  });
  return {onStateChanged:render};
}
