import { ArrowUp, Plus } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

interface ChatInputProps {
  disabled: boolean;
  onSend: (content: string) => void;
  onError: (message: string) => void;
}

const textExtensions = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".log",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".yaml",
  ".yml"
];

function isTextFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith("text/") || textExtensions.some((extension) => lowerName.endsWith(extension));
}

export function ChatInput({ disabled, onSend, onError }: ChatInputProps) {
  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const style = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const minHeight = lineHeight * 2;
    const maxHeight = lineHeight * 6;
    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const content = value.trim();
    if (!content) return;
    onSend(content);
    setValue("");
  };

  const attachFile = async (file: File) => {
    if (!isTextFile(file)) {
      onError("仅支持上传文本类型文件");
      return;
    }
    try {
      const text = await file.text();
      const block = `\n\n[文件：${file.name}]\n${text}`;
      setValue((current) => `${current}${block}`.trimStart());
    } catch {
      onError("读取文件失败");
    }
  };

  return (
    <form className="chat-input" onSubmit={submit}>
      <input
        ref={fileInputRef}
        type="file"
        className="chat-input__file"
        accept=".txt,.md,.json,.csv,.log,.xml,.html,.css,.js,.ts,.tsx,.jsx,.yaml,.yml,text/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void attachFile(file);
          event.target.value = "";
        }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        rows={2}
        placeholder="发送消息给模型..."
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) submit(event);
        }}
      />
      <div className="chat-input__actions">
        <button className="chat-input__attach" type="button" disabled={disabled} title="上传文本文件" onClick={() => fileInputRef.current?.click()}>
          <Plus size={20} />
        </button>
        <button className="chat-input__send" type="submit" disabled={disabled || !value.trim()} title="发送">
          <ArrowUp size={18} />
        </button>
      </div>
    </form>
  );
}
