import { create } from "zustand";
import type { ChatAttachment, ChatMessage, ChatSession, ImageGenerationRequest } from "../types/chat";
import { chatService } from "../services/chatService";

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeRequestId: string | null;
  loading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  createSession: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  generateImage: (request: ImageGenerationRequest) => Promise<void>;
  appendDelta: (requestId: string, delta: string) => void;
  finishMessage: (requestId: string, content: string, attachments?: ChatAttachment[]) => void;
  failMessage: (requestId: string, message: string) => void;
  clear: () => Promise<void>;
}

function now() {
  return Date.now();
}

function newMessage(role: ChatMessage["role"], content: string, attachments?: ChatAttachment[]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    ...(attachments?.length ? { attachments } : {}),
    createdAt: now()
  };
}

function newSession(): ChatSession {
  const createdAt = now();
  return {
    id: crypto.randomUUID(),
    title: "新聊天",
    messages: [],
    createdAt,
    updatedAt: createdAt
  };
}

function sessionTitle(messages: ChatMessage[]) {
  const firstUser = messages.find(
    (message) => message.role === "user" && (message.content.trim() || message.attachments?.length)
  );
  if (!firstUser) return "新聊天";
  const compact = firstUser.content.replace(/\s+/g, " ").trim();
  if (!compact && firstUser.attachments?.length) return "图片识别";
  return compact.length > 22 ? `${compact.slice(0, 22)}...` : compact;
}

function sortSessions(sessions: ChatSession[]) {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function activeSession(state: ChatState) {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? null;
}

async function persist(sessions: ChatSession[]) {
  return chatService.saveSessions(sortSessions(sessions));
}

function nextActiveSessionId(sessions: ChatSession[], preferredId: string | null) {
  if (preferredId && sessions.some((session) => session.id === preferredId)) return preferredId;
  return sessions[0]?.id ?? null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeRequestId: null,
  loading: false,
  error: null,
  loadSessions: async () => {
    set({ error: null });
    try {
      const sessions = await chatService.listSessions();
      if (sessions.length) {
        set({ sessions: sortSessions(sessions), activeSessionId: sessions[0].id });
        return;
      }
      const session = newSession();
      set({ sessions: [session], activeSessionId: session.id });
      await persist([session]);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "读取历史记录失败" });
    }
  },
  createSession: () => {
    if (get().loading) return;
    const session = newSession();
    const sessions = sortSessions([session, ...get().sessions]);
    set({ sessions, activeSessionId: session.id, activeRequestId: null, loading: false, error: null });
    void persist(sessions).then((saved) => {
      set({ sessions: saved, activeSessionId: nextActiveSessionId(saved, get().activeSessionId) });
    });
  },
  selectSession: (id) => {
    if (get().loading) return;
    set({ activeSessionId: id, error: null });
  },
  deleteSession: async (id) => {
    if (get().loading) return;
    const remaining = get().sessions.filter((session) => session.id !== id);
    const sessions = remaining.length ? remaining : [newSession()];
    const activeSessionId = get().activeSessionId === id ? sessions[0].id : get().activeSessionId;
    set({ sessions: sortSessions(sessions), activeSessionId, error: null });
    const saved = await persist(sessions);
    set({ sessions: saved, activeSessionId: nextActiveSessionId(saved, activeSessionId) });
  },
  sendMessage: async (content, attachments = []) => {
    const trimmed = content.trim();
    if (!trimmed && !attachments.length) return;
    const current = activeSession(get()) ?? newSession();
    const userContent = trimmed || "请识别并描述这些图片。";
    const user = newMessage("user", userContent, attachments);
    const assistant = newMessage("assistant", "");
    const nextSession: ChatSession = {
      ...current,
      title: sessionTitle([...current.messages, user]),
      messages: [...current.messages, user, assistant],
      updatedAt: now()
    };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({ sessions, activeSessionId: nextSession.id, loading: true, error: null });
    const saved = await persist(sessions);
    set({ sessions: saved, activeSessionId: nextActiveSessionId(saved, nextSession.id) });
    try {
      const messagesForApi = nextSession.messages.filter((message) => message.role !== "assistant" || message.content);
      const { requestId } = await chatService.send(messagesForApi);
      set({ activeRequestId: requestId });
    } catch (error) {
      get().failMessage(assistant.id, error instanceof Error ? error.message : "发送消息失败");
    }
  },
  generateImage: async (request) => {
    const prompt = request.prompt.trim();
    if (!prompt) {
      set({ error: "请输入 Prompt" });
      return;
    }
    const current = activeSession(get()) ?? newSession();
    const user = newMessage("user", `生成图片：${prompt}`);
    const assistant = newMessage("assistant", "");
    const nextSession: ChatSession = {
      ...current,
      title: sessionTitle([...current.messages, user]),
      messages: [...current.messages, user, assistant],
      updatedAt: now()
    };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({ sessions, activeSessionId: nextSession.id, loading: true, error: null });
    const saved = await persist(sessions);
    set({ sessions: saved, activeSessionId: nextActiveSessionId(saved, nextSession.id) });
    try {
      const { requestId } = await chatService.generateImage({ ...request, prompt });
      set({ activeRequestId: requestId });
    } catch (error) {
      get().failMessage(assistant.id, error instanceof Error ? error.message : "图像生成失败");
    }
  },
  appendDelta: (requestId, delta) => {
    if (get().activeRequestId !== requestId) return;
    const current = activeSession(get());
    if (!current) return;
    const nextSession: ChatSession = {
      ...current,
      messages: current.messages.map((message, index, messages) =>
        index === messages.length - 1 ? { ...message, content: message.content + delta } : message
      ),
      updatedAt: now()
    };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({ sessions });
    void persist(sessions);
  },
  finishMessage: (requestId, content, attachments) => {
    if (get().activeRequestId !== requestId) return;
    const current = activeSession(get());
    if (!current) return;
    const nextSession: ChatSession = {
      ...current,
      messages: current.messages.map((message, index, messages) =>
        index === messages.length - 1 && !message.content
          ? { ...message, content, ...(attachments?.length ? { attachments } : {}) }
          : message
      ),
      updatedAt: now()
    };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({ loading: false, activeRequestId: null, sessions });
    void persist(sessions);
  },
  failMessage: (requestId, message) => {
    const isActiveRequest = get().activeRequestId === requestId;
    const current = activeSession(get());
    if (!current) {
      set({ loading: false, activeRequestId: isActiveRequest ? null : get().activeRequestId, error: message });
      return;
    }
    const nextSession: ChatSession = {
      ...current,
      messages: current.messages.map((item, index, messages) =>
        index === messages.length - 1 ? { ...item, content: message, error: message } : item
      ),
      updatedAt: now()
    };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({
      loading: false,
      activeRequestId: isActiveRequest ? null : get().activeRequestId,
      error: message,
      sessions
    });
    void persist(sessions);
  },
  clear: async () => {
    if (get().loading) return;
    const current = activeSession(get());
    if (!current) return;
    const nextSession: ChatSession = { ...current, title: "新聊天", messages: [], updatedAt: now() };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({ sessions, loading: false, activeRequestId: null, error: null });
    await persist(sessions);
  }
}));
