import { ArrowUp, Image, Plus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ChatAttachment, ImageGenerationRequest } from "../types/chat";

interface ChatInputProps {
  disabled: boolean;
  visionEnabled: boolean;
  imageGenerationEnabled: boolean;
  onSend: (content: string, attachments?: ChatAttachment[]) => void;
  onGenerateImage: (request: ImageGenerationRequest) => void;
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

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];
const imageMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"]
]);
const maxImagesPerMessage = 4;
const maxImageBytes = 10 * 1024 * 1024;
const imageSizes = [
  { ratio: "1:1", label: "1 : 1", size: "512x512", preview: "square" },
  { ratio: "3:4", label: "3 : 4", size: "768x1024", preview: "portrait-wide" },
  { ratio: "4:3", label: "4 : 3", size: "1024x768", preview: "landscape-tall" },
  { ratio: "9:16", label: "9 : 16", size: "720x1280", preview: "portrait" },
  { ratio: "16:9", label: "16 : 9", size: "1280x720", preview: "landscape" }
] as const;
const fileAccept = [
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
  ".yml",
  "text/*",
  ...imageExtensions,
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp"
].join(",");
const textFileAccept = [
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
  ".yml",
  "text/*"
].join(",");

function isTextFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith("text/") || textExtensions.some((extension) => lowerName.endsWith(extension));
}

function imageExtension(file: File) {
  const lowerName = file.name.toLowerCase();
  return imageExtensions.find((extension) => lowerName.endsWith(extension));
}

function isImageFile(file: File) {
  const extension = imageExtension(file);
  return Boolean(extension) && (!file.type || file.type.startsWith("image/"));
}

function imageMimeType(file: File) {
  return file.type || imageMimeTypes.get(imageExtension(file) ?? "") || "application/octet-stream";
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("读取图片失败"));
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export function ChatInput({ disabled, visionEnabled, imageGenerationEnabled, onSend, onGenerateImage, onError }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [imagePanelOpen, setImagePanelOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedSize, setSelectedSize] = useState<(typeof imageSizes)[number]["size"]>("512x512");
  const [imageCount, setImageCount] = useState(1);
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
    if (!content && !attachments.length) return;
    onSend(content, attachments);
    setValue("");
    setAttachments([]);
  };

  const submitImageGeneration = () => {
    const prompt = imagePrompt.trim();
    if (!prompt) {
      onError("请输入 Prompt");
      return;
    }
    if (!imageGenerationEnabled) {
      onError("请先在设置中启用生图能力");
      return;
    }
    onGenerateImage({
      prompt,
      negativePrompt: negativePrompt.trim(),
      size: selectedSize,
      n: imageCount
    });
    setImagePanelOpen(false);
    setImagePrompt("");
    setNegativePrompt("");
    setImageCount(1);
  };

  const attachFile = async (file: File) => {
    if (isImageFile(file)) {
      if (!visionEnabled) {
        onError("请先在设置中启用识图能力");
        return;
      }
      if (file.size > maxImageBytes) {
        onError("单张图片不能超过 10MB");
        return;
      }
      if (attachments.length >= maxImagesPerMessage) {
        onError("每条消息最多上传 4 张图片");
        return;
      }
      try {
        const dataUrl = await readAsDataUrl(file);
        setAttachments((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: imageMimeType(file),
            size: file.size,
            dataUrl
          }
        ]);
      } catch {
        onError("读取图片失败");
      }
      return;
    }

    if (!isTextFile(file)) {
      onError("仅支持上传文本文件或常见图片格式");
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
    <div className="chat-input-wrap">
      {imageGenerationEnabled && imagePanelOpen && (
        <div className="image-generator-popover">
          <div className="image-generator-panel">
            <label>
              Prompt
              <textarea
                value={imagePrompt}
                disabled={disabled}
                rows={3}
                placeholder="描述你想生成的图片"
                onChange={(event) => setImagePrompt(event.target.value)}
              />
            </label>
            <label>
              Negative Prompt
              <textarea
                value={negativePrompt}
                disabled={disabled}
                rows={2}
                placeholder="描述你想排除的元素"
                onChange={(event) => setNegativePrompt(event.target.value)}
              />
            </label>
            <div className="image-generator-panel__meta-row">
              <div className="image-generator-panel__field">
                <span>图片比例</span>
                <div className="image-ratio-grid">
                  {imageSizes.map((option) => (
                    <button
                      key={option.size}
                      type="button"
                      className={selectedSize === option.size ? "image-ratio image-ratio--active" : "image-ratio"}
                      disabled={disabled}
                      onClick={() => setSelectedSize(option.size)}
                    >
                      <span className={`image-ratio__preview image-ratio__preview--${option.preview}`} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="image-generator-panel__resolution">
                分辨率
                <select
                  value={selectedSize}
                  disabled={disabled}
                  onChange={(event) => setSelectedSize(event.target.value as (typeof imageSizes)[number]["size"])}
                >
                  {imageSizes.map((option) => (
                    <option key={option.size} value={option.size}>
                      {option.size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              图片数量
              <div className="image-count-row">
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={imageCount}
                  disabled={disabled}
                  onChange={(event) => setImageCount(Number(event.target.value))}
                />
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={imageCount}
                  disabled={disabled}
                  onChange={(event) => setImageCount(Math.min(4, Math.max(1, Number(event.target.value) || 1)))}
                />
              </div>
            </label>
            <button
              className="image-generator-panel__submit"
              type="button"
              disabled={disabled || !imageGenerationEnabled}
              onClick={submitImageGeneration}
            >
              <Image size={16} /> 生成图片
            </button>
          </div>
        </div>
      )}
      <form className="chat-input" onSubmit={submit}>
      <input
        ref={fileInputRef}
        type="file"
        className="chat-input__file"
        accept={visionEnabled ? fileAccept : textFileAccept}
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          const imageCount = files.filter(isImageFile).length;
          if (!visionEnabled && imageCount > 0) {
            onError("请先在设置中启用识图能力");
            event.target.value = "";
            return;
          }
          if (attachments.length + imageCount > maxImagesPerMessage) {
            onError("每条消息最多上传 4 张图片");
            event.target.value = "";
            return;
          }
          for (const file of files) {
            void attachFile(file);
          }
          event.target.value = "";
        }}
      />
      {attachments.length > 0 && (
        <div className="chat-input__attachments" aria-label="已选择图片">
          {attachments.map((attachment) => (
            <div className="chat-input__attachment" key={attachment.id}>
              <img src={attachment.dataUrl} alt={attachment.name} />
              <button
                type="button"
                title={`移除 ${attachment.name}`}
                disabled={disabled}
                onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
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
        <div className="chat-input__left-actions">
          <button className="chat-input__attach" type="button" disabled={disabled} title="上传文件/图片" onClick={() => fileInputRef.current?.click()}>
            <Plus size={20} />
          </button>
          {imageGenerationEnabled && (
            <button
              className={imagePanelOpen ? "chat-input__image is-active" : "chat-input__image"}
              type="button"
              disabled={disabled}
              title="图像生成"
              onClick={() => setImagePanelOpen((open) => !open)}
            >
              <Image size={18} />
            </button>
          )}
        </div>
        <button className="chat-input__send" type="submit" disabled={disabled || (!value.trim() && !attachments.length)} title="发送">
          <ArrowUp size={18} />
        </button>
      </div>
      </form>
    </div>
  );
}
