export type ChatRole = "system" | "user" | "assistant";

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
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

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  size: string;
  n: number;
}

export interface ChatDelta {
  requestId: string;
  delta: string;
}

export interface ChatDone {
  requestId: string;
  content: string;
  attachments?: ChatAttachment[];
}

export interface ChatError {
  requestId: string;
  message: string;
}
