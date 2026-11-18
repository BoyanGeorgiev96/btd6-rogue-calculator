# Critical-hit evidence and scope

Critical damage is off by default. The optional description-based estimate assumes the stated “1 in N” probability and total crit multiplier, with mean factor `1 + p * (M - 1)`. Normal hit damage remains separate. Runtime crit timing is unverified.

The pinned v56.0 export contains `GiveCritChanceBoostBehaviorModel` with lower/upper values and `overridesExistingCrit`. Home Brew Alchemy and Divine Intervention set the override flag; One Shot, Critical Success, and Critical Impact do not. These records alone do not establish simultaneous-trigger resolution, whether bounds describe per-shot probability or counter timing, or interaction with innate tower crits. The current v57 Home Brew description also differs from the older model’s multiplier.

Ninja Kiwi’s v49 notes explicitly state Divine Intervention should no longer be overridden by other crit artifacts:
https://www.reddit.com/r/btd6/comments/1le303i/bloons_td_6_v490_update_notes/

Raw source examples:

- https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/HomeBrewAlchemy1.json
- https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/DivineIntervention1.json

When multiple artifact crit mechanics apply, the calculator does not add their chances or multiply their mean factors. It warns and excludes their critical contribution, preserving other modeled effects. Innate tower crits remain excluded.

To establish a stronger model, an in-game test must track hit damage and crit timing for each source alone and together, both equip orders, a tower with innate crits, and category-converted towers. Record the game version and attack component. Confirm whether crits replace damage, multiply prior damage, or choose one of multiple modifiers. Until then, critical estimates remain optional and exclude overlapping mechanics.
