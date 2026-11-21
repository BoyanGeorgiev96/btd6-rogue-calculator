# Calculation scope

The Calculator tab exposes **80 modeled artifacts**. The full catalog also includes reference-only artifacts. Selecting a reference-only artifact shows an explicit warning and does not change totals. Some modeled artifacts only have part of their effect represented: for example One Shot's slowdown is included, while its critical damage requires the optional estimate mode.

The calculation code and catalogs are organized as follows:

- `src/artifact-rules.js`: named parameter bindings, effect definitions, conditions, and exclusions.
- `src/effect-engine.js`: reusable condition matching, conversions, and effect evaluation.
- `src/calculator.js`: selected-artifact evaluation, totals, breakdowns, and saved-state validation.
- `src/artifact-summary.js`: UI summaries derived from the evaluated effects.
- `data/artifacts.json`: the artifact source catalog, original description templates, and parameters.
- `data/towers.json`: versioned component stats for 26 towers and 1,664 legal crosspaths.
- `data/heroes.json`: level snapshots for 18 base heroes (360 hero/level entries).
- `src/hero-roster.js`: named heroes, export IDs, and Heroic Specialty affinities.
- `src/tower-stats.js`: preset selection, path validation, manual overrides, and saved-state restoration.
- `scripts/tower-import.mjs`: extraction of known attack components from raw tower exports.
- `data/catalog-contract.json`: reviewed templates and layouts used to flag incompatible updates.

Druid vine destruction and spawned ground-vine output are explicitly excluded from ordinary hit/DPS, pierce and artifact critical estimates. Their component IDs remain selectable for saved-plan compatibility, with zero modeled damage/rate, unknown modeled pierce and an exclusion warning; normal Druid attacks and ability timers remain available. See the [pinned-source and developer-note review](tower-stats.md#druid-vine-scope-review-2026-11-12).

See [artifact rules](artifact-rules.md) for the update-review procedure. The model:

- Multiplies independent artifact modifiers; only one rarity per artifact can be active.
- Separates regular damage, attack rate, pierce, range, and MOAB damage multipliers. Boss damage includes global and MOAB damage modifiers.
- Uses compatible verified cooldowns where available; other rates use rounded description percentages. Results remain estimates.
- Uses the chosen tower category, highest upgrade tier, or hero level for supported gates. Dreadbloon and One Monkey Army category conversions are evaluated before other effects. One Monkey Army gives heroes all categories at any level and doubles their boss damage; regular base-tower hit damage becomes zero, while powers are absent from its fixed penalty list. Camo detection and XP changes are not modeled.
- Applies first-20-seconds effects, Close targeting, auras, and status conditions only when the matching control is enabled. The aura checkbox assumes the tower is inside all selected artifact auras.
- Excludes frozen and stunned/tranced damage bonuses from boss estimates. Sticky Situation's glued-target damage bonus also applies to MOAB/Boss estimates when the glued condition is enabled, since glue can remain on Boss/BAD targets. The condition assumes glue is present; glue uptime is not simulated.
- Selects Regular Bloon, Ceramic, MOAB-class, or Boss targets with Camo and Fortified flags. Supported source tag modifiers apply in exported order. Pure Damage includes its Ceramic bonus, Ceramic Chunker adds flat Ceramic damage before artifact multipliers, and Dreadbloon applies its Fortified-or-Ceramic bonus once. Target flags select damage bonuses; they do not simulate detection or immunities.
- Excludes damage-over-time, additional projectile DPS, ability DPS, damage rounding, boss armor/resistances, augments, and other buffs. Pierce and range are tracked independently; hit-DPS alone does not capture Spike Factory output. Critical damage is optional and limited as described below.
- Loads raw tower-component stats for the selected legal crosspath. The highest tier is derived from that path for artifact gates. Each component is evaluated separately, with one projectile contact per attack cycle; its artifact-adjusted pierce and range are calculated separately, while emitted projectile count is shown for context. These do not multiply single-target DPS.
- Preserves manual damage, boss/MOAB damage, attack-rate, pierce, and range overrides. Global targeting range is preserved as unlimited, and older manual builds without base pierce/range show unknown base values rather than fabricated numbers. Legacy builds retain their manually entered stats. Hero abilities/spells, summons/beasts, DOT, and conditional tower/hero scaling are not fully modeled. Heroic Specialty grants the selected named hero its affinity category; custom manual heroes do not acquire a guessed affinity.
- Uses separate source versions: artifact descriptions are v57, while the pinned tower export is v56.0. Both versions are shown in the UI. These are source-snapshot statistics, not a guarantee of current-game accuracy.

These limits are displayed in the UI. The four class-conversion artifacts are modeled with their range and original-tower damage penalties; upgrade prices remain excluded. See the [catalog-wide calculation audit](artifact-calculation-audit.md) for modeled effects and the remaining reference-only reasons.

## Accuracy and inactive effects

Compatible artifact cooldowns for 30 artifact families are pinned in `src/verified-cooldowns.js` with their source filenames and expected description parameters. Matching rules use the reciprocal of the raw cooldown instead of rounded speed text. Changes to those parameters require mechanics review before refresh/build can apply them. Other artifact rates remain description-based estimates.

Description-based expected artifact critical damage is opt-in and shown separately from normal hit damage. Normal hits are the default. The expectation uses the current description’s stated probability and damage (not a guarantee about RNG timing). Innate tower crits remain excluded. Multiple applicable artifact crit mechanics produce an explicit warning and exclude critical damage until their interaction is verified. Inactive effects explain missing tower/category, tier/path, aura, and round-window requirements.

The target picker uses recognized Ceramic, Camo, Fortified, MOAB, and Boss tag damage modifiers from the pinned component export. Manual damage edits clear imported conditional modifiers, so a custom value is not silently combined with old source bonuses. Target settings are preserved in saved/shared builds.

## Reviewed artifact coverage additions

The [117-artifact audit](artifact-calculation-audit.md) covers four class conversions, Phayze’s Camo-target damage, Intelligence Agent’s aura attack penalty, Growing Steady’s slowdown, High Impact Glue’s base impact damage, Rubber Bullets’ replacement/capped hit damage, and Too Many Cooks’ speed calculation. Reference shows a specific reason for each of the 37 remaining reference-only artifacts. Partial effects carry exclusions; Growing Steady’s damage growth and High Impact Glue’s density bonus are not silently included, and capped Rubber Bullets hits do not receive an unverified crit expectation.

With Too Many Cooks selected, **Advanced settings & details → Battle conditions → Other Military aura sources** accepts 0–15 eligible other sources, excluding the selected tower. The default is zero other sources; party rows are not automatically counted. This battle-context value survives saves, links, history and plan transfers. Class conversions consume Heroic Specialty’s granted affinity; range penalties follow converted membership, while fixed base-tower damage penalties remain in effect. See the audit for source provenance and assumptions.
