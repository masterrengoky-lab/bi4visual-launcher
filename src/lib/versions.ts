/** Human name for a version id, e.g. `fabric-loader-0.16.9-1.21.1` → `1.21.1 · Fabric`. */
export function versionLabel(id: string): string {
  const fabric = /^fabric-loader-[^-]+-(.+)$/.exec(id);
  if (fabric) return `${fabric[1]} · Fabric`;
  return id;
}
