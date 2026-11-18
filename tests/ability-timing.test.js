import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {abilityTiming} from '../src/ability-timing.js';
import {extractAbilityDuration} from '../scripts/ability-duration-import.mjs';
import {getAbilityTimers,applyTowerPreset,validateHeroCatalog} from '../src/tower-stats.js';
import {defaults} from '../src/calculator.js';
const heroes=JSON.parse(readFileSync(new URL('../data/heroes.json',import.meta.url)));
const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
const catalog={...towers,heroes:heroes.heroes};
const behavior=(type,fields={})=>({$type:`Abilities.${type}, Assembly`,...fields});
test('nominal timing handles downtime, exact coverage, overlap, and unknown timers',()=>{
 const duration={seconds:12,gapEligible:true};
 assert.deepEqual(abilityTiming(duration,45),{durationSeconds:12,gapSeconds:33,uptime:12/45});
 for(const cooldown of [12,8])assert.deepEqual(abilityTiming(duration,cooldown),{durationSeconds:12,gapSeconds:0,uptime:1});
 for(const cooldown of [null,0,-1,Infinity])assert.equal(abilityTiming(duration,cooldown).gapSeconds,null);
 assert.equal(abilityTiming(null,45).gapSeconds,null);
 assert.equal(abilityTiming({...duration,gapEligible:false},45).gapSeconds,null);
});
test('duration extraction ignores visual lifespans, conflicting phases and unreviewed attack windows',()=>{
 const visual=behavior('CreateEffectOnAbilityModel',{lifespan:99,effectModel:{lifespan:999}});
 const turbo=behavior('TurboModel',{lifespan:12});
 assert.equal(extractAbilityDuration({behaviors:[visual]}),null);
 assert.equal(extractAbilityDuration({behaviors:[turbo,behavior('CallToArmsModel',{lifespan:15})]}),null);
 assert.equal(extractAbilityDuration({behaviors:[behavior('ActivateAttackModel',{isOneShot:false,lifespan:.05})]},{baseId:'GlueGunner'}),null);
 assert.equal(extractAbilityDuration({behaviors:[turbo,visual]}).seconds,12);
 for(const restriction of [{additionalCharges:1},{livesCost:1},{maxActivationsPerRound:1},{maxActivationsPerGame:1},{sharedCooldown:true}])assert.equal(extractAbilityDuration({behaviors:[turbo],...restriction}).gapEligible,false);
 assert.equal(extractAbilityDuration({behaviors:[behavior('BloodSacrificeModel',{buffDuration:60})]}).gapEligible,false);
});
test('pinned hero durations follow levels, and artifact factors/manual cooldowns change gaps rather than durations',()=>{
 const context=level=>applyTowerPreset({...defaults,category:'Hero',tower:'Quincy',heroLevel:level},catalog);
 const first=getAbilityTimers(context(3),catalog,1);assert.equal(first[0].durationSeconds,8);
 const full=getAbilityTimers(context(20),catalog,.8);
 assert.equal(full[0].durationSeconds,12);assert.equal(full[0].gapSeconds,24);
 assert.equal(full[1].durationSeconds,3);assert.equal(full[1].gapSeconds,41);
 const manual=getAbilityTimers({...context(20),abilityMode:'manual',baseAbilityCooldown:10},catalog,1);
 assert.equal(manual[0].gapSeconds,0);assert.equal(manual[0].uptime,1);assert.equal(manual[1].gapSeconds,52);
 const standalone=getAbilityTimers({...context(20),abilityMode:'manual',abilityId:null,baseAbilityCooldown:10},catalog,1);
 assert.equal(standalone.at(-1).durationSeconds,null);assert.equal(standalone.at(-1).gapSeconds,null);
});
test('source duration metadata validates and does not fabricate durations for unknown abilities',()=>{
 validateHeroCatalog(heroes);
 const copy=structuredClone(heroes);copy.heroes[0].levels['20'].abilities[0].duration.seconds=-1;
 assert.throws(()=>validateHeroCatalog(copy),/invalid ability duration/);
 const engineer=applyTowerPreset({...defaults,category:'Support',tower:'Engineer Monkey'},catalog,'040');
 assert.equal(getAbilityTimers(engineer,catalog,1)[0].durationSeconds,null);
});
