import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, ImagePlus, Loader2, Send, Trash2, X, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth"
import { apiJson, apiTry, apiUpload } from "@/lib/api"
import { formatShortDate } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { ModuleItemComment } from "@/lib/modules"

/**
 * Blog-style discussion for one card. Lists the thread (photos shown flat) and
 * lets the logged-in user post a comment with an optional photo. Sits to the
 * right of an open item on the class page.
 */
export function CommentPanel({ itemId }: { itemId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<ModuleItemComment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  // The thread scroll area; we keep it anchored to the bottom (latest message).
  const threadRef = useRef<HTMLDivElement | null>(null)

  const isSupervisor = user?.role === "SUPERVISOR"
  const basePath = isSupervisor
    ? `/supervisor/module-item-comments/${itemId}`
    : `/student/module-items/${itemId}/comments`

  const load = useCallback(() => {
    setLoading(true)
    apiJson<ModuleItemComment[]>(basePath)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [basePath])

  useEffect(() => { load() }, [load])

  // Always start at the bottom: the discussion is a chat, so the latest message
  // is what matters on open, and it stays at the bottom as comments arrive.
  const scrollToBottom = useCallback(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!loading) scrollToBottom()
  }, [loading, comments, scrollToBottom])

  function pickFile(f: File | null) {
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
    setError("")
  }

  async function submit() {
    if ((!text.trim() && !file) || posting) return
    setPosting(true)
    setError("")

    let res: Response
    if (file) {
      // apiUpload never sets Content-Type, so the browser adds the multipart
      // boundary and the server can parse the FormData + file. apiTry would
      // force application/json and the image would be lost.
      const form = new FormData()
      form.append("text", text.trim())
      form.append("image", file)
      res = await apiUpload(basePath, form)
    } else {
      res = await apiTry(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
    }

    setPosting(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || "No se pudo publicar el comentario")
      return
    }
    const created: ModuleItemComment = await res.json()
    setComments((prev) => [...prev, created])
    setText("")
    pickFile(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function remove(id: string) {
    const path = isSupervisor
      ? `/supervisor/module-item-comments/${itemId}/${id}`
      : `/student/module-items/${itemId}/comments/${id}`
    const res = await apiTry(path, { method: "DELETE" })
    if (!res.ok) return
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  /** The supervisor can wipe the whole discussion at once. */
  async function clearAll() {
    if (!isSupervisor || comments.length === 0) return
    if (!confirm("¿Eliminar todos los comentarios de esta discusión?")) return
    const res = await apiTry(`/supervisor/module-item-comments/${itemId}`, { method: "DELETE" })
    if (!res.ok) return
    setComments([])
  }

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <MessageSquare className="h-4 w-4 text-brand-accent" />
        <h3 className="font-serif text-base font-medium">Discusión</h3>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
        {isSupervisor && comments.length > 0 && (
          <button
            onClick={clearAll}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            title="Eliminar todos los comentarios"
          >
            <Eraser className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>

      {/* Thread — scrolls to the latest message on open and when new ones land. */}
      <div ref={threadRef} className="flex-1 overflow-y-auto py-3 space-y-4 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Todavía no hay comentarios. Arrancá la conversación.
          </p>
        ) : (
          comments.map((c) => {
            const mine = c.user.id === user?.id
            const isGabriela = c.user.role === "SUPERVISOR"
            return (
              <div
                key={c.id}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                {/* Small meta (name / role / time) over the bubble */}
                <div className={cn("flex items-center gap-1.5 px-1 text-[0.7rem] text-muted-foreground mb-0.5", mine && "flex-row-reverse")}>
                  <span className={cn("font-medium", isGabriela ? "text-brand-accent" : "")}>
                    {mine ? "Vos" : c.user.name}
                  </span>
                  {!mine && (
                    <span className="px-1.5 py-0.5 rounded-full bg-muted/70">
                      {isGabriela ? "Supervisora" : "Coach"}
                    </span>
                  )}
                  <span>{formatShortDate(c.createdAt)}</span>
                  {(mine || isSupervisor) && (
                    <button
                      onClick={() => remove(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={mine ? "Eliminar comentario" : "Eliminar comentario (moderación)"}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Bubble: own messages go right, the rest left (WhatsApp-style) */}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 space-y-1.5",
                    mine
                      ? "bg-brand-accent text-white rounded-br-md"
                      : "bg-white border border-border rounded-bl-md"
                  )}
                >
                  {c.text && (
                    <p className={cn("text-sm whitespace-pre-wrap", mine ? "text-white" : "text-foreground")}>
                      {c.text}
                    </p>
                  )}
                  {c.imageUrl && (
                    <img
                      src={c.imageUrl}
                      alt="Imagen del comentario"
                      className="rounded-lg w-full h-auto object-cover bg-muted/50"
                    />
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-border pt-3 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escribí un comentario..."
        />

        {previewUrl && (
          <div className="relative inline-block">
            <img src={previewUrl} alt="Vista previa" className="h-20 w-20 object-cover rounded-lg border border-border" />
            <button
              onClick={() => pickFile(null)}
              className="absolute -top-1.5 -right-1.5 bg-foreground text-background rounded-full p-0.5"
              aria-label="Quitar imagen"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={posting}>
            <ImagePlus className="h-4 w-4 mr-1" /> Foto
          </Button>
          <Button
            size="sm"
            className="ml-auto bg-brand-accent hover:bg-brand-accent-dark"
            disabled={posting || (!text.trim() && !file)}
            onClick={submit}
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publicar
          </Button>
        </div>
      </div>
    </div>
  )
}
