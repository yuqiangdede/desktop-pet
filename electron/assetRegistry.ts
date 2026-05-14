const assetRoots = new Map<string, string>();

export function registerAssetRoot(key: string, dir: string) {
  assetRoots.set(key, dir);
}

export function resolveAssetRoot(key: string) {
  return assetRoots.get(key) ?? null;
}

