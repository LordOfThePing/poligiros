import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Inline loading indicator used while data is being fetched, so a page never
 * flashes an "empty" state (or a stale value) before the request resolves.
 *
 * Use a full-width variant when it replaces a whole list block, or the compact
 * variant for small placeholders.
 */
export function LoadingBadge({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-muted-foreground",
        compact ? "py-2" : "py-12",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Cargando...</span>
    </div>
  )
}
