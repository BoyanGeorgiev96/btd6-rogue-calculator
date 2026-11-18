import {calculate} from './calculator.js';
import {applyTowerPreset,getPresetVariant,validUpgradePath} from './tower-stats.js';
export function compareTowerPresets(artifacts,selected,context,catalog,specs){
 if(!Array.isArray(specs)||specs.length>8)throw new Error('Compare up to eight presets at once.');
 return specs.map(spec=>{
  const actor=catalog.towers.find(t=>t.name===spec.tower)??catalog.heroes?.find(h=>h.name===spec.tower)??catalog.powers?.find(p=>p.name===spec.tower);
  if(!actor)throw new Error('Unknown tower or hero preset.');
  const hero=Boolean(catalog.heroes?.some(h=>h.name===spec.tower));
  if(hero?(!Number.isInteger(spec.heroLevel)||spec.heroLevel<1||spec.heroLevel>20):!validUpgradePath(spec.path))throw new Error('Choose a legal upgrade path or hero level.');
  const identity={...context,abilityId:spec.abilityId??null,durationOverrides:{},tower:actor.name,category:hero?'Hero':actor.category,heroLevel:hero?spec.heroLevel:context.heroLevel,upgradePath:hero?null:spec.path};
  const variant=getPresetVariant(catalog,identity);
  if(!variant)throw new Error('Choose an available preset path or level.');
  if(spec.componentId&&!variant.components.some(c=>c.id===spec.componentId))throw new Error('That attack component is unavailable.');
  if(spec.abilityId&&!variant.abilities.some(a=>a.id===spec.abilityId))throw new Error('That ability is unavailable.');
  const preset=applyTowerPreset(identity,catalog,spec.path??'000',spec.componentId??null);
  const component=variant.components.find(c=>c.id===preset.componentId);
  const base=calculate(artifacts,{},preset),result=calculate(artifacts,selected,preset);
  return {spec:{...spec,componentId:preset.componentId,abilityId:preset.abilityId},context:preset,abilityName:variant.abilities.find(a=>a.id===preset.abilityId)?.name??'No ability',componentName:component?.name??'No direct attack',components:variant.components,abilities:variant.abilities,notes:[...variant.notes,...(component?.notes??[]),...(variant.abilities.find(a=>a.id===preset.abilityId)?.notes??[])],base,result,gain:result.targetDpsValue-base.targetDpsValue,relative:base.targetDpsValue>0?result.targetDpsValue/base.targetDpsValue-1:null};
 });
}
