import {metadataFromFields} from './saved-metadata.js';
import {exceedsAdditionLimit,artifactLimitMessage} from './artifact-capacity.js';
import {getPresetVariant} from './tower-stats.js';
import {compareMultipliers} from './artifact-metrics.js';
import {rememberDetails,abilityTimings,factor} from './comparison-ui.js';
import {exportBuildReport} from './build-report.js';
import {initPartyOverview} from './party-overview-ui.js';
import { artifactCandidate, compareBuilds, snapshot, createSavedBuild, parseLibrary, exportLibrary, libraryKey, maxBuilds } from './build-tools.js';
import { calculate, supported } from './calculator.js';
import { targetTypes } from './target-stats.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('en', {maximumFractionDigits:2}).format(value);
const signed = value => `${value > 0 ? '+' : ''}${fmt(value)}`;
function deltaLabel(row) {
  if(row.delta === null) return row.beforeGlobal && row.afterGlobal ? 'Unchanged' : '—';
  if(Math.abs(row.delta) < 1e-10) return 'No change';
  return row.relative === null ? `${signed(row.delta)} (from zero)` : `${signed(row.relative * 100)}%`;
}
export function artifactTools(artifact, rarity, state, artifacts, currentResult, analysis) {
  if(!supported.has(artifact.id)) return '';
  const selected = Boolean(state.selected[artifact.id]);
  const candidate = artifactCandidate(state, artifact, selected ? null : rarity);
  // Selected contribution compares without -> with. Preview compares current -> candidate.
  const current = currentResult ?? calculate(artifacts,state.selected,state.context);
  const alternative = analysis ? null : calculate(artifacts,candidate.selected,candidate.context);
  const rows = analysis?.multiplierRows ?? (selected ? compareMultipliers(alternative,current) : compareMultipliers(current,alternative));
  const changes = rows.filter(row => row.delta !== null && Math.abs(row.delta) > 1e-10);
  const text = changes.length ? changes.map(row => `${row.label} ${factor(row.before)} → ${factor(row.after)}`).join(' · ') : 'No measurable artifact multiplier change. Target ratios need a nonzero base. Unlimited range is not scored.';
  const next = selected ? artifact.variants[artifact.variants.findIndex(v => v.rarity === rarity) + 1] : null;
  return `<div class="artifact-tools"><p>${selected ? 'Contribution' : 'If added'}: ${escape(text)}</p><button class="text-button" data-preview="${artifact.id}" data-preview-rarity="${selected ? '' : escape(rarity)}">Preview ${selected ? 'removal' : 'addition'}</button>${next ? `<button class="text-button" data-preview="${artifact.id}" data-preview-rarity="${escape(next.rarity)}">Preview ${escape(next.rarity)}</button>` : ''}</div>`;
}
function identity(state,catalog) {
  const c = state.context;
  const conditions = [['early','first 20s'],['close','Close targeting'],['aura','artifact auras'],['glued','glued'],['frozen','frozen'],['stunned','stunned / tranced']].filter(([key]) => c[key]).map(([,label]) => label);
  if(state.selected.TooManyCooks)conditions.push(`${c.otherMilitaryCount} other Military aura sources`);
  const component=getPresetVariant(catalog,c)?.components.find(item=>item.id===c.componentId);
  return [`${c.tower} ${c.category==='Hero'?'level '+c.heroLevel:c.upgradePath??'manual'}`,component?.name??'Manual attack',c.statMode==='manual'?'Manual stats':null,`${targetTypes[c.targetType]}${c.camo?', Camo':''}${c.fortified?', Fortified':''}`,c.criticalMode==='expected'?'crit estimates':'normal hits',conditions.length?conditions.join(', '):null].filter(Boolean).join(' · ');
}
export function initBuildWorkbench({artifacts, towerCatalog, artifactVersion, getState, setState, message}) {
  let builds = [], baseline = null, preview = null, deleted = null;
  const source = {artifacts: String(artifactVersion), towers: towerCatalog.source.gameVersion};
  const newId = () => globalThis.crypto?.randomUUID?.() ?? `build-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let stored;
  try {
    stored = localStorage.getItem(libraryKey);
    if(stored) builds = parseLibrary(stored, artifacts);
  } catch {
    if(stored) {$('#build-json').value = stored; $('.saved-builds').open = true; $('.build-transfer').open = true;}
    message('Saved builds could not be read. The original collection is in the import/export text box. Copy it before saving a replacement. Your current build is still available.');
  }
  function persist(next) {
    const serialized = exportLibrary(next);
    if(serialized.length > 2_000_000) {message('This collection exceeds the 2 MB backup limit. Export and remove some builds first.');return false;}
    try { localStorage.setItem(libraryKey, serialized); }
    catch { message('Could not save this collection. Browser storage may be full or unavailable. Export the collection to keep a copy.'); return false; }
    builds = next; return true;
  }
  const party = initPartyOverview({artifacts, towerCatalog, artifactVersion, getState, getBuilds: () => builds});
  const selectedBuild = () => builds.find(build => build.id === $('#saved-build').value);
  function renderSaved(id = $('#saved-build').value) {
    party.render();
    $('#saved-build').innerHTML = '<option value="">Choose a saved build</option>' + builds.map(build => `<option value="${escape(build.id)}">${escape(build.name)}</option>`).join('');
    $('#saved-build').value = builds.some(build => build.id === id) ? id : '';
    const selected = selectedBuild();
    for(const button of ['load-build','update-build','delete-build']) $('#' + button).disabled = !selected;
    $('#export-builds').disabled = !builds.length;
    $('#undo-delete').hidden = !deleted;
    renderReport();
    $('#saved-build-info').textContent = selected ? `Saved ${selected.savedAt ? new Date(selected.savedAt).toLocaleString() : 'date unknown'} · Artifacts v${selected.source.artifacts || '?'} · Towers/heroes v${selected.source.towers || '?'}.` : `${builds.length} / ${maxBuilds} builds saved in this browser.`;
  }
  function renderComparison() {
    const left = preview ? getState() : baseline?.state;
    const right = preview?.state ?? getState();
    $('#comparison-panel').hidden = !left;
    $('#swap-builds').hidden = !baseline || Boolean(preview);
    $('#apply-preview').hidden = !preview;
    const blocked=preview&&exceedsAdditionLimit(getState().selected,preview.state.selected);
    $('#apply-preview').disabled=Boolean(blocked);
    $('#apply-preview').title=blocked?artifactLimitMessage:'';
    $('#cancel-preview').hidden = !preview;
    if(!left) return;
    const comparison = compareBuilds(artifacts, left, right);
    $('#comparison-title').textContent = preview ? preview.label : 'Pinned build → Current build';
    $('#comparison-before').textContent = `${preview ? 'Current build' : 'Pinned build'}: ${identity(left,towerCatalog)}`;
    $('#comparison-after').textContent = `${preview ? 'Preview' : 'Current build'}: ${identity(right,towerCatalog)}`;
    const restoreDetails=rememberDetails($('#comparison-abilities'));
    $('#comparison-multiplier-rows').innerHTML=comparison.multiplierRows.map(row=>`<tr><th scope="row">${escape(row.label)}</th><td>${factor(row.before)}</td><td>${factor(row.after)}</td><td>${row.delta===null?'Unavailable':(row.delta>0?'+':'')+fmt(row.delta)+' factor points'}</td></tr>`).join('');
    $('#comparison-abilities').innerHTML=`<div><h3>${preview?'Current':'Pinned'} build</h3>${abilityTimings(left.context,towerCatalog,comparison.before)}</div><div><h3>${preview?'Preview':'Current'} build</h3>${abilityTimings(right.context,towerCatalog,comparison.after)}</div>`;
    restoreDetails();
    $('#comparison-rows').innerHTML = comparison.rows.map(row => `<tr><th scope="row">${row.label}</th><td>${row.beforeGlobal ? 'Unlimited' : row.before === null ? 'Unknown' : fmt(row.before)}</td><td>${row.afterGlobal ? 'Unlimited' : row.after === null ? 'Unknown' : fmt(row.after)}</td><td>${escape(deltaLabel(row))}</td></tr>`).join('');
    $('#comparison-warning').textContent = [...new Set([...comparison.before.warnings, ...comparison.after.warnings])].join(' ');
    if(blocked)$('#comparison-warning').textContent+=' '+artifactLimitMessage;
  }
  $('#pin-build').addEventListener('click', () => {
    baseline = {state: snapshot(getState(), artifacts)}; preview = null; renderComparison();
    message('Build pinned for comparison.');
  });
  $('#swap-builds').addEventListener('click', () => {
    if(!baseline) return;
    const previous = baseline.state; baseline = {state:snapshot(getState(), artifacts)}; preview = null;
    setState(previous); message('Current and pinned builds swapped.');
  });
  $('#clear-comparison').addEventListener('click', () => {baseline = null; preview = null; renderComparison();});
  $('#cancel-preview').addEventListener('click', () => {preview = null; renderComparison();});
  $('#apply-preview').addEventListener('click', () => {
    if(!preview) return;
    if(exceedsAdditionLimit(getState().selected,preview.state.selected)){message(artifactLimitMessage);return;}
    const candidate = preview.state; preview = null;
    setState(candidate); message('Preview applied.');
  });
  function previewArtifact(id,rarity){
    const artifact=artifacts.find(a=>a.id===id);if(!artifact)return;
    preview={label:`${rarity?'Add / change to '+rarity:'Remove'} ${artifact.name}`,state:artifactCandidate(getState(),artifact,rarity)};
    renderComparison();$('#comparison-panel').scrollIntoView?.({block:'nearest',behavior:'smooth'});$('#comparison-panel').focus({preventScroll:true});
  }
  $('#artifact-list').addEventListener('click',event=>{
    const button=event.target.closest('[data-preview]');if(button)previewArtifact(button.dataset.preview,button.dataset.previewRarity||null);
  });
  $('#saved-build').addEventListener('change', () => {
    const selected = selectedBuild(); if(selected) fillMetadata(selected);
    renderSaved();
  });
  const metadata = () => metadataFromFields($('#build-notes').value, $('#build-tags').value);
  function fillMetadata(build) {$('#build-name').value=build.name;$('#build-notes').value=build.notes;$('#build-tags').value=build.tags.join(', ');}
  function saveNew(duplicate = false) {
    if(builds.length >= maxBuilds) {message('This browser already has 50 saved builds. Export or remove one before saving another.'); return;}
    try {
      const name = duplicate ? `${$('#build-name').value.trim() || 'Build'} copy` : $('#build-name').value;
      const build = createSavedBuild(name, getState(), artifacts, source, newId(), undefined, metadata());
      if(persist([...builds, build])) {$('#build-name').value = build.name;renderSaved(build.id);message(`Saved “${build.name}” in this browser.`);}
    } catch(error) {message(error.message);}
  }
  $('#save-build').addEventListener('click', () => saveNew());
  $('#duplicate-build').addEventListener('click', () => saveNew(true));
  $('#update-build').addEventListener('click', () => {
    const selected = selectedBuild(); if(!selected) return;
    try {
      const replacement = createSavedBuild($('#build-name').value, getState(), artifacts, source, selected.id, undefined, metadata());
      if(persist(builds.map(build => build.id === selected.id ? replacement : build))) {renderSaved(selected.id);message(`Updated “${replacement.name}”.`);}
    } catch(error) {message(error.message);}
  });
  $('#load-build').addEventListener('click', () => {
    const selected = selectedBuild(); if(!selected) return;
    const hadBaseline = Boolean(baseline);
    if(!baseline) baseline = {state:snapshot(getState(), artifacts)};
    fillMetadata(selected); preview = null; setState(snapshot(selected.state, artifacts, towerCatalog));
    message(`Loaded “${selected.name}”. ${hadBaseline ? 'Pinned comparison kept.' : 'Previous build pinned.'}`);
  });
  $('#delete-build').addEventListener('click', () => {
    const selected = selectedBuild(); if(!selected) return;
    if(persist(builds.filter(build => build.id !== selected.id))) {deleted = selected;renderSaved();message(`Deleted “${selected.name}”. Undo is available until the next deletion or page reload.`);}
  });
  $('#undo-delete').addEventListener('click', () => {
    if(!deleted || builds.length >= maxBuilds) {message('Remove a saved build to make room before undoing.');return;}
    const id = deleted.id;
    if(persist([...builds, deleted])) {deleted = null;renderSaved(id);message('Saved build restored.');}
  });
  $('#export-builds').addEventListener('click', () => {
    const json = exportLibrary(builds); $('#build-json').value = json;
    const url = URL.createObjectURL(new Blob([json], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url;link.download = 'rogue-lab-builds.json';link.click();setTimeout(() => URL.revokeObjectURL(url),1000);
    message('Build collection exported.');
  });
  $('#import-builds').addEventListener('click', () => {
    try {
      const imported = parseLibrary($('#build-json').value, artifacts);
      if(builds.length + imported.length > maxBuilds) throw new Error('Import would exceed the 50-build limit. Existing builds were kept.');
      const additions = imported.map(build => ({...build, id:newId()}));
      if(persist([...builds,...additions])) {renderSaved(additions[0]?.id);message(`Imported ${additions.length} builds. Unknown artifact selections are omitted.`);}
    } catch(error) {message(error.message);}
  });
  $('#build-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if(!file) return;
    if(file.size > 2_000_000) {message('Build import is too large (maximum 2 MB).');return;}
    try {$('#build-json').value = await file.text(); message('File ready to import.');}
    catch {message('Could not read the selected file.');}
  });
  function renderReport() {
    if (!$('#build-report-panel').open) return;
    $('#build-report-text').value = exportBuildReport({state:getState(), artifacts, towerCatalog, artifactVersion, name:$('#build-name').value, notes:$('#build-notes').value, tags:$('#build-tags').value.split(',')});
  }
  $('#build-report-panel').addEventListener('toggle', renderReport);
  for (const id of ['build-name','build-notes','build-tags']) $('#'+id).addEventListener('input', renderReport);
  $('#export-build-report').addEventListener('click', () => {
    renderReport();
    const url = URL.createObjectURL(new Blob([$('#build-report-text').value], {type:'text/markdown;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'rogue-lab-build-report.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('Build report exported.');
  });
  renderSaved();renderComparison();
  return {previewArtifact,previewBuild(next,label){preview={label,state:snapshot(next,artifacts)};renderComparison();$('#comparison-panel').scrollIntoView({block:'start'});$('#comparison-panel').focus({preventScroll:true});},onStateChanged() {preview = null;renderComparison();party.render();renderReport();}};
}
