import { artifactEvidence } from './artifact-discovery.js';

export const coverageStatuses = ['Verified export cooldown', 'Description estimate', 'Unverified mechanics', 'Unmodeled'];

// Inventory evidence, not applicability to the current build. A row is one
// rule effect / explicit exclusion at one rarity, never an entire verified artifact.
export function artifactCoverage(artifacts) {
  return [...artifacts].sort((a,b)=>a.name.localeCompare(b.name)).flatMap(artifact =>
    artifact.variants.flatMap(variant => artifactEvidence(artifact,variant).map((entry,index)=>({
      ...entry, id:`${artifact.id}:${variant.rarity}:${index}`, artifactId:artifact.id,
      name:artifact.name, rarity:variant.rarity, description:variant.description
    })))
  );
}

export function filterCoverage(rows, {search='', status='all'}={}) {
  const query=search.trim().toLocaleLowerCase();
  return rows.filter(row=>(status==='all'||row.status===status) &&
    `${row.name} ${row.artifactId} ${row.rarity} ${row.label} ${row.status} ${row.detail} ${row.description}`.toLocaleLowerCase().includes(query));
}
