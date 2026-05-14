export const characterService = {
  list: () => window.desktopPet.character.list(),
  importDirectory: () => window.desktopPet.character.importDirectory(),
  setActive: (id: string) => window.desktopPet.character.setActive(id),
  restoreDefault: () => window.desktopPet.character.restoreDefault()
};
