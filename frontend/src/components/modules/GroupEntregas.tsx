import { useEffect, useState } from "react"
import { Loader2, Users } from "lucide-react"
import { apiJson } from "@/lib/api"
import { formatShortDate } from "@/lib/date"
import { Markdown } from "@/components/Markdown"

type GroupEntrega = {
  id: string
  text: string
  submittedAt: string
  coach: { id: string; name: string }
}

/**
 * Item 1: ENTRETA cards are shared within the CIC — every coach can read the
 * entregas of their peers. Lists them read-only under the coach's own entrega.
 */
export function GroupEntregas({ itemId }: { itemId: string }) {
  const [items, setItems] = useState<GroupEntrega[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiJson<GroupEntrega[]>(`/student/module-items/${itemId}/group-submissions`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [itemId])

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando entregas del grupo...
      </p>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-brand-accent" />
        <p className="text-sm font-medium text-foreground">Entregas del grupo (tu CIC)</p>
      </div>
      <div className="space-y-3">
        {items.map((s) => (
          <div key={s.id} className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">
              <strong className="text-foreground">{s.coach.name}</strong> · entregó el {formatShortDate(s.submittedAt)}
            </p>
            <Markdown>{s.text}</Markdown>
          </div>
        ))}
      </div>
    </div>
  )
}
