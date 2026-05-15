import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import mermaid from "mermaid";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

interface MarkdownMessageProps {
  content: string;
}

interface CodeElementProps {
  className?: string;
  children?: ReactNode;
}

let mermaidInitialized = false;
let mermaidRenderId = 0;
const longContentThreshold = 10000;
const collapsedPreviewLength = 6000;
const remarkPlugins = [remarkGfm];

function initializeMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default"
  });
  mermaidInitialized = true;
}

function codeText(children: ReactNode) {
  return Children.toArray(children).join("").replace(/\n$/, "");
}

function mermaidCodeFromPre(children: ReactNode) {
  const child = Children.toArray(children)[0];
  if (!isValidElement<CodeElementProps>(child)) return null;
  const language = /language-(\S+)/.exec(child.props.className ?? "")?.[1]?.toLowerCase();
  return language === "mermaid" ? codeText(child.props.children) : null;
}

function codeFromPre(children: ReactNode) {
  const child = Children.toArray(children)[0];
  if (!isValidElement<CodeElementProps>(child)) return codeText(children);
  return codeText(child.props.children);
}

function CopyableCodeBlock({ children, fallback = false }: { children: ReactNode; fallback?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const text = codeFromPre(children);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    await window.desktopPet.clipboard.writeText(text);
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`markdown-code-wrap ${fallback ? "markdown-code-wrap--fallback" : ""}`}>
      <button
        type="button"
        className="markdown-code-copy"
        title={copied ? "已复制" : "复制代码"}
        aria-label={copied ? "代码已复制" : "复制代码"}
        onClick={handleCopy}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? "已复制" : "复制"}</span>
      </button>
      <pre className={`markdown-code ${fallback ? "markdown-code--fallback" : ""}`}>{children}</pre>
    </div>
  );
}

function MermaidBlock({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const instanceId = useRef(++mermaidRenderId);

  useEffect(() => {
    let active = true;
    const renderId = `mermaid-${instanceId.current}-${Date.now()}`;

    async function renderChart() {
      try {
        initializeMermaid();
        const result = await mermaid.render(renderId, chart);
        if (!active) return;
        setSvg(result.svg);
        setFailed(false);
      } catch {
        if (!active) return;
        setSvg(null);
        setFailed(true);
      }
    }

    void renderChart();
    return () => {
      active = false;
    };
  }, [chart]);

  if (failed) {
    return (
      <CopyableCodeBlock fallback>
        <code>{chart}</code>
      </CopyableCodeBlock>
    );
  }

  if (!svg) {
    return <div className="mermaid-chart mermaid-chart--loading">正在渲染图表...</div>;
  }

  return <div className="mermaid-chart" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const markdownComponents: Components = {
  a({ children, ...props }) {
    return (
      <a {...props} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  pre({ children }) {
    const chart = mermaidCodeFromPre(children);
    if (chart !== null) return <MermaidBlock chart={chart} />;
    return <CopyableCodeBlock>{children}</CopyableCodeBlock>;
  }
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > longContentThreshold;
  const shouldCollapse = isLong && !expanded;
  const visibleContent = shouldCollapse ? content.slice(0, collapsedPreviewLength) : content;

  useEffect(() => {
    setExpanded(false);
  }, [content]);

  if (shouldCollapse) {
    return (
      <div className="markdown-content">
        <div className="markdown-preview-text">{visibleContent}</div>
        <button type="button" className="message__expand" onClick={() => setExpanded(true)}>
          展开全文
        </button>
      </div>
    );
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
        {visibleContent || "..."}
      </ReactMarkdown>
      {isLong ? (
        <button type="button" className="message__expand" onClick={() => setExpanded(false)}>
          收起长文
        </button>
      ) : null}
    </div>
  );
}
