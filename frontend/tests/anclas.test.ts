import { describe, it, expect } from "vitest"
import { selectBonusCandidates, groupRankedAnchors } from "../src/lib/anclas"

// The tier walk: start at 6, drop a tier at a time until >= minCount items
// qualify; otherwise return everything sorted. null answers count as 0.
describe("selectBonusCandidates", () => {
  it("returns only the 6-scored items when 3+ items score 6", () => {
    const result = selectBonusCandidates([6, 6, 6, 5, 4, 3])
    expect(result.map((c) => c.val)).toEqual([6, 6, 6])
    expect(result.map((c) => c.idx).sort((a, b) => a - b)).toEqual([0, 1, 2])
  })

  it("includes the 5s when only 2 items score 6 (next tier down)", () => {
    const result = selectBonusCandidates([6, 6, 5, 5, 4, 1])
    expect(result.map((c) => c.val)).toEqual([6, 6, 5, 5])
  })

  it("falls through to the 4s when nothing scores >= 5", () => {
    const result = selectBonusCandidates([4, 4, 4, 3, 2, 1])
    expect(result.map((c) => c.val)).toEqual([4, 4, 4])
  })

  it("falls back to all items sorted desc when no tier reaches minCount", () => {
    const result = selectBonusCandidates([1, 0, 0])
    expect(result.map((c) => c.val)).toEqual([1, 0, 0])
    expect(result).toHaveLength(3)
  })

  it("treats null answers as 0", () => {
    const result = selectBonusCandidates([6, 6, 6, null, null])
    expect(result.map((c) => c.val)).toEqual([6, 6, 6])
    expect(result).toHaveLength(3)
  })

  it("honors a custom minCount", () => {
    const result = selectBonusCandidates([6, 5, 5, 4], 2)
    expect(result.map((c) => c.val)).toEqual([6, 5, 5])
  })

  it("returns results sorted by score descending", () => {
    const result = selectBonusCandidates([4, 6, 5, 6, 5])
    const vals = result.map((c) => c.val)
    expect([...vals]).toEqual([...vals].sort((a, b) => b - a))
  })
})

describe("groupRankedAnchors", () => {
  it("groups ties into a shared, dense rank position", () => {
    const groups = groupRankedAnchors({ TF: 6, GG: 6, AU: 5, SE: 4 })
    expect(groups).toEqual([
      { rank: 1, score: 6, anchors: ["TF", "GG"] },
      { rank: 2, score: 5, anchors: ["AU"] },
      { rank: 3, score: 4, anchors: ["SE"] },
    ])
  })

  it("shortens the list on ties (ranks are dense, not 1,1,3)", () => {
    const groups = groupRankedAnchors({ A: 5, B: 5, C: 5, D: 1 })
    expect(groups.map((g) => g.rank)).toEqual([1, 2])
    expect(groups[0].anchors).toEqual(["A", "B", "C"])
  })

  it("gives every anchor its own rank when all scores differ", () => {
    const groups = groupRankedAnchors({ A: 6, B: 5, C: 4 })
    expect(groups.map((g) => g.rank)).toEqual([1, 2, 3])
  })

  it("respects a provided order for stable tie display", () => {
    const groups = groupRankedAnchors({ A: 5, B: 5 }, ["B", "A"])
    expect(groups[0].anchors).toEqual(["B", "A"])
  })
})
