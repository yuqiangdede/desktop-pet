import { useEffect, useRef } from "react";
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
          <div className="message__content">{message.content || "..."}</div>
        </div>
      ))}
    </div>
  );
}
