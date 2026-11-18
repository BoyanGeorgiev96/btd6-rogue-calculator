// Reviewed against the bundled v57 descriptions. These are reference notes,
// never new effects or a claim about runtime semantics. Existing rule exclusions
// (crit ambiguity, category XP, charge loops, etc.) are supplied by the rules.
export const artifactExclusions = {
  AlchemicEngineering:['Bloon-to-Gold conversion'],
  BBGatlingGun:['Shot spread / accuracy'],
  Discord:['Projectile coordination / geometry'],
  DreamTeams:['Placement cooldown rounds'],
  FataMorgana:['Projectile lifespan and border reflection'],
  FollowMe:['Cursor targeting, turn rate and continuous firing behavior'],
  FrostedTips:['Permafrost / Bloon slowing'],
  FullBroadside:['Extra ability charges'],
  GeneralsDisposition:['Camo detection'],
  GetToTheChopper:['Extra ability charges'],
  HawksEye:['Projectile lifespan and shot spread'],
  HeightenedPerception:['Projectile speed'],
  HeroicEdge:['Additional homing sword projectiles'],
  JustLikeMagic:['Additional Arcane Bolt projectiles'],
  MaliciousMauling:['Projectile speed'],
  MysticTwister:['Projectile lifespan and orbit geometry'],
  OverwhelmingSynergy:['Other Monkey upgrade prices'],
  PerceptiveCrow:['Camo detection aura'],
  PincushionFlyby:['Pinning / Bloon slowing'],
  SlippedOnThePeel:['Bloon slowing aura'],
  SlowerIsHarder:['Projectile speed'],
  SpiritOfAdventure:['Hero XP'],
  SquadronTogether:['Other Monkey upgrade prices'],
  SwiftestToBusiness:['Projectile speed and placement cooldown rounds'],
  TitForTat:['Bloon movement speed'],
  TrickShotATacks:['Projectile reflection and lifespan'],
  Wackywibblywavey:['Projectile flight pattern'],
  ZigThenZag:['Projectile speed and zigzag flight pattern']
};
for(const prefix of ['Divine','EliteMilitary','FirstClassSupport','GrandMagic','GreaterPrimary']) {
  artifactExclusions[`${prefix}Precision`]=['Shot spread'];
  artifactExclusions[`${prefix}Quickening`]=['Projectile speed'];
}
for(const id of ['AlchemicEngineering','BiggestBeacon','CorneredBeasts','CriticalImpact','DivineIntervention','FataMorgana','FrostedTips','FullBroadside','GetToTheChopper','HomeBrewAlchemy','MaliciousMauling','OneShot','PerceptiveCrow','PincushionFlyby','SlippedOnThePeel','SwellingSpikes','SwiftestToBusiness','TrickShotATacks','Wackywibblywavey','GrowingSteady','HighImpactGlue','RubberBullets']) {
  (artifactExclusions[id]??=[]).push('Granted party tower');
}

// Reviewed catalog-wide: these artifacts have no supported effect on the
// selected component's modeled stats. Keep the reason visible in Reference.
export const referenceArtifactReasons = {
  AbundantChoices:'Reward choices; offer availability is not simulated.',
  AddedPreservatives:'Projectile lifespan and border bounces require travel/geometry simulation.',
  BargainingChip:'Reroll costs and merchant resale value are economy effects.',
  BattlefieldCommission:'Hero XP progression is not simulated.',
  BlitzingApeBarrageEmitter:'Grants consumable Super Monkey Beacons; select a Beacon power preset separately. Quantities and acquisition are not simulated.',
  BouncingProjectiles:'Projectile travel distance and bounces do not change targeting range.',
  CarryABigStick:'Grants Cave Monkeys; select a Cave Monkey power preset separately. Quantities and acquisition are not simulated.',
  CatsMeow:'Lives, regeneration, Mana Shield and a party grant; no ordinary stat factor.',
  CharismaticLeader:'Rest-tile recruitment choices are outside combat calculations.',
  ColdSteel:'Freeze chance does not establish a frozen target or status uptime.',
  CorrosiveTorpEDarts:'Added glue/acid DOT and party grant; no reviewed ordinary hit modifier.',
  DazingFrostburn:'Stun and burn DOT are outside ordinary hit DPS.',
  Duckageddon:'Additional duck attack; proc frequency, geometry and contacts are not modeled.',
  EnchantedRebuttal:'Knockback changes exposure/coverage, not nominal contact DPS.',
  EsotericElementalist:'Freeze, blowback and burn DOT; status uptime is not simulated.',
  EssenceOfBlastapopoulos:'Target-applied +4 vulnerability needs explicit debuff state and reviewed damage/crit ordering; burn DOT is excluded. Selection alone does not establish a debuffed target.',
  EssenceOfDiamondback:'Re-hit timing and projectile speed require collision/travel simulation.',
  EssenceOfLych:'Zombie summons, revival and charges are outside ordinary component stats.',
  EssenceOfVortex:'MOAB knockback and Bloon blowback are outside nominal contact DPS.',
  ExplosiveEconomics:'On-sale explosion and placement cooldown rounds; neither is repeatable attack/ability DPS.',
  ExtraChange:'Cash and income are outside modeled combat stats.',
  FishNova:'Additional fish projectiles; proc frequency and contacts are not modeled.',
  FlamingHotPunchARang:'Knockback, probabilistic burn DOT and party grant.',
  Gluesplosion:'On-pop glue splatter is an added projectile, not base projectile pierce.',
  HomingProjectiles:'Homing changes projectile contacts; it is not an attack-rate or damage multiplier.',
  InsiderTrading:'Merchant purchase discounts are outside combat stats.',
  MightyMulligan:'Finite reward rerolls are outside combat stats.',
  NoMorePlease:'Insta-choice bans and consumable charges are outside combat stats.',
  PopsFired:'On-pop explosions require proc, contact and chain-reaction simulation.',
  Portability:'Grants placement powers; no ordinary stat factor.',
  QuantumLeap:'Projectile teleport/travel behavior does not establish hit frequency or targeting range.',
  SplodyDarts:'On-expiry explosions are additional attacks, not a multiplier on the base hit.',
  SummerFun:'Additional knockback monkeys and party grant are outside the selected component.',
  BattleCat:'Grants Battle Cat powers; select a Battle Cat power preset separately. Quantities and acquisition are not simulated.',
  TheUnspokenHeroes:'Additional tack rings have unmodeled proc frequency and contact geometry.',
  WhatInTarnation:'Additional shots and status procs; no reviewed multiplier on the selected base component.',
  WindowShopping:'Merchant tokens and campaign hearts are outside combat stats.'
};
