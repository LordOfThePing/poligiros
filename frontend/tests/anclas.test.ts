import { describe, it, expect } from "vitest"
import { selectBonusCandidates } from "../src/lib/anclas"

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
