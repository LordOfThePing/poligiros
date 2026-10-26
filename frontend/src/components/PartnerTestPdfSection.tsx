import ResultsView from "@/pages/client/ResultsView"
import { apiJson } from "@/lib/api"
import { testTitle } from "@/lib/testInfo"

/** The interviewed dupla's own result for the registro card's test. */
export type PartnerTest = {
  testType: string
  responses: Record<string, unknown>
  completedAt: string
}

/**
 * Fetch the dupla's test from an endpoint answering `{ completed, testType,
 * responses, completedAt }` (the coach's `/student/module-items/:id/dupla/:coachId`
 * or the supervisor's `/supervisor/practice-records/:id/partner-test`).
 * `null` when they have not completed it — the PDF then goes without it.
 */
export async function fetchPartnerTest(path: string): Promise<PartnerTest | null> {
  try {
    const r = await apiJson<Partial<PartnerTest> & { completed: boolean }>(path)
    if (!r.completed || !r.testType || !r.responses) return null
    return { testType: r.testType, responses: r.responses, completedAt: r.completedAt ?? new Date().toISOString() }
  } catch {
    return null
  }
}

/**
 * First part of a registro PDF: the test the session was run on, as the dupla
 * completed it, so the record reads next to the result it talks about. Uses
 * the same export layout as the test's own PDF (`ResultsView` `exportCopy`).
 */
export function PartnerTestPdfSection({ test, partnerName }: { test: PartnerTest; partnerName: string }) {
  return (
    <div className="mb-8 border-b border-border pb-8">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          Test de la dupla · {testTitle(test.testType)}
        </p>
        <h2 className="font-serif text-2xl text-foreground">{partnerName}</h2>
      </div>
      <ResultsView
        testType={test.testType}
        responses={test.responses}
        coachFeedback={null}
        completedAt={test.completedAt}
        hideExport
        exportCopy
        constrainHeight={false}
      />
    </div>
  )
}

/**
 * Tag every rounded card/box under `el` as a pagination-aware block, so the
 * paginator moves a box that doesn't fit to the next page instead of cutting
 * it (same as the test's own PDF in `DownloadResultPdf`).
 */
export function tagPdfBlocks(el: HTMLElement) {
  el.querySelectorAll(".rounded-xl, .rounded-lg").forEach((n) => {
    ;(n as HTMLElement).setAttribute("data-pdf-block", "")
  })
}
