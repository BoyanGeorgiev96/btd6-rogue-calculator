import {sourceNotes} from './ui-notes.js';
import {rememberDetails,multiplierCells,absoluteStats,abilityTimings,factor} from './comparison-ui.js';
import {compareUpgrades} from './upgrade-comparison.js';
import {targetTypes} from './target-stats.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => value === null ? 'Unknown' : new Intl.NumberFormat('en', {maximumFractionDigits:3}).format(value);
const signed = value => `${value > 0 ? '+' : ''}${fmt(value)}`;

export function initUpgradeComparison({artifacts, towerCatalog, getState}) {
  const actors=[...towerCatalog.towers,...(towerCatalog.powers??[]).filter(p=>Object.keys(p.variants).length>1)];
  const initial = getState().context;
  let tower = actors.find(entry => entry.name === initial.tower)?.name ?? actors[0].name;
  let referencePath = tower === initial.tower && initial.upgradePath ? initial.upgradePath : '000';
  let components = {}, abilities = {};
  $('#upgrade-tower').innerHTML = actors.map(entry => `<option ${entry.name === tower ? 'selected' : ''}>${escape(entry.name)}</option>`).join('');
  function paths() {
    const actor = actors.find(entry => entry.name === tower);
    $('#upgrade-reference').innerHTML = Object.keys(actor.variants).sort().map(path => `<option ${path === referencePath ? 'selected' : ''}>${path}</option>`).join('');
  }
  paths();
  function render() {
    if (!$('#upgrade-comparison').open) return;
    const state = getState(), c = state.context;
    const tier = $('#upgrade-tier').value === 'all' ? null : Number($('#upgrade-tier').value);
    const comparison = compareUpgrades(artifacts, state, towerCatalog, {tower, referencePath, components, abilities, tier});
    const reference = comparison.reference;
    $('#upgrade-context').textContent = `${tower} · ${targetTypes[c.targetType]}${c.camo ? ' · Camo' : ''}${c.fortified ? ' · Fortified' : ''} · ${Object.keys(state.selected).length} artifacts · ${c.criticalMode === 'expected' ? 'critical estimates' : 'normal hits'} · tower export v${towerCatalog.source.gameVersion}.`;
    $('#upgrade-baseline').textContent = `Reference ${referencePath} · ${reference.componentName} · ${factor(reference.result.targetDpsMultiplier)} target DPS multiplier · ${reference.interval === null ? 'No modeled attacks' : fmt(reference.interval)+'s between attacks'} · ${comparison.rows.length} paths shown. Reference remains in use when filtered out.`;
    const rows = [...comparison.rows];
    if($('#upgrade-sort').value==='factor')rows.sort((a,b)=>(b.result.targetDpsMultiplier??-1)-(a.result.targetDpsMultiplier??-1)||a.path.localeCompare(b.path));
    if ($('#upgrade-sort').value === 'dps') rows.sort((a,b) => b.result.targetDpsValue-a.result.targetDpsValue || a.path.localeCompare(b.path));
    const restoreDetails=rememberDetails($('#upgrade-rows'));
    $('#upgrade-rows').innerHTML = rows.map(row => `<tr data-upgrade-path="${row.path}" ${row.isReference ? 'class="upgrade-reference-row"' : ''}>
      <th scope="row">${row.path}${row.isReference ? '<small>Reference</small>' : ''}<label>Attack component<select data-upgrade-field="component" aria-label="Attack component for ${row.path}" ${row.components.length ? '' : 'disabled'}>${row.components.length ? row.components.map(component => `<option value="${escape(component.id)}" ${component.id === row.context.componentId ? 'selected' : ''}>${escape(component.name)}</option>`).join('') : '<option>No direct attack</option>'}</select></label>
      <label>Ability<select data-upgrade-field="ability" aria-label="Ability for ${row.path}" ${row.abilities.length ? '' : 'disabled'}>${row.abilities.length ? row.abilities.map(ability => `<option value="${escape(ability.id)}" ${ability.id === row.context.abilityId ? 'selected' : ''}>${escape(ability.name)}</option>`).join('') : '<option>No ability</option>'}</select></label>
      <details><summary>Warnings &amp; exclusions</summary><p>${escape(sourceNotes(row.notes).join(' ') || 'There are no additional source notes.')}</p></details>${absoluteStats(row.result)}${abilityTimings(row.context,towerCatalog,row.result)}<details class="absolute-stats"><summary>Absolute change vs reference</summary><p data-upgrade-metric="dps">${fmt(row.result.targetDpsValue)}<small>Artifacts ${signed(row.artifactGain)}</small></p><p data-upgrade-metric="change">${signed(row.dpsChange)}</p><p data-upgrade-metric="interval">${row.interval === null ? 'No attacks' : fmt(row.interval)+'s'} · ${row.intervalChange === null ? 'Change unavailable' : signed(row.intervalChange)+'s vs reference'}</p></details></th>${multiplierCells(row.result)}</tr>`).join('');
    restoreDetails();
  }
  $('#upgrade-comparison').addEventListener('toggle', render);
  $('#open-upgrade-comparison').addEventListener('click', () => {
    $('#upgrade-comparison').open = true; render();
  });
  $('#upgrade-tower').addEventListener('change', event => {tower=event.target.value; referencePath='000'; components={}; abilities={}; paths(); render();});
  $('#upgrade-reference').addEventListener('change', event => {referencePath=event.target.value; render();});
  for (const id of ['upgrade-tier','upgrade-sort']) $('#'+id).addEventListener('change', render);
  $('#upgrade-rows').addEventListener('change', event => {
    const field = event.target.dataset.upgradeField;
    if (!field) return;
    const path = event.target.closest('tr').dataset.upgradePath;
    (field === 'component' ? components : abilities)[path] = event.target.value;
    render();
  });
  return {onStateChanged:render};
}
