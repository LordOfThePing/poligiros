import { useEffect, useState } from "react"

/**
 * Like `useState`, but seeded from and mirrored to `localStorage[key]`. Used for
 * things like list filters where a supervisor coming back to a page expects to
 * find it the way she left it — CIC/Tarea/Tipo dropdowns, sort order, active
 * tab. Kept separate from `draft.ts` because those are user-typed content that
 * gets cleared on submit; these just live forever.
 */
const PREFIX = "poligiros.filter."

export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {}
    return initial
  })

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {}
  }, [key, value])

  return [value, setValue]
}
