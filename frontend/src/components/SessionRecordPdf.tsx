import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import html2canvas from "html2canvas"
import { formatShortDate } from "@/lib/date"
import { paginateCanvasToPdf } from "@/lib/pdfPaginate"

type RecordShape = {
  sessionNum: number
  sessionDate: string
  coacheeName: string
  coacheeAge: string
  coacheeSex: string
  coacheeWorks: boolean
  coacheePosition?: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
}

export function SessionRecordPdf({
  record,
  clientName,
  coachName,
  label = "Descargar PDF",
}: {
  record: RecordShape
  clientName: string
  coachName?: string
  label?: string
}) {
  const [downloading, setDownloading] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const renderCapture = () => (
    <div
      ref={captureRef}
      style={{ position: "fixed", left: -10000, top: 0, width: 900, background: "#fff", color: "#1c1917" }}
    >
      <div className="p-8">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Registro de sesión</p>
        <h1 className="text-2xl font-bold mb-4">Sesión #{record.sessionNum} — {clientName}</h1>
        <div className="grid grid-cols-2 gap-4 text-sm mb-5">
          <div><p className="text-xs text-slate-400 mb-0.5">Coachee</p><p>{record.coacheeName}</p></div>
          <div><p className="text-xs text-slate-400 mb-0.5">Coach</p><p>{coachName || "-"}</p></div>
          <div><p className="text-xs text-slate-400 mb-0.5">Fecha</p><p>{formatShortDate(record.sessionDate)}</p></div>
          <div><p className="text-xs text-slate-400 mb-0.5">Edad / Sexo</p><p>{record.coacheeAge} · {record.coacheeSex}</p></div>
          <div><p className="text-xs text-slate-400 mb-0.5">¿Trabaja?</p><p>{record.coacheeWorks ? "Sí" : "No"}{record.coacheePosition ? " · " + record.coacheePosition : ""}</p></div>
        </div>
        {[
          ["Principales outputs", record.mainOutputs],
          ["Herramientas utilizadas y resultados", record.toolsAndResults],
          ["Conclusiones", record.conclusions],
        ].map(([title, body]) => {
          return (
            <div key={title} data-pdf-block className="mb-4" style={{ whiteSpace: "pre-wrap" }}>
              <p className="text-xs text-slate-400 mb-1">{title}</p>
              <p className="text-sm">{body}</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  async function handleDownload() {
    setDownloading(true)
    try {
      await document.fonts.ready
      await new Promise((r) => setTimeout(r, 50))
      const el = captureRef.current
      if (!el) throw new Error("no capture")
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: false, logging: false, imageTimeout: 15000, backgroundColor: "#ffffff" })
      const pdf = await paginateCanvasToPdf(canvas, el)
      pdf.save("registro-sesion-" + record.sessionNum + ".pdf")
    } catch (e) {
      console.error(e)
      window.print()
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
