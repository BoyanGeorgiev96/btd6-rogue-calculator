import { verifiedCooldowns } from './verified-cooldowns.js';
import { heroRoster } from './hero-roster.js';
// Named bindings map upstream description placeholders to meaningful values.
// Definitions contain data only; the evaluator has no artifact-specific branches.
const increase = value => ({ operation: 'percentIncrease', value });
const decrease = value => ({ operation: 'percentDecrease', value });
const multiply = value => ({ operation: 'multiplier', value });
const effect = (stat, value, when = {}) => ({ stat, ...value, when });
const rule = (parameters, effects, extra = {}) => ({ parameters, effects, ...extra });
const category = category => ({ category });
const nonHero = { not: category('Hero') };
const highTier = { any: [
  { all: [category('Hero'), { minHeroLevel: 15 }] },
  { all: [nonHero, { minTier: 4 }] }
] };
const allCategories = ['Primary', 'Military', 'Magic', 'Support'];

export const artifactRules = {
  AbsoluteAbility: rule({ attackSlowdownPercent: 0 }, [effect('attackRate', decrease('attackSlowdownPercent'))]),
  BBGatlingGun: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'))]),
  TitForTat: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'))]),
  SlowerIsHarder: rule({ damageBonusPercent: 1 }, [effect('damage', increase('damageBonusPercent'))]),
  SlowAndSteady: rule({ damageBonusPercent: 0, earlyAttackSlowdownPercent: 1 }, [
    effect('damage', increase('damageBonusPercent')),
    effect('attackRate', decrease('earlyAttackSlowdownPercent'), { flag: 'early' })
  ]),
  StartingStong: rule({ earlyAttackBonusPercent: 0 }, [effect('attackRate', increase('earlyAttackBonusPercent'), { flag: 'early' })]),
  Discord: rule({ damageBonusPercent: 0 }, [effect('damage', increase('damageBonusPercent'), { category: 'Military', minTier: 2 })]),
  OverwhelmingSynergy: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), category('Magic'))]),
  SquadronTogether: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), category('Military'))]),
  ZigThenZag: rule({ attackBonusPercent: 1 }, [effect('attackRate', increase('attackBonusPercent'), category('Military'))]),
  PrimarySpecialist: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), category('Primary'))]),
  SupportSpecialist: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), category('Support'))]),
  PureDamage: rule({ moabDamageBonusPercent: 0 }, [
    effect('attackRate', multiply(.5), category('Magic')),
    effect('moabDamage', increase('moabDamageBonusPercent'), category('Magic'))
  ]),
  SpiritOfAdventure: rule({ attackBonusPercent: 1 }, [effect('attackRate', increase('attackBonusPercent'), category('Hero'))]),
  EssenceOfBloonarius: rule({}, [
    effect('damage', multiply(1.5), { all: [nonHero, { maxTier: 3 }] }),
    effect('attackRate', multiply(.84), { all: [nonHero, { minTier: 4 }] })
  ]),
  PrimalInstinct: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), { category: 'Primary', flag: 'close' })]),
  GeneralsDisposition: rule({ moabDamageBonusPercent: 0 }, [effect('moabDamage', increase('moabDamageBonusPercent'), { flag: 'aura' })]),
  JustLikeMagic: rule({ moabDamageBonusPercent: 0 }, [
    effect('attackRate', multiply(.5), { category: 'Magic', minTier: 5, maxTier: 5 }),
    effect('moabDamage', increase('moabDamageBonusPercent'), { flag: 'aura' })
  ]),
  ConfuddlingSpelling: rule({ statusDamageMultiplier: 0 }, [effect('regularDamage', multiply('statusDamageMultiplier'), { category: ['Hero', 'Magic'], flag: 'stunned' })]),
  CrystalCrash: rule({ statusDamageMultiplier: 0 }, [effect('regularDamage', multiply('statusDamageMultiplier'), { category: ['Hero', 'Support'], flag: 'frozen' })]),
  StickySituation: rule({ statusDamageMultiplier: 0 }, [effect('damage', multiply('statusDamageMultiplier'), { category: ['Hero', 'Primary'], flag: 'glued' })]),
  HomeBrewAlchemy: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), { tower: 'Alchemist' })], { excluded: ['Critical damage'] }),
  OneShot: rule({}, [effect('attackRate', multiply(.5), { tower: 'Sniper Monkey' })], { excluded: ['Critical damage'] }),
  SwellingSpikes: rule({}, [effect('attackRate', multiply(.5), { tower: 'Spike Factory' })]),
  Wackywibblywavey: rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), { tower: 'Heli Pilot' })]),
  SwiftestToBusiness: rule({ attackBonusPercent: 1 }, [effect('attackRate', increase('attackBonusPercent'), { tower: 'Ninja Monkey', minTier: 3 })]),
  DreamTeams: rule({}, [effect('attackRate', multiply(1.11), { tower: ['Monkey Sub', 'Ninja Monkey', 'Druid', 'Wizard Monkey', 'Beast Handler'] })]),
  FollowMe: rule({ attackSlowdownPercent: 1 }, [effect('attackRate', decrease('attackSlowdownPercent'), { tower: ['Dart Monkey', 'Boomerang Monkey', 'Bomb Shooter', 'Tack Shooter', 'Super Monkey', 'Druid', 'Mermonkey'] })]),
  HeroicSpecialty: rule({}, [], {
    categories: allCategories.map(affinity => ({ add: [affinity], when: { category: 'Hero', tower: heroRoster.filter(hero => hero.affinity === affinity).map(hero => hero.name) } })),
    summary: 'Named heroes gain their affinity category',
    excluded: ['Hero XP']
  }),
  MaliciousMauling: rule({ moabDamageMultiplier: 0 }, [
    effect('attackRate', multiply(.5), { tower: 'Bomb Shooter' }),
    effect('moabDamage', multiply('moabDamageMultiplier'), { tower: ['Bomb Shooter', 'Striker Jones'] })
  ]),
  EssenceOfDreadbloon: rule({}, [], {
    categories: [{ add: allCategories, when: highTier }],
    summary: 'High-tier towers count as every category',
    excluded: []
  }),
  OneMonkeyArmy: rule({}, [
    effect('bossDamage', multiply(2), category('Hero')),
    effect('damage', multiply(0), {originalCategory:allCategories})
  ], {
    categories: [{ add: allCategories, when: category('Hero') }],
    excluded: ['Camo detection', 'Hero XP']
  })
};

// Shared families require no additional evaluator or UI branches.
for (const [prefix, towerCategory] of Object.entries({
  EliteMilitary: 'Military', FirstClassSupport: 'Support', GrandMagic: 'Magic',
  GreaterPrimary: 'Primary', Divine: ['Hero','Powers']
})) {
  artifactRules[`${prefix}Precision`] = rule({ damageBonusPercent: 0 }, [effect('damage', increase('damageBonusPercent'), category(towerCategory))]);
  artifactRules[`${prefix}Quickening`] = rule({ attackBonusPercent: 0 }, [effect('attackRate', increase('attackBonusPercent'), category(towerCategory))]);
}

// Additional tracked stats share the same evaluator. Keep all effects of an
// already-supported artifact together rather than inventing extra selections.
function extend(id, parameters, effects) {
  Object.assign(artifactRules[id].parameters, parameters);
  artifactRules[id].effects.push(...effects);
}
extend('Discord', { pierceBonusPercent: 1 }, [effect('pierce', increase('pierceBonusPercent'), { category: 'Military', minTier: 2 })]);
extend('DreamTeams', { rangeBonusPercent: 0 }, [effect('range', increase('rangeBonusPercent'), { tower: ['Monkey Sub', 'Ninja Monkey', 'Druid', 'Wizard Monkey', 'Beast Handler'] })]);
extend('PureDamage', {}, [effect('pierce', multiply(2), category('Magic'))]);
extend('EssenceOfBloonarius', {}, [effect('pierce', multiply(2), { all: [nonHero, { maxTier: 3 }] })]);
extend('SwellingSpikes', { pierceBonusPercent: 0 }, [effect('pierce', increase('pierceBonusPercent'), { tower: 'Spike Factory' })]);
extend('GeneralsDisposition', {}, [effect('range', multiply(.8), category('Hero'))]);
// The raw specialist export targets the union of other categories (bitmask 14
// for Primary), so converted towers can receive both the bonus and penalty.
extend('PrimarySpecialist', { otherPiercePenaltyPercent: 1 }, [effect('pierce', decrease('otherPiercePenaltyPercent'), category(['Military', 'Magic', 'Support']))]);
extend('SupportSpecialist', { otherPiercePenaltyPercent: 1 }, [effect('pierce', decrease('otherPiercePenaltyPercent'), category(['Primary', 'Military', 'Magic']))]);

Object.assign(artifactRules, {
  AlchemicEngineering: rule({ piercePenaltyPercent: 0 }, [effect('pierce', decrease('piercePenaltyPercent'), { tower: 'Engineer Monkey', minTier: 3 })]),
  BiggestBeacon: rule({}, [
    effect('range', multiply(2.5), { tower: 'Monkey Village' }),
    effect('range', multiply(1.2), { all: [category('Support'), { not: { tower: 'Monkey Village' } }] })
  ]),
  CorneredBeasts: rule({ rangeBonusPercent: 0 }, [effect('range', increase('rangeBonusPercent'), { tower: 'Beast Handler', minTier: 3 })], { excluded: ['Bloon-count-dependent attack speed'] }),
  FataMorgana: rule({ bonusPercent: 0 }, [effect('range', increase('bonusPercent'), { tower: 'Mermonkey' }), effect('pierce', increase('bonusPercent'), { tower: 'Mermonkey' })]),
  FrostedTips: rule({ bonusPercent: 0 }, [effect('range', increase('bonusPercent'), { tower: 'Dart Monkey' }), effect('pierce', increase('bonusPercent'), { tower: 'Dart Monkey' })]),
  FullBroadside: rule({ pierceBonusPercent: 0 }, [effect('pierce', increase('pierceBonusPercent'), { tower: 'Monkey Buccaneer' })]),
  GetToTheChopper: rule({ pierceBonusPercent: 0 }, [effect('pierce', increase('pierceBonusPercent'), { tower: 'Heli Pilot' })]),
  HawksEye: rule({ rangeBonusPercent: 0 }, [effect('range', increase('rangeBonusPercent'))]),
  HeightenedPerception: rule({ rangeBonusPercent: 0 }, [effect('range', increase('rangeBonusPercent'), category('Primary'))]),
  HeroicEdge: rule({ pierceBonusPercent: 1 }, [effect('pierce', increase('pierceBonusPercent'),category(allCategories))]),
  MysticTwister: rule({ pierceBonusPercent: 0 }, [effect('pierce', increase('pierceBonusPercent'), category('Magic'))]),
  PerceptiveCrow: rule({ rangePenaltyPercent: 0 }, [effect('range', decrease('rangePenaltyPercent'), { tower: 'Monkey Buccaneer', minPath: [0, 0, 2] })]),
  PincushionFlyby: rule({ pierceBonusPercent: 0 }, [effect('pierce', increase('pierceBonusPercent'), { tower: 'Monkey Ace' })]),
  SlippedOnThePeel: rule({}, [effect('range', multiply(2), { tower: 'Benjamin' })]),
  TrickShotATacks: rule({ rangeBonusPercent: 0 }, [effect('range', increase('rangeBonusPercent'), { tower: 'Tack Shooter' })])
});
for (const [prefix, towerCategory] of Object.entries({ EliteMilitary: 'Military', FirstClassSupport: 'Support', GrandMagic: 'Magic', GreaterPrimary: 'Primary', Divine: ['Hero','Powers'] })) {
  artifactRules[`${prefix}Inspiration`] = rule({ pierceBonusPercent: 0, rangeBonusPercent: 1 }, [
    effect('pierce', increase('pierceBonusPercent'), category(towerCategory)),
    effect('range', increase('rangeBonusPercent'), category(towerCategory))
  ]);
}

// Expected critical damage is separate from normal hit damage. Multiple active
// artifact crit mechanics are flagged rather than assuming unverified stacking.
artifactRules.HomeBrewAlchemy.critical = { chance: .05, multiplier: 50, when: { tower: 'Alchemist' } };
artifactRules.HomeBrewAlchemy.excluded = [];
Object.assign(artifactRules.OneShot.parameters, { critOneIn: 0, critMultiplier: 1 });
artifactRules.OneShot.critical = { oneIn: 'critOneIn', multiplier: 'critMultiplier', when: { tower: 'Sniper Monkey' } };
artifactRules.OneShot.excluded = [];
Object.assign(artifactRules, {
  CriticalSuccess: rule({ attackSlowdownPercent: 0, critDamagePercent: 1 }, [effect('attackRate', decrease('attackSlowdownPercent'), category('Primary'))], { critical: { chance: .1, damagePercent: 'critDamagePercent', when: category('Primary') } }),
  CriticalImpact: rule({ critOneIn: 0, critDamagePercent: 1 }, [], { critical: { oneIn: 'critOneIn', damagePercent: 'critDamagePercent', when: { tower: 'Mortar Monkey', minTier: 3 } } }),
  DivineIntervention: rule({ critOneIn: 0, critMultiplier: 1 }, [], { critical: { oneIn: 'critOneIn', multiplier: 'critMultiplier', when: { tower: ['Super Monkey', 'Adora'] } } })
});

for(const [id,variants] of Object.entries(verifiedCooldowns)) {
  const rateEffects=artifactRules[id]?.effects.filter(effect=>effect.stat==='attackRate') ?? [];
  if(rateEffects.length===1)rateEffects[0].verified=variants;
}

extend('PureDamage', {}, [effect('targetDamage', increase('moabDamageBonusPercent'), {category:'Magic',targetTag:'Ceramic'})]);
extend('EssenceOfDreadbloon', {}, [effect('targetDamage', multiply(1.5), {all:[highTier,{targetTag:['Fortified','Ceramic']}]})]);
artifactRules.CeramicChunker=rule({ceramicBonus:0},[effect('flatDamage',{operation:'flat',value:'ceramicBonus'},{category:'Primary',targetTag:'Ceramic'})]);

// Ability cooldown effects use recharge-rate estimates from descriptions.
// A +25% recharge rate means a timer / 1.25, not a 25% timer reduction.
extend('AbsoluteAbility',{abilityBonusPercent:1},[effect('abilityRate',increase('abilityBonusPercent'))]);
for(const [prefix,towerCategory]of Object.entries({EliteMilitary:'Military',FirstClassSupport:'Support',GrandMagic:'Magic',GreaterPrimary:'Primary',Divine:['Hero','Powers']})){
  extend(`${prefix}Quickening`,{},[effect('abilityRate',increase('attackBonusPercent'),category(towerCategory))]);
}
extend('DreamTeams',{},[effect('abilityRate',multiply(1.11),{tower:['Monkey Sub','Ninja Monkey','Druid','Wizard Monkey','Beast Handler']})]);
extend('FataMorgana',{},[effect('abilityRate',increase('bonusPercent'),{tower:'Mermonkey'})]);
extend('FullBroadside',{},[effect('abilityRate',increase('pierceBonusPercent'),{tower:'Monkey Buccaneer'})]);
extend('GetToTheChopper',{},[effect('abilityRate',increase('pierceBonusPercent'),{tower:'Heli Pilot'})]);
extend('HomeBrewAlchemy',{},[effect('abilityRate',increase('attackBonusPercent'),{tower:'Alchemist'})]);
extend('SwiftestToBusiness',{},[effect('abilityRate',increase('attackBonusPercent'),{tower:'Ninja Monkey',minTier:3})]);
extend('PureDamage',{},[effect('abilityRate',multiply(.5),category('Magic'))]);
for(const [id,own,others]of [['PrimarySpecialist','Primary',['Military','Magic','Support']],['SupportSpecialist','Support',['Primary','Military','Magic']]]){
  extend(id,{},[effect('abilityRate',increase('attackBonusPercent'),category(own)),effect('abilityRate',decrease('otherPiercePenaltyPercent'),category(others))]);
}
artifactRules.InnateAbility=rule({abilitySlowdownPercent:0},[effect('abilityRate',decrease('abilitySlowdownPercent'))],{excluded:['Automatic activation']});
artifactRules.AbilityStacking=rule({extraCharges:0,abilitySlowdownPercent:1},[effect('abilityRate',decrease('abilitySlowdownPercent'),{not:{tower:'Psi'}})],{excluded:['Extra ability charges and charge-loop behavior']});
artifactRules.ImprovedSpelling=rule({attackSlowdownPercent:0,abilityBonusPercent:1},[effect('attackRate',decrease('attackSlowdownPercent'),{category:'Magic',minPath:[0,4,0]}),effect('abilityRate',increase('abilityBonusPercent'),{category:'Magic',minPath:[0,4,0]})],{excluded:['Upgrade discounts']});
artifactRules.MaliciousMauling.excluded=['Ability cooldown: ambiguous halved wording and incompatible pinned export; excluded pending mechanics review'];

// Reviewed v57 descriptions + pinned v56 behavior selection. Damage penalties
// use fixed base-tower identities; category grants/range use category membership.
for(const [id,own] of [['Unification','Primary'],['Conscription','Military'],['MonkeyAcademy','Magic'],['MasterOfAllTrades','Support']]){
  artifactRules[id]=rule({rangePenaltyPercent:0,otherDamagePenaltyPercent:1},[
    effect('range',decrease('rangePenaltyPercent'),category(own)),
    effect('damage',decrease('otherDamagePenaltyPercent'),{originalCategory:allCategories.filter(c=>c!==own)})
  ],{categories:[{add:allCategories,when:category(own),chain:true}],excluded:['Upgrade price penalties']});
}
artifactRules.EssenceOfPhayze=rule({},[effect('targetDamage',multiply(3),{all:[highTier,{targetTag:'Camo'}]})],{excluded:['Camo detection (hit eligibility remains unknown)']});
artifactRules.IntelligenceAgent=rule({attackSlowdownPercent:0},[effect('attackRate',decrease('attackSlowdownPercent'),{flag:'aura'})],{excluded:['Damage-type immunity coverage; assumes an eligible hero aura provider']});
artifactRules.GrowingSteady=rule({attackSlowdownPercent:0},[effect('attackRate',decrease('attackSlowdownPercent'),{tower:'Druid'})],{
  excluded:['Round-dependent damage growth: pinned roundCap and campaign/encounter counter semantics unresolved'],
  caveat:{when:{tower:'Druid'},text:'Growing Steady: only the attack slowdown is modeled; round-dependent damage growth is excluded.'}
});
artifactRules.HighImpactGlue=rule({impactDamage:0},[effect('flatDamage',{operation:'flat',value:'impactDamage'},{tower:'Glue Gunner'})],{
  excluded:['Projectile speed','Bloon-density/RBE-dependent extra impact damage'],
  caveat:{when:{tower:'Glue Gunner'},text:'High Impact Glue: base impact damage only; density-dependent extra damage is excluded.'}
});
artifactRules.RubberBullets=rule({},[effect('damageSet',{operation:'multiplier',value:1},{tower:'Sniper Monkey',minTier:4}),effect('damageCap',multiply(1),{tower:'Sniper Monkey',minTier:4})],{excluded:['MOAB immobilization and damage-type changes','Critical interactions with the replacement damage cap'],caveat:{when:{tower:'Sniper Monkey',minTier:4},text:'Rubber Bullets: replacement base damage and maximum ordinary damage are 1; critical interactions are excluded.'}});
artifactRules.TooManyCooks=rule({attackBonusPercent:0},[
  effect('attackRate',increase('attackBonusPercent'),category('Military')),
  {...effect('attackRate',{operation:'cooldownMultiplier',value:1.05},category('Military')),stackCount:'otherMilitaryCount'}
],{excluded:['Provider availability and subtower/category exceptions; other Military aura sources are entered manually'],countNote:{when:category('Military'),key:'otherMilitaryCount',label:'Too Many Cooks: other Military aura sources assumed (excluding this tower; maximum 15)'}});
for(const id of ['IntelligenceAgent','GrowingSteady','TooManyCooks'])artifactRules[id].effects[0].verified=verifiedCooldowns[id];

artifactRules.PowerNexus=rule({attackBonusPercent:0,damageBonusPercent:1},[
  effect('attackRate',increase('attackBonusPercent'),category('Powers')),
  effect('damage',increase('damageBonusPercent'),category('Powers'))
],{categories:[{add:['Support'],when:category('Powers')}],excluded:[]});
artifactRules.PowerNexus.effects[0].verified=verifiedCooldowns.PowerNexus;
