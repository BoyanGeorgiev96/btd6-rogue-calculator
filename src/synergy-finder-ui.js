import {factor,absoluteStats,abilityTimings,rememberDetails} from './comparison-ui.js';
import {conversionArtifacts, findSynergies} from './synergy-finder.js';
import {targetTypes} from './target-stats.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('en', {maximumFractionDigits:3}).format(value);
const labels = {conversion:'Category conversion',damageSet:'Base damage replacement',damageCap:'Maximum ordinary hit damage',damage:'Damage',regularDamage:'Status damage (bosses excluded)',attackRate:'Attack rate',moabDamage:'MOAB damage',bossDamage:'Boss damage',pierce:'Pierce',range:'Range',targetDamage:'Target damage',flatDamage:'Flat target damage',abilityRate:'Ability recharge rate',critical:'Potential critical expectation (stacking unverified)'};
export function initSynergyFinder({artifacts,towerCatalog, getState, previewArtifact}) {
  const conversions = conversionArtifacts(artifacts);
  $('#synergy-conversion').innerHTML = conversions.map(a => `<option value="${escape(a.id)}">${escape(a.name)}</option>`).join('');
  $('#synergy-conversion').value = conversions.find(a => getState().selected[a.id])?.id ?? conversions[0].id;
  function render() {
    if (!$('#synergy-finder').open) return;
    const state = getState(), c = state.context;
    const s = findSynergies(artifacts, state, $('#synergy-conversion').value);
    $('#synergy-context').textContent = `${c.tower} · ${c.category === 'Hero' ? 'level '+c.heroLevel : c.upgradePath ?? 'tier '+c.tier} · ${targetTypes[c.targetType]} · ${s.rarity} conversion ${s.owned ? '(selected)' : '(hypothetical addition)'}.`;
    $('#synergy-categories').textContent = `${s.before.join(', ')} → ${s.after.join(', ')}. ${s.added.length ? 'New categories: '+s.added.join(', ')+'.' : 'No additional categories. '+(s.reasons.join(' ') || 'Another conversion or the original category already covers these categories.')}`;
    $('#synergy-totals').textContent = `Current loadout without → with this conversion: ${factor(s.base.targetDpsMultiplier)} → ${factor(s.result.targetDpsMultiplier)} target-DPS multiplier. Unselected artifacts below are excluded from these totals. ${s.result.warnings.join(' ')}`;
    const restore=rememberDetails($('#synergy-details'));
    $('#synergy-details').innerHTML=`<div><h3>Without conversion</h3>${absoluteStats(s.base)}${abilityTimings(c,towerCatalog,s.base)}</div><div><h3>With conversion</h3>${absoluteStats(s.result)}${abilityTimings(c,towerCatalog,s.result)}</div>`;
    restore();
    $('#synergy-effects').innerHTML = s.unlocks.length ? s.unlocks.map(u => `<tr><th scope="row">${escape(u.name)}<small>${escape(u.rarity)} · ${u.owned ? 'Selected' : 'Potential pairing'}</small></th><td>${u.effects.map(e => `${escape(labels[e.stat])}: ${e.stat === 'flatDamage' ? '+' : '×'}${fmt(e.value)}${e.penalty ? ' — penalty' : ''}`).join('<br>')}</td></tr>`).join('') : '<tr><td colspan="2">No newly activated modeled effects for this tower and these conditions.</td></tr>';
    $('#synergy-roster-context').textContent = `Identity exploration at tower tier ${c.tier} / hero level ${c.heroLevel}, using current target, conditions, crit mode, and other selected conversions. All modeled artifacts are considered at their selected rarity or first listed rarity. No upgrade path is assumed for other towers, so path-gated effects are omitted. `;
    $('#synergy-beneficiaries').innerHTML = s.beneficiaries.length ? s.beneficiaries.map(b => `<tr><th scope="row">${escape(b.tower)}<small>${escape(b.category)} → +${escape(b.added.join(', '))}</small></th><td>${escape(b.bonuses.join(', '))}${b.penalties.length ? `<small>Also unlocks penalties: ${escape(b.penalties.join(', '))}</small>` : ''}</td></tr>`).join('') : '<tr><td colspan="2">No towers unlock bonuses at these tiers and conditions.</td></tr>';
    $('#preview-synergy').disabled = s.owned;
  }
  $('#synergy-finder').addEventListener('toggle', render);
  $('#synergy-conversion').addEventListener('change', render);
  $('#open-synergy').addEventListener('click', () => {$('#synergy-finder').open = true;render();});
  $('#preview-synergy').addEventListener('click', () => {
    const s = findSynergies(artifacts, getState(), $('#synergy-conversion').value);
    previewArtifact(s.converter.id, s.rarity);
  });
  return {onStateChanged:render};
}
