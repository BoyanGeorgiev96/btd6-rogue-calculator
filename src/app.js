import {sourceNotes,routineScopeNotes} from './ui-notes.js';
import {artifactLimit,artifactLimitMessage,canAddArtifact,artifactCapacityWarning} from './artifact-capacity.js';
import {artifactEffectFilters,filterArtifactEntries} from './artifact-filters.js';
import {rememberDetails} from './comparison-ui.js';
import {initUptimeFinder} from './uptime-finder-ui.js';
import {explainMultiplier} from './multiplier-explanation.js';
import {setManualAbilityDuration} from './ability-timing.js';
import { initStatVisibility } from './stat-visibility-ui.js';
import { initWorkspaces } from './workspaces-ui.js';
import { initOffline } from './offline-ui.js';
import { initRunPlanner } from './run-planner-ui.js';
import { initUpgradeComparison } from './upgrade-comparison-ui.js';
import { initTargetMatrix } from './target-matrix-ui.js';
import { initSynergyFinder } from './synergy-finder-ui.js';
import { initArtifactOffers } from './artifact-offers-ui.js';
import { createBuildHistory } from './build-history.js';
import { initPlanningTools } from './planning-ui.js';
import { analyzeArtifact, sortArtifacts, artifactEvidence } from './artifact-discovery.js';
import { artifactTools, initBuildWorkbench } from './build-workbench-ui.js';
import { targetTypes } from './target-stats.js';
import { getAbilityTimers, applyAbilityPreset, setManualAbilityCooldown, applyTowerPreset, getPresetVariant, getPresetSourceUrl, restoreTowerContext, setManualStat, validUpgradePath, validateTowerCatalog, validateHeroCatalog, validatePowerCatalog } from './tower-stats.js';
import { artifactConditionHints, artifactSummary } from './artifact-summary.js';
import {calculate,defaults,sanitizeState,supported,towers} from './calculator.js';
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='rogue-lab-v1';
let statVisibility,uptimeFinder,explainedStat=null,workspaceNavigation, runPlanner, upgradeTools, matrixTools, synergyTools, offerTools, buildHistory, planningTools, workbench, catalog, towerCatalog, state={context:{...defaults},selected:{}}, view='modeled', choices={};
const fmt=n=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(n);
const fmtSource=n=>new Intl.NumberFormat('en',{maximumFractionDigits:6}).format(n);
const mult=n=>`${fmt(n)}×`;
const percent=n=>`${n>=1?'+':''}${fmt((n-1)*100)}%`;
function message(text){$('#app-message').textContent=text;$('#app-message').hidden=false;}
function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{message('Browser storage is unavailable. You can still save your build with a link.');}}
function contextControls(){
  $('#tower-category').innerHTML=Object.keys(towers).map(t=>`<option ${t===state.context.category?'selected':''}>${t}</option>`).join('');
  $('#tower').innerHTML=towers[state.context.category].map(t=>`<option value="${escape(t)}" ${t===state.context.tower?'selected':''}>${t==='Hero'?'Custom hero (manual)':escape(t)}</option>`).join('');
  $('#target-type').value=state.context.targetType;$('#target-camo').checked=state.context.camo;$('#target-fortified').checked=state.context.fortified;
  $('#critical-mode').value=state.context.criticalMode;$('#other-military-count').value=state.context.otherMilitaryCount;
  $('#tier').value=state.context.tier;$('#hero-level').value=state.context.heroLevel;
  $('#tier-label').hidden=state.context.category==='Hero'||Boolean(state.context.upgradePath);
  const power=state.context.category==='Powers'?towerCatalog.powers.find(p=>p.name===state.context.tower):null;
  $('#upgrade-paths').hidden=state.context.category==='Hero'||Boolean(power&&Object.keys(power.variants).length===1);$('#hero-level-label').hidden=state.context.category!=='Hero';
  $('#base-damage').value=state.context.baseDamage;$('#base-boss-damage').value=state.context.baseBossDamage ?? state.context.baseDamage;$('#base-rate').value=Number(state.context.baseRate.toPrecision(10));
  $('#base-pierce').value=state.context.basePierce ?? '';
  $('#base-range').value=state.context.baseRange ?? '';
  $('#range-global').checked=state.context.rangeMode==='global';
  $('#base-range').disabled=state.context.rangeMode==='global';
  $('#base-range').placeholder=state.context.rangeMode==='global'?'Unlimited':'Unknown';
  const path=state.context.upgradePath ?? '000';
  ['top','middle','bottom'].forEach((name,index)=>{
    $(`#path-${name}`).innerHTML=Array.from({length:6},(_,tier)=>{const candidate=[...path];candidate[index]=String(tier);return `<option value="${tier}" ${path[index]===String(tier)?'selected':''} ${validUpgradePath(candidate.join(''))&&(!power||power.variants[candidate.join('')])?'':'disabled'}>${tier}</option>`;}).join('');
  });
  const variant=getPresetVariant(towerCatalog,state.context);
  $('#component').innerHTML=variant?.components.length?variant.components.map(c=>`<option value="${escape(c.id)}" ${c.id===state.context.componentId?'selected':''}>${escape(c.name)}</option>`).join(''):'<option>No direct attack preset</option>';
  $('#component').disabled=!variant?.components.length;
  $('#ability').innerHTML='<option value="">Manual timer</option>'+(variant?.abilities??[]).map(a=>`<option value="${escape(a.id)}" ${a.id===state.context.abilityId?'selected':''}>${escape(a.name)}</option>`).join('');
  $('#base-ability-cooldown').value=state.context.baseAbilityCooldown??'';
  document.querySelectorAll('[data-condition]').forEach(el=>el.checked=state.context[el.dataset.condition]);
}
function renderPresetInfo(){
  const c=state.context;
  $('#live-stat-context').textContent=`Calculator build · ${c.tower} · ${c.category==='Hero'?'Level '+c.heroLevel:(c.upgradePath??'Manual')} · ${targetTypes[c.targetType]}${c.camo?' · Camo':''}${c.fortified?' · Fortified':''}`;
  $('#setup-compact-context').textContent=`${c.tower} · ${c.category==='Hero'?'Level '+c.heroLevel:(c.upgradePath??'Manual')} · ${targetTypes[c.targetType]}${c.camo?' · Camo':''}${c.fortified?' · Fortified':''}`;
  $('#tower-context-label').textContent=`${c.tower} · ${c.category==='Hero'?'Level '+c.heroLevel:(c.upgradePath??'Manual')} ${c.statMode==='manual'?'· manual stats':''}`;
  const variant=getPresetVariant(towerCatalog,c);
  const activeConditions=[['early','First 20 seconds'],['close','Close targeting'],['aura','Artifact auras'],['glued','Glued'],['frozen','Frozen'],['stunned','Stunned / tranced']].filter(([key])=>c[key]).map(([,label])=>label);
  $('#cooks-count-label').hidden=!state.selected.TooManyCooks;
  if(state.selected.TooManyCooks)activeConditions.push(`${c.otherMilitaryCount} other Military aura sources`);
  const activeComponent=variant?.components.find(component=>component.id===c.componentId);
  $('#active-settings').textContent=[activeComponent?.name,c.statMode==='manual'?'Manual stats':null,c.abilityMode==='manual'?'Manual ability timer':null,c.criticalMode==='expected'?'Critical estimates enabled':null,...activeConditions].filter(Boolean).join(' · ');
  $('#live-stat-settings').textContent=$('#active-settings').textContent;
  $('#live-stat-settings').hidden=!(c.statMode==='manual'||c.abilityMode==='manual'||c.criticalMode==='expected'||activeConditions.length);
  if(activeComponent)$('#live-stat-context').textContent+=' · '+activeComponent.name;
  $('.conditions > summary').textContent=`Battle conditions${activeConditions.length?' · '+activeConditions.length+' active':''}`;
  $('#critical-settings > summary').textContent=`Critical hits · ${c.criticalMode==='expected'?'estimate enabled':'normal hits'}`;
  const component=variant?.components.find(component=>component.id===c.componentId);
  const notes=sourceNotes([...(variant?.notes ?? []),...(component?.notes ?? [])]);
  $('#component-warnings').textContent=notes.filter(note=>!routineScopeNotes.has(note)).join(' ');
  const source=towerCatalog.source;
  const url=getPresetSourceUrl(towerCatalog,c);
  const identity=c.category==='Hero'?' · Level '+c.heroLevel:(c.upgradePath?' · '+[...c.upgradePath].join('-'):'');
  $('#preset-info').innerHTML=`<strong>${c.statMode==='preset'?(c.category==='Hero'?'Hero preset':c.category==='Powers'?'Power preset':'Tower preset'):'Manual stats'}${identity}</strong>`+
    (component?.damageExcluded?'':component?`<p>Source cooldown ${fmtSource(component.cooldownSeconds)}s · Pierce ${fmt(component.pierce)} · ${component.projectiles===null?'Variable projectile count':component.projectiles+' projectile'+(component.projectiles===1?'':'s')+(component.trigger==='secondary'?' per trigger':' per cycle')}</p>`:'<p>No repeatable attack in this preset.</p>')+
    (url?`<p>${c.category==='Hero'?'Hero':c.category==='Powers'?'Power':'Tower'} export v${escape(source.gameVersion)} · <a href="${escape(url)}" target="_blank" rel="noreferrer">Source ↗</a></p>`:'<p>Custom hero: enter the stats for your hero and level.</p>')+
    (component?.damageExcluded?'':'<p>One projectile contact per cycle. Components are calculated separately, not summed. Source snapshot may differ from your game version.</p>')+
    (c.rangeMode==='global'?'<p>Range boosts leave unlimited targeting unlimited.</p>':'')+
    notes.map(note=>`<p class="preset-warning">${escape(note)}</p>`).join('');
  const ability=variant?.abilities.find(a=>a.id===c.abilityId);
  $('#ability-info').textContent=(c.abilityMode==='preset'?`${ability?.name??'Ability'} · pinned base timer ${fmt(c.baseAbilityCooldown)}s. `:c.abilityMode==='none'?'No fixed-cooldown ability in this preset. ':'Manual ability timer. ')+sourceNotes(ability?.notes??[]).join(' ');
  $('#load-preset').disabled=!variant;
}
function renderList(){
  const expanded=new Set([...document.querySelectorAll('.artifact-details[open]')].map(detail=>detail.closest('[data-id]').dataset.id));
  const currentResult=calculate(catalog.artifacts,state.selected,state.context);
  const query=$('#search').value.toLowerCase().trim(), category=$('#category-filter').value;
  const matchesQuery=a=>`${a.name} ${a.category} ${a.variants.map(v=>v.description).join(' ')}`.toLowerCase().includes(query);
  const hiddenReferences=catalog.artifacts.filter(a=>!supported.has(a.id)&&matchesQuery(a)).length;
  $('#artifact-visibility-note').hidden=view!=='modeled'||!query||!hiddenReferences;
  $('#artifact-visibility-message').textContent=`${hiddenReferences}${query?' matching':''} reference-only artifact${hiddenReferences===1?' is':'s are'} hidden. Their effects aren’t calculated.`;
  const entries=catalog.artifacts.filter(a=>
    (view!=='modeled'||supported.has(a.id))&&(view!=='selected'||state.selected[a.id])&&
    (category==='all'||(category==='boss'?a.boss:a.category===category))&&
    matchesQuery(a)).map(a=>analyzeArtifact(a,state.selected[a.id]||choices[a.id]||a.variants[0].rarity,state,catalog.artifacts,currentResult));
  const filtered=filterArtifactEntries(entries,{effect:$('#effect-filter').value,impact:$('#impact-filter').value,rarity:$('#rarity-filter').value});
  const artifacts=sortArtifacts(filtered.filter(entry=>!$('#only-applicable').checked||entry.applicable),$('#artifact-sort').value);
  $('#clear-artifact-filters').disabled=!query&&category==='all'&&$('#effect-filter').value==='all'&&$('#impact-filter').value==='all'&&$('#rarity-filter').value==='all'&&!$('#only-applicable').checked;
  $('#result-count').textContent=`${artifacts.length} artifact${artifacts.length===1?'':'s'}${query?' found':''}`;
  $('#selected-count').textContent=Object.keys(state.selected).length;
  const selectedCount=Object.keys(state.selected).length;
  $('#artifact-capacity-status').hidden=selectedCount<artifactLimit;
  $('#artifact-capacity-status').textContent=artifactCapacityWarning(selectedCount)||`${selectedCount} / ${artifactLimit} selected. Remove an artifact before adding another.`;
  $('#artifact-list').innerHTML=artifacts.length?artifacts.map(analysis=>{
    const a=analysis.artifact;
    const rarity=state.selected[a.id]||choices[a.id]||a.variants[0].rarity;
    const v=a.variants.find(v=>v.rarity===rarity), enabled=Boolean(state.selected[a.id]);
    const blocked=!canAddArtifact(state.selected,a.id);
    const symbol=a.boss?'✦':/Quickening|Strong|Speed|Synergy|TitForTat|BBGatling|Squadron|Specialist/.test(a.id)?'ϟ':/Precision|Damage|Harder|Discord|Steady/.test(a.id)?'⌖':'◇';
    const summary=artifactSummary(a,v,state.context,catalog.artifacts,state.selected);
    const hints=artifactConditionHints(a,state.context);
    const hintLinks=hints.map(hint=>`<a class="condition-hint" href="#condition-${hint.flag}" data-condition-hint="${hint.flag}">Set ${escape(hint.label)} →</a>`).join(' ');
    return `<article class="artifact-card ${enabled?'is-selected':''}" data-id="${a.id}"><div class="card-main" ${blocked?`title="${artifactLimitMessage}"`: ''}><label class="artifact-check"><input type="checkbox" data-select="${a.id}" aria-label="Enable ${escape(a.name)}" ${blocked?'aria-disabled="true" aria-describedby="artifact-capacity-status"':''} ${enabled?'checked':''}></label><div class="artifact-icon ${escape(a.category.toLowerCase().replaceAll(' ','-'))}">${symbol}</div><div class="artifact-info"><div class="artifact-category">${escape(a.boss?'Boss artifact':a.category)}${!supported.has(a.id)?' <span class="reference-tag">Reference only</span>':''}</div><h3>${escape(a.name)}</h3><p>${escape(summary)}${hintLinks?` <span class="condition-hints">${hintLinks}</span>`:''}</p></div><select class="rarity ${rarity.toLowerCase()}" id="rarity-${a.id}" data-rarity="${a.id}" aria-label="${escape(a.name)} rarity">${a.variants.map(v=>`<option ${v.rarity===rarity?'selected':''}>${v.rarity}</option>`).join('')}</select></div><details class="artifact-details" ${expanded.has(a.id)?'open':''}><summary>Details &amp; preview</summary>${artifactTools(a,rarity,state,catalog.artifacts,currentResult,analysis)}<p>${escape(v.description)}</p>${!supported.has(a.id)?'<p class="reference-warning">Reference only. This artifact is not included in calculated totals.</p>':''}${artifactEvidence(a,v).map(e=>`<p class="effect-evidence"><strong>${escape(e.label)} · ${escape(e.status)}</strong><br>${escape(e.detail)}</p>`).join('')}<a href="https://btd6apiexplorer.github.io/rogue" target="_blank" rel="noreferrer">View source catalog ↗</a></details></article>`;
  }).join(''):`<div class="empty-state"><span>⌕</span><h3>${view==='selected'&&!Object.keys(state.selected).length?'No artifacts selected.':'No artifacts match these filters.'}</h3><button id="reset-filters" class="text-button">Browse calculator artifacts →</button></div>`;
}
function clearArtifactFilters(){
  $('#search').value='';$('#category-filter').value='all';$('#effect-filter').value='all';$('#impact-filter').value='all';$('#rarity-filter').value='all';$('#only-applicable').checked=false;
  renderList();
}
function renderStats(){
  const r=calculate(catalog.artifacts,state.selected,state.context);
  const timers=getAbilityTimers(state.context,towerCatalog,r.abilityCooldown);
  const ability=getPresetVariant(towerCatalog,state.context)?.abilities.find(a=>a.id===state.context.abilityId);
  const rows=[
    ['Damage per hit',r.damage,fmt(r.hit),'damage / hit','damage'],
    ['Attack speed',r.rate,fmt(r.attacks),'attacks / sec','speed'],
    ['Boss damage per hit',r.bossDamage,fmt(r.bossHit),'damage / hit','boss'],
    ['Pierce',r.pierce,r.projectilePierce===null?'Unknown':fmt(r.projectilePierce),r.projectilePierce===null?'Base value unknown':'pierce / projectile','pierce'],
    ['Range',r.range,r.rangeMode==='global'?'Unlimited':r.attackRange===null?'Unknown':fmt(r.attackRange),r.rangeMode==='global'?'Global targeting':r.attackRange===null?'Base value unknown':'game units','range'],
    ['Ability cooldown',r.abilityCooldown,r.abilitySeconds===null?'Unknown':fmt(r.abilitySeconds)+'s',r.abilitySeconds===null?'Base timer unknown':ability?.name??'Manual timer','ability']
  ];
  $('#stats').innerHTML=`<div class="dps-highlight" data-modifier="dps"><span>${r.criticalMultiplier!==1?'Expected ':''}${targetTypes[state.context.targetType]} DPS</span><button class="multiplier-button" data-explain-stat="dps" aria-label="Explain target DPS multiplier">${r.targetDpsMultiplier===null?'—':'×'+fmt(r.targetDpsMultiplier)}</button></div>`+rows.map(([title,value,,,cls])=>`<div class="stat-row" data-modifier="${cls}"><span class="stat-label">${title}</span><button class="stat-value multiplier-button" data-explain-stat="${cls}" aria-label="Explain ${title} multiplier">×${fmt(value)}</button></div>`).join('');
  statVisibility?.refresh();
  const restoreStatDetails=rememberDetails($('#stat-modifiers'));
  $('#stat-modifiers').innerHTML=`<div><strong>${targetTypes[state.context.targetType]} DPS</strong><span>${fmt(r.targetDpsValue)}${r.criticalMultiplier!==1?' expected':''}</span><span>${fmt(r.targetHit)} normal damage / hit${r.targetDpsMultiplier===null?' · No base DPS for a multiplier':''}</span></div>`+rows.map(([title,value,absolute,unit,cls])=>cls==='ability'?`<div data-stat="ability"><strong>Ability cooldowns</strong>${timers.length?timers.map(timer=>`<div class="ability-timer" data-ability-timer="${escape(timer.id??'manual')}"><span>${escape(timer.name)}${timer.manual&&timer.id?' · manual override':''}</span><span class="stat-value">${timer.seconds===null?'Unknown':fmt(timer.seconds)+'s'}</span><span>Base ${timer.baseSeconds===null?'unknown':fmt(timer.baseSeconds)+'s'} · ${percent(value)}</span>${timer.durationSeconds===null?'<span>Duration unknown · gap not estimated</span>':`<span>Duration ${fmt(timer.durationSeconds)}s · ${timer.durationManual?'manual override':'pinned source'}</span><span>${timer.gapSeconds===null?'Gap not estimated · conditional / limited activation':timer.gapSeconds===0?'Potential continuous uptime · 0s nominal gap':`${fmt(timer.gapSeconds)}s nominal gap · ${fmt(timer.uptime*100)}% uptime`}</span>`}<details class="duration-override"><summary>Override duration</summary><label>Manual duration (sec)<input type="number" min="0.001" max="1000000000" step="any" data-duration-for="${escape(timer.id??'__manual__')}" aria-label="Manual duration for ${escape(timer.name)}" value="${timer.durationManual?timer.durationSeconds:''}" placeholder="${timer.sourceDurationSeconds===null?'Unknown':fmt(timer.sourceDurationSeconds)+'s source'}"></label>${timer.durationManual?`<button class="text-button" data-reset-duration="${escape(timer.id??'__manual__')}">Restore source duration</button>`:''}</details>${sourceNotes(timer.notes).map(note=>`<span>${escape(note)}</span>`).join('')}</div>`).join(''):'<span>No imported fixed-cooldown ability at this tier / level.</span>'}</div>`:`<div data-stat="${cls}"><strong>${title}</strong><span class="stat-value">${escape(absolute)}</span><span>${escape(unit)} · ${percent(value)}${cls==='range'&&r.rangeMode==='global'?' · range modifiers do not apply':''}${cls==='ability'&&state.context.abilityMode==='none'?' · no ability at this tier':''}</span></div>`).join('');
  restoreStatDetails();
  $('#calculation-warnings').textContent=r.warnings.join(' ');
  $('#live-stat-warning').textContent=r.warnings.join(' ');$('#live-stat-warning').hidden=!r.warnings.length;
  $('#calculation-trace').innerHTML=r.trace.map(step=>`<li><span>${escape(step.label)}</span><small>${step.operation==='targetModifier'?`${mult(step.factor)} + ${fmt(step.additive)}`:step.operation==='multiply'?mult(step.value):step.operation==='add'?'+ '+fmt(step.value):fmt(step.value)} → <strong>${fmtSource(step.after)}</strong></small></li>`).join('');
  $('#ability-calculation').textContent=r.abilitySeconds===null?'The ability timer is unknown or unavailable. Only the cooldown multiplier is shown.':`Ability timer: ${fmtSource(state.context.baseAbilityCooldown)}s ÷ ${mult(r.abilityRate)} recharge rate = ${fmtSource(r.abilitySeconds)}s (${mult(r.abilityCooldown)} base time). This is separate from attack DPS. Reviewed duration and nominal gap estimates are in Stats with artifacts applied. Charges, activation caps, cooldown floors and runtime uptime are not simulated.`;
  $('#trace-exclusions').textContent=[...r.unmodeled.map(name=>`${name}: reference only.`),...r.breakdown.filter(b=>!b.active).map(b=>`${b.name}: ${b.note}`),...r.breakdown.flatMap(b=>b.excluded.map(effect=>`${b.name}: ${effect} excluded.`))].join(' ')||'No selected reference-only or inactive effects.';
  $('#accuracy-overview').textContent=`Tower base stats: ${state.context.statMode==='preset'?'pinned export v'+towerCatalog.source.gameVersion:'manual values'}. Artifact descriptions: v${catalog.version}. Only cooldowns explicitly labeled verified use export values. Other effects are description estimates. Detection, geometry, armor, damage rounding, DOT, ability DPS, and innate crits are excluded. Ability timers use description-based recharge estimates. Reviewed durations support nominal gap estimates only. Charges, cooldown floors, and special resets are excluded.`;
  $('#critical-summary').textContent=r.criticalMultiplier!==1?`Expected artifact crit factor: ${mult(r.criticalMultiplier)}. Normal hit damage remains separate.`:'';
  if(explainedStat)renderMultiplierExplanation();
  $('#applied-count').textContent=`${r.breakdown.filter(b=>b.active).length} applied`;
  $('#breakdown-list').innerHTML=r.breakdown.length?r.breakdown.map(b=>`<div class="breakdown-row ${b.active?'':'inactive'}"><span>${escape(b.name)}<small>${b.active?escape(b.rarity):escape(b.note)}</small></span><strong>${b.active?[b.bossHitMultiplier*b.rate!==1?'DPS '+mult(b.bossHitMultiplier*b.rate):'',b.pierce!==1?'Pierce '+mult(b.pierce):'',b.range!==1?'Range '+mult(b.range):'',b.abilityRate!==1?'Cooldown '+mult(1/b.abilityRate):'',b.targetDamage!==1?'Target '+mult(b.targetDamage):'',b.flatDamage!==0?'Target +'+fmt(b.flatDamage):''].filter(Boolean).join('<br>')||'Categories updated':'—'}</strong></div>`).join(''):'<p class="no-boosts">No modeled effects selected.</p>';
  if(r.unmodeled.length)$('#breakdown-list').insertAdjacentHTML('beforeend',`<p class="unmodeled">${r.unmodeled.length} reference-only selection${r.unmodeled.length===1?' is':'s are'} excluded from totals.</p>`);
}
function renderMultiplierExplanation(){
  const explanation=explainMultiplier(catalog.artifacts,state,explainedStat);
  $('#multiplier-explanation').hidden=false;
  $('#multiplier-explanation-title').textContent=`${explanation.label} · ${explanation.value===null?'Unavailable': '×'+fmt(explanation.value)}`;
  $('#multiplier-explanation-note').textContent=explanation.note;
  $('#multiplier-explanation-rows').innerHTML=explanation.entries.map(entry=>`<li>${escape(entry.name)} · ${escape(entry.rarity)}: ${explanation.contextual?`${entry.before===null?'Unavailable':'×'+fmt(entry.before)} without → ${entry.after===null?'Unavailable':'×'+fmt(entry.after)} current`:'×'+fmt(entry.value)}${entry.conversion?' · category conversion':''}<small>${escape(entry.note)}</small></li>`).join('')||'<li>No artifacts selected. Factors start at ×1.</li>';
  $('#multiplier-explanation-exclusions').textContent=explanation.exclusions.join(' ');
}
function clearSharedHash(){if(location.hash.startsWith('#build='))history.replaceState(null,'',location.pathname+location.search);}
function render({record=true,historyGroup=null}={}){
  if(record&&buildHistory?.record(state,historyGroup))clearSharedHash();
  renderPresetInfo();renderList();renderStats();save();workbench?.onStateChanged();planningTools?.onStateChanged();offerTools?.onStateChanged();synergyTools?.onStateChanged();matrixTools?.onStateChanged();upgradeTools?.onStateChanged();runPlanner?.onStateChanged();uptimeFinder?.onStateChanged();
  $('#undo-build').disabled=!buildHistory?.canUndo;$('#redo-build').disabled=!buildHistory?.canRedo;
}
function restoreHistory(direction){
  const next=buildHistory?.[direction]();if(!next)return;
  state=next;clearSharedHash();contextControls();document.querySelectorAll('input').forEach(input=>input.setCustomValidity(''));render({record:false});
  message(direction==='undo'?'Previous build restored. Redo is available.':'Build change reapplied.');
}
async function init(){
  const response=await fetch(new URL('../data/artifacts.json',import.meta.url));
  if(!response.ok)throw new Error('Could not load the artifact catalog.');
  catalog=await response.json();
  const towerResponse=await fetch(new URL('../data/towers.json',import.meta.url));
  if(!towerResponse.ok)throw new Error('Could not load tower presets.');
  towerCatalog=await towerResponse.json();validateTowerCatalog(towerCatalog);
  const heroResponse=await fetch(new URL('../data/heroes.json',import.meta.url));
  if(!heroResponse.ok)throw new Error('Could not load hero presets.');
  const heroCatalog=await heroResponse.json();validateHeroCatalog(heroCatalog);
  if(JSON.stringify(heroCatalog.source)!==JSON.stringify(towerCatalog.source))throw new Error('Tower and hero source versions do not match.');
  towerCatalog.heroes=heroCatalog.heroes;
  const powerResponse=await fetch(new URL('../data/powers.json',import.meta.url));
  if(!powerResponse.ok)throw new Error('Could not load power presets.');
  const powerCatalog=await powerResponse.json();validatePowerCatalog(powerCatalog);
  if(JSON.stringify(powerCatalog.source)!==JSON.stringify(towerCatalog.source))throw new Error('Power and tower source versions do not match.');
  towerCatalog.powers=powerCatalog.powers;
  let raw;try{raw=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(location.hash.startsWith('#build=')){
    try{const encoded=location.hash.slice(7);if(encoded.length>50000)throw new Error();raw=JSON.parse(decodeURIComponent(encoded));message('Shared build loaded. Changes save in this browser.');}
    catch{message('That build link could not be read. Your saved build is shown instead.');}
  }
  $('#effect-filter').innerHTML='<option value="all">All effects</option>'+artifactEffectFilters.map(([id,label])=>`<option value="${id}">${escape(label)}</option>`).join('');
  $('#rarity-filter').innerHTML='<option value="all">Any rarity</option>'+[...new Set(catalog.artifacts.flatMap(a=>a.variants.map(v=>v.rarity)))].map(rarity=>`<option>${escape(rarity)}</option>`).join('');
  state=sanitizeState(raw,catalog.artifacts);
  state.context=raw?restoreTowerContext(state.context,towerCatalog):applyTowerPreset(state.context,towerCatalog);
  buildHistory=createBuildHistory(state);
  $('#data-version').textContent=`Artifacts: BTD6 v${catalog.version} · Towers/heroes/powers: BTD6 v${towerCatalog.source.gameVersion} · Artifact snapshot checked ${catalog.checked}`;
  workbench=initBuildWorkbench({artifacts:catalog.artifacts,towerCatalog,artifactVersion:catalog.version,getState:()=>state,setState:next=>{state=next;contextControls();render();},message});
  planningTools=initPlanningTools({artifacts:catalog.artifacts,towerCatalog,getState:()=>state,setState:next=>{state=next;contextControls();render();},message});
  offerTools=initArtifactOffers({artifacts:catalog.artifacts,towerCatalog,getState:()=>state,previewArtifact:(id,rarity)=>workbench.previewArtifact(id,rarity)});
  synergyTools=initSynergyFinder({artifacts:catalog.artifacts,towerCatalog,getState:()=>state,previewArtifact:(id,rarity)=>workbench.previewArtifact(id,rarity)});
  runPlanner=initRunPlanner({artifacts:catalog.artifacts,towerCatalog,artifactVersion:catalog.version,getState:()=>state,setState:next=>{state=next;contextControls();render();},message});
  upgradeTools=initUpgradeComparison({artifacts:catalog.artifacts,towerCatalog,getState:()=>state});
  matrixTools=initTargetMatrix({artifacts:catalog.artifacts,towerCatalog,getState:()=>state});
  uptimeFinder=initUptimeFinder({artifacts:catalog.artifacts,towerCatalog,getState:()=>state,previewBuild:(next,label)=>workbench.previewBuild(next,label)});
  statVisibility=initStatVisibility();
  contextControls();render();
  workspaceNavigation=initWorkspaces({artifacts:catalog.artifacts});
  if(window.ResizeObserver)new window.ResizeObserver(([entry])=>document.documentElement.style.setProperty('--live-stats-height',`${entry.target.getBoundingClientRect().height+12}px`)).observe($('.workspace-shell'));
  $('#stats').addEventListener('click',event=>{const button=event.target.closest('[data-explain-stat]');if(!button)return;explainedStat=button.dataset.explainStat;renderMultiplierExplanation();$('#multiplier-explanation-title').focus();$('#multiplier-explanation').scrollIntoView({block:'start'});});
  $('#close-multiplier-explanation').addEventListener('click',()=>{const stat=explainedStat;explainedStat=null;$('#multiplier-explanation').hidden=true;$(`[data-explain-stat="${stat}"]`)?.focus();});
  $('#stat-modifiers').addEventListener('change',event=>{const input=event.target.closest('[data-duration-for]');if(!input)return;const id=input.dataset.durationFor;try{state.context=setManualAbilityDuration(state.context,id==='__manual__'?null:id,input.value===''?null:Number(input.value));render();$(`[data-duration-for="${id}"]`)?.focus({preventScroll:true});}catch(error){input.setCustomValidity(error.message);input.reportValidity();}});
  $('#stat-modifiers').addEventListener('click',event=>{const button=event.target.closest('[data-reset-duration]');if(!button)return;state.context=setManualAbilityDuration(state.context,button.dataset.resetDuration==='__manual__'?null:button.dataset.resetDuration,null);render();});
  $('#undo-build').addEventListener('click',()=>restoreHistory('undo'));$('#redo-build').addEventListener('click',()=>restoreHistory('redo'));
  document.addEventListener('focusout',()=>buildHistory.endGroup());
  $('#expand-setup').addEventListener('click',()=>$('#edit-settings').click());
  $('#browse-artifacts').addEventListener('click',()=>{if(matchMedia('(max-width:800px)').matches)$('.summary').dataset.setupCollapsed='true';$('.library').scrollIntoView({block:'start'});$('#search').focus({preventScroll:true});});
  $('#edit-settings').addEventListener('click',()=>{$('.summary').dataset.setupCollapsed='false';$('#tower-settings').open=true;$('#tower-settings').scrollIntoView({block:'start'});$('#tower').focus({preventScroll:true});});
  for(const id of ['effect-filter','impact-filter','rarity-filter'])$('#'+id).addEventListener('change',renderList);
  $('#clear-artifact-filters').addEventListener('click',clearArtifactFilters);
  $('#show-reference-artifacts').addEventListener('click',()=>{
    const query=$('#search').value;
    clearArtifactFilters();$('#search').value=query;
    const allButton=$('[data-view="all"]');allButton.click();allButton.focus();
  });
  $('#artifact-sort').addEventListener('change',renderList);$('#only-applicable').addEventListener('change',renderList);
  $('#search').addEventListener('input',renderList);$('#category-filter').addEventListener('change',renderList);
  const modeledButton=$('[data-view="modeled"]'), modeledHelp=$('.modeled-view-help'), modeledTooltip=$('#modeled-view-tooltip');
  const hideModeledHelp=()=>{modeledTooltip.hidden=true;};
  modeledHelp.addEventListener('pointerenter',()=>{modeledTooltip.hidden=false;});
  modeledHelp.addEventListener('pointerleave',()=>{if(document.activeElement!==modeledButton)hideModeledHelp();});
  modeledButton.addEventListener('focus',()=>{modeledTooltip.hidden=false;});
  modeledButton.addEventListener('click',()=>{modeledTooltip.hidden=false;});
  modeledButton.addEventListener('blur',hideModeledHelp);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideModeledHelp();});
  document.addEventListener('click',event=>{if(!modeledHelp.contains(event.target))hideModeledHelp();});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    view=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button);});renderList();
  }));
  $('#artifact-list').addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.select){const id=el.dataset.select;if(el.checked&&!canAddArtifact(state.selected,id)){el.checked=false;return;}if(el.checked)state.selected[id]=$(`#rarity-${id}`).value;else delete state.selected[id];}
    if(el.dataset.rarity){choices[el.dataset.rarity]=el.value;if(state.selected[el.dataset.rarity])state.selected[el.dataset.rarity]=el.value;}
    render();
    // Re-rendering cards must preserve the keyboard user's focus.
    if(el.dataset.select)$(`[data-select="${el.dataset.select}"]`)?.focus();
    if(el.dataset.rarity)$(`[data-rarity="${el.dataset.rarity}"]`)?.focus();
  });
  $('#artifact-list').addEventListener('click',event=>{
    const target=event.target;
    const hint=target.closest('[data-condition-hint]');
    if(hint){
      event.preventDefault();
      const flag=hint.dataset.conditionHint, control=$(`#condition-${flag}`);
      $('.summary').dataset.setupCollapsed='false';
      $('#advanced-settings').open=true;$('.conditions').open=true;
      control?.scrollIntoView({block:'center',behavior:'smooth'});control?.focus({preventScroll:true});
      return;
    }
    if(target.id==='reset-filters'){clearArtifactFilters();$('[data-view="modeled"]').click();$('#search').focus();return;}
    const checkbox=target.closest('[data-select]');
    if(checkbox?.getAttribute('aria-disabled')==='true'){event.preventDefault();return;}
    if(target.closest('input,select,button,a,label,details,summary')||!window.getSelection().isCollapsed)return;
    const card=target.closest('.artifact-card');
    if(card)card.querySelector('[data-select]').click();
  });
  $('#tower-category').addEventListener('change',e=>{state.context.category=e.target.value;state.context.tower=towers[e.target.value][0];if(e.target.value==='Hero')state.context.heroLevel=1;state.context=applyTowerPreset(state.context,towerCatalog);contextControls();render();});
  $('#tower').addEventListener('change',e=>{state.context.tower=e.target.value;state.context=applyTowerPreset(state.context,towerCatalog);contextControls();render();});
  for(const [id,prop,min,max] of [['tier','tier',0,5],['hero-level','heroLevel',1,20],['base-damage','baseDamage',0,1e9],['base-boss-damage','baseBossDamage',0,1e9],['base-rate','baseRate',0,1e6],['base-pierce','basePierce',0,1e9],['base-range','baseRange',0,1e9]]){
    $(`#${id}`).addEventListener('input',e=>{const n=Number(e.target.value);if(!e.target.value||!Number.isFinite(n)||n<min||n>max||(['tier','heroLevel'].includes(prop)&&!Number.isInteger(n))){e.target.setCustomValidity(`Enter a value between ${min} and ${max}.`);return;}e.target.setCustomValidity('');if(prop.startsWith('base')){state.context=setManualStat(state.context,prop,n);if(prop==='baseDamage')$('#base-boss-damage').value=state.context.baseBossDamage;}else {state.context[prop]=Math.round(n);if(prop==='heroLevel'&&state.context.category==='Hero'&&state.context.tower!=='Hero'){state.context=applyTowerPreset(state.context,towerCatalog,'000',state.context.componentId);contextControls();}}render({historyGroup:'number:'+id});});
  }
  ['top','middle','bottom'].forEach(name=>$(`#path-${name}`).addEventListener('change',()=>{
    const path=['top','middle','bottom'].map(n=>$(`#path-${n}`).value).join('');
    if(!validUpgradePath(path))return;
    state.context=applyTowerPreset(state.context,towerCatalog,path);contextControls();render();$(`#path-${name}`).focus();
  }));
  $('#target-type').addEventListener('change',e=>{state.context.targetType=e.target.value;render();});
  for(const [id,prop]of[['target-camo','camo'],['target-fortified','fortified']])$('#'+id).addEventListener('change',e=>{state.context[prop]=e.target.checked;render();});
  $('#other-military-count').addEventListener('input',e=>{const n=Number(e.target.value);if(e.target.value===''||!Number.isInteger(n)||n<0||n>15){e.target.setCustomValidity('Enter a whole number from 0 to 15.');return;}e.target.setCustomValidity('');state.context.otherMilitaryCount=n;render({historyGroup:'number:other-military-count'});});
  $('#critical-mode').addEventListener('change',e=>{state.context.criticalMode=e.target.value;render();});
  $('#range-global').addEventListener('change',e=>{state.context={...state.context,statMode:'manual',rangeMode:e.target.checked?'global':'finite',baseRange:null};contextControls();render();});
  $('#ability').addEventListener('change',e=>{state.context=e.target.value?applyAbilityPreset(state.context,towerCatalog,e.target.value):{...state.context,abilityId:null,abilityMode:'manual'};contextControls();render();});
  $('#base-ability-cooldown').addEventListener('input',e=>{const value=e.target.value===''?null:Number(e.target.value);try{state.context=setManualAbilityCooldown(state.context,value);e.target.setCustomValidity('');render({historyGroup:'number:base-ability-cooldown'});}catch(error){e.target.setCustomValidity(error.message);}});
  $('#component').addEventListener('change',e=>{state.context=applyTowerPreset(state.context,towerCatalog,state.context.upgradePath ?? '000',e.target.value);contextControls();render();});
  $('#load-preset').addEventListener('click',()=>{state.context=applyTowerPreset(state.context,towerCatalog,state.context.upgradePath ?? '000',state.context.componentId);contextControls();render();});
  document.querySelectorAll('[data-condition]').forEach(el=>el.addEventListener('change',()=>{state.context[el.dataset.condition]=el.checked;render();}));
  $('#clear').addEventListener('click',()=>{state.selected={};history.replaceState(null,'',location.pathname+location.search);render();message('Artifacts cleared.');});
  $('#share').addEventListener('click',async()=>{
    const url=new URL(location.href);url.searchParams.delete('workspace');url.searchParams.delete('tool');url.hash='build='+encodeURIComponent(JSON.stringify(state));
    try{await navigator.clipboard.writeText(url.href);$('#share').textContent='Build link copied ✓';setTimeout(()=>$('#share').innerHTML='Copy build link <span>↗</span>',2000);}
    catch{history.replaceState(null,'',url);workspaceNavigation.refresh();message('Build link is in your address bar. Copy the URL to share it.');}
  });
  document.addEventListener('keydown',e=>{
    const editing=document.activeElement.isContentEditable||document.activeElement.closest('textarea,select,input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])');
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&!editing){
      const key=e.key.toLowerCase();const direction=key==='z'?(e.shiftKey?'redo':'undo'):key==='y'&&!e.shiftKey?'redo':null;
      if(direction&&buildHistory[direction==='undo'?'canUndo':'canRedo']){e.preventDefault();restoreHistory(direction);return;}
    }
    if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();document.querySelector('.workspace-nav [data-workspace=calculator]').click();$('#search').focus();}});
}
init().catch(error=>{message(`${error.message} Try refreshing the page.`);$('#result-count').textContent='Catalog unavailable';console.error(error);});
initOffline();
