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
  sendMessage: (content: string, attachments?: ChatAttachment[], modelName?: string) => Promise<void>;
  generateImage: (request: ImageGenerationRequest, modelName?: string) => Promise<void>;
  retryMessage: (messageId: string, modelName?: string) => Promise<void>;
  appendDelta: (requestId: string, delta: string) => void;
  finishMessage: (requestId: string, content: string, attachments?: ChatAttachment[]) => void;
  failMessage: (requestId: string, message: string) => void;
  clear: () => Promise<void>;
}

function now() {
  return Date.now();
}

function newMessage(role: ChatMessage["role"], content: string, attachments?: ChatAttachment[], modelName?: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    ...(modelName ? { modelName } : {}),
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

const deltaFlushDelayMs = 75;
const streamingPersistDelayMs = 2200;
const pendingDeltas = new Map<string, string>();
const deltaFlushTimers = new Map<string, number>();
let streamingPersistTimer: number | null = null;

function clearDeltaState(requestId: string) {
  const timer = deltaFlushTimers.get(requestId);
  if (timer !== undefined) window.clearTimeout(timer);
  deltaFlushTimers.delete(requestId);
  pendingDeltas.delete(requestId);
}

function scheduleStreamingPersist(sessions: ChatSession[]) {
  if (streamingPersistTimer !== null) window.clearTimeout(streamingPersistTimer);
  streamingPersistTimer = window.setTimeout(() => {
    streamingPersistTimer = null;
    void persist(sessions);
  }, streamingPersistDelayMs);
}

function cancelStreamingPersist() {
  if (streamingPersistTimer === null) return;
  window.clearTimeout(streamingPersistTimer);
  streamingPersistTimer = null;
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
  sendMessage: async (content, attachments = [], modelName) => {
    const trimmed = content.trim();
    if (!trimmed && !attachments.length) return;
    const current = activeSession(get()) ?? newSession();
    const userContent = trimmed || "请识别并描述这些图片。";
    const user = newMessage("user", userContent, attachments);
    const assistant = newMessage("assistant", "", undefined, modelName);
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
  generateImage: async (request, modelName) => {
    const prompt = request.prompt.trim();
    if (!prompt) {
      set({ error: "请输入 Prompt" });
      return;
    }
    const current = activeSession(get()) ?? newSession();
    const user = newMessage("user", `生成图片：${prompt}`);
    const assistant = newMessage("assistant", "", undefined, modelName);
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
  retryMessage: async (messageId, modelName) => {
    if (get().loading) return;
    const current = activeSession(get());
    if (!current) return;
    const targetIndex = current.messages.findIndex((message) => message.id === messageId && message.role === "assistant");
    if (targetIndex <= 0) return;
    const previousMessages = current.messages.slice(0, targetIndex);
    if (!previousMessages.some((message) => message.role === "user")) return;
    const assistant = newMessage("assistant", "", undefined, modelName);
    const nextMessages = [...previousMessages, assistant];
    const nextSession: ChatSession = {
      ...current,
      title: sessionTitle(nextMessages),
      messages: nextMessages,
      updatedAt: now()
    };
    const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
    set({ sessions, activeSessionId: nextSession.id, loading: true, activeRequestId: null, error: null });
    const saved = await persist(sessions);
    set({ sessions: saved, activeSessionId: nextActiveSessionId(saved, nextSession.id) });
    try {
      const messagesForApi = previousMessages.filter((message) => message.role !== "assistant" || message.content);
      const { requestId } = await chatService.send(messagesForApi);
      set({ activeRequestId: requestId });
    } catch (error) {
      get().failMessage(assistant.id, error instanceof Error ? error.message : "重试失败");
    }
  },
  appendDelta: (requestId, delta) => {
    pendingDeltas.set(requestId, (pendingDeltas.get(requestId) ?? "") + delta);
    if (deltaFlushTimers.has(requestId)) return;

    const flushTimer = window.setTimeout(() => {
      deltaFlushTimers.delete(requestId);
      if (get().activeRequestId !== requestId) {
        pendingDeltas.delete(requestId);
        return;
      }
      const buffered = pendingDeltas.get(requestId);
      if (!buffered) return;
      pendingDeltas.delete(requestId);

      const current = activeSession(get());
      if (!current) return;
      const nextSession: ChatSession = {
        ...current,
        messages: current.messages.map((message, index, messages) =>
          index === messages.length - 1 ? { ...message, content: message.content + buffered } : message
        ),
        updatedAt: now()
      };
      const sessions = sortSessions([nextSession, ...get().sessions.filter((session) => session.id !== nextSession.id)]);
      set({ sessions });
      scheduleStreamingPersist(sessions);
    }, deltaFlushDelayMs);

    deltaFlushTimers.set(requestId, flushTimer);
  },
  finishMessage: (requestId, content, attachments) => {
    if (get().activeRequestId !== requestId) return;
    clearDeltaState(requestId);
    cancelStreamingPersist();
    const current = activeSession(get());
    if (!current) return;
    const nextSession: ChatSession = {
      ...current,
      messages: current.messages.map((message, index, messages) =>
        index === messages.length - 1
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
    clearDeltaState(requestId);
    cancelStreamingPersist();
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
