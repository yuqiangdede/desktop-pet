import { create } from "zustand";
import type { AppConfig } from "../types/config";
import { configService } from "../services/configService";

interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  subscribeToChanges: () => void;
  save: (patch: Partial<AppConfig>) => Promise<void>;
  reset: () => Promise<void>;
}

let unsubscribeFromConfigChanges: (() => void) | null = null;

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ config: await configService.get(), loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "读取配置失败", loading: false });
    }
  },
  subscribeToChanges: () => {
    if (unsubscribeFromConfigChanges) return;
    unsubscribeFromConfigChanges = window.desktopPet.config.onChanged((config) => {
      set({ config, loading: false, error: null });
    });
  },
  save: async (patch) => {
    set({ loading: true, error: null });
    try {
      set({ config: await configService.save(patch), loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "保存配置失败", loading: false });
    }
  },
  reset: async () => {
    set({ loading: true, error: null });
    try {
      set({ config: await configService.reset(), loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "重置配置失败", loading: false });
    }
  }
}));
