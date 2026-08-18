import { ExternalLink, FileText } from "lucide-react"
import { KIND_BADGE, KIND_LABEL, formatBytes, type ModuleItem } from "@/lib/modules"
import { Markdown } from "@/components/Markdown"

/**
 * Read-only render of a module's cards. Used on the student's class page and as
 * the supervisor's preview, so both always see the same thing.
 */
export function ModuleItemList({ items }: { items: ModuleItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay contenido en esta clase.</p>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium text-foreground">{item.title}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${KIND_BADGE[item.kind]}`}
            >
              {KIND_LABEL[item.kind]}
            </span>
          </div>

          {item.description && <Markdown>{item.description}</Markdown>}

          {item.links.length > 0 && (
            <div className="space-y-1.5">
              {item.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-brand-accent hover:underline break-all"
                >
                  {link.storageKey ? (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {link.title}
                  {link.sizeBytes != null && (
                    <span className="text-muted-foreground text-xs shrink-0">
                      {formatBytes(link.sizeBytes)}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
