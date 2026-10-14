import { useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Dependency-free tooltip. No Radix: we show a positioned bubble on hover
 * (desktop) and on focus/tap (touch). Using the browser's native `title=""`
 * is ruled out across the app, so this is the single tooltip primitive.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string
  children: React.ReactNode
  side?: "top" | "bottom"
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const bubblePos =
    side === "top"
      ? "bottom-full mb-1.5"
      : "top-full mt-1.5"

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md",
          "border border-border bg-white px-2 py-1 text-xs font-normal text-foreground shadow-md",
          "transition-opacity duration-150",
          bubblePos,
          open ? "opacity-100" : "opacity-0",
        )}
      >
        {label}
      </span>
    </span>
  )
}
