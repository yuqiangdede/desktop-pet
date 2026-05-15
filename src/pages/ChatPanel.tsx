import { useEffect, useMemo, useState } from "react";
import { History, MessageSquarePlus, Minus, Trash2 } from "lucide-react";
import { ChatInput } from "../components/ChatInput";
import { MessageList } from "../components/MessageList";
import { openaiClient } from "../services/openaiClient";
import { useChatStore } from "../store/chatStore";
import { useConfigStore } from "../store/configStore";
import { getActiveModelConfig } from "../types/config";

function formatSessionTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    activeRequestId,
    loading,
    error,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    sendMessage,
    generateImage,
    retryMessage,
    appendDelta,
    finishMessage,
    failMessage,
    clear
  } = useChatStore();
  const { config, load, save, subscribeToChanges } = useConfigStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    subscribeToChanges();
    load();
    loadSessions();
  }, [load, loadSessions, subscribeToChanges]);

  useEffect(() => {
    const offDelta = openaiClient.onDelta(({ requestId, delta }) => appendDelta(requestId, delta));
    const offDone = openaiClient.onDone(({ requestId, content, attachments }) => finishMessage(requestId, content, attachments));
    const offError = openaiClient.onError(({ requestId, message }) => failMessage(requestId, message));
    return () => {
      offDelta();
      offDone();
      offError();
    };
  }, [appendDelta, failMessage, finishMessage]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );
  const assistantName = config?.petName.trim() || "桌宠";
  const activeModel = config ? getActiveModelConfig(config) : null;
  const modelName = activeModel?.name.trim() || activeModel?.model.trim() || "未配置模型";
  const visionEnabled = Boolean(activeModel?.capabilities.vision);
  const imageGenerationEnabled = Boolean(activeModel?.capabilities.image);
  const visibleError = inputError || error;

  return (
    <main className="chat-shell">
      <header className="panel-header">
        <div>
          <h1>聊天</h1>
          {config && config.models.length > 1 ? (
            <select
              className="model-switch"
              value={activeModel?.id ?? config.activeModelId}
              disabled={loading || Boolean(activeRequestId)}
              title="切换模型"
              onChange={(event) => void save({ activeModelId: event.target.value })}
            >
              {config.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name || model.model || "未命名模型"}
                </option>
              ))}
            </select>
          ) : (
            <p>{loading ? "正在回复" : modelName}</p>
          )}
        </div>
        <div className="header-actions">
          <button
            type="button"
            title="历史记录"
            className={historyOpen ? "is-active" : ""}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History size={16} />
          </button>
          <button type="button" title="新聊天" disabled={loading} onClick={createSession}>
            <MessageSquarePlus size={16} />
          </button>
          <button type="button" title="清空当前聊天" disabled={loading} onClick={() => void clear()}>
            <Trash2 size={16} />
          </button>
          <button type="button" title="最小化聊天" onClick={() => window.desktopPet.window.toggleChat()}>
            <Minus size={16} />
          </button>
        </div>
      </header>

      <section className={`history-drawer ${historyOpen ? "history-drawer--open" : ""}`}>
        <div className="history-drawer__header">
          <span>历史记录</span>
          <button type="button" disabled={loading} onClick={createSession}>
            新聊天
          </button>
        </div>
        <div className="history-list">
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={`history-item ${session.id === activeSessionId ? "history-item--active" : ""}`}
              disabled={loading}
              onClick={() => {
                selectSession(session.id);
                setHistoryOpen(false);
              }}
            >
              <span>{session.title}</span>
              <small>{formatSessionTime(session.updatedAt)}</small>
              <Trash2
                size={14}
                onClick={(event) => {
                  event.stopPropagation();
                  if (loading) return;
                  void deleteSession(session.id);
                }}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="chat-content">
        {visibleError && <div className="error-banner">{visibleError}</div>}
        <MessageList
          messages={activeSession?.messages ?? []}
          assistantName={assistantName}
          retrying={loading || Boolean(activeRequestId)}
          streaming={Boolean(activeRequestId)}
          onRetry={(messageId) => {
            setInputError(null);
            void retryMessage(messageId, modelName);
          }}
        />
      </section>
      <ChatInput
        disabled={loading || Boolean(activeRequestId)}
        visionEnabled={visionEnabled}
        imageGenerationEnabled={imageGenerationEnabled}
        onSend={(content, attachments) => {
          setInputError(null);
          void sendMessage(content, attachments, modelName);
        }}
        onGenerateImage={(request) => {
          setInputError(null);
          void generateImage(request, modelName);
        }}
        onError={setInputError}
      />
    </main>
  );
}
