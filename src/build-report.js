import {multiplierMetrics} from './artifact-metrics.js';
import {snapshot} from './build-tools.js';
import {calculate, supported} from './calculator.js';
import {getAbilityTimers,getPresetVariant, getPresetSourceUrl} from './tower-stats.js';
import {targetTypes} from './target-stats.js';

const fmt = value => value === null ? 'Unknown' : new Intl.NumberFormat('en', {maximumFractionDigits:6}).format(value);
// Keep user-supplied names as literal Markdown text, including HTML and links.
const text = value => String(value).replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]()<>#!|~]/g, '\\$&');
const list = values => values.length ? values.map(value => `- ${text(value)}`).join('\n') : '- None.';

// Use the exact current inputs, including manual overrides; never refresh presets
// while exporting a report. This operation has no storage or DOM side effects.
export function exportBuildReport({state, artifacts, towerCatalog, artifactVersion, name = 'Current build', notes: userNotes = '', tags = []}) {
  const current = snapshot(state, artifacts), c = current.context;
  const result = calculate(artifacts, current.selected, c);
  const base = calculate(artifacts, {}, c);
  const variant = getPresetVariant(towerCatalog, c);
  const component = variant?.components.find(item => item.id === c.componentId);
  const ability = variant?.abilities.find(item => item.id === c.abilityId);
  const sourceUrl = getPresetSourceUrl(towerCatalog, c);
  const conditions = [['early','First 20 seconds'],['close','Close targeting'],['aura','Inside selected artifact auras'],['frozen','Frozen'],['glued','Glued'],['stunned','Stunned / tranced']];
  const rows = [
    ['Target DPS', base.targetDpsValue, result.targetDpsValue],
    ['Normal damage / hit', base.targetHit, result.targetHit],
    ['Expected damage / hit', base.expectedTargetHit, result.expectedTargetHit],
    ['Attacks / second', base.attacks, result.attacks],
    ['Seconds between attacks', base.attacks > 0 ? 1/base.attacks : null, result.attacks > 0 ? 1/result.attacks : null],
    ['Pierce / projectile', base.projectilePierce, result.projectilePierce],
    ['Range', base.attackRange, result.attackRange],
    ['Ability cooldown (seconds)', base.abilitySeconds, result.abilitySeconds]
  ];
  const factors=multiplierMetrics(result).map(m=>`| ${m.label} | ${m.value===null?'Unavailable':'×'+fmt(m.value)} |`).join('\n');
  const timings=getAbilityTimers(c,towerCatalog,result.abilityCooldown).map(timer=>`| ${text(timer.name)} | ${fmt(timer.seconds)} | ${fmt(timer.durationSeconds)}${timer.durationSeconds===null?'':timer.durationManual?' (manual override)':' (source)'} | ${timer.gapSeconds===null?'Not estimated':fmt(timer.gapSeconds)} | ${timer.uptime===null?'Not estimated':fmt(timer.uptime*100)+'%'+(timer.gapSeconds===0?' — potential continuous uptime':'')} | ${text([...timer.notes,...(timer.durationSeconds!==null&&timer.gapSeconds===null?['Conditional / limited activation; gap not estimated.']:[])].join(' ')||'—')} |`).join('\n');
  const selected = artifacts.filter(a => current.selected[a.id]);
  const notes = [...result.warnings,
    ...result.breakdown.filter(item => !item.active).map(item => `${item.name}: ${item.note}`),
    ...result.breakdown.flatMap(item => item.excluded.map(note => `${item.name}: ${note} excluded.`)),
    ...result.unmodeled.map(name => `${name}: reference only; excluded from totals.`)];
  const eligibility = c.baseDamageExcluded || !c.baseCanHitMoab && ['moab','boss'].includes(c.targetType)
    ? 'Excluded for this component / original target.' : 'Unknown — detection and damage-type immunities are not modeled. Positive damage does not establish hit eligibility.';
  return `# Rogue Lab build report\n\n${text(name.trim() || 'Current build')}${tags.filter(tag=>tag.trim()).length?'\n\nTags: '+tags.filter(tag=>tag.trim()).map(tag=>text(tag.trim())).join(', '):''}${userNotes?'\n\n## User notes\n\n'+userNotes.split(/\r?\n/).map(line=>text(line)).join('\n\n'):''}\n\n## Configuration\n\n${list([
    `Tower: ${c.tower} (${c.category}); ${c.category === 'Hero' ? 'hero level '+c.heroLevel : c.upgradePath ?? 'manual tier '+c.tier}`,
    `Attack: ${component?.name ?? c.componentId ?? 'Manual attack'}; stats: ${c.statMode}`,
    `Ability: ${c.abilityMode === 'none' ? 'No ability' : ability?.name ?? c.abilityId ?? 'Manual / unspecified timer'}; timer: ${c.abilityMode}`,
    `Target: ${targetTypes[c.targetType]}; Camo: ${c.camo ? 'on' : 'off'}; Fortified: ${c.fortified ? 'on' : 'off'}`,
    `Artifact critical estimates: ${c.criticalMode === 'expected' ? 'enabled' : 'off (normal hits)'}`,
    `Other Military aura sources (Too Many Cooks): ${c.otherMilitaryCount}`,
    ...conditions.map(([key,label]) => `${label}: ${c[key] ? 'on' : 'off'}`),
    `Input regular damage: ${fmt(c.baseDamage)}; MOAB/Boss damage: ${fmt(c.baseBossDamage ?? c.baseDamage)}; attacks/sec: ${fmt(c.baseRate)}`,
    `Input pierce: ${fmt(c.basePierce)}; range: ${c.rangeMode === 'global' ? 'Unlimited' : fmt(c.baseRange)}; ability seconds: ${c.abilityMode === 'none' ? 'No ability' : fmt(c.baseAbilityCooldown)}`
  ])}\n\n## Loadout (${selected.length})\n\n${list(selected.map(a => `${a.name} | ${current.selected[a.id]}${supported.has(a.id) ? '' : ' | Reference only; excluded from totals'}`))}\n\n## Artifact multipliers\n\nRelative to this build’s own base setup. Lower ability-cooldown factors mean faster recharge.\n\n| Stat | Artifact factor |\n| --- | ---: |\n${factors}\n\n## All ability timings\n\n${timings?`| Ability | Cooldown (s) | Duration (s) | Nominal gap (s) | Nominal uptime | Notes |\n| --- | ---: | ---: | ---: | ---: | --- |\n${timings}`:"No imported fixed-cooldown ability."}\n\nNominal estimates assume cooldown starts at activation and immediate reuse. Targets, charges, activation limits, cooldown floors and round boundaries can add downtime. Unknown and conditional durations do not establish continuous uptime.\n\n## Estimated stats\n\nOne projectile contact per attack cycle for the selected component. Base means the same inputs without artifacts. Values rounded to six decimal places.\n\n| Stat | Base | Build |\n| --- | ---: | ---: |\n${rows.map(([label,a,b]) => `| ${label} | ${label === 'Range' && c.rangeMode === 'global' ? 'Unlimited' : label.startsWith('Ability') && c.abilityMode === 'none' ? 'No ability' : fmt(a)} | ${label === 'Range' && c.rangeMode === 'global' ? 'Unlimited' : label.startsWith('Ability') && c.abilityMode === 'none' ? 'No ability' : fmt(b)} |`).join('\n')}\n\nArtifact target-DPS change: ${fmt(result.targetDpsValue - base.targetDpsValue)}. Zero attack rate means no modeled attacks; its interval is unknown.\n\nHit eligibility: ${eligibility}\n\n## Sources and accuracy\n\n${list([
    `Artifact descriptions: v${artifactVersion}; community source snapshot, not guaranteed current-game accuracy.`,
    `Bundled tower/hero/power export: v${towerCatalog.source.gameVersion}; revision ${towerCatalog.source.revision}.`,
    `Attack inputs: ${c.statMode === 'preset' ? 'pinned preset values' : 'manual values; source component stats may differ'}. Preset revision recorded on build: ${c.presetRevision ?? 'none'}.`,
    'Compatible verified export cooldowns are used where available; other modeled effects are description estimates. Critical timing and stacking interactions remain unverified.'
  ])}${sourceUrl ? `\n\n[Associated pinned tower/hero/power model](${sourceUrl}) (manual overrides may differ).` : ''}\n\n### Source notes\n\n${list([...new Set([...(variant?.notes ?? []), ...(component?.notes ?? []), ...(ability?.notes ?? [])])])}\n\n## Warnings, inactive effects, and selected exclusions\n\n${list([...new Set(notes)])}\n\n## Calculation limits\n\n${list([
    'Pierce, emitted projectile counts, and range do not multiply single-target contact DPS. Components are not summed.',
    'Detection, damage-type immunity eligibility, geometry, placement, projectile travel, runtime uptime, damage rounding, boss armor/resistances, augments, and other buffs are excluded.',
    'Additional projectile DPS, DOT, ability damage, summons/beasts, innate tower criticals, and conditional tower/hero scaling are not fully modeled.',
    'Boss estimates exclude frozen, glued, and stunned/tranced status bonuses. Target flags select damage bonuses only.',
    'Duration/gap values are nominal estimates only. Charges, cooldown floors and special resets are not simulated. Unknown timers do not establish ability availability.',
    'Costs, curse restrictions, offer availability, and survival feasibility are excluded; this report is not a coverage or purchase recommendation.',
    'This report describes the current calculator build only, not a pending preview, pinned comparison, or complete run plan. Use saved-build JSON for import and transfer.'
  ])}\n`;
}
