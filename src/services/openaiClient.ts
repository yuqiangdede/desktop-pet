import type { ChatMessage } from "../types/chat";
import type { AppConfig } from "../types/config";

export const openaiClient = {
  send: (messages: ChatMessage[]) => window.desktopPet.chat.send(messages),
  stop: (requestId: string) => window.desktopPet.chat.stop(requestId),
  testConnection: (config?: Partial<AppConfig>) => window.desktopPet.chat.testConnection(config),
  onDelta: window.desktopPet.chat.onDelta,
  onDone: window.desktopPet.chat.onDone,
  onError: window.desktopPet.chat.onError
};
