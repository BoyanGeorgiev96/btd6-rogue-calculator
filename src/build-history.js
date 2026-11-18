// Session-local history of calculator state. No storage or DOM dependencies.
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => JSON.stringify(canonical(value));
export function createBuildHistory(initial, {limit = 50} = {}) {
  if(!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('History limit must be between 1 and 200.');
  let current = structuredClone(initial), currentKey = fingerprint(current), past = [], future = [], lastGroup = null;
  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get counts() { return {undo:past.length, redo:future.length}; },
    record(next, group = null) {
      const nextKey = fingerprint(next);
      if(nextKey === currentKey) { if(group !== lastGroup) lastGroup = null; return false; }
      if(group === null || group !== lastGroup || future.length) {
        past.push(current); if(past.length > limit) past.shift();
      }
      current = structuredClone(next); currentKey = nextKey; future = []; lastGroup = group;
      return true;
    },
    endGroup() { lastGroup = null; },
    undo() {
      if(!past.length) return null;
      future.push(current); current = past.pop(); currentKey = fingerprint(current); lastGroup = null;
      return structuredClone(current);
    },
    redo() {
      if(!future.length) return null;
      past.push(current); current = future.pop(); currentKey = fingerprint(current); lastGroup = null;
      return structuredClone(current);
    }
  };
}
