import { artifactRules } from '../src/artifact-rules.js';
import { bindParameters, evaluateEffects, evaluateCritical, resolveCategories } from '../src/effect-engine.js';

const rarities = new Set(['Common', 'Rare', 'Legendary']);
export function validateCatalog(catalog) {
  if (!catalog || !Number.isInteger(catalog.version) || catalog.version < 1 || !Array.isArray(catalog.artifacts) || !catalog.artifacts.length)
    throw new Error('Invalid catalog header or empty artifact list');
  const ids = new Set();
  for (const artifact of catalog.artifacts) {
    if (!artifact || typeof artifact.id !== 'string' || !/^[A-Za-z0-9]+$/.test(artifact.id) || ids.has(artifact.id)) throw new Error('Invalid or duplicate artifact ID');
    ids.add(artifact.id);
    if (!artifact.name || typeof artifact.name !== 'string' || typeof artifact.category !== 'string' || !artifact.category || typeof artifact.boss !== 'boolean') throw new Error(`${artifact.id}: invalid metadata`);
    if (!Array.isArray(artifact.variants) || !artifact.variants.length) throw new Error(`${artifact.id}: no variants`);
    const seen = new Set();
    for (const variant of artifact.variants) {
      const label = `${artifact.id}/${variant.rarity}`;
      if (!rarities.has(variant.rarity) || seen.has(variant.rarity)) throw new Error(`${label}: invalid or duplicate rarity`);
      seen.add(variant.rarity);
      if (typeof variant.sourceTemplate !== 'string' || !variant.sourceTemplate || typeof variant.description !== 'string' || !variant.description) throw new Error(`${label}: missing description or source template`);
      if (!Array.isArray(variant.params) || !Array.isArray(variant.sourceParams) || variant.params.length !== variant.sourceParams.length) throw new Error(`${label}: invalid parameters`);
      if (variant.sourceParams.some(p => typeof p !== 'string')) throw new Error(`${label}: source parameters must be strings`);
      const expected = variant.sourceTemplate.replace(/\{(\d+)\}/g, (_, n) => {
        if (variant.sourceParams[n] === undefined) throw new Error(`${label}: missing placeholder ${n}`);
        return variant.sourceParams[n];
      });
      if (expected !== variant.description) throw new Error(`${label}: description does not match source parameters`);
      for (const [index, raw] of variant.sourceParams.entries()) {
        const value = raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw;
        if (variant.params[index] !== value) throw new Error(`${label}: inconsistent parameter ${index}`);
      }
    }
  }
}

export function sourceContract(artifact) {
  return {
    name: artifact.name, category: artifact.category, boss: artifact.boss,
    variants: Object.fromEntries(artifact.variants.map(v => [v.rarity, {
      template: v.sourceTemplate,
      parameterTypes: v.params.map(p => typeof p)
    }]))
  };
}

// Numeric parameter changes are compatible; source wording, literal numbers,
// rarity layouts, and parameter types must match the reviewed contract.
export function reviewCatalog(catalog, contracts, rules = artifactRules) {
  validateCatalog(catalog);
  if (!contracts || contracts.schemaVersion !== 1 || !contracts.artifacts || typeof contracts.artifacts !== 'object' || Array.isArray(contracts.artifacts))
    throw new Error('Invalid reviewed source contracts');
  const issues = [];
  const byId = new Map(catalog.artifacts.map(a => [a.id, a]));
  for (const artifact of catalog.artifacts) {
    const expected = contracts.artifacts[artifact.id];
    if (!expected) issues.push({ id: artifact.id, reason: 'New artifact needs source review (reference-only unless a rule is added).' });
    else if (JSON.stringify(sourceContract(artifact)) !== JSON.stringify(expected))
      issues.push({ id: artifact.id, reason: 'Source description, metadata, rarity, or parameter layout changed.' });
  }
  for (const id of Object.keys(contracts.artifacts)) if (!byId.has(id)) issues.push({ id, reason: 'Previously reviewed artifact was removed.' });
  for (const [id, definition] of Object.entries(rules)) {
    const artifact = byId.get(id);
    if (!artifact) { issues.push({ id, reason: 'Calculation rule has no catalog entry.' }); continue; }
    try {
      for (const variant of artifact.variants) {
        bindParameters(definition, variant);
        const context = { category: 'Primary', tower: 'Dart Monkey', tier: 0, heroLevel: 1 };
        const categories = resolveCategories([{ definition }], context);
        evaluateEffects(definition, variant, context, categories);
        evaluateCritical(definition, variant, context, categories);
      }
    } catch (error) { issues.push({ id, reason: error.message }); }
  }
  return issues;
}

export function diffCatalog(previous, next, contracts, rules = artifactRules) {
  validateCatalog(previous);
  validateCatalog(next);
  const old = new Map(previous.artifacts.map(a => [a.id, a]));
  const current = new Map(next.artifacts.map(a => [a.id, a]));
  const added = next.artifacts.filter(a => !old.has(a.id)).map(a => a.id);
  const removed = previous.artifacts.filter(a => !current.has(a.id)).map(a => a.id);
  const changed = [];
  for (const artifact of next.artifacts) {
    const before = old.get(artifact.id);
    if (!before) continue;
    const fields = Object.keys(artifact).filter(key => JSON.stringify(before[key]) !== JSON.stringify(artifact[key]));
    if (fields.length) changed.push({ id: artifact.id, fields, before: before.variants.map(v => ({ rarity: v.rarity, params: v.sourceParams })), after: artifact.variants.map(v => ({ rarity: v.rarity, params: v.sourceParams })) });
  }
  return { fromVersion: previous.version, toVersion: next.version, added, removed, changed, requiresReview: reviewCatalog(next, contracts, rules) };
}

export function formatReport(report) {
  const items = report.requiresReview.map(i => `- **${i.id}**: ${i.reason}`).join('\n') || '- No source-contract changes detected. Review the balance values before merging.';
  const values = report.changed.map(c => `- **${c.id}** (${c.fields.join(', ')}):\n  - Before: ${JSON.stringify(c.before)}\n  - After: ${JSON.stringify(c.after)}`).join('\n') || '- None';
  return `# Artifact data update: v${report.fromVersion} → v${report.toVersion}\n\n${report.requiresReview.length ? 'Manual source review is required. The proposed catalog is in data/artifacts.candidate.json; the active catalog was preserved.' : 'The active catalog contains the proposed compatible parameter updates.'}\n\n## Added\n\n${report.added.join(', ') || 'None'}\n\n## Removed\n\n${report.removed.join(', ') || 'None'}\n\n## Changed values\n\n${values}\n\n## Review findings\n\n${items}\n\nThis is a community dataset update, not verification against the running game. No automatic merge or deployment is performed by the refresh workflow.\n`;
}
