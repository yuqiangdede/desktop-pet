import type { AppConfig } from "../types/config";

export const configService = {
  get: () => window.desktopPet.config.get(),
  save: (config: Partial<AppConfig>) => window.desktopPet.config.save(config),
  reset: () => window.desktopPet.config.reset()
};
