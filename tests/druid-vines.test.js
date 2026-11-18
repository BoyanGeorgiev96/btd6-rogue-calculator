import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,defaults,sanitizeState} from '../src/calculator.js';
import {applyTowerPreset,restoreTowerContext,setManualStat,validateTowerCatalog} from '../src/tower-stats.js';
import {runPlanSnapshot,parseRunPlan} from '../src/run-plan-storage.js';
import {compareTargets} from '../src/target-matrix.js';
import {exportBuildReport} from '../src/build-report.js';
const read=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url)));
const catalog=read('data/towers.json'),artifacts=read('data/artifacts.json').artifacts;
const druid=catalog.towers.find(t=>t.id==='Druid');
const selected={EssenceOfDreadbloon:'Legendary',CriticalSuccess:'Rare',CeramicChunker:'Rare',PureDamage:'Rare',AbsoluteAbility:'Common'};
const context={...defaults,category:'Magic',tower:'Druid',criticalMode:'expected',targetType:'ceramic'};

test('all reviewed Druid vine components retain source identities but cannot generate ordinary damage or crit estimates',()=>{
  let excluded=0;
  for(const [path,variant] of Object.entries(druid.variants)){
    const thorn=applyTowerPreset(context,catalog,path,variant.components[0].id);
    assert.equal(thorn.baseDamageExcluded,false);assert.ok(calculate(artifacts,{},thorn).targetDpsValue>0);
    for(const component of variant.components.filter(c=>c.damageExcluded)){
      excluded++;
      assert.ok(Number(path[1])>=3);assert.match(component.name,/excluded/);
      const c=applyTowerPreset(context,catalog,path,component.id);
      assert.equal(c.baseDamage,0);assert.equal(c.baseRate,0);assert.equal(c.basePierce,null);
      for(const targetType of ['bloon','ceramic','moab','boss']){
        const r=calculate(artifacts,selected,{...c,targetType});
        for(const key of ['targetHit','expectedTargetHit','targetDpsValue','hit','bossHit','expectedHit','expectedBossHit','attacks'])assert.equal(r[key],0,`${path}/${component.id}/${targetType}/${key}`);
        assert.equal(r.criticalMultiplier,1);assert.equal(r.targetDpsMultiplier,null);assert.equal(r.projectilePierce,null);
        assert.match(r.warnings.join(' '),/excluded from ordinary hit damage/);
        assert.ok(r.breakdown.every(row=>row.critical===null));
        assert.ok(r.trace.some(step=>step.label==='Component excluded from ordinary hit damage'));
      }
    }
  }
  assert.equal(excluded,30);
});

test('old preset snapshots refresh safely; excluded component identity and independent ability timing survive plan transfer',()=>{
  const old={...context,statMode:'preset',upgradePath:'040',componentId:'attack-1/weapon-0',baseDamage:9999999,basePierce:9999999,baseRate:1/2.6,abilityMode:'preset',abilityId:'VineCrushAbility'};
  const restored=restoreTowerContext(sanitizeState({context:old},artifacts).context,catalog);
  assert.equal(restored.componentId,old.componentId);assert.equal(restored.baseDamageExcluded,true);assert.equal(restored.baseDamage,0);
  const result=calculate(artifacts,selected,restored);assert.equal(result.targetDpsValue,0);assert.equal(result.abilitySeconds,48);
  const setup={tower:'Druid',selected,stages:[{path:'030',componentId:old.componentId},{path:'040',componentId:old.componentId},{path:'050',componentId:'attack-1/weapon-0/child-0'}]};
  const saved=runPlanSnapshot(artifacts,catalog,context,setup,{},57);
  assert.deepEqual(parseRunPlan(JSON.stringify(saved),artifacts,catalog,57).snapshot,saved);
  const reloaded=restoreTowerContext(sanitizeState({context:restored},artifacts).context,catalog);
  assert.equal(reloaded.baseDamageExcluded,true);
  const manual=setManualStat(restored,'baseDamage',5);
  assert.equal(manual.baseDamageExcluded,false);assert.equal(manual.statMode,'manual');
  assert.deepEqual(restoreTowerContext(manual,catalog),manual);
  const invalid=structuredClone(catalog);invalid.towers.find(t=>t.id==='Druid').variants['030'].components[1].damageExcluded='true';
  assert.throws(()=>validateTowerCatalog(invalid),/invalid damage exclusion/);
});

test('excluded results remain zero with stale numbers and flat artifact bonuses; reports and matrices label the exclusion',()=>{
  const c={...applyTowerPreset(context,catalog,'040','attack-1/weapon-0'),baseDamage:9999999,baseBossDamage:9999999,baseRate:100};
  assert.equal(calculate(artifacts,selected,c).targetHit,0);assert.equal(calculate(artifacts,selected,c).targetDpsValue,0);
  const clean=applyTowerPreset(context,catalog,'040','attack-1/weapon-0');
  const rows=compareTargets(artifacts,{context:clean,selected});
  assert.ok(rows.every(row=>row.eligibility.startsWith('Excluded')&&row.result.targetDpsValue===0));
  const report=exportBuildReport({state:{context:clean,selected},artifacts,towerCatalog:catalog,artifactVersion:57});
  assert.ok(report.includes('Vine destruction \\(excluded\\)'));
  assert.match(report,/Hit eligibility: Excluded/);assert.doesNotMatch(report,/9999999|9,999,999/);
});
