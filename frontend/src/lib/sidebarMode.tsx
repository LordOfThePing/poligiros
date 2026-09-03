import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const STORAGE_KEY = "poligiros.sidebar-fixed"

/**
 * Whether the desktop sidebar is pinned open (`fixed`, w-64) or shrinks to an
 * icon rail that only expands on hover (`auto`, w-16). Lives in a context —
 * not local state inside CollapsibleSidebar — because the page layout
 * (App.tsx) also needs it to know how much to offset the main content.
 */
type SidebarModeContextType = {
  fixed: boolean
  setFixed: (value: boolean | ((prev: boolean) => boolean)) => void
}

const SidebarModeContext = createContext<SidebarModeContextType | null>(null)

export function SidebarModeProvider({ children }: { children: ReactNode }) {
  const [fixed, setFixed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "fixed"
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, fixed ? "fixed" : "auto")
    } catch {
      /* private mode / storage disabled — the choice just won't persist */
    }
  }, [fixed])

  return (
    <SidebarModeContext.Provider value={{ fixed, setFixed }}>
      {children}
    </SidebarModeContext.Provider>
  )
}

export function useSidebarMode() {
  const ctx = useContext(SidebarModeContext)
  if (!ctx) throw new Error("useSidebarMode must be used inside SidebarModeProvider")
  return ctx
}
