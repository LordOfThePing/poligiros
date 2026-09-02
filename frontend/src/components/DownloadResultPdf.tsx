import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Printer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import ResultsView from "@/pages/client/ResultsView"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"

/**
 * Result export actions:
 *  - "Descargar PDF": captures the result and downloads a real .pdf file.
 *  - "Imprimir": opens the browser print dialog (Save as PDF via printer).
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
  const [downloading, setDownloading] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  // Render a hidden, full copy that html2canvas can snapshot pixel-for-pixel.
  const renderCapture = () => (
    <div
      ref={captureRef}
      className="print-result"
      style={{ position: "fixed", left: -10000, top: 0, width: 900, background: "#fff", color: "#1c1917" }}
    >
      <div className="p-6">
        <ResultsView
          testType={testType}
          responses={responses}
          coachFeedback={coachFeedback}
          completedAt={completedAt}
          hideExport
          constrainHeight={false}
        />
      </div>
    </div>
  )

  async function handleDownload() {
    setDownloading(true)
    try {
      // Let the portal+canvas paint before snapshot.
      await new Promise((r) => setTimeout(r, 200))
      const el = captureRef.current
      if (!el) throw new Error("no capture")
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        backgroundColor: "#ffffff",
      })
      const imgData = canvas.toDataURL("image/jpeg", 0.92)
      // Build a single PDF page that grows to the full content height, so there
      // are no page cuts in the middle of results.
      const pageW = 794 // ~A4 width in pt
      const imgH = (canvas.height * pageW) / canvas.width
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [pageW, Math.ceil(imgH)] })
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, imgH)
      pdf.save(`anclas-de-carrera.pdf`)
    } catch (e) {
      console.error(e)
      // Fallback to the print dialog if snapshotting failed.
      window.print()
    } finally {
      setDownloading(false)
    }
  }

  function handlePrint() {
    setPrinting(true)
    // Let the portal render before triggering the print dialog.
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 120)
  }

  return (
    <>
      <div className="flex items-center gap-2 no-print">
        <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
          <Download className="h-4 w-4 mr-1.5" />
          {downloading ? "Generando..." : "Descargar PDF"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={printing}>
          <Printer className="h-4 w-4 mr-1.5" />
          {printing ? "Preparando..." : "Imprimir"}
        </Button>
      </div>

      {createPortal(renderCapture(), document.body)}
    </>
  )
}
