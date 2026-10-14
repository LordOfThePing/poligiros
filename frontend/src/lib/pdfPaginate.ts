import { jsPDF } from "jspdf"

const A4_WIDTH_PT = 595
const A4_HEIGHT_PT = 842
const MARGIN_PT = 24

/**
 * Paginate an already-rendered html2canvas snapshot into an A4 PDF, avoiding
 * cuts through elements the caller tagged with `data-pdf-block`. If a tagged
 * block does not fit on the current page, the page is cut short and the block
 * starts on the next one; if a single block is taller than one page we let it
 * overflow (unavoidable).
 *
 * Falls back to a plain page-tall slicing when no `data-pdf-block` is found.
 */
export async function paginateCanvasToPdf(
  canvas: HTMLCanvasElement,
  sourceEl: HTMLElement,
): Promise<jsPDF> {
  const contentW = A4_WIDTH_PT - 2 * MARGIN_PT
  const contentH = A4_HEIGHT_PT - 2 * MARGIN_PT
  const pxPerPt = canvas.width / contentW
  const pageHeightPx = Math.floor(contentH * pxPerPt)

  const sourceTop = sourceEl.getBoundingClientRect().top
  const scaleY = canvas.height / sourceEl.offsetHeight

  const blocks = Array.from(
    sourceEl.querySelectorAll<HTMLElement>("[data-pdf-block]"),
  )
    .map((b) => {
      const r = b.getBoundingClientRect()
      const top = Math.max(0, Math.floor((r.top - sourceTop) * scaleY))
      const bottom = Math.min(canvas.height, Math.ceil(top + r.height * scaleY))
      return { top, bottom }
    })
    .sort((a, b) => a.top - b.top)

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" })

  let cursor = 0
  let firstPage = true
  // Minimum ratio of a page we'll fill before pushing a block to the next page.
  // Below that we accept cutting the block (prevents an empty page when a huge
  // block starts near the top).
  const MIN_FILL = 0.1

  while (cursor < canvas.height) {
    let end = Math.min(canvas.height, cursor + pageHeightPx)

    for (const b of blocks) {
      if (b.top <= cursor) continue
      if (b.top >= end) break
      // Block crosses the page boundary.
      if (b.bottom > end) {
        const candidate = b.top
        if (candidate - cursor >= pageHeightPx * MIN_FILL) {
          end = candidate
        }
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

    if (!firstPage) pdf.addPage()
    pdf.addImage(img, "JPEG", MARGIN_PT, MARGIN_PT, contentW, sliceHPt)
    firstPage = false
    cursor = end
  }

  return pdf
}
