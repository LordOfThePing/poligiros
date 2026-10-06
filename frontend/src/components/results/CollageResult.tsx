import { FileText, Image as ImageIcon, Download } from "lucide-react"

/** Lectura read-only de un Collage enviado. */
export function CollageResult({ responses }: { responses: Record<string, unknown> }) {
  const fileUrl = typeof responses.fileUrl === "string" ? responses.fileUrl : ""
  const fileName = typeof responses.fileName === "string" ? responses.fileName : ""
  const mimeType = typeof responses.mimeType === "string" ? responses.mimeType : ""
  const sizeBytes = typeof responses.sizeBytes === "number" ? responses.sizeBytes : 0
  const notes = typeof responses.notes === "string" ? responses.notes : ""

  const isImage = mimeType.startsWith("image/")

  if (!fileUrl) {
    return <p className="text-sm text-muted-foreground italic">Collage sin archivo guardado.</p>
  }

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-foreground">Collage</h2>

      <div className="rounded-xl border border-border bg-white p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent">
            {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{fileName || "collage"}</p>
            {sizeBytes > 0 && (
              <p className="text-xs text-muted-foreground">
                {(sizeBytes / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline shrink-0"
          >
            <Download className="h-3.5 w-3.5" /> Abrir
          </a>
        </div>

        {isImage && (
          <img
            src={fileUrl}
            alt={fileName || "Collage"}
            className="w-full max-h-[500px] object-contain rounded-lg border border-border"
          />
        )}

        {!isImage && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-brand-accent hover:underline py-2"
          >
            Abrir PDF en una pestaña nueva ↗
          </a>
        )}
      </div>

      {notes && (
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Notas
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  )
}
