import { create } from "zustand";
import type { CharacterInfo } from "../types/character";
import { characterService } from "../services/characterService";

interface AppState {
  characters: CharacterInfo[];
  error: string | null;
  loadCharacters: () => Promise<void>;
  importCharacter: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  characters: [],
  error: null,
  loadCharacters: async () => {
    try {
      set({ characters: await characterService.list(), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "读取角色列表失败" });
    }
  },
  importCharacter: async () => {
    try {
      const imported = await characterService.importDirectory();
      if (imported) {
        set({ characters: [...get().characters.filter((item) => item.id !== imported.id), imported], error: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "导入角色失败" });
    }
  }
}));
