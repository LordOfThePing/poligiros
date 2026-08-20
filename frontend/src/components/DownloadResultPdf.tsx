import { useState } from "react"
import { createPortal } from "react-dom"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import ResultsView from "@/pages/client/ResultsView"

/**
 * "Descargar como PDF": renders a print-only copy of the result and opens the
 * browser's print dialog (Save as PDF). The `@media print` CSS hides the rest of
 * the app and only shows `.print-result`.
 */
export function DownloadResultPdf({
  testType,
  responses,
  coachFeedback,
  completedAt,
}: {
  testType: string
  responses: Record<string, unknown>
  coachFeedback: string | null
  completedAt: string
}) {
  const [printing, setPrinting] = useState(false)

  async function handlePrint() {
    setPrinting(true)
    // Let the portal render before triggering the print dialog.
    await new Promise((r) => setTimeout(r, 120))
    window.print()
    setPrinting(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="no-print"
        onClick={handlePrint}
        disabled={printing}
      >
        <Printer className="h-4 w-4 mr-1.5" />
        {printing ? "Preparando..." : "Descargar PDF"}
      </Button>

      {printing &&
        createPortal(
          <div className="print-result bg-white text-foreground">
            <ResultsView
              testType={testType}
              responses={responses}
              coachFeedback={coachFeedback}
              completedAt={completedAt}
            />
          </div>,
          document.body
        )}
    </>
  )
}
