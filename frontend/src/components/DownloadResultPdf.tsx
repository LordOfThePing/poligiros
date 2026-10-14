import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Printer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import ResultsView from "@/pages/client/ResultsView"
import html2canvas from "html2canvas"
import { paginateCanvasToPdf } from "@/lib/pdfPaginate"

const TEST_LABELS: Record<string, string> = {
  ANCLAS_CARRERA: "Anclas de Carrera",
  TABLERO_IDEAS: "Tablero de Ideas",
  PIRAMIDE_PROPOSITO: "Piramide del Proposito",
  MODELO_NEGOCIO: "Desarrollo de idea de negocio-proyecto-trabajo",
  TAREAS_EXPLORACION: "Tareas a explorar",
  PLAN_VITAL: "Plan Vital Integral",
  COLLAGE: "Collage",
  OBJETIVO_CARRERA: "Objetivo de Carrera",
  PLAN_ACCION: "Plan de Accion",
}

function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // "Pérez" → "perez", not "p-rez"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

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
  personName,
}: {
  testType: string
  responses: Record<string, unknown>
  coachFeedback: string | null
  completedAt: string
  /** Who took the test: shown on top of the PDF and appended to the filename. */
  personName?: string | null
}) {
  const label = TEST_LABELS[testType] ?? "Resultado"
  const fileBase = slugify(personName ? `${label} ${personName}` : label) || "resultado"

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
        <div className="mb-4 border-b border-border pb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {personName && <h1 className="font-serif text-2xl text-foreground mt-1">{personName}</h1>}
        </div>
        <ResultsView
          testType={testType}
          responses={responses}
          coachFeedback={coachFeedback}
          completedAt={completedAt}
          hideExport
          exportCopy
          constrainHeight={false}
        />
      </div>
    </div>
  )

  async function handleDownload() {
    setDownloading(true)
    try {
      // Let the portal paint, then wait for webfonts so html2canvas measures
      // text with the real metrics — otherwise it can snapshot mid-swap from
      // the fallback font, shifting glyphs (numbers, headings) out of place.
      await new Promise((r) => setTimeout(r, 50))
      await document.fonts.ready
      const el = captureRef.current
      if (!el) throw new Error("no capture")
      // Tag every rounded card/box as a pagination-aware block. The paginator
      // avoids splitting these between pages, so a Plan Vital section box
      // either fits on the current page or starts on the next one.
      el.querySelectorAll(".rounded-xl, .rounded-lg").forEach((n) => {
        ;(n as HTMLElement).setAttribute("data-pdf-block", "")
      })
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        backgroundColor: "#ffffff",
      })
      const pdf = await paginateCanvasToPdf(canvas, el)
      pdf.save(`${fileBase}.pdf`)
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
    // The browser's "Save as PDF" filename comes from document.title —
    // swap it to the test name for the duration of the print dialog.
    const previousTitle = document.title
    document.title = personName ? `${label} - ${personName}` : label
    // Let the portal render before triggering the print dialog.
    setTimeout(() => {
      window.print()
      document.title = previousTitle
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
