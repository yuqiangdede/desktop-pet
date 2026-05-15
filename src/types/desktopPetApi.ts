import type { AppConfig } from "./config";
import type { CharacterInfo } from "./character";
import type { ChatDelta, ChatDone, ChatError, ChatMessage, ChatSession, ImageGenerationRequest } from "./chat";

export interface DesktopPetApi {
  config: {
    get(): Promise<AppConfig>;
    save(config: Partial<AppConfig>): Promise<AppConfig>;
    reset(): Promise<AppConfig>;
    onChanged(callback: (config: AppConfig) => void): () => void;
  };
  chat: {
    send(messages: ChatMessage[]): Promise<{ requestId: string }>;
    generateImage(request: ImageGenerationRequest): Promise<{ requestId: string }>;
    stop(requestId: string): Promise<void>;
    listSessions(): Promise<ChatSession[]>;
    saveSessions(sessions: ChatSession[]): Promise<ChatSession[]>;
    testConnection(config?: Partial<AppConfig>): Promise<{ ok: boolean; message: string }>;
    onDelta(callback: (event: ChatDelta) => void): () => void;
    onDone(callback: (event: ChatDone) => void): () => void;
    onError(callback: (event: ChatError) => void): () => void;
  };
  clipboard: {
    writeText(text: string): Promise<void>;
  };
  character: {
    list(): Promise<CharacterInfo[]>;
    pickVideoFile(): Promise<string | null>;
    pickImageFile(): Promise<string | null>;
    importVideoFile(sourcePath: string, displayName?: string): Promise<CharacterInfo>;
    importImageFile(sourcePath: string, displayName?: string): Promise<CharacterInfo>;
    setActive(id: string): Promise<AppConfig>;
    delete(id: string): Promise<AppConfig>;
    restoreDefault(): Promise<AppConfig>;
  };
  window: {
    toggleChat(): Promise<void>;
    openSettings(): Promise<void>;
    dragMove(delta: { x: number; y: number }): Promise<void>;
    resizePet(delta: { x: number; y: number }): Promise<AppConfig | null>;
    resetPetPosition(): Promise<void>;
  };
}

declare global {
  interface Window {
    desktopPet: DesktopPetApi;
  }
}
