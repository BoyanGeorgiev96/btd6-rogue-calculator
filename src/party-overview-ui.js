import {sourceNotes} from './ui-notes.js';
import {rememberDetails,multiplierCells,absoluteStats,abilityTimings} from './comparison-ui.js';
import {compareParty} from './party-overview.js';
import {targetTypes} from './target-stats.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initPartyOverview({artifacts, towerCatalog, artifactVersion, getState, getBuilds}) {
  const selected = new Set();
  function render() {
    if (!$('#party-overview').open) return;
    const builds = getBuilds();
    for (const id of selected) if (!builds.some(b => b.id === id)) selected.delete(id);
    $('#party-builds').innerHTML = builds.length ? builds.map(build => `<label><input type="checkbox" data-party-build="${escape(build.id)}" ${selected.has(build.id) ? 'checked' : selected.size >= 8 ? 'disabled' : ''}> ${escape(build.name)}</label>`).join('') : '<p>Save a tower or hero in Saved builds to add it here.</p>';
    const current = getState(), c = current.context;
    $('#party-context').textContent = `${targetTypes[c.targetType]}${c.camo ? ' · Camo' : ''}${c.fortified ? ' · Fortified' : ''} · ${Object.keys(current.selected).length} selected artifacts · ${c.criticalMode === 'expected' ? 'crit estimates' : 'normal hits'} · ${selected.size} / 8 saved builds.`;
    const rows = compareParty(artifacts, current, builds.filter(b => selected.has(b.id)), towerCatalog);
    const metric = $('#party-sort').value;
    rows.sort((a,b) => metric === 'dps' ? b.result.targetDpsValue-a.result.targetDpsValue : metric==='gain'?b.gain-a.gain:(b.result.targetDpsMultiplier??-1)-(a.result.targetDpsMultiplier??-1));
    const restoreDetails=rememberDetails($('#party-rows'));
    $('#party-rows').innerHTML = rows.map(row => `<tr data-party-row="${escape(row.id)}"><th scope="row">${escape(row.name)}<small>${escape(row.context.tower)} · ${row.context.category === 'Hero' ? 'level '+row.context.heroLevel : escape(row.context.upgradePath ?? 'tier '+row.context.tier)} · ${escape(row.componentName)} · ${escape(row.context.statMode)} stats</small><details><summary>Source &amp; exclusions</summary><p>Artifacts v${escape(artifactVersion)} · Towers/heroes/powers v${escape(towerCatalog.source.gameVersion)}. Presets refresh from the bundled catalog. Manual values are retained.</p><p>${escape(sourceNotes(row.notes).join(' ') || 'No additional source warnings.')}</p></details>${absoluteStats(row.result)}${abilityTimings(row.context,towerCatalog,row.result)}</th>${multiplierCells(row.result)}</tr>`).join('');
    restoreDetails();
    $('#party-empty').hidden = rows.length > 0;
  }
  $('#party-overview').addEventListener('toggle', render);
  $('#open-party').addEventListener('click', () => {$('#party-overview').open = true;render();});
  $('#party-sort').addEventListener('change', render);
  $('#party-builds').addEventListener('change', event => {
    const id = event.target.dataset.partyBuild;
    if (!id) return;
    if (event.target.checked && selected.size < 8) selected.add(id); else selected.delete(id);
    render();
  });
  return {render};
}
