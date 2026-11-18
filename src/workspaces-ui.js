import { initArtifactCoverage, appendEvidenceLinks } from './artifact-coverage-ui.js';
import { artifactEvidence } from './artifact-discovery.js';

const descriptions = {
  calculator: ['Calculator', ''],
  planner: ['Run planner', 'Unsaved plan changes reset on reload.'],
  compare: ['Compare', 'Temporary comparisons reset on reload.'],
  reference: ['Reference', '']
};
const toolIds = {
  'open-target-matrix':'target-matrix', 'open-offers':'offer-comparison',
  'open-synergy':'synergy-finder', 'open-party':'party-overview',
  'open-upgrade-comparison':'upgrade-comparison', 'open-tower-comparison':'tower-comparison'
};
const tools = {
  'offer-comparison': ['Compare artifact offers'],
  'target-matrix': ['Target matrix'],
  'synergy-finder': ['Synergy finder'],
  'party-overview': ['Party overview'],
  'upgrade-comparison': ['Compare upgrades'],
  'tower-comparison': ['Compare tower presets']
};
const $ = selector => document.querySelector(selector);

// Query routes work on any static host, including a GitHub Pages repository path.
// Workspace changes retain the same document and all module-owned drafts/history.
export function initWorkspaces({artifacts}) {
  const workbench = $('.workbench');
  const planner = $('#run-planner');
  $('#planner-workspace').append(planner);
  for (const id of Object.values(toolIds)) {
    const panel = $('#'+id);
    $('#compare-workspace').append(panel);
    panel.querySelector(':scope > summary').hidden = true;
    panel.setAttribute('aria-labelledby', 'workspace-title');
  }
  $('#reference-accuracy-slot').append($('.accuracy-details'));
  const coverage=initArtifactCoverage(artifacts);
  $('#reference-artifact').replaceChildren(...[...artifacts].sort((a,b)=>a.name.localeCompare(b.name)).map(artifact => {
    const option = document.createElement('option'); option.value=artifact.id; option.textContent=artifact.name; return option;
  }));
  function evidence() {
    const artifact=artifacts.find(entry=>entry.id===$('#reference-artifact').value);
    const fragment=document.createDocumentFragment();
    for(const variant of artifact.variants) {
      const detail=document.createElement('details'), summary=document.createElement('summary');
      summary.textContent=variant.rarity;detail.append(summary);
      const description=document.createElement('p');description.textContent=variant.description;detail.append(description);
      for(const entry of artifactEvidence(artifact,variant)) {
        const p=document.createElement('p');p.textContent=`${entry.label} · ${entry.status}. ${entry.detail}`;detail.append(p);
        appendEvidenceLinks(detail,entry.links);
      }
      fragment.append(detail);
    }
    const source=document.createElement('a');source.href='https://btd6apiexplorer.github.io/rogue';source.textContent='Artifact source catalog ↗';source.target='_blank';source.rel='noreferrer';fragment.append(source);
    $('#reference-evidence').replaceChildren(fragment);
  }
  $('#reference-artifact').addEventListener('change',evidence);evidence();
  // Display choices never enter a build, shared URL or undo history.
  let preferences={};
  try { preferences=JSON.parse(localStorage.getItem('rogue-lab-display-v1')||'{}')||{}; } catch {}
  if(typeof preferences!=='object'||Array.isArray(preferences))preferences={};
  for(const detail of document.querySelectorAll('[data-display-preference]')) {
    const key=detail.dataset.displayPreference;
    if(typeof preferences[key]==='boolean')detail.open=preferences[key];
    detail.addEventListener('toggle',()=>{
      preferences[key]=detail.open;
      try {localStorage.setItem('rogue-lab-display-v1',JSON.stringify(preferences));} catch {}
    });
  }
  function show({focus=false}={}) {
    const url=new URL(location.href);
    const requested=url.searchParams.get('workspace');
    const workspace=Object.hasOwn(descriptions,requested)?requested:'calculator';
    const [title,description]=descriptions[workspace];
    document.body.dataset.workspace=workspace;
    document.title=`${title} · Rogue Lab`;
    $('#workspace-title').textContent=title;$('#workspace-description').textContent=description;$('#workspace-description').hidden=!description;
    for(const panel of document.querySelectorAll('[data-workspace-panel]'))panel.hidden=panel.dataset.workspacePanel!==workspace;
    for(const link of document.querySelectorAll('.workspace-nav [data-workspace]')) {
      if(link.dataset.workspace===workspace)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    const calculator=workspace==='calculator', compare=workspace==='compare';
    (compare?$('#compare-build-slot'):$('#calculator-build-slot')).append(workbench);
    $('#shared-build-tools').hidden=!(calculator||compare);
    if(calculator)$('#calculator-workspace').insertBefore($('#shared-build-tools'),$('#calculator-build-slot'));
    else if(compare)$('#compare-workspace').insertBefore($('#shared-build-tools'),$('#compare-build-editor'));
    $('.live-stat-bar').hidden=workspace==='reference';
    if(workspace==='planner')planner.open=true;
    if(workspace==='reference')coverage.show();
    const requestedTool=url.searchParams.get('tool');
    const tool=Object.values(toolIds).includes(requestedTool)?requestedTool:'offer-comparison';
    for(const [buttonId,panelId] of Object.entries(toolIds)) {
      $('#'+panelId).hidden=!compare||tool!==panelId;
      $('#'+buttonId).setAttribute('aria-pressed',String(tool===panelId));
    }
    if(compare) {
      $('#'+tool).open=true;
      const [toolTitle]=tools[tool];
      $('#workspace-title').textContent=toolTitle;
      document.title=`${toolTitle} · Rogue Lab`;
    }
    if(focus){$('#workspace-title').focus({preventScroll:true});$('#workspace-title').scrollIntoView({block:'start'});}
  }
  function navigate(workspace, tool=null) {
    const url=new URL(location.href);url.searchParams.set('workspace',workspace);
    if(tool)url.searchParams.set('tool',tool);else url.searchParams.delete('tool');
    if(url.href!==location.href)history.pushState(null,'',url);
    show({focus:true});
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-workspace]');
    const toolButton=event.target.closest('#compare-tool-links button');
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(link){event.preventDefault();navigate(link.dataset.workspace);}
    else if(toolButton&&toolIds[toolButton.id])navigate('compare',toolIds[toolButton.id]);
  },true);
  // The stats bar opens the shared editor without leaving the comparison.
  $('#edit-settings').addEventListener('click',()=>{
    if(document.body.dataset.workspace==='compare')$('#compare-build-editor').open=true;
    else if(document.body.dataset.workspace!=='calculator')navigate('calculator');
  },true);
  window.addEventListener('popstate',()=>show({focus:true}));
  show();
  return {refresh:show};
}
