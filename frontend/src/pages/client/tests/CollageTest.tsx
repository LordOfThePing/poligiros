import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TestApi, UploadResult } from "@/lib/testApi"

interface CollageTestProps {
  api: TestApi
  assignmentId: string
}

/**
 * Collage de valores / inspiración — el coachee lo arma afuera (típicamente en
 * Canva) y acá sube el PDF o la imagen final. Opcionalmente puede dejar una
 * nota de qué quiso representar.
 */
export default function CollageTest({ api }: CollageTestProps) {
  const { toast } = useToast()
  const [file, setFile] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleUpload(f: File) {
    setUploading(true)
    const res = await api.uploadFile(f)
    setUploading(false)
    if (!res.ok) {
      toast({ title: "Error al subir", description: res.error, variant: "destructive" })
      return
    }
    setFile(res.data)
  }

  async function submit() {
    if (!file) return
    setSubmitting(true)
    const res = await api.submit({ ...file, notes: notes.trim() })
    setSubmitting(false)
    if (res.ok) {
      setDone(true)
    } else {
      toast({ title: "Error al enviar", variant: "destructive" })
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <p className="text-4xl">✓</p>
        <h2 className="font-serif text-2xl text-foreground">¡Collage enviado!</h2>
        <p className="text-muted-foreground">Tu archivo quedó guardado y le llegó a tu coach.</p>
      </div>
    )
  }

  const isImage = file?.mimeType.startsWith("image/")

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      <div>
        <h2 className="font-serif text-2xl text-foreground mb-1">Collage</h2>
        <p className="text-sm text-muted-foreground">
          Armá tu collage en Canva (o la herramienta que prefieras) con lo que te
          inspira, los valores con los que te identificás o la imagen de tu futuro
          deseado. Después subí acá el <strong>PDF</strong>, <strong>JPG</strong> o <strong>PNG</strong> final.
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-border bg-white p-6">
        {!file ? (
          <label className="flex flex-col items-center justify-center gap-3 cursor-pointer py-6">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {uploading ? "Subiendo..." : "Hacé click o arrastrá tu archivo"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG o PNG · hasta 25 MB</p>
            </div>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
                e.target.value = ""
              }}
              disabled={uploading}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent">
                {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </p>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-accent hover:underline"
                >
                  Ver archivo subido ↗
                </a>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isImage && (
              <img
                src={file.fileUrl}
                alt="Preview del collage"
                className="w-full max-h-80 object-contain rounded-lg border border-border"
              />
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm">
          Notas (opcional)
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="¿Qué quisiste representar? ¿Qué imágenes elegiste y por qué?"
          rows={4}
        />
      </div>

      <Button
        className="w-full bg-brand-accent hover:bg-brand-accent-dark"
        disabled={!file || submitting}
        onClick={submit}
      >
        {submitting ? "Enviando..." : "Enviar collage"}
      </Button>
    </div>
  )
}
