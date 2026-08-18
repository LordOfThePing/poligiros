import { useEffect, useState } from "react"
import { apiJson } from "@/lib/api"
import type { CoachAccess } from "@/lib/access"

/**
 * What the logged-in coach is allowed to do, from GET /student/access.
 *
 * Starts as `null` (still loading) so callers can avoid flashing a "no tenés
 * permiso" state before the answer arrives. These are conveniences only — the
 * backend enforces the same rules on every write.
 */
export function useCoachAccess(): { access: CoachAccess | null; loading: boolean } {
  const [access, setAccess] = useState<CoachAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiJson<CoachAccess>("/student/access")
      .then((a) => { if (!cancelled) { setAccess(a); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { access, loading }
}
