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
