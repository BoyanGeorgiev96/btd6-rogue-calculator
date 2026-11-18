// Format importer-authored notes without changing pinned data or source descriptions.
export function sourceNotes(notes) {
  const unique=[...new Set(notes)];
  const heroScope='Hero ability damage, summoned units, and conditional buffs are excluded.';
  return unique
    .filter(note=>note!=='Ability attacks are excluded.'||!unique.includes(heroScope))
    .map(note=>note.replace(/; ([a-z])/g,(_,letter)=>'. '+letter.toUpperCase()));
}

export const routineScopeNotes=new Set([
  'Ability attacks are excluded.',
  'Hero ability damage, summoned units, and conditional buffs are excluded.',
  'Damage-over-time effects are excluded.',
  'Other conditional damage modifiers are excluded.',
  'Critical hits and conditional attack-rate changes are excluded.'
]);
