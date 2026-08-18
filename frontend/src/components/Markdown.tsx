import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Markdown renderer for supervisor-authored content (class cards, module
 * descriptions).
 *
 * Every element is mapped explicitly because Tailwind's preflight strips the
 * default styling off headings, lists and blockquotes — without this, `##` and
 * `-` would parse correctly but render as plain paragraphs.
 *
 * Safety: raw HTML is NOT enabled (that needs `rehype-raw`), so anything that
 * looks like a tag is escaped as text, and react-markdown's default URL
 * transform drops `javascript:` hrefs.
 */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`text-sm text-foreground leading-relaxed space-y-3 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-xl text-foreground mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-lg text-foreground mt-4 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-medium text-base text-foreground mt-3 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-medium text-sm text-foreground mt-3 first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent hover:underline break-words"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-brand-accent/40 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-muted rounded-lg p-3 overflow-x-auto text-xs">{children}</pre>
          ),
          hr: () => <hr className="border-border" />,
          // Images embed inline with ![texto](url). Lazy so a class page full of
          // scans does not block on them.
          img: ({ src, alt }) => (
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt ?? ""}
              loading="lazy"
              className="max-w-full h-auto rounded-lg border border-border"
            />
          ),
          // Wide tables scroll inside their own box instead of stretching the card.
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-medium bg-muted/50">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
