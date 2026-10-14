import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import { formatShortDate } from "./date"

const A4W = 595
const A4H = 842
const MARGIN = 24
const CONTENT_W = A4W - 2 * MARGIN
const CONTENT_H = A4H - 2 * MARGIN

export type BulkPracticeRecord = {
  coachName: string
  coacheeName: string
  moduleTitle: string
  itemTitle: string
  sessionDate: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
  feedback: string | null
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

function renderRecord(record: BulkPracticeRecord): HTMLDivElement {
  const host = document.createElement("div")
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;background:#fff;color:#1c1917"
  host.innerHTML = `
    <div style="padding:32px;font-family:system-ui,-apple-system,sans-serif;">
      <div data-pdf-block style="margin-bottom:16px">
        <p style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">
          Registro de sesión · ${escape(record.moduleTitle)} · ${escape(record.itemTitle)}
        </p>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 10px">Sesión con ${escape(record.coacheeName)}</h1>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
          <div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Coach</p><p style="margin:0">${escape(record.coachName)}</p></div>
          <div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Coachee</p><p style="margin:0">${escape(record.coacheeName)}</p></div>
          ${record.sessionDate ? `<div><p style="font-size:11px;color:#94a3b8;margin:0 0 2px">Fecha</p><p style="margin:0">${escape(formatShortDate(record.sessionDate))}</p></div>` : ""}
        </div>
      </div>
      ${section("Principales emergentes", record.mainOutputs)}
      ${section("Herramientas y resultados", record.toolsAndResults)}
      ${section("Conclusiones", record.conclusions)}
      ${record.feedback ? section("Devolución de la supervisora", record.feedback) : ""}
    </div>
  `
  return host
}

/** Append one captured record's slices to the shared PDF, starting on a fresh page. */
async function appendRecordToPdf(
  pdf: jsPDF,
  record: BulkPracticeRecord,
  isFirstRecord: boolean,
): Promise<void> {
  const host = renderRecord(record)
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
    let firstPageOfRecord = true
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

      // First page of the first record uses the already-blank first page of
      // the jsPDF doc; every other page is an added page.
      if (!(isFirstRecord && firstPageOfRecord)) pdf.addPage()
      pdf.addImage(img, "JPEG", MARGIN, MARGIN, CONTENT_W, sliceHPt)
      firstPageOfRecord = false
      cursor = end
    }
  } finally {
    document.body.removeChild(host)
  }
}

/**
 * Build a single PDF with each practice record on its own page(s). Each
 * record starts on a fresh page, and sections (`data-pdf-block`) never get
 * split across pages.
 */
export async function downloadBulkPracticeRecordsPdf(
  records: BulkPracticeRecord[],
  filename: string,
): Promise<void> {
  if (records.length === 0) return
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" })
  for (let i = 0; i < records.length; i++) {
    await appendRecordToPdf(pdf, records[i], i === 0)
  }
  pdf.save(filename)
}
