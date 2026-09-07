// Pure scoring helpers for the Anclas de Carrera test. Kept out of the page
// component so they can be unit-tested without rendering React.

export type BonusCandidate = { idx: number; val: number }

/**
 * Select the items offered in Step 2 ("bonus" selection).
 *
 * Tier walk: start at score 6 and drop one tier at a time until at least
 * `minCount` items qualify.
 *
 *   count(val == 6) >= minCount        → only the 6s
 *   else count(val >= 5) >= minCount   → the 6s + 5s
 *   else count(val >= 4) >= minCount   → the 6s + 5s + 4s
 *   ... and so on down to 1.
 *
 * If no tier reaches `minCount`, fall back to every item sorted descending so
 * the user always has something to pick from. `null` answers count as 0.
 */
export function selectBonusCandidates(
  answers: (number | null)[],
  minCount = 3,
): BonusCandidate[] {
  const scored: BonusCandidate[] = answers.map((val, idx) => ({ idx, val: val ?? 0 }))
  for (let minScore = 6; minScore >= 1; minScore--) {
    const candidates = scored
      .filter((x) => x.val >= minScore)
      .sort((a, b) => b.val - a.val)
    if (candidates.length >= minCount) return candidates
  }
  return [...scored].sort((a, b) => b.val - a.val)
}

export type RankGroup = { rank: number; score: number; anchors: string[] }

/**
 * Group anchors into a DENSE ranking: anchors with the same score share one
 * rank position (and render side by side), and the list shortens on ties
 * (1, 2, 3 over groups — not 1, 1, 3). Within a tie, anchors keep the order
 * given by `order` (defaults to the object's key order) for stable display.
 */
export function groupRankedAnchors(
  scores: Record<string, number>,
  order?: string[],
): RankGroup[] {
  const keys = (order ?? Object.keys(scores)).filter((k) => k in scores)
  const sorted = [...keys].sort((a, b) => scores[b] - scores[a])
  const groups: RankGroup[] = []
  for (const anchor of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.score === scores[anchor]) {
      last.anchors.push(anchor)
    } else {
      groups.push({ rank: groups.length + 1, score: scores[anchor], anchors: [anchor] })
    }
  }
  return groups
}

/**
 * Which anchors earn the 🏆 on the results screen.
 *
 * The trophy marks the podium across ranks 1, 2, 3. A tie includes ALL its
 * anchors (never split), and a tie sitting before the 3rd position cuts the
 * podium short there — so a tie in 1st or 2nd stops the trophies (a later 3rd
 * does NOT get the 🏆), while a tie in 3rd still gets the trophy on all its
 * cards.
 *
 *   singles 1-2-3            → trophies on ranks 1, 2, 3
 *   tie in 1st or 2nd        → trophies stop at the tie (no 3rd)
 *   tie in 3rd               → trophies on 1, 2, and all tied 3rds
 */
export function podiumAnchors(
  scores: Record<string, number>,
  order?: string[],
  max = 3,
): Set<string> {
  const groups = groupRankedAnchors(scores, order)
  const result = new Set<string>()
  for (const g of groups) {
    if (g.rank > max) break
    g.anchors.forEach((a) => result.add(a))
    // A tie earlier than the last podium slot stops the run.
    if (g.anchors.length > 1 && g.rank < max) break
  }
  return result
}

/* ─── Questionnaire + scoring ──────────────────────────────────────────────
   Shared by the test itself and by the post-review editor, which re-asks the
   same 40 statements and recomputes scores/ranking from the answers. */

export const QUESTIONS = [
  "Sueño con ser tan bueno en lo que hago que mi consejo será requerido continuamente.",
  "Me siento más satisfecho / realizado en mi trabajo cuando siento que logré integrar y optimizar los esfuerzos de otros.",
  "Sueño con tener una carrera que me permita la libertad de trabajar independientemente y con planificación propia.",
  "La seguridad y la estabilidad son más importantes para mi que la libertad y la autonomía.",
  "Estoy siempre buscando ideas o proyectos que me permitan encarar un emprendimiento propio.",
  "Voy a sentirme exitoso en mi carrera solo si siento que he hecho una contribución a la comunidad.",
  "Sueño con tener una carrera que me permita resolver problemas o salir adelante en situaciones extremadamente desafiantes.",
  "Cambiaría de empresa antes que asumir una responsabilidad que comprometiera mis objetivos personales y familiares.",
  "Voy a sentirme exitoso en mi carrera sólo si puedo desarrollar mis habilidades técnicas o funcionales hasta el nivel más alto de competencia.",
  "Sueño con estar a cargo de una organización compleja y con tomar decisiones que involucren a muchas personas.",
  "Me siento más cómodo en mi trabajo cuando tengo libertad absoluta para definir tareas, procedimientos y planes.",
  "Cambiaría de empresa antes que aceptar una posición que pusiera en juego mi seguridad en esa organización.",
  "Armar mi propia empresa es más importante para mí que lograr una posición ejecutiva en una organización.",
  "Me siento más realizado en mi carrera si puedo poner mi talento al servicio de otros.",
  "Voy a sentirme exitoso en mi carrera sólo si enfrento y resuelvo desafíos muy complejos.",
  "Sueño una carrera que me permitirá integrar mis necesidades personales, familiares y laborales.",
  "Es más atractivo para mí convertirme en un profesional de nivel ejecutivo en mi área de experiencia que en un gerente general.",
  "Voy a sentirme exitoso sólo si me convierto en gerente general de una empresa.",
  "Voy a sentirme exitoso sólo si logro completa autonomía y libertad.",
  "Prefiero trabajar en organizaciones que me den seguridad y estabilidad.",
  "Me siento más realizado en mi carrera cuando puedo construir algo que es resultado de mis ideas y esfuerzo.",
  "Usar mis capacidades para hacer del mundo un lugar mejor es más importante para mí que alcanzar una posición de alto nivel ejecutivo.",
  "Me sentí más contento con mi carrera cuando pude resolver problemas que parecían imposibles o triunfar pese a grandes obstáculos.",
  "Me siento exitoso en mi vida sólo si puedo equilibrar mis objetivos personales, familiares y de carrera.",
  "Cambiaría de empresa antes que aceptar una rotación que me alejara de mi área de experiencia.",
  "Llegar a ser gerente general es más atractivo para mí que ser un director funcional de mi área de experiencia.",
  "La posibilidad de realizar un trabajo a mi manera, libre de reglas y limitaciones, es más importante para mí que la seguridad laboral.",
  "Me siento más contento con mi trabajo cuando siento que tengo una completa seguridad financiera y de empleo.",
  "Me sentiré realizado en mi carrera sólo si logro crear o construir algo desarrollado o creado enteramente por mí.",
  "Sueño con tener una carrera que me permita realizar una contribución real a la humanidad y a la sociedad.",
  "Busco oportunidades de trabajo que desafíen fuertemente mi capacidad de resolver problemas o mi perfil competitivo.",
  "Equilibrar los requerimientos de la vida personal y profesional es más importante para mí que lograr una posición de alto nivel.",
  "Me siento más satisfecho en mi trabajo cuando puedo utilizar mis conocimientos y habilidades específicas.",
  "Cambiaría de empresa antes que aceptar un trabajo que me alejara del camino hacia la gerencia general.",
  "Cambiaría de empresa antes que aceptar un trabajo que redujera mi autonomía y libertad.",
  "Sueño con desarrollar una carrera que me permita sentir seguridad y estabilidad.",
  "Sueño con poner en marcha y construir mi propio negocio.",
  "Cambiaría de empresa antes que aceptar una posición en la que se desaprovechara mi habilidad de brindar servicio a otros.",
  "Lidiar con problemas que parecen insolubles es más importante para mí que alcanzar una posición ejecutiva.",
  "Siempre busqué oportunidades de trabajo que minimizaran la interferencia con lo familiar y personal.",
]

export const ANCHOR_ITEMS: Record<string, number[]> = {
  TF: [0, 8, 16, 24, 32],
  GG: [1, 9, 17, 25, 33],
  AU: [2, 10, 18, 26, 34],
  SE: [3, 11, 19, 27, 35],
  CE: [4, 12, 20, 28, 36],
  SC: [5, 13, 21, 29, 37],
  PD: [6, 14, 22, 30, 38],
  EV: [7, 15, 23, 31, 39],
}

/** Anchor keys in their canonical (display) order. */
export const ANCHOR_KEYS = Object.keys(ANCHOR_ITEMS)

export function calcScores(finalAnswers: number[]): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const [anchor, items] of Object.entries(ANCHOR_ITEMS)) {
    const sum = items.reduce((s, i) => s + (finalAnswers[i] || 0), 0)
    scores[anchor] = parseFloat((sum / items.length).toFixed(2))
  }
  return scores
}

/** Anchors sorted by score, best first. */
export function rankAnchors(scores: Record<string, number>): string[] {
  return [...ANCHOR_KEYS].sort((a, b) => scores[b] - scores[a])
}
