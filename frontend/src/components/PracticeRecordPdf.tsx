import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import html2canvas from "html2canvas"
import { formatShortDate } from "@/lib/date"
import { paginateCanvasToPdf } from "@/lib/pdfPaginate"

type RecordShape = {
  sessionDate: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
  feedback?: string | null
}

/**
 * PDF for a `PracticeRecord` (module REGISTRO card). Both sides are coaches of
 * the same CIC, so this record carries no coachee-profile data (no edad/sexo
 * like `SessionRecord` has — see schema.prisma).
 */
export function PracticeRecordPdf({
  record,
  coachName,
  coacheeName,
  moduleTitle,
  itemTitle,
  label = "Descargar PDF",
}: {
  record: RecordShape
  coachName: string
  coacheeName: string
  moduleTitle?: string
  itemTitle?: string
  label?: string
}) {
  const [downloading, setDownloading] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const renderCapture = () => (
    <div
      ref={captureRef}
      style={{ position: "fixed", left: -10000, top: 0, width: 900, background: "#fff", color: "#1c1917" }}
    >
      <div className="p-8 space-y-5">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
            Registro de sesión {moduleTitle && itemTitle ? `· ${moduleTitle} · ${itemTitle}` : ""}
          </p>
          <h1 className="text-2xl font-bold">Sesión con {coacheeName}</h1>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-slate-400 mb-0.5">Coach</p><p>{coachName}</p></div>
          <div><p className="text-xs text-slate-400 mb-0.5">Coachee</p><p>{coacheeName}</p></div>
          {record.sessionDate && (
            <div><p className="text-xs text-slate-400 mb-0.5">Fecha</p><p>{formatShortDate(record.sessionDate)}</p></div>
          )}
        </div>
        {[
          ["Principales emergentes", record.mainOutputs],
          ["Herramientas y resultados", record.toolsAndResults],
          ["Conclusiones", record.conclusions],
        ].map(([title, body]) => (
          <div key={title} data-pdf-block style={{ whiteSpace: "pre-wrap" }}>
            <p className="text-xs text-slate-400 mb-1">{title}</p>
            <p className="text-sm">{body}</p>
          </div>
        ))}
        {record.feedback && (
          <div data-pdf-block style={{ whiteSpace: "pre-wrap" }}>
            <p className="text-xs text-slate-400 mb-1">Devolución de la supervisora</p>
            <p className="text-sm">{record.feedback}</p>
          </div>
        )}
      </div>
    </div>
  )

  async function handleDownload() {
    setDownloading(true)
    try {
      await new Promise((r) => setTimeout(r, 50))
      await document.fonts.ready
      const el = captureRef.current
      if (!el) throw new Error("no capture")
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: false, logging: false, imageTimeout: 15000, backgroundColor: "#ffffff" })
      const pdf = await paginateCanvasToPdf(canvas, el)
      pdf.save(`registro-${coacheeName.toLowerCase().replace(/\s+/g, "-")}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
        <Download className="h-4 w-4 mr-1.5" />
        {downloading ? "Generando..." : label}
      </Button>
      {createPortal(renderCapture(), document.body)}
    </>
  )
}
