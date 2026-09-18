import { createContext, useContext, useEffect, useRef, useState } from "react"

/**
 * localStorage-backed drafts for anything a coach or coachee types and could
 * lose to a refresh, a dead battery or a tab closed by accident.
 *
 * The test pages each grew their own copy of this (see `DRAFT_KEY` in them);
 * this is the same idea packaged so the module cards — registros and entregas
 * — get it too without another hand-rolled pair of effects.
 */
const PREFIX = "poligiros.draft."

/**
 * Fired on `window` after every successful draft write, with the key that was
 * written — the unprefixed one for `writeDraft`/`useDraft`, the raw one for
 * `useAutosave`. `useSaveStatus` listens to it to tell "still typing" apart
 * from "it is on disk".
 */
const SAVED_EVENT = "poligiros:draft-saved"

function announceSaved(key: string) {
  window.dispatchEvent(new CustomEvent<string>(SAVED_EVENT, { detail: key }))
}

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
    announceSaved(key)
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

/*
 * Whole-form autosave, for pages whose state already lives in several
 * `useState`s (Pirámide, Plan Vital, Modelo de Negocio). These use the raw
 * `<name>-draft-<id>` keys those tests wrote before this module existed, so
 * drafts saved by the older hand-rolled code still restore.
 */

export function loadDraft<T = Record<string, unknown>>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function discardDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {}
}

function writeRaw(key: string, serialized: string) {
  try {
    localStorage.setItem(key, serialized)
    announceSaved(key)
  } catch {}
}

/**
 * Persist `value` under `key` while the user types.
 *
 * Writes are debounced by `delay` ms so a long textarea doesn't hit
 * localStorage on every keystroke, and flushed immediately when the tab is
 * hidden or unloaded — so closing/reloading mid-sentence still keeps it.
 *
 * `enabled` must stay false until the form has hydrated (from a stored draft
 * or from the server), otherwise the empty initial state overwrites the draft
 * on mount. Pass false too once the form is submitted or read-only.
 */
export function useAutosave(key: string, value: unknown, enabled = true, delay = 400) {
  let serialized: string | null = null
  try {
    serialized = JSON.stringify(value)
  } catch {
    serialized = null
  }

  const latest = useRef(serialized)
  latest.current = serialized

  useEffect(() => {
    if (!enabled || serialized === null) return
    const t = setTimeout(() => writeRaw(key, serialized), delay)
    return () => clearTimeout(t)
  }, [key, serialized, enabled, delay])

  useEffect(() => {
    if (!enabled) return
    const flush = () => {
      if (latest.current !== null) writeRaw(key, latest.current)
    }
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onHidden)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onHidden)
    }
  }, [key, enabled])
}

/*
 * "Guardando… / Borrador guardado" next to each autosaved field.
 *
 * A field only knows its own value, while the write may cover the whole form
 * (useAutosave) — so the status goes to "saving" when *this* value changes and
 * to "saved" on the next write of *its* draft key. Every writer here debounces
 * by clearing the previous timer, so that next write always includes the
 * change.
 */

export type SaveStatus = "idle" | "saving" | "saved"

/**
 * Lets a form declare its draft key once instead of threading it down to every
 * field (the canvas blocks, the Plan Vital questions…). `enabled` must be false
 * until the form has hydrated: loading a stored draft changes the values too,
 * and that is not the user typing.
 */
export const DraftStatusContext = createContext<{ draftKey: string; enabled: boolean } | null>(null)

export function useSaveStatus(
  value: unknown,
  draftKey?: string | null,
  enabled?: boolean
): SaveStatus {
  const ctx = useContext(DraftStatusContext)
  const key = draftKey ?? ctx?.draftKey ?? null
  const on = Boolean(key) && (enabled ?? ctx?.enabled ?? true)

  let serialized: string
  try {
    serialized = JSON.stringify(value) ?? ""
  } catch {
    serialized = String(value)
  }

  const [status, setStatus] = useState<SaveStatus>("idle")
  // What the field held when tracking (re)started; null = not tracking. It is
  // reset whenever the key changes or tracking turns back on, so hydrating or
  // switching to another card never reads as an edit.
  const baseline = useRef<string | null>(null)
  const trackedKey = useRef(key)
  const pending = useRef(false)

  useEffect(() => {
    if (!on || trackedKey.current !== key) {
      trackedKey.current = key
      baseline.current = on ? serialized : null
      pending.current = false
      setStatus("idle")
      return
    }
    if (baseline.current === null) {
      baseline.current = serialized
      return
    }
    if (serialized === baseline.current) return
    baseline.current = serialized
    pending.current = true
    setStatus("saving")
  }, [on, key, serialized])

  useEffect(() => {
    if (!key) return
    const onSaved = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== key || !pending.current) return
      pending.current = false
      setStatus("saved")
    }
    window.addEventListener(SAVED_EVENT, onSaved)
    return () => window.removeEventListener(SAVED_EVENT, onSaved)
  }, [key])

  return status
}
