/** Shared shapes for module content (cards + links). Nothing is ever uploaded:
 *  every resource is a link to Drive / Docs / Zoom / an article. */

export type ModuleItemKind = "TAREA" | "BIBLIOGRAFIA" | "PRESENTACION" | "LINK" | "RECURSO"

export type ModuleLink = {
  id: string
  title: string
  url: string
  orderIndex: number
  /** Set when the file was uploaded to R2 through the app; null for plain links. */
  storageKey: string | null
  mimeType: string | null
  sizeBytes: number | null
}

/** "1,4 MB" — for the file chips next to an uploaded document. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}

export type ModuleItem = {
  id: string
  title: string
  description: string | null
  kind: ModuleItemKind
  orderIndex: number
  links: ModuleLink[]
}

export type Module = {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  orderIndex: number
  published: boolean
  items: ModuleItem[]
}

/** Student view adds their own progress. */
export type StudentModule = Module & { completed: boolean }

export const ITEM_KINDS: ModuleItemKind[] = [
  "TAREA",
  "BIBLIOGRAFIA",
  "PRESENTACION",
  "LINK",
  "RECURSO",
]

export const KIND_LABEL: Record<ModuleItemKind, string> = {
  TAREA: "Tarea",
  BIBLIOGRAFIA: "Bibliografía",
  PRESENTACION: "Presentación",
  LINK: "Link",
  RECURSO: "Recurso",
}

/** Tailwind classes per kind, so a class page is scannable at a glance. */
export const KIND_BADGE: Record<ModuleItemKind, string> = {
  TAREA: "bg-amber-100 text-amber-800",
  BIBLIOGRAFIA: "bg-sky-100 text-sky-800",
  PRESENTACION: "bg-violet-100 text-violet-800",
  LINK: "bg-emerald-100 text-emerald-800",
  RECURSO: "bg-slate-100 text-slate-700",
}

/**
 * Flatten markdown to plain text for compact one-line previews, where rendering
 * real markdown would either break the layout or show raw `**` noise.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")           // headings
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // links -> their text
    .replace(/[*_~`>]/g, "")               // emphasis / code / quote markers
    .replace(/^\s*[-+]\s+/gm, "")          // bullets
    .replace(/\s+/g, " ")
    .trim()
}
