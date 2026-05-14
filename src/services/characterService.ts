export const characterService = {
  list: () => window.desktopPet.character.list(),
  pickVideoFile: () => window.desktopPet.character.pickVideoFile(),
  pickImageFile: () => window.desktopPet.character.pickImageFile(),
  importVideoFile: (sourcePath: string, displayName?: string) =>
    window.desktopPet.character.importVideoFile(sourcePath, displayName),
  importImageFile: (sourcePath: string, displayName?: string) =>
    window.desktopPet.character.importImageFile(sourcePath, displayName),
  setActive: (id: string) => window.desktopPet.character.setActive(id),
  delete: (id: string) => window.desktopPet.character.delete(id),
  restoreDefault: () => window.desktopPet.character.restoreDefault()
};
