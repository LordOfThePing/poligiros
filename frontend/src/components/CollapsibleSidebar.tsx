import { useEffect, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useSidebarMode } from "@/lib/sidebarMode"

/**
 * The global left nav shell, shared by the supervisor and the coach.
 *
 * Desktop (`lg` and up) — two modes, toggled by the icon button in the header:
 *  - "fixed": always expanded (w-64). The default for large screens.
 *  - "auto": shrinks to a narrow icon rail (w-16) and only expands on hover,
 *    floating OVER the page content without shifting it.
 *
 * Below `lg` there is no hover, so the rail would just sit permanently
 * collapsed (or, worse, permanently expanded and overlapping content if
 * "fixed" was set from a desktop session). Instead mobile gets the pattern
 * apps use there: the rail is hidden entirely, a hamburger button floats
 * top-left, and tapping it slides the full nav in as a Sheet over the page.
 * It closes itself on navigation.
 *
 * The chosen desktop mode is remembered across reloads. Children receive
 * `expanded` (true when showing labels) and a `keepOpen` callback so an open
 * dropdown can keep the rail expanded (avoids the flicker of collapsing
 * mid-interaction) — meaningless in the mobile sheet, where labels always show.
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
  const { fixed, setFixed } = useSidebarMode()
  const [hovering, setHovering] = useState(false)
  // An open dropdown/popover must keep the sidebar expanded (no flicker).
  const [keepOpen, setKeepOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever a nav link is followed.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Expanded when fixed, or when auto is hovered or an inner menu is open.
  const expanded = fixed || hovering || keepOpen

  const noopKeepOpen = () => {}

  return (
    <>
      {/* Mobile top bar — the only chrome visible below lg. */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-white px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-foreground"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-serif text-xl text-brand-accent leading-none">Poligiros</span>
        <span className="ml-auto truncate text-xs text-muted-foreground">{roleLabel}</span>
      </div>

      {/* Desktop rail — hidden below lg. */}
      <aside
        onMouseEnter={() => (fixed ? undefined : setHovering(true))}
        onMouseLeave={() => (fixed ? undefined : setHovering(false))}
        className={cn(
          "hidden lg:flex fixed left-0 inset-y-0 z-40 bg-white border-r border-border flex-col overflow-hidden transition-[width] duration-200 ease-in-out",
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

      {/* Mobile drawer — full nav, always "expanded", slides over the page. */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
          <SheetTitle className="sr-only">Menú de {roleLabel}</SheetTitle>
          <div className="p-4 border-b border-border">
            <h1 className="font-serif text-2xl text-brand-accent leading-none">Poligiros</h1>
            <span className="block text-[0.7rem] text-muted-foreground mt-1.5">{roleLabel}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children({ expanded: true, keepOpen: noopKeepOpen })}
          </div>
          {footer && (
            <div className="border-t border-border p-2.5 shrink-0">
              {footer({ expanded: true, keepOpen: noopKeepOpen })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
