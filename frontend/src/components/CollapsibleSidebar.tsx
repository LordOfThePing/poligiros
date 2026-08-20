import { useEffect, useState, type ReactNode } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "poligiros.sidebar-fixed"

/**
 * The global left nav shell, shared by the supervisor and the coach.
 *
 * Two modes, toggled by the icon button in the header:
 *  - "fixed": always expanded (w-64). The default for large screens.
 *  - "auto": shrinks to a narrow icon rail (w-16) and only expands on hover,
 *    floating OVER the page content without shifting it. Default for small
 *    screens / best fit.
 *
 * The chosen mode is remembered across reloads. Children receive `expanded`
 * (true when showing labels) and a `keepOpen` callback so an open dropdown can
 * keep the sidebar expanded (avoids the flicker of collapsing mid-interaction).
 */
export function CollapsibleSidebar({
  roleLabel,
  children,
  footer,
}: {
  roleLabel: string
  children: (args: { expanded: boolean; keepOpen: (open: boolean) => void }) => ReactNode
  /** Fixed footer pinned to the bottom (e.g. the profile + logout menu). */
  footer?: (args: { expanded: boolean; keepOpen: (open: boolean) => void }) => ReactNode
}) {
  const [fixed, setFixed] = useState<boolean>(false)
  const [hovering, setHovering] = useState(false)
  // An open dropdown/popover must keep the sidebar expanded (no flicker).
  const [keepOpen, setKeepOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, fixed ? "fixed" : "auto")
  }, [fixed])

  // Expanded when fixed, or when auto is hovered or an inner menu is open.
  const expanded = fixed || hovering || keepOpen

  return (
    <aside
      onMouseEnter={() => (fixed ? undefined : setHovering(true))}
      onMouseLeave={() => (fixed ? undefined : setHovering(false))}
      className={cn(
        "fixed left-0 inset-y-0 z-40 bg-white border-r border-border flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out",
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
          <div className="min-w-0 leading-tight">
            <h1 className="font-serif text-2xl text-brand-accent leading-none">Poligiros</h1>
            <span className="block text-[0.7rem] text-muted-foreground mt-1.5 truncate">
              {roleLabel}
            </span>
          </div>
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
        {children({ expanded, keepOpen: setKeepOpen })}
      </div>

      {footer && (
        <div
          className={cn(
            "border-t border-border shrink-0 mt-auto",
            expanded ? "p-2.5" : "px-2 py-3"
          )}
        >
          {footer({ expanded, keepOpen: setKeepOpen })}
        </div>
      )}
    </aside>
  )
}
