import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson } from "@/lib/api"
import { AnclasResult } from "@/components/results/AnclasResult"

type PartnerAnclasData = {
  coach: { id: string; name: string }
  completed: boolean
  completedAt?: string
  scores?: Record<string, number> | null
  aiInsight?: string | null
}

/**
 * Reusable "ver las anclas de mi dupla" widget. Picks a partner of the same CIC
 * (or takes one preselected by the caller) and lets the user open their Anclas
 * result to prepare a devolución. Can be embedded in any card that references a
 * dupla partner.
 */
export function DuplaAnclas({
  itemId,
  partnerId,
  partnerLabel,
}: {
  /** The released module item this lives on (used to fetch candidate partners). */
  itemId: string
  /** Optional preselected dupla partner. When omitted, a picker is shown. */
  partnerId?: string
  /** Optional static label for the button (e.g. the partner's name). */
  partnerLabel?: string
}) {
  const { toast } = useToast()
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([])
  const [coacheeId, setCoacheeId] = useState(partnerId ?? "")
  const [anclas, setAnclas] = useState<PartnerAnclasData | null>(null)
  const [loadingAnclas, setLoadingAnclas] = useState(false)
  const [showAnclas, setShowAnclas] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  useEffect(() => {
    if (partnerId) return // preselected, no list needed
    setLoadingCandidates(true)
    apiJson<{ candidates: { id: string; name: string }[] }>(`/student/module-items/${itemId}/dupla`)
      .then((r) => setCandidates(r.candidates))
      .catch(() => {})
      .finally(() => setLoadingCandidates(false))
  }, [itemId, partnerId])

  // Reset whenever the partner changes.
  useEffect(() => {
    setAnclas(null)
    setShowAnclas(false)
  }, [coacheeId])

  async function loadAnclas() {
    if (!coacheeId) return
    setShowAnclas(true)
    if (anclas) return
    setLoadingAnclas(true)
    try {
      setAnclas(await apiJson<PartnerAnclasData>(`/student/coaches/${coacheeId}/anclas`))
    } catch {
      setAnclas(null)
      toast({ title: "No se pudieron ver las anclas de tu dupla", variant: "destructive" })
    }
    setLoadingAnclas(false)
  }

  const partnerName = partnerLabel ?? candidates.find((c) => c.id === coacheeId)?.name

  return (
    <div className="space-y-3">
      {!partnerId && (
        <select
          value={coacheeId}
          onChange={(e) => setCoacheeId(e.target.value)}
          disabled={loadingCandidates}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">Elegí tu compañero/a de dupla</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <button
          onClick={() => (showAnclas ? setShowAnclas(false) : loadAnclas())}
          className="flex items-center gap-2 text-sm text-foreground"
          disabled={!coacheeId}
        >
          {showAnclas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Users className="h-4 w-4 text-brand-accent" />
          Ver las anclas de {partnerName ?? "tu dupla"}
        </button>

        {showAnclas && (
          <div className="mt-3">
            {loadingAnclas ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
              </p>
            ) : anclas?.completed && anclas.scores ? (
              <AnclasResult
                scores={anclas.scores}
                aiInsight={anclas.aiInsight ?? null}
                title={`Anclas de ${partnerName ?? "tu dupla"}`}
                subtitle={
                  anclas.completedAt
                    ? `Test completado el ${formatShortDate(anclas.completedAt)}`
                    : "Resultados según la metodología de Edgar Schein"
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no completó el Test de Anclas de Carrera. Pedile que lo haga
                antes de la sesión: sin eso no vas a poder darle la devolución.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}