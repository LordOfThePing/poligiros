import { useState } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

// Dependency-free per-block hint: reveals `text` in a small bubble on hover
// (desktop) and on click/focus (touch). No Radix Tooltip/Popover is installed.
export function InfoHint({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        aria-label="Ver la consigna de este bloque"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-lg",
          "border border-border bg-white px-3 py-2 text-left text-xs font-normal leading-snug text-foreground shadow-lg",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          open && "opacity-100"
        )}
      >
        {text}
      </span>
    </span>
  )
}
