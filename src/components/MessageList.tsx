import { useEffect, useRef } from "react";
import { MarkdownMessage } from "./MarkdownMessage";
import type { ChatMessage } from "../types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  assistantName: string;
}

export function MessageList({ messages, assistantName }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!messages.length) {
    return <div className="empty-state">开始一段新聊天，消息会自动保存在历史记录中。</div>;
  }

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((message) => (
        <div key={message.id} className={`message message--${message.role} ${message.error ? "message--error" : ""}`}>
          <div className="message__role">{message.role === "user" ? "你" : assistantName}</div>
          <div className="message__content">
            {message.attachments?.length ? (
              <div className="message__attachments">
                {message.attachments.map((attachment) => (
                  <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} title={attachment.name} />
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
  );
}
