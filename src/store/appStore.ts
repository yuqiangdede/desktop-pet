import { create } from "zustand";
import type { CharacterInfo } from "../types/character";
import { characterService } from "../services/characterService";
import { deriveCharacterNameFromPath } from "../utils/characterNaming";

interface AppState {
  characters: CharacterInfo[];
  error: string | null;
  loadCharacters: () => Promise<void>;
  importVideoCharacter: () => Promise<CharacterInfo | null>;
  importImageCharacter: () => Promise<CharacterInfo | null>;
  deleteCharacter: (id: string) => Promise<boolean>;
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
  importVideoCharacter: async () => {
    try {
      const sourcePath = await characterService.pickVideoFile();
      if (!sourcePath) return null;
      const defaultName = deriveCharacterNameFromPath(sourcePath);
      const imported = await characterService.importVideoFile(sourcePath, defaultName);
      if (imported) {
        set({ characters: [...get().characters.filter((item) => item.id !== imported.id), imported], error: null });
      }
      return imported;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "导入 WebM 角色失败" });
      return null;
    }
  },
  importImageCharacter: async () => {
    try {
      const sourcePath = await characterService.pickImageFile();
      if (!sourcePath) return null;
      const defaultName = deriveCharacterNameFromPath(sourcePath);
      const imported = await characterService.importImageFile(sourcePath, defaultName);
      if (imported) {
        set({ characters: [...get().characters.filter((item) => item.id !== imported.id), imported], error: null });
      }
      return imported;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "导入 PNG 角色失败" });
      return null;
    }
  },
  deleteCharacter: async (id: string) => {
    try {
      await characterService.delete(id);
      set({ characters: get().characters.filter((item) => item.id !== id), error: null });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "删除角色失败" });
      return false;
    }
  }
}));
