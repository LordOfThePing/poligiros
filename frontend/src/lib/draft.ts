import { useEffect, useRef, useState } from "react"

/**
 * localStorage-backed drafts for anything a coach or coachee types and could
 * lose to a refresh, a dead battery or a tab closed by accident.
 *
 * The test pages each grew their own copy of this (see `DRAFT_KEY` in them);
 * this is the same idea packaged so the module cards — registros and entregas
 * — get it too without another hand-rolled pair of effects.
 */
const PREFIX = "poligiros.draft."

export function readDraft<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw !== null) return JSON.parse(raw) as T
  } catch {}
  return fallback
}

export function writeDraft(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {}
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {}
}

/**
 * localStorage-backed draft for anything a coach or coachee types and could
 * lose to a refresh, a dead battery or a tab closed by accident.
 *
 * The tests each grew their own copy of this (see `DRAFT_KEY` in the test
 * pages); this is the same idea packaged so the module cards — registros and
 * entregas — get it too without another hand-rolled effect pair.
 *
 * Usage:
 *
 *   const [text, setText, clearDraft] = useDraft(`entrega-${item.id}`, item.submission?.text ?? "")
 *
 * `initial` is what the server already has. A stored draft wins over it, since
 * the draft is by definition newer than whatever was last saved — except when
 * the draft is identical, in which case there is nothing to restore.
 */
export function useDraft<T>(
  key: string | null,
  initial: T,
  opts: { debounceMs?: number } = {}
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const { debounceMs = 500 } = opts

  const [value, setValue] = useState<T>(() => (key ? readDraft(key, initial) : initial))

  // Skip the write the initial render would otherwise trigger: it would
  // persist `initial` as a "draft" the user never typed.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!key) return
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    const t = setTimeout(() => writeDraft(key, value), debounceMs)
    return () => clearTimeout(t)
  }, [key, value, debounceMs])

  function clear() {
    if (key) clearDraft(key)
  }

  return [value, setValue, clear]
}
