import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { groupRankedAnchors, podiumAnchors } from "@/lib/anclas"

/**
 * The Anclas results screen.
 *
 * Shared on purpose: this is what the coach/coachee sees the moment they finish
 * the test AND what they see whenever they reopen it later. It used to be
 * duplicated — the end-of-test screen had the cards, bars and insight, while the
 * read-only view fell back to a bare ranked list — so the same data looked like
 * two different results.
 */

export const ANCHOR_INFO: Record<string, { name: string; description: string; icon: string }> = {
  TF: { name: "Técnico/Funcional", icon: "🔬", description: "Tu identidad profesional está ligada al dominio de un área específica. Buscás ser experto/a reconocido/a." },
  GG: { name: "Gerencia General", icon: "🏢", description: "Te motiva liderar organizaciones complejas, integrar personas y tomar decisiones de alto impacto." },
  AU: { name: "Autonomía", icon: "🦅", description: "Valorás la libertad de trabajar a tu manera. La autonomía es innegociable para vos." },
  SE: { name: "Seguridad/Estabilidad", icon: "⚓", description: "Priorizás entornos predecibles y seguros. La estabilidad te permite dar lo mejor de vos." },
  CE: { name: "Creativo-Emprendedor", icon: "🚀", description: "Te impulsa crear algo propio. Encontrás satisfacción en construir desde cero." },
  SC: { name: "Servicio a la Causa", icon: "🌿", description: "El propósito y el impacto en otros son centrales. Querés que tu trabajo tenga significado mayor." },
  PD: { name: "Puro Desafío", icon: "⚡", description: "Los problemas complejos te energizan. Necesitás un trabajo que desafíe constantemente tus capacidades." },
  EV: { name: "Estilo de Vida", icon: "⚖️", description: "Buscás integrar armoniosamente lo profesional y lo personal. Tu bienestar integral no es negociable." },
}

export const ANCHOR_ORDER = ["TF", "GG", "AU", "SE", "CE", "SC", "PD", "EV"]

export function AnclasResult({
  scores,
  aiInsight,
  loadingInsight = false,
}: {
  scores: Record<string, number>
  aiInsight: string | null
  /** Only while the test is being finished; on a stored result it is never true. */
  loadingInsight?: boolean
}) {
  // The average can exceed 6 (bonus items add +4), so bars scale to the top
  // anchor rather than to a fixed /6 max.
  const topScore = Math.max(...Object.values(scores), 1)
  // Anchors that earn the 🏆 (top 3 ranks; a tie at a rank includes all of it).
  const podium = podiumAnchors(scores, ANCHOR_ORDER)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl text-foreground mb-1">Tus Anclas de Carrera</h2>
        <p className="text-sm text-muted-foreground">
          Resultados según la metodología de Edgar Schein
        </p>
      </div>

      <div className="space-y-3">
        {/* Dense ranking: tied anchors share a rank and sit side by side. */}
        {groupRankedAnchors(scores, ANCHOR_ORDER).map((group) => {
          const isTop = group.rank === 1
          const isPodium = group.anchors.every((a) => podium.has(a))
          const tied = group.anchors.length > 1
          return (
            <div
              key={group.rank}
              className={cn(
                "bg-white rounded-xl border border-border p-5",
                isPodium && "border-brand-accent/50 shadow-sm"
              )}
            >
              <div className="flex items-start gap-4">
                {/* The rank column: a 🏆 marks a podium rank (1, 2, 3); a tie
                    qualifies the position, not any one anchor, so it shows once
                    here instead of repeating on every card. */}
                <div className="flex flex-col items-center gap-1.5 shrink-0 w-8">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-base",
                      isPodium ? "bg-brand-accent text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPodium ? "🏆" : group.rank}
                  </div>
                  {tied && (
                    <span className="text-[10px] leading-tight text-muted-foreground text-center">
                      empate
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-4">
                  <div className={cn("grid gap-x-6 gap-y-4", tied && "sm:grid-cols-2")}>
                    {group.anchors.map((anchor) => {
                      const info = ANCHOR_INFO[anchor]
                      return (
                        <div key={anchor} className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPodium && <span className="text-base">🏆</span>}
                            <span className="text-lg">{info.icon}</span>
                            <span className="font-semibold text-foreground">{info.name}</span>
                            <Badge variant="outline" className="text-xs">{anchor}</Badge>
                            {isTop && (
                              <Badge className="bg-brand-accent text-white hover:bg-brand-accent text-xs">
                                1er ancla
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* One bar for the whole group: every anchor in it scored the
                      same, so drawing it per anchor repeated the same value and
                      made equal scores look different. */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Puntuación{tied ? " compartida" : ""}</span>
                      <span className="font-medium text-foreground">{group.score}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-brand-accent rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${(group.score / topScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {(loadingInsight || aiInsight) && (
        <div className="rounded-xl bg-gray-900 text-gray-100 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">Insight personalizado</span>
          </div>
          {loadingInsight ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn("h-4 bg-gray-700 rounded animate-pulse", i === 3 && "w-2/3")}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{aiInsight}</p>
          )}
        </div>
      )}
    </div>
  )
}
