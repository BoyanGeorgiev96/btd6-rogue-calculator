# Rogue Lab mechanics notebook

Status: **prepared protocols; no in-game observations recorded**.

Use these protocols to investigate specific unresolved mechanics. Description
estimates, pinned export values, and calculator outputs are hypotheses, not trial
results; notebook entries do not change calculations. Artifact descriptions are
v57; tower/hero and matching cooldown exports are v56.0, revision `f818c39e6d7cc4e0f8fb02a2e3d1a929bcfe6a24`.
Game version and platform must be recorded independently for every session.

## Research before scheduling gameplay trials

Review official versioned patch notes and pinned gameplay fields first, then seek reproducible community measurements or recordings with identifiable versions and loadouts. Record source-backed conclusions separately from observations made by this project. Description repetition and undocumented videos do not settle stacking formulas. Use gameplay trials for remaining questions that can be isolated with reproducible controls.

Source review on 2026-11-12 (no project gameplay trials):

| Question | Evidence and current conclusion |
| --- | --- |
| Dreadbloon category gate | [Official v49 notes](https://www.reddit.com/r/btd6/comments/1le303i/bloons_td_6_v490_update_notes/) establish tier-4 towers / level-15 heroes. The calculator uses those thresholds; other conversion interactions remain unverified. |
| Divine Intervention overlap | The same v49 notes fix other crit artifacts overriding Divine Intervention. They do not establish joint probabilities, damage composition or acquisition-order independence. Overlapping artifact crit estimates remain excluded. |
| Malicious Mauling ability penalty | The same v49 notes establish an ability-cooldown penalty, but do not settle its exact factor/scope against the older export. The ability clause remains excluded; see `docs/ability-cooldowns.md` in the repository. |
| Druid vines and crits | [Official v53 notes](https://www.reddit.com/r/btd6/comments/1r2iecf/bloons_td_6_version_fifty_three_point_oh_update/) exclude artifact crits on target-destroying x3x vines. Pinned source identifies the destruction component. It and unmodeled spawned ground-vine output are excluded from ordinary hit/DPS estimates; see `docs/tower-stats.md` in the repository. Old demonstrations can show behavior that was later fixed. |
| Universal attack/ability cooldown floors | The initial public-source search did not establish a reliable universal rule. Floors remain unknown; no absence-of-a-floor or guaranteed uptime is inferred. |

## Shared controls

1. Record game version, platform, mode, map, encounter/round, game speed, recording
   frame rate, tower/path or named hero/level, targeting, placement and target.
2. Record the complete artifact loadout with exact rarities and acquisition order,
   curses, shop bonuses, Monkey Knowledge and all external buffs. Mark unknowns.
3. Use one isolated repeatable attack component, no innate crits or extra damage
   sources where possible, and a target it can visibly hit. Confirm contacts in
   the recording; calculator hit eligibility is still unknown. Keep geometry,
   distance, target properties and non-tested effects fixed.
4. Record a no-tested-artifact baseline and each tested artifact alone before a
   combination. Repeat the baseline after a series to detect drift. If the game
   cannot reproduce the same conditions, label the comparison confounded rather
   than silently treating different encounters as controlled trials.
5. Save raw video/screenshots and per-hit or per-cast data with timestamps/frame
   numbers. Report misses, interruptions, target deaths and discarded intervals
   with reasons. Never infer per-hit damage solely from a rounded DPS display.
6. Use independent repeated trials. Report sample sizes and spread; a short run
   without an event cannot establish that event is impossible. Stop or redesign
   if an isolated observable component or legal loadout cannot be obtained.

## CRIT-01 — artifact critical stacking

Question: when two applicable artifact crit mechanics are present, do their
chances/damage interact, replace one another, or depend on acquisition order?

Candidate setup: a 400 Sniper with One Shot, Critical Success and Essence of
Dreadbloon as the source-described high-tier category conversion. Check the actual
descriptions and component for the chosen version and rarities before testing.
Conversion behavior is itself unverified;
hold the same conversion in every arm, verify each crit alone, and label the test
confounded if those controls cannot be established. These are test candidates,
not claims that a particular combination works in the game.

1. Choose and record one legal setup in which each tested crit is independently
   observable. Copy the exact rarity descriptions and their evidence links from
   Reference; do not substitute assumed multipliers.
2. Record four arms with the same tower and other effects: neither A nor B, A
   only, B only, A+B. Repeat the combination with B acquired before A. If baseline
   restoration is unavailable, use separately documented matching runs.
3. For each hit, record index, frame, observed damage, normal/crit classification
   (or unknown), and any relevant visual indication. Retain large hits and any
   possible simultaneous proc as raw observations, without forcing a model.
4. Preselect a practical count per arm and repeat across runs. Compare observed
   hit-size classes, frequencies and sequences with explicit hypotheses:
   independent events, exclusive events, replacement, or order dependence.
   Separate changes in normal-hit damage and attack interval from crit behavior.
5. Report uncertainty and any indistinguishable hypotheses. Do not enable combined
   critical expectation from a mean damage measurement alone.

Current calculator behavior: multiple applicable artifact crit mechanics warn and
exclude the critical estimate. Innate tower crits remain excluded.

## RATE-01 — attack interval and possible cooldown floors

Question: do measured attack intervals keep following increasing compatible
speed modifiers, or is there a repeatable lower limit?

1. Choose a simple direct attack without charge-up, changing attack sequences,
   extra projectiles or conditional speed. Record its component and unmodified
   interval. Verify it is actually firing continuously at the same target.
2. Prepare an ordered series: baseline, one applicable speed artifact, then
   additional known applicable speed modifiers or separately controlled rarity
   replacements. Record complete arms and description/source expectations before
   measuring; a stronger rarity replaces the earlier copy.
3. Count emission frames over many full intervals: `(last frame - first frame) /
   (frame rate * number of intervals)`. Also retain individual intervals, game
   speed, recording precision, sample count and spread. Exclude wind-up and target
   reacquisition explicitly; keep discarded data in the record.
4. Repeat each arm and the baseline. Change recording resolution or choose a
   slower baseline if expected differences approach a frame. A plateau at frame
   precision can be a measurement limit, missed emissions or animation limit.
5. Only propose a floor if observations distinguish it from those alternatives.
   Report the tested component/loadouts and uncertainty; do not generalize a
   component-specific result to all towers.

## ABILITY-01 — repeatable ability cooldown and possible floors

Question: how do applicable cooldown modifiers combine for one repeatable timer?

1. Choose one ability with a repeatable timer and no extra charges, resets,
   transformation or duration ambiguity. Record its exact identity and upgrade.
2. Compare baseline, each cooldown modifier alone and combinations, keeping the
   ability and other effects fixed. Do not mix placement cooldown rounds with
   ability cooldown seconds or attack intervals.
3. Record cast, timer start and next-ready frames separately, with ability duration
   and UI timer values. Count next-ready intervals instead of human recast delays.
   If readiness is ambiguous, mark it unknown and retain video.
4. Repeat and report uncertainty as in RATE-01. A displayed integer timer cannot
   establish a subsecond floor. Keep charge/reset behavior outside this test.

## EFFECT-01 — ambiguous gates, conversions and aura effects

Question: write one specific unresolved clause from a bundled description.
Examples include category-conversion order and an aura's provider/recipient gate.
Detection, immunity and curse precedence require separate evidence; this protocol
does not establish complete hit eligibility or survival feasibility.

1. Copy artifact ID, rarity, exact clause and pinned evidence link. State at least
   two interpretations and the observable outcome that would distinguish them.
2. Define a control and one-variable changes: e.g. inside/outside the same aura,
   below/at a described tier gate, or opposite acquisition orders. Keep unrelated
   categories, upgrades, targets and buffs fixed. Tier changes may alter base
   stats; compare each tier with its own no-artifact baseline.
3. Confirm a provider exists before testing its aura. Record distances/placement
   and acquisition order. If curse, conversion or another gate cannot be held
   constant, record that limitation instead of attributing its result to one effect.
4. Measure the relevant observable directly and repeat. Record a failed trigger
   as an observation with controls, not proof that every use of the effect fails.

## Blank session / trial record

Duplicate this block for each session and attach raw data. Blank means untested.

```text
Session ID / date / tester:
Protocol ID / question:
Status: prepared | observed | inconclusive | reviewed (choose one)
Game version / platform / mode / map / encounter / game speed:
Recording frame rate / timing uncertainty:
Tower / path or hero level / component / targeting / position:
Target properties / contact confirmation:
All artifacts / rarities / acquisition order:
Curses / shop / Monkey Knowledge / buffs / unknowns:
Source description and pinned links / calculator revision:
Calculator build report or build JSON (hypothesis only):
Hypotheses / predicted distinguishing observations:
Baseline and trial arms / intended counts / repeat count:
Raw file paths or links / timestamps:
Per-hit rows: arm, run, hit index, frame, damage, classification, notes
Per-interval rows: arm, run, start frame, end frame, interval count, notes
Exclusions / discarded rows and reasons / deviations / confounders:
Observed counts / values / spread / measurement uncertainty:
Interpretation / alternatives still consistent with observations:
Reviewer / review date / narrow supported scope:
Follow-up test / rule PR link (if separately approved and verified):
```

## Review before changing a rule

Keep the raw record, version, controls and uncertainty available to a reviewer.
Separate observed values from interpretations; conflicting or confounded trials
remain inconclusive. Scope conclusions to the tested versions, towers and effects.
Follow the repository's `docs/artifact-rules.md` and `docs/tower-stats.md` review
procedures before implementation. Add regression coverage for the supported behavior and preserve all unrelated exclusions and
unknowns. Notebook entries never automatically promote data or alter arithmetic.
