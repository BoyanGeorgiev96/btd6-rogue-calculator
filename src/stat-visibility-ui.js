// Browser display preferences only; calculation and build state are unchanged.
const storageKey='rogue-lab-stat-visibility-v1';
const stats=[['dps','Target DPS'],['damage','Damage per hit'],['speed','Attack speed'],['boss','Boss damage per hit'],['pierce','Pierce'],['range','Range'],['ability','Ability cooldown']];

export function initStatVisibility() {
  const picker=document.querySelector('#stat-visibility');
  const bar=document.querySelector('#stats');
  const shell=document.querySelector('.workspace-shell');
  const content=document.querySelector('#stat-bar-content');
  const collapseButton=document.querySelector('#toggle-stat-bar');
  const pinButton=document.querySelector('#toggle-stat-pin');
  const layoutKey='rogue-lab-stat-layout-v1';
  let layout={};
  try {layout=JSON.parse(localStorage.getItem(layoutKey))||{};} catch {}
  let collapsed=layout?.collapsed===true, pinned=layout?.pinned!==false;
  function refreshLayout() {
    content.hidden=collapsed;
    collapseButton.textContent=collapsed?'Expand stats':'Collapse stats';
    collapseButton.setAttribute('aria-expanded',String(!collapsed));
    pinButton.textContent=pinned?'Unpin bar':'Pin bar';
    pinButton.setAttribute('aria-pressed',String(pinned));
    shell.dataset.pinned=String(pinned);
    shell.dataset.statsCollapsed=String(collapsed);
    document.documentElement.dataset.statsPinned=String(pinned);
  }
  function saveLayout() {
    try {localStorage.setItem(layoutKey,JSON.stringify({collapsed,pinned}));} catch {}
    refreshLayout();
  }
  collapseButton.addEventListener('click',()=>{collapsed=!collapsed;saveLayout();});
  pinButton.addEventListener('click',()=>{pinned=!pinned;saveLayout();});
  refreshLayout();
  let stored;
  try {stored=JSON.parse(localStorage.getItem(storageKey));} catch {}
  const hidden=new Set(Array.isArray(stored)?stored.filter(id=>stats.some(([key])=>key===id)):[]);
  const options=document.querySelector('#stat-visibility-options');
  for(const [id,name] of stats) {
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='checkbox';input.value=id;input.checked=!hidden.has(id);
    label.append(input,document.createTextNode(name));options.append(label);
  }
  function refresh() {
    for(const row of bar.querySelectorAll('[data-modifier]'))row.hidden=hidden.has(row.dataset.modifier);
    const count=stats.length-hidden.size;
    bar.style.gridTemplateColumns=count?(hidden.has('dps')?`repeat(${count},minmax(0,1fr))`:count===1?'minmax(0,1fr)':`minmax(170px,1.25fr) repeat(${count-1},minmax(0,1fr))`):'none';
    bar.hidden=count===0;
    document.querySelector('#stats-empty').hidden=count!==0;
    document.querySelector('#show-all-stats').disabled=hidden.size===0;
    document.querySelector('.stats-scroll-hint').hidden=count<2;
  }
  function save() {
    try {localStorage.setItem(storageKey,JSON.stringify([...hidden]));} catch {}
    refresh();
  }
  options.addEventListener('change',event=>{
    const input=event.target;
    if(input.checked)hidden.delete(input.value);else hidden.add(input.value);
    save();
  });
  document.querySelector('#show-all-stats').addEventListener('click',()=>{
    hidden.clear();for(const input of options.querySelectorAll('input'))input.checked=true;save();
  });
  document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false;});
  picker.addEventListener('keydown',event=>{
    if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();event.preventDefault();}
  });
  return {refresh};
}
