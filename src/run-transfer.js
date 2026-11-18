const header='Rogue Lab run v1';
const normalize=value=>value.trim().replace(/\s+/g,' ').toLowerCase();
export function exportRun(selected,artifacts){
 return [header,...artifacts.filter(a=>a.variants.some(v=>v.rarity===selected[a.id])).map(a=>`${a.name} | ${selected[a.id]}`)].join('\n');
}
export function parseRun(text,artifacts){
 if(typeof text!=='string'||text.length>50_000)throw new Error('Run text is too large (maximum 50,000 characters).');
 const names=new Map();for(const a of artifacts){names.set(normalize(a.id),a);names.set(normalize(a.name),a);}
 const selected={},errors=[];
 for(const [index,line]of text.split(/\r?\n/).entries()){
  const clean=line.trim();if(!clean||clean.startsWith('#')||clean===header)continue;
  const parts=clean.split('|');if(parts.length!==2){errors.push(`Line ${index+1}: use Artifact name | Rarity.`);continue;}
  const artifact=names.get(normalize(parts[0]));if(!artifact){errors.push(`Line ${index+1}: unknown artifact “${parts[0].trim().slice(0,80)}”.`);continue;}
  const variant=artifact.variants.find(v=>normalize(v.rarity)===normalize(parts[1]));
  if(!variant){errors.push(`Line ${index+1}: ${artifact.name} has no ${parts[1].trim().slice(0,40)} rarity.`);continue;}
  if(Object.hasOwn(selected,artifact.id)){errors.push(`Line ${index+1}: duplicate ${artifact.name}.`);continue;}
  selected[artifact.id]=variant.rarity;
 }
 if(errors.length)throw new Error(errors.slice(0,8).join('\n')+(errors.length>8?'\nMore errors omitted.':''));
 if(!Object.keys(selected).length)throw new Error('Add at least one artifact. To clear a run, use Clear build.');
 return selected;
}
