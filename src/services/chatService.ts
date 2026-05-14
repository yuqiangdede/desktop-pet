import type { ChatMessage, ChatSession } from "../types/chat";
import { openaiClient } from "./openaiClient";

export const chatService = {
  send: (messages: ChatMessage[]) => openaiClient.send(messages),
  stop: (requestId: string) => openaiClient.stop(requestId),
  listSessions: () => window.desktopPet.chat.listSessions(),
  saveSessions: (sessions: ChatSession[]) => window.desktopPet.chat.saveSessions(sessions)
};
