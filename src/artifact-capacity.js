// Pinned v56 rogueData.json: maxArtifactInventorySize = 50.
// See docs/artifact-capacity.md for source evidence and exclusions.
export const artifactLimit = 50;
export const artifactLimitMessage = '50-artifact limit reached. Remove an artifact before adding another.';

export function canAddArtifact(selected, id) {
  return Object.hasOwn(selected, id) || Object.keys(selected).length < artifactLimit;
}

// Saved/imported hypothetical builds stay inspectable. Rarity changes and
// removals remain available even above the cap; new additions require space.
export function exceedsAdditionLimit(current, candidate) {
  return Object.keys(candidate).length > artifactLimit &&
    Object.keys(candidate).some(id => !Object.hasOwn(current, id));
}

export function artifactCapacityWarning(count) {
  return count > artifactLimit ? `${count} / ${artifactLimit} artifacts selected: above the normal campaign limit. This is a hypothetical build; remove ${count - artifactLimit} to fit.` : '';
}
