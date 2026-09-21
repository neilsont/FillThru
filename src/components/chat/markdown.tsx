"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Assistant replies, rendered. Styled by hand (no typography plugin) to sit on
// the ivory/navy palette.
const components: Components = {
  p: ({ children }) => <p className="leading-7 mb-3 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="text-xl font-bold text-primary mt-5 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-primary mt-5 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-primary mt-4 mb-1.5 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold text-primary mt-3 mb-1 first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-7 [&>p]:mb-1">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/60 pl-4 my-3 text-muted-foreground [&>p]:mb-1">{children}</blockquote>,
  hr: () => <hr className="my-5 border-border/60" />,
  code: ({ className, children }) => (
    <code className={cn("rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.88em] text-foreground", className)}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-[#0c1f3a] p-4 text-[13px] leading-6 text-[#e8e4dc] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary/70 text-left">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold text-primary border-b border-border/60">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 align-top border-b border-border/40 last:border-b-0">{children}</td>,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[15px] text-foreground break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
