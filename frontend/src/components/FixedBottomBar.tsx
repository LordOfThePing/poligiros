import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A bar pinned to the bottom of the viewport that never covers the content
 * above it.
 *
 * Because the bar is `fixed` it takes no room in the flow, and a hardcoded
 * `pb-*` on the page cannot keep up with it: it stacks on narrow screens, grows
 * with the safe-area inset, and gains a second button on some steps. So it
 * measures itself and renders a spacer of exactly that height in the flow —
 * the last rows of a form can never end up underneath it.
 */
export function FixedBottomBar({
  children,
  className,
  innerClassName,
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
}) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    setHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <div aria-hidden style={{ height }} />
      <div
        ref={barRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 backdrop-blur px-4 pt-3 z-10",
          className,
        )}
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className={cn("max-w-5xl mx-auto", innerClassName)}>{children}</div>
      </div>
    </>
  )
}
