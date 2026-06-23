import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-[0.95rem] font-semibold mt-3 mb-2 first:mt-0 text-foreground tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[0.9rem] font-semibold mt-3 mb-1.5 first:mt-0 text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium mt-2.5 mb-1 first:mt-0 text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 last:mb-0 leading-[1.65] text-foreground/95">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2.5 last:mb-0 ml-4 list-disc space-y-1.5 marker:text-primary/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2.5 last:mb-0 ml-4 list-decimal space-y-1.5 marker:text-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.6] pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground/85">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-2 border-primary/50 pl-3 text-muted italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={`${className} font-mono text-xs`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-white/10 px-1.5 py-0.5 text-[0.8em] font-mono text-primary"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-lg bg-black/35 border border-border/60 p-3 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:opacity-90"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border/80" />,
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
