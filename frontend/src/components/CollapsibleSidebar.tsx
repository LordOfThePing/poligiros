import { useEffect, useState, type ReactNode } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "poligiros.sidebar-fixed"

/**
 * The global left nav shell, shared by the supervisor and the coach.
 *
 * Two modes, toggled by the icon button in the header:
 *  - "fixed": always expanded (w-64).
 *  - "auto": shrinks to a narrow icon rail (w-16) and only expands on hover, so
 *    the profile + items can be tucked away without losing quick access.
 *
 * The chosen mode is remembered across reloads. Children receive `expanded`
 * (true when showing labels) so they can hide the text and keep just icons.
 */
export function CollapsibleSidebar({
  roleLabel,
  children,
  footer,
}: {
  roleLabel: string
  children: (args: { expanded: boolean }) => ReactNode
  /** Fixed footer pinned to the bottom (e.g. the profile + logout menu). */
  footer?: (args: { expanded: boolean }) => ReactNode
}) {
  const [fixed, setFixed] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true
    return localStorage.getItem(STORAGE_KEY) !== "auto"
  })
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, fixed ? "fixed" : "auto")
  }, [fixed])

  // Expanded when fixed mode, or when auto mode is hovered open.
  const expanded = fixed || hovering

  return (
    <aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        "shrink-0 bg-white border-r border-border flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-in-out",
        expanded ? "w-64" : "w-16"
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-border",
          expanded ? "justify-between p-4" : "justify-center p-4"
        )}
      >
        {expanded ? (
          <>
            <h1 className="font-serif text-2xl text-brand-accent leading-none">Poligiros</h1>
            <span className="text-xs text-muted-foreground mt-1 hidden lg:block">{roleLabel}</span>
          </>
        ) : (
          <span className="font-serif text-2xl text-brand-accent leading-none">P.</span>
        )}
        <button
          onClick={() => setFixed((v) => !v)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title={fixed ? "Auto-ocultar panel" : "Dejar el panel fijo"}
          aria-label={fixed ? "Auto-ocultar panel" : "Dejar el panel fijo"}
        >
          {fixed ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav is the only scrollable area; the footer stays pinned to the bottom. */}
      <div className={cn("flex-1 overflow-y-auto overflow-x-hidden min-h-0", expanded ? "p-4" : "px-2 py-3")}>
        {children({ expanded })}
      </div>

      {footer && (
        <div className={cn("border-t border-border shrink-0", expanded ? "p-2.5" : "px-2 py-3")}>
          {footer({ expanded })}
        </div>
      )}
    </aside>
  )
}
