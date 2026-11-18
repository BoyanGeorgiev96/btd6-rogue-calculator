# Ability cooldown estimates

Ability recharge is independent of attack rate and damage. Each artifact contributes an `abilityRate` factor; the calculator multiplies those factors and returns its reciprocal as `abilityCooldown`. With a known base timer, `abilitySeconds = baseAbilityCooldown / abilityRate`. A 25% speed increase is therefore 0.8× base time; a 25% speed decrease is 1⅓× base time. No ability DPS is added to attack DPS.

## Covered artifact families

- Absolute Ability; all five category Quickening artifacts.
- Dream Teams, Fata Morgana, Full Broadside, Get to the Chopper, Home Brew Alchemy, and Swiftest to Business.
- Pure Damage; Primary Specialist and Support Specialist, including other-category penalties on converted towers.
- Innate Ability and Ability Stacking (slowdown excludes Psi; extra charges remain excluded).
- Improved Spelling: converted Magic category plus an actual middle path of 4 or higher. Its ordinary attack penalty is modeled separately; discounts are excluded.

These are **description-based recharge estimates**, using the bundled v57 parameters and literals. Verified attack-rate exports do not establish ability-recharge behavior. The older artifact models contain differences (including zero-valued cooldown boost fields) whose runtime transformation is not established by the data alone. Malicious Mauling's “ability cooldown … halved” clause is excluded pending mechanics evidence; its attack and MOAB effects still apply. Ninja Kiwi’s [official v49 notes](https://www.reddit.com/r/btd6/comments/1le303i/bloons_td_6_v490_update_notes/) establish that its attack-rate penalty also increases ability cooldown. This supports the direction of the effect, but does not resolve the exact factor or provider/recipient scope against the incompatible pinned export. No timer factor is inferred from the patch wording.

## Base timers and limitations

Timer metadata comes from the pinned [BTD6 Mod Helper export](https://github.com/Btd6ModHelper/btd6-game-data/tree/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Towers). For example, Dart Monkey 0-4-0 has a 50s Super Monkey Fan Club base timer; Quincy level 20 has separate Rapid Shot (45s) and Storm of Arrows (55s) timers. The importer keeps positive fixed timers on enabled, visible root AbilityModels. Hidden/passive/disabled entries and zero or dynamically scaled timers are excluded. The source revision remains v56.0; descriptions are v57.

Activation caps and shared cooldowns are retained as notes. Extra charges, first-use delays, minimum timer floors, resource costs, automatic activation, reset effects, and runtime uptime are not simulated. Reviewed durations and nominal gaps are documented in [ability duration review](ability-durations.md); they do not guarantee runtime uptime. Abilities without a known timer stay unknown, not zero. Use a manual timer for a custom case.

`abilityMode` tracks source, manual, and no-ability states independently of ordinary attack `statMode`. Saving and sharing retain the selected ability ID and manual override. Reloading saved source timers refreshes the pinned value; removed IDs keep their previous seconds in manual mode. Loading a different tower/path/hero level reloads its source timer. Source comparison rows have their own ability selector and never inherit the main calculator’s manual timer.
