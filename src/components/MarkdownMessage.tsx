import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import mermaid from "mermaid";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
}

interface CodeElementProps {
  className?: string;
  children?: ReactNode;
}

let mermaidInitialized = false;
let mermaidRenderId = 0;

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
      <pre className="markdown-code markdown-code--fallback">
        <code>{chart}</code>
      </pre>
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
    return <pre className="markdown-code">{children}</pre>;
  }
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content || "..."}
      </ReactMarkdown>
    </div>
  );
}
