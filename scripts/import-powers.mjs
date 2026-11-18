import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { powerRoster } from '../src/power-roster.js';
import { validatePowerCatalog } from '../src/tower-stats.js';
import { importPowerModel } from './power-import.mjs';
const source=JSON.parse(await readFile(new URL('../data/tower-source.json',import.meta.url)));
const review=JSON.parse(await readFile(new URL('../data/power-source-models.json',import.meta.url)));
if (JSON.stringify(source)!==JSON.stringify(review.source)) throw new Error('Power review does not match source manifest');
const cacheIndex=process.argv.indexOf('--cache-dir');
if (cacheIndex>=0 && (!process.argv[cacheIndex+1] || process.argv[cacheIndex+1].startsWith('--'))) throw new Error('--cache-dir requires a directory');
const cache=cacheIndex<0?null:resolve(process.argv[cacheIndex+1]);
if(cache)await mkdir(cache,{recursive:true});
const catalog={schemaVersion:4,source,checked:review.reviewed,powers:[]};
for(const power of powerRoster){
  const actor={id:power.id,name:power.name,category:'Powers',variants:{}};
  for(const path of power.paths){
    const sourcePath=power.id==='SuperMonkeyBeacon'?`Towers/${power.id}/${power.id}${path==='000'?'':'-'+path}.json`:`Powers/${power.id}.json`;
    const expected=review.models.find(m=>m.path===sourcePath)?.blob;
    if(!expected)throw new Error('Unreviewed power model: '+sourcePath);
    const file=cache&&resolve(cache,sourcePath.replaceAll('/','__'));
    let content;
    try{if(file)content=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!content){const response=await fetch(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${sourcePath}`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(sourcePath+': '+response.status);content=Buffer.from(await response.arrayBuffer());}
    const hash=createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    if(hash!==expected)throw new Error('Power model differs from reviewed blob: '+sourcePath);
    if(file)await writeFile(file,content);
    const {path:imported,...variant}=importPowerModel(JSON.parse(content),power);
    if(imported!==path)throw new Error('Unexpected power path');
    actor.variants[path]={sourcePath,...variant};
  }
  catalog.powers.push(actor);
}
validatePowerCatalog(catalog);
const target=process.argv.includes('--write')?'powers.json':'powers.candidate.json';
await writeFile(new URL('../data/'+target,import.meta.url),JSON.stringify(catalog,null,2)+'\n');
console.log(`${catalog.powers.length} powers written to data/${target}; review before promotion.`);
