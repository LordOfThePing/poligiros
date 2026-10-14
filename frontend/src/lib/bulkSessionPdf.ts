import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import { formatShortDate } from "./date"

const A4W = 595
const A4H = 842
const MARGIN = 24
const CONTENT_W = A4W - 2 * MARGIN
const CONTENT_H = A4H - 2 * MARGIN

export type BulkSessionRecord = {
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

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function section(title: string, body: string): string {
  return `
    <div data-pdf-block style="margin-bottom:16px;white-space:pre-wrap">
      <p style="font-size:11px;color:#94a3b8;margin:0 0 4px">${escape(title)}</p>
      <p style="font-size:13px;margin:0">${escape(body)}</p>
    </div>
  `
}

function renderRecord(record: BulkSessionRecord, coachName: string, coacheeDisplay: string): HTMLDivElement {
  const host = document.createElement("div")
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;background:#fff;color:#1c1917"
  host.innerHTML = `
    <div style="padding:32px;font-family:system-ui,-apple-system,sans-serif">
      <div data-pdf-block style="margin-bottom:16px">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">
          Registro de sesión
        </p>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 10px">Sesión #${record.sessionNum} — ${escape(coacheeDisplay)}</h1>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
          <div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Coachee</p><p style="margin:0">${escape(record.coacheeName)}</p></div>
          <div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Coach</p><p style="margin:0">${escape(coachName)}</p></div>
          <div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Fecha</p><p style="margin:0">${escape(formatShortDate(record.sessionDate))}</p></div>
          <div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Edad / Sexo</p><p style="margin:0">${escape(record.coacheeAge)} · ${escape(record.coacheeSex)}</p></div>
          <div style="grid-column:1 / -1"><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">¿Trabaja?</p><p style="margin:0">${record.coacheeWorks ? "Sí" : "No"}${record.coacheePosition ? " · " + escape(record.coacheePosition) : ""}</p></div>
        </div>
      </div>
      ${section("Principales outputs", record.mainOutputs)}
      ${section("Herramientas utilizadas y resultados", record.toolsAndResults)}
      ${section("Conclusiones", record.conclusions)}
    </div>
  `
  return host
}

async function appendRecord(
  pdf: jsPDF,
  record: BulkSessionRecord,
  coachName: string,
  coacheeDisplay: string,
  isFirstRecord: boolean,
): Promise<void> {
  const host = renderRecord(record, coachName, coacheeDisplay)
  document.body.appendChild(host)
  try {
    await document.fonts.ready
    await new Promise((r) => setTimeout(r, 20))
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      backgroundColor: "#ffffff",
    })
    const sourceEl = host.firstElementChild as HTMLElement
    const pxPerPt = canvas.width / CONTENT_W
    const pageHeightPx = Math.floor(CONTENT_H * pxPerPt)
    const scaleY = canvas.height / sourceEl.offsetHeight
    const srcTop = sourceEl.getBoundingClientRect().top
    const blocks = Array.from(sourceEl.querySelectorAll<HTMLElement>("[data-pdf-block]"))
      .map((b) => {
        const r = b.getBoundingClientRect()
        const top = Math.max(0, Math.floor((r.top - srcTop) * scaleY))
        const bottom = Math.min(canvas.height, Math.ceil(top + r.height * scaleY))
        return { top, bottom }
      })
      .sort((a, b) => a.top - b.top)

    let cursor = 0
    let firstPage = true
    while (cursor < canvas.height) {
      let end = Math.min(canvas.height, cursor + pageHeightPx)
      for (const b of blocks) {
        if (b.top <= cursor) continue
        if (b.top >= end) break
        if (b.bottom > end) {
          if (b.top - cursor >= pageHeightPx * 0.1) end = b.top
          break
        }
      }
      const sliceH = Math.max(1, end - cursor)
      const slice = document.createElement("canvas")
      slice.width = canvas.width
      slice.height = sliceH
      const ctx = slice.getContext("2d")!
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, -cursor)
      const img = slice.toDataURL("image/jpeg", 0.92)
      const sliceHPt = sliceH / pxPerPt
      if (!(isFirstRecord && firstPage)) pdf.addPage()
      pdf.addImage(img, "JPEG", MARGIN, MARGIN, CONTENT_W, sliceHPt)
      firstPage = false
      cursor = end
    }
  } finally {
    document.body.removeChild(host)
  }
}

/**
 * Build a single PDF with all session records (SessionRecord shape) for a
 * coachee, each starting on its own page.
 */
export async function downloadBulkSessionRecordsPdf(
  records: BulkSessionRecord[],
  coachName: string,
  coacheeDisplay: string,
  filename: string,
): Promise<void> {
  if (records.length === 0) return
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" })
  for (let i = 0; i < records.length; i++) {
    await appendRecord(pdf, records[i], coachName, coacheeDisplay, i === 0)
  }
  pdf.save(filename)
}
