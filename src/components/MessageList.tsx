import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import type { ChatAttachment, ChatMessage } from "../types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  assistantName: string;
  retrying: boolean;
  onRetry: (messageId: string) => void;
}

export function MessageList({ messages, assistantName, retrying, onRetry }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<ChatAttachment | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  if (!messages.length) {
    return <div className="empty-state">开始一段新聊天，消息会自动保存在历史记录中。</div>;
  }

  return (
    <>
      <div className="message-list" ref={listRef}>
        {messages.map((message) => (
          <div key={message.id} className={`message message--${message.role} ${message.error ? "message--error" : ""}`}>
            <div className="message__meta">
              <div className="message__role">
                <span>{message.role === "user" ? "你" : assistantName}</span>
                {message.role === "assistant" && message.modelName ? (
                  <span className="message__model" title={`模型：${message.modelName}`}>
                    {message.modelName}
                  </span>
                ) : null}
              </div>
              {message.role === "assistant" ? (
                <button
                  type="button"
                  className="message__retry"
                  disabled={retrying}
                  title={message.error ? "重试" : "重新生成"}
                  aria-label={message.error ? "重试这条回复" : "重新生成这条回复"}
                  onClick={() => onRetry(message.id)}
                >
                  <RotateCcw size={14} />
                </button>
              ) : null}
            </div>
            <div className="message__content">
              {message.attachments?.length ? (
                <div className="message__attachments">
                  {message.attachments.map((attachment) => (
                    <button
                      type="button"
                      className="message__attachment-preview"
                      key={attachment.id}
                      title={`查看 ${attachment.name}`}
                      aria-label={`放大查看 ${attachment.name}`}
                      onClick={() => setPreview(attachment)}
                    >
                      <img src={attachment.dataUrl} alt={attachment.name} />
                    </button>
                  ))}
                </div>
              ) : null}
              {message.role === "assistant" && !message.error ? (
                <MarkdownMessage content={message.content} />
              ) : (
                message.content || (message.attachments?.length ? "" : "...")
              )}
            </div>
          </div>
        ))}
      </div>
      {preview ? (
        <div className="image-preview" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}>
          <button
            type="button"
            className="image-preview__close"
            title="关闭"
            aria-label="关闭图片预览"
            onClick={() => setPreview(null)}
          >
            <X size={18} />
          </button>
          <img src={preview.dataUrl} alt={preview.name} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </>
  );
}
