export function basenameWithoutExtension(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop()?.trim() ?? filePath.trim();
  return fileName.replace(/\.[^.]+$/, "");
}

export function deriveCharacterNameFromPath(filePath: string) {
  const baseName = basenameWithoutExtension(filePath).trim();
  if (!baseName) return filePath.trim();

  const separatorIndex = baseName.search(/[-_]/);
  if (separatorIndex > 0) {
    const candidate = baseName.slice(0, separatorIndex).trim();
    if (candidate) return candidate;
  }

  return baseName;
}

export function resolveCharacterNameFromPath(filePath: string, providedName?: string) {
  const trimmed = providedName?.trim();
  return trimmed || deriveCharacterNameFromPath(filePath);
}
