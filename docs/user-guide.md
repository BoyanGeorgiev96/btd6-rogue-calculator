# Using Rogue Lab

Rogue Lab compares artifact effects on a selected attack component. Multipliers are relative to the same setup without artifacts. Expand **Stats with artifacts applied** for absolute values and all available ability timings. Results do not simulate a complete tower, party, or encounter; see [calculation scope](calculation-scope.md).

## Workspaces and navigation

| Workspace | URL query | Tools |
| --- | --- | --- |
| Calculator | `?workspace=calculator` (default) | Setup, artifacts, explanations, previews, saves and reports |
| Run planner | `?workspace=planner` | Early/Mid/Late upgrades, starting loadout and later picks |
| Compare | `?workspace=compare` | Offers, targets, upgrades, presets, parties and synergies |
| Reference | `?workspace=reference` | Source versions, exclusions, effect coverage and mechanics notebook |

Compare links can add `&tool=offer-comparison`, `target-matrix`, `upgrade-comparison`, `tower-comparison`, `party-overview`, or `synergy-finder`. Unknown routes fall back to Calculator or artifact offers. Build links use `#build=` and open Calculator.

Switching workspaces or using Back/Forward keeps unfinished plans, comparison choices, filters, previews, pinned builds, and undo history. Reloading restores the autosaved calculator, saved collections, and last saved or loaded plan. Temporary choices and unsaved planner edits reset. Save or export a complete plan before closing the tab.

## Setup and stats

Choose a tower, hero, or power, its upgrades or level, and a target. **Advanced settings & details** contains attack/ability selection, manual base stats, battle conditions, critical estimates, and source notes. Target flags select supported damage bonuses; they do not grant detection or bypass immunities. Manual damage edits clear imported conditional damage modifiers.

The sticky bar describes the **calculator build** even while viewing planner checkpoints or comparisons. It shows artifact multipliers only, such as ×1.23. Changing base stats alone leaves unmodified factors at ×1; the setup still controls which artifacts apply. Target-DPS factors include modeled flat bonuses and optional crit estimates; a zero base DPS has no defined ratio and shows an em dash.

Click a multiplier to inspect its factors, penalties, category conversions, and inactive effects. Target-DPS explanations remove each artifact and recalculate the build, so those contextual contributions cannot be added or multiplied together. **Explain this calculation** shows the engine's ordered steps through target DPS.

**Stats**, **Collapse stats**, and **Unpin bar** control the bar's presentation. On phones and tablets, **Use setup & browse artifacts** collapses setup; **Edit setup** reopens it. Desktop keeps setup expanded. Display preferences are stored separately from builds and history.

## Browse and preview artifacts

**Modeled effects** shows the 80 artifacts with effects included in calculations. The other 37 are reference-only. Hover, focus, or tap **Modeled effects ⓘ** for the distinction between views. A visible search notice identifies matching hidden reference-only artifacts. **Show all artifacts** keeps your search, clears the other filters, and reveals those matches. Reference-only artifacts can be selected but do not change totals.

Click an artifact’s name, description, or row background to select or remove it. Rarity dropdowns, details, and preview controls act independently. The normal campaign limit is 50 selected artifacts, including reference-only artifacts. At the cap, remove an artifact before adding another; rarity changes remain available. Imported or shared builds above the cap stay inspectable with a hypothetical-build warning. Curse restrictions remain outside this validation. See [capacity evidence and scope](artifact-capacity.md).

Search and filter by category, effect, boost/penalty, available rarity, or **Only applicable**. Effect filters use modeled rules, including inactive conditions. Impact reflects the current setup and displayed rarity; an artifact can have both gains and penalties. Reference-only artifacts do not match specific modeled effects or **Only applicable**. Filters survive workspace navigation and reset on reload.

Sort by name or artifact multiplier gain for target DPS, pierce, range, or cooldown reduction. Selected artifacts are ranked by removing and restoring them; unselected artifacts by adding their displayed rarity. Rankings include conversions and penalties but omit price, placement, runtime uptime, and unsupported mechanics. Zero-base DPS and global-range ratios sort after measurable factors.

**Details & preview** shows the contribution and evidence for an artifact. **Preview addition/removal** or **Preview rarity** compares a candidate; **Apply preview** makes one undoable change. Editing the current build dismisses a pending preview. Contribution values depend on the rest of the build and should not be added together.

Evidence labels apply per effect: **Verified export cooldown** means a matching pinned attack cooldown, **Description estimate** means a modeled description value, and **Unverified mechanics** identifies unresolved critical timing/interactions. None establishes current-game accuracy for an entire artifact.

## Ability timing and uptime searches

The **Ability cooldown** factor is the remaining fraction of base cooldown time. Effective seconds are `base seconds / product(recharge-rate modifiers)`: 25% faster recharge turns 60s into 48s; 25% slower turns it into 80s. Attack-rate verification does not verify ability recharge.

Expanded stats list every imported fixed-cooldown ability at the selected level or crosspath. The ability selector chooses the single timer used in comparison summaries and reports; it does not hide other available timers. Manual cooldown overrides affect only that selected ability. A standalone manual timer is listed alongside imported abilities.

Reviewed durations support nominal gap `max(0, cooldown − duration)` and uptime `min(100%, duration / cooldown)`. These assume cooldown begins at activation and immediate reuse. **Potential continuous uptime** means zero nominal gap under those assumptions; cooldown floors, targets, round boundaries, charges, costs, and activation delays can prevent it in play. Unknown or restricted timing does not produce a continuous-uptime claim. Artifact recharge changes cooldown, not duration. See [cooldown scope](ability-cooldowns.md) and [duration review](ability-durations.md).

**Override duration** accepts positive seconds for a specific tower and ability, including standalone manual timers. Overrides survive autosave, links, saved-build JSON, and undo/redo, and remain labeled manual. Hero-level changes keep the override; clearing it restores the current source duration. Overrides preserve known activation restrictions and do not change attack DPS. Source preset/upgrade comparisons omit calculator overrides; saved-party rows keep their saved overrides. Run plans use their own source snapshots.

**Find ability uptime thresholds**, under Advanced settings, tests one or up to two artifact additions/rarity upgrades within the modeled recharge and conversion subset. Every candidate uses the full engine, including penalties and gates. Results state the tested count; zero-gap alternatives rank by fewest changes, then target-DPS factor. If none closes the gap, results show the best partial reductions. More than two changes, removals, downgrades, prices, availability, and unmodeled effects are outside the search. It makes no claim of global optimality or guaranteed runtime uptime. Preview a result before applying it; calculator edits clear stale results.

## Save, share, and compare builds

The current build autosaves locally. **Copy build link** creates a snapshot of calculator inputs; editing a shared build clears its old URL hash so reload uses the edited autosave.

**Saved builds** holds up to 50 named builds separately from autosave. Editing the calculator does not overwrite a named build: use **Update selected**. Deletion can be undone until another deletion or reload. Browser storage is not cross-device sync; export backups before clearing it.

**Pin current for comparison** keeps a temporary snapshot while you edit or load another build. Each side retains its tower, target, conditions, and critical setting. Comparisons lead with artifact multipliers; expand absolute stats and **All ability timings** for details. **Swap with pinned build** exchanges the two. Pinned builds clear on reload.

Saved builds and complete plans support notes up to 4,000 characters and up to 20 tags of 40 characters each. Tags are trimmed and deduplicated without case sensitivity. Notes/tags survive JSON transfer and saved-entry updates; build reports include them as text. They are separate from build links and current-build undo history.

**Export collection** downloads JSON and fills a copyable text box. Import adds copies without replacing existing builds, with a 2 MB limit and a 50-build collection cap. Invalid imports leave the collection intact; unknown artifact IDs and unavailable rarities are omitted. Loaded source presets refresh from bundled data; manual values stay as entered. Source-version labels identify older snapshots.

### Artifact-list transfer

Under **Saved builds → Import / export an artifact list**, use:

```text
Rogue Lab run v1
Ceramic Chunker | Rare
One Monkey Army | Legendary
```

Names and artifact IDs are case-insensitive. Blank lines and `#` comments are ignored. Unknown names, unavailable rarities, duplicates, or malformed lines block the entire import and identify the affected lines. Input is limited to 50 KB / 50,000 characters.

Preview before applying. Merge retains other selections and uses imported rarities on conflicts; replace uses only imported selections. Both keep tower and target settings, and both can be undone. Changing the text or mode invalidates the preview. Exports include reference-only artifacts. This format does not decode BTD6 save files.

### Readable reports

**Export a readable build report** previews Markdown for the current calculator build, including manual overrides. It does not report a pending preview, pinned build, or complete plan. The build-name field supplies its title; **Download build report** saves `rogue-lab-build-report.md`.

Reports include artifact multipliers, all ability timings and manual-duration labels, loadout, setup, absolute estimates, source versions/revision, notes, inactive effects, warnings, and exclusions. Unknown values, unlimited range, unavailable abilities, and component exclusions keep their labels. Markdown is a readable snapshot; use JSON to transfer editable builds.

### Undo and redo

The stats bar retains up to 50 current-build changes in this tab. Consecutive valid edits in one numeric field are grouped until focus moves or another action occurs. New edits after undo discard redo. Filters, previews, and saved collections have separate state.

Outside input editing, use Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl+Y to redo. Text fields keep native undo. History resets on reload; the current build still autosaves.

## Comparison tools

Comparisons lead with artifact multipliers. Absolute stats and all imported ability timings expand per row or target. **Methodology & scope** explains each tool's assumptions; warnings stay beside affected results. Ratios with zero baselines, unknown values, unlimited range, and unavailable abilities are labeled separately.

| Tool | Inputs and scope |
| --- | --- |
| Artifact offers | Up to three exact artifact/rarity alternatives against the current build. Owned rarities are replaced, not stacked; reference-only offers remain visible but unranked. Highlighted gains compare only entered options. Preview before applying. |
| Tower presets | Up to eight independently selected tower/hero/power presets, paths/levels, components, and abilities. Rows use current artifacts, target, conditions, and crit mode; calculator manual overrides are omitted. |
| Party overview | Up to eight saved builds. Each keeps its own setup, components, abilities, and manual overrides, but uses the current artifacts, target, conditions, and crit mode. Saved artifacts/conditions are ignored. Missing source components/timers retain saved manual values with a warning. |
| Target matrix | Regular, Ceramic, Fortified Ceramic, MOAB-class, and Boss estimates for the current setup. Only Fortified Ceramic is fortified; all columns share the Camo flag. The calculator target stays unchanged. |
| Upgrades | All legal source paths for one tower, with independent component/ability selectors and a reference path that stays active even if filtered out. Uses current artifacts and conditions; omits calculator manual overrides. Heroes use preset comparison instead. |

These rows are independent alternatives, never a summed party/tower DPS total or purchase recommendation. Costs, geometry, omitted attacks, detection/immunities, and runtime uptime are outside their scope. Party-member buffs/interactions are not simulated. Temporary row choices clear on reload; exploration does not change the build unless you apply a preview.

The target matrix labels hit eligibility unknown except for explicit MOAB/original-target component exclusions. The [eligibility review](hit-eligibility.md) preserves pinned artifact, component, and bloon-property evidence plus reproduction commands. Raw masks and positive estimated damage do not establish whether an attack can hit. Full eligibility and survival recommendations remain deferred.

### Category synergies

**Synergy finder** compares membership with and without a chosen conversion while retaining other selected conversions. It lists newly activated selected effects and possible unselected pairings, including penalties and slowdowns. Selected pairings use their selected rarity; unselected pairings use the displayed first-listed rarity. Tower identity, tier/level, path, target, aura, status, and critical gates still apply.

Package target-DPS totals use the full engine, including the conversion's own effects and crit warnings. Pairing activation alone is not a net gain. **Towers with newly unlocked bonuses** checks roster identities at the current tier/hero level and conditions; other towers have no assumed path, so path-gated effects are omitted. It does not infer attack stats, combined DPS, or a purchase ranking. Custom manual heroes have no guessed affinity. Preview a conversion before applying it.

## Plan a run

**Plan a run** uses a regular tower, three legal upgrade snapshots, and a starting loadout. Early/Mid/Late are checkpoints you define, not round or survival thresholds. The editable `000 → 300 → 500` defaults are examples. Paths must preserve earlier upgrades; heroes, powers, selling, and respecs are outside this flow. Each checkpoint has independent attack and ability selectors, initially the first listed source entries.

The starting loadout initially copies the calculator's artifacts. Editing it leaves the calculator unchanged. Checkpoints use source stats and the current target, conditions, and critical mode; Early does not enable the first-20-seconds condition automatically.

Inspect an artifact/rarity, then **Choose for Mid** or **Choose for Late** to add it. Mid picks carry into Late; later rarities replace earlier copies. Removing a pick restores the earlier loadout at that stage. Tower/path edits retain picks. None promises offer availability.

Suggestions test each artifact independently against each checkpoint's loadout. Up to eight examples prioritize no measured losses/crit warnings, then earliest modeled benefit, then your preferred cadence, pierce, or target-DPS gain. Unspecified rarities use the displayed first-listed variant. Reference-only artifacts remain inspectable but are not suggested. These are conditional alternatives, not a cumulative acquisition order.

Checkpoint and offer tables show target DPS, attack interval, and pierce. **Metrics & source notes** expands other stats, ability timings, loadouts, and evidence. Longer intervals remain a tradeoff even when hits grow stronger. Overkill, target health, and leaks are not simulated. Category-conversion pairings include full package penalties/warnings and are never added automatically.

**Use starting setup in calculator** applies the Early snapshot and starting artifacts as one undoable change. It does not apply later checkpoints or save the complete plan.

### Save and transfer complete plans

Under **Save / transfer complete plan**, save up to 50 named plans separately from calculator builds. Unsaved edits require an explicit discard before loading another plan. Deletion can be undone until another deletion or reload. The last saved or loaded plan restores on reload; unsaved changes do not. Older single-plan saves appear as “My run plan”.

| Transfer | Limit and behavior |
| --- | --- |
| Download/import plan JSON | 100 KB. Validates and replaces the workspace; saved plans and calculator state stay unchanged until explicitly saved/applied. |
| Download all/import plan collection | 2 MB and 50 total plans. Validates every entry, then adds copies without replacing the collection or workspace. Exports omit unsaved edits. |

Unknown artifacts/rarities, unavailable components/abilities, illegal paths/progression, or unsupported formats reject the entire plan import. Plans retain setup, picks, target/conditions, inspection choices, notes/tags, and source provenance. Results recalculate from bundled data and warn on source changes.

Reloaded/imported plans keep their saved target and conditions. Enable **Use current calculator target and battle conditions** to follow the calculator again. If browser storage fails, the workspace and JSON export remain usable.

The planner excludes costs, curses and starting-loadout restrictions, placement, density, travel, hit eligibility, omitted attacks, DOT, ability damage, and survival feasibility. It cannot promise affordable upgrades, safe cadence, coverage, or leak-free survival.

## Reference and mechanics evidence

**Artifact effect coverage** lists all 117 artifacts and bundled rarities, 50 rows per page. Search descriptions/effects/exclusions or filter by evidence. Counts are effect/rarity rows, not a percentage of mechanics verified. Reference-only artifacts group omitted effects into one row per rarity. The inventory is independent of the current build and does not establish applicability or hit eligibility.

Rows link to bundled v57 descriptions, implemented rules, and matching pinned v56 cooldown models. Full descriptions expand in place. Filters survive navigation and reset on reload. The [mechanics notebook](mechanics-notebook.md) contains source research and prepared protocols, with no project gameplay trials recorded. Findings require review before changing calculations.

## Offline use and updates

After a connected visit to the production build over HTTPS or localhost, wait for **Offline copy ready** before disconnecting. The cached release includes all workspaces, bundled catalogs, and the mechanics notebook. External fonts and source websites need a connection; system fonts remain available offline. Browser cache eviction or clearing site data can remove offline access, so keep JSON backups.

The production calculator checks for updates on opening; **Check for updates** checks again. When **Update ready** appears, save/export unfinished plans, close all tabs for that calculator, and reopen. Reloading while other tabs remain open can keep the older release. Updates do not force reloads or change calculations in a running tab. Code and data install together with integrity checks; failed installations retain the previous offline release.

Local source development does not install an offline copy or show offline controls. See [development](development.md#offline-build-checks) for production-build checks.
