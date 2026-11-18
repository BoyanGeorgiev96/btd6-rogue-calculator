# Artifact calculation audit — 2026-11-12

Reviewed all **117 artifacts and every bundled rarity** against the v57 descriptions, current rule definitions and exclusions. The machine-readable [per-artifact record](artifact-calculation-audit.json) records each description hash, modeled stats, exclusions and the reason for every reference-only artifact. This review covers source evidence and calculation scope; no in-game trials were run.

There are **80 modeled artifacts and 37 reference-only artifacts**. Reference shows a specific reason for every remaining reference-only artifact. Supporting source for the rules below comprises 23 artifact files at the pinned v56 revision; downloaded/cached bytes matched the Git blob hashes in the existing source inventory and their rarity parameters matched the active v57 catalog.

## Modeled calculations

| Artifact | Included | Remaining limits |
| --- | --- | --- |
| Conscription | Military → all four classes; rarity-specific Military range reduction; damage penalty to original non-Military base tower identities | Upgrade prices excluded. The pinned penalty lists base tower IDs, not heroes; conversion does not erase those identities. |
| Unification | Primary equivalent, including Common’s 25% range reduction | Same identity/price limits |
| Monkey Academy | Magic equivalent | Same identity/price limits |
| Master of All Trades | Support equivalent | Same identity/price limits |
| Essence of Phayze | Triple damage against a Camo-flagged target, at tower tier 4+ / hero level 15+ | Detection remains unknown; a target flag is not proof the tower can hit. |
| Intelligence Agent | Aura-recipient attack penalty; pinned rate-support cooldowns 1.5 / 1.4 / 1.25 | Existing aura control assumes a valid hero provider and range; damage-type coverage remains excluded. |
| Growing Steady | Druid slowdown: pinned attack interval ×1.2 | Damage growth excluded: raw `DamageModifierForRoundModel` has `roundCap: 10`, while the description implies campaign accumulation. Counter/reset/cap semantics need separate evidence. Warning accompanies results; this is not a net-value ranking of the full artifact. Manual damage can represent a known observed value. |
| High Impact Glue | Base impact damage +2 / +3 / +6 on the selected Glue Gunner component | Additional RBE/density damage and projectile speed excluded. Explicit base-only warning. Added DamageModel is summed with existing modeled direct damage; DOT is not imported as ordinary hit damage. |
| Rubber Bullets | Tier-4+ Sniper replacement base damage 1 and maximum ordinary hit damage 1, before/after existing modeled factors respectively | Pinned replacement DamageModel has damage/maxDamage/CappedDamage 1 and tag modifiers do not apply over the cap. Artifact crit expectations are excluded for the capped case because their interaction is unresolved. Immobilization and damage-type changes remain excluded. Source target exclusions are preserved. |
| Too Many Cooks | Pinned Military base speed benefit, with ×1.05 attack interval per explicitly entered other Military aura source (0–15) | Raw RateSupport excludes the owning tower, is global/non-unique, filters Military/non-subtowers and caps at 15. User supplies the number of eligible other sources; no party count or provider availability is inferred. This is a source-based stacking estimate, not a runtime guarantee. |

All new rules use the shared engine, so previews, target/tower/upgrade/party comparisons, offers, rankings, run plans, explanations and uptime searches retain conversions and penalties. The Too Many Cooks count is independent of tower base stats, persists through state/history/JSON/links, and is shared as battle context in party comparisons. Older plan transfers without the count restore zero other providers.

## Category interactions

Original grants (Heroic Specialty, Dreadbloon and One Monkey Army) are resolved first. The four class converters then consume granted membership in simultaneous rounds until no categories are added. Thus Heroic Specialty can make Churchill Military, enabling Conscription below Dreadbloon’s level-15 gate. Category conversion does not change the tower’s original identity or make it a hero. Original class grants retain their previous gates.

Range effects follow final category membership. Consequently multiple Rare class converters can stack their range penalties on a converted tower. Damage penalties follow the pinned fixed tower-type lists: e.g. a base Sniper still receives Monkey Academy’s non-Magic damage penalty even if Conscription has granted it Magic membership. Heroes are absent from these fixed damage-penalty lists. These choices are supported by the pinned model fields, not an inferred exemption from English wording.

For Conscription specifically, a tier-4 Sniper with Essence of Dreadbloon retains ×1.00 damage from Conscription; a tier-4 Wizard with the same artifacts receives ×0.50. Both count as Military, so both receive Rare Conscription’s ×0.85 range factor and applicable Military bonuses. The damage boost selects `WizardMonkey` explicitly in `boostToInvokeModel.towerTypes`, with `inverseTowerTypes: false`, empty `towerSets`, and a `DamageBoostBehaviorModel.multiplier` of `0.5`; neither `SniperMonkey` nor any hero is listed. Gaining Military membership does not remove the Wizard’s base ID from that selection.

Heroes granted Military by Heroic Specialty can activate Conscription’s category grant and range penalty below level 15; heroes with another affinity do not activate those Military effects from Heroic Specialty alone. At level 15+, Dreadbloon grants every hero all four classes, enabling the class-based effects regardless of affinity. None acquire these fixed base-tower damage penalties. This exemption is specific to these four conversion artifacts: other penalties selected by category can still apply to converted heroes. Regression tests cover the Sniper/Wizard examples, every supported base tower across all converter rarities, and all named hero affinities. These interpretations are based on pinned source fields; no new in-game trials were run.

Useful source links (all at revision `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`):

- [Conscription Rare](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/Conscription2.json): category grant, fixed non-Military `towerTypes`, range selection.
- [Unification Common](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/Unification1.json), [Monkey Academy Rare](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/MonkeyAcademy2.json), [Master of All Trades Rare](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/MasterOfAllTrades2.json).
- [Phayze](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/EssenceOfPhayze1.json), [Intelligence Agent Common](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/IntelligenceAgent1.json).
- [Growing Steady Common](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/GrowingSteady1.json), [High Impact Glue Common](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/HighImpactGlue1.json), [Rubber Bullets Rare](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/RubberBullets1.json), [Too Many Cooks Common](https://github.com/Btd6ModHelper/btd6-game-data/blob/f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24/Artifacts/TooManyCooks1.json).

## Why other artifacts stay reference-only

The remaining 37 have no reviewed effect on the selected component’s supported stats. Their effects concern economy, progression, powers/summons, extra projectiles, DOT, statuses, movement, collisions or survival. Do not turn travel distance into targeting range, extra-projectile pierce into base pierce, a freeze chance into permanent Frozen status, or an explosion’s damage into a multiplier on every shot.

Blastapopoulos is a specific follow-up: its +4 target vulnerability is known, but selection alone does not mean the target is already debuffed, and the ordering relative to source/artifact/critical damage needs review before treating it as the same pre-multiplier flat bonus as Ceramic Chunker. It remains reference-only with that reason visible. Growing Steady’s counter semantics, Cornered Beasts’ density-speed mapping, and the existing Malicious Mauling cooldown ambiguity remain explicit partial exclusions. These unresolved effects remain excluded.

The [power preset review](powers.md) adds Power Nexus, extends the Divine families to Powers, and limits One Monkey Army’s zero-damage effect to its fixed regular-tower list. The reviewed power and artifact blob inventory is recorded separately in `data/power-source-models.json`; the original 23-file audit above retains its source record.
