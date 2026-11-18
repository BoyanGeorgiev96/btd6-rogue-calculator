// Optional user annotations belong to saved artifacts, never calculation state.
export function savedMetadata({notes = '', tags = []} = {}) {
  if (typeof notes !== 'string' || notes.length > 4000) throw new Error('Notes must be at most 4,000 characters.');
  if (!Array.isArray(tags) || tags.length > 20 || tags.some(tag => typeof tag !== 'string' || tag.trim().length > 40)) throw new Error('Use up to 20 tags, each at most 40 characters.');
  const unique = new Map();
  for (const tag of tags.map(tag => tag.trim()).filter(Boolean)) if (!unique.has(tag.toLowerCase())) unique.set(tag.toLowerCase(), tag);
  return {notes, tags:[...unique.values()]};
}
export const metadataFromFields = (notes, tags) => savedMetadata({notes, tags:tags.split(',')});
