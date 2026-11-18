import { artifactCoverage, coverageStatuses, filterCoverage } from './artifact-coverage.js';

export function appendEvidenceLinks(parent, links) {
  const list=document.createElement('p');
  for(const [index,link] of links.entries()) {
    if(index)list.append(' · ');
    const a=document.createElement('a');a.href=link.href;a.textContent=link.label;
    a.target='_blank';a.rel='noreferrer';list.append(a);
  }
  parent.append(list);
}

export function initArtifactCoverage(artifacts) {
  const rows=artifactCoverage(artifacts);
  const search=document.querySelector('#coverage-search'), status=document.querySelector('#coverage-status');
  for(const name of coverageStatuses) {
    const option=document.createElement('option');option.value=name;option.textContent=name;status.append(option);
  }
  document.querySelector('#coverage-summary').textContent=`${artifacts.length} artifacts · ${rows.length} effect/rarity rows. `+
    coverageStatuses.map(name=>`${name}: ${rows.filter(row=>row.status===name).length}`).join(' · ');
  const pageSize=50;
  let page=0;
  const previous=document.querySelector('#coverage-previous'), next=document.querySelector('#coverage-next');
  function render() {
    const matching=filterCoverage(rows,{search:search.value,status:status.value});
    const visible=matching.slice(page*pageSize,(page+1)*pageSize);
    document.querySelector('#coverage-count').textContent=matching.length?
      `Showing ${page*pageSize+1}–${page*pageSize+visible.length} of ${matching.length} matching effect/rarity rows (${rows.length} total).`:
      `No matching effects. 0 of ${rows.length} effect/rarity rows shown.`;
    previous.disabled=page===0;next.disabled=(page+1)*pageSize>=matching.length;
    const fragment=document.createDocumentFragment();
    for(const row of visible) {
      const tr=document.createElement('tr');
      const name=document.createElement('th');name.scope='row';name.textContent=`${row.name} · ${row.rarity}`;tr.append(name);
      const effect=document.createElement('td');effect.textContent=row.label;tr.append(effect);
      const evidence=document.createElement('td');
      const label=document.createElement('strong');label.textContent=row.status;evidence.append(label);
      const note=document.createElement('p');note.textContent=row.detail;evidence.append(note);
      appendEvidenceLinks(evidence,row.links);
      const detail=document.createElement('details'), summary=document.createElement('summary');summary.textContent='Complete source description';
      const description=document.createElement('p');description.textContent=row.description;detail.append(summary,description);evidence.append(detail);
      tr.append(evidence);fragment.append(tr);
    }
    document.querySelector('#coverage-rows').replaceChildren(fragment);
    document.querySelector('#coverage-dashboard .comparison-table').scrollTop=0;
  }
  function refilter(){page=0;render();}
  search.addEventListener('input',refilter);status.addEventListener('change',refilter);
  previous.addEventListener('click',()=>{page--;render();});next.addEventListener('click',()=>{page++;render();});
  // Avoid building a large hidden table during calculator/comparison startup.
  let initialized=false;
  return {show(){if(!initialized){render();initialized=true;}}};
}
