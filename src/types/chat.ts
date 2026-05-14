export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequest {
  requestId: string;
  messages: ChatMessage[];
}

export interface ChatDelta {
  requestId: string;
  delta: string;
}

export interface ChatDone {
  requestId: string;
  content: string;
}

export interface ChatError {
  requestId: string;
  message: string;
}
