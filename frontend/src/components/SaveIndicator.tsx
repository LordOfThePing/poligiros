import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSaveStatus } from "@/lib/draft"

/**
 * Tiny "Guardando… → Borrador guardado" badge for a field that autosaves its
 * draft to this device. Renders nothing until the field is edited, and nothing
 * outside a draft (no `draftKey` prop and no `DraftStatusContext`), so shared
 * components can carry it and stay silent in read-only / supervisor views.
 */
export function SaveIndicator({
  value,
  draftKey,
  enabled,
  compact,
  className,
}: {
  value: unknown
  draftKey?: string | null
  enabled?: boolean
  /** Icon only (the text moves to the tooltip), for rows with no room for it. */
  compact?: boolean
  className?: string
}) {
  const status = useSaveStatus(value, draftKey, enabled)
  if (status === "idle") return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal text-muted-foreground whitespace-nowrap",
        className
      )}
      title="Respuesta provisoria guardada en este dispositivo. Todavía no está enviada."
      aria-live="polite"
    >
      {status === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> {!compact && "Guardando…"}
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-green-600" /> {!compact && "Borrador guardado"}
        </>
      )}
    </span>
  )
}
