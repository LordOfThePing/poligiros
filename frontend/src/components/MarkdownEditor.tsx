import { useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Link2, Eye, Pencil } from "lucide-react"
import { Markdown } from "@/components/Markdown"

/**
 * Textarea with a markdown toolbar and a preview tab.
 *
 * The toolbar only inserts markdown text — the value stays plain markdown, so
 * nothing here changes what gets stored or how it renders elsewhere. Typing the
 * syntax by hand works exactly the same.
 */
export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  rows?: number
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  /**
   * Wrap the selection in `before`/`after`, or insert the markers and place the
   * caret between them when nothing is selected.
   */
  function wrap(before: string, after = "") {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = value.slice(start, end)
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)

    // Restore focus and selection after React re-renders the value.
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + before.length
      el.setSelectionRange(caret, caret + selected.length)
    })
  }

  /** Prefix the line the caret is on (headings, list bullets). */
  function prefixLine(prefix: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: start } = el
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)

    requestAnimationFrame(() => {
      el.focus()
      const caret = start + prefix.length
      el.setSelectionRange(caret, caret)
    })
  }

  const tools = [
    { icon: Bold, label: "Negrita", run: () => wrap("**", "**") },
    { icon: Italic, label: "Itálica", run: () => wrap("*", "*") },
    { icon: Heading1, label: "Título", run: () => prefixLine("## ") },
    { icon: Heading2, label: "Subtítulo", run: () => prefixLine("### ") },
    { icon: List, label: "Lista", run: () => prefixLine("- ") },
    { icon: ListOrdered, label: "Lista numerada", run: () => prefixLine("1. ") },
    { icon: Link2, label: "Link", run: () => wrap("[", "](https://)") },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {tools.map(({ icon: Icon, label, run }) => (
          <Button
            key={label}
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title={label}
            aria-label={label}
            disabled={preview}
            onClick={run}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? (
            <><Pencil className="h-3 w-3 mr-1" /> Editar</>
          ) : (
            <><Eye className="h-3 w-3 mr-1" /> Vista previa</>
          )}
        </Button>
      </div>

      {preview ? (
        <div className="border border-border rounded-md p-3 min-h-[120px] bg-white">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nada para previsualizar.</p>
          )}
        </div>
      ) : (
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="font-mono text-xs"
        />
      )}

      <p className="text-xs text-muted-foreground">
        Acepta markdown: <code>**negrita**</code>, <code>*itálica*</code>,{" "}
        <code>## Título</code>, <code>### Subtítulo</code>, <code>- listas</code>,{" "}
        <code>[texto](url)</code>.
      </p>
    </div>
  )
}
