/** Shared shapes for module content (cards + links). Nothing is ever uploaded:
 *  every resource is a link to Drive / Docs / Zoom / an article. */

export type ModuleItemKind = "TAREA" | "BIBLIOGRAFIA" | "PRESENTACION" | "LINK" | "RECURSO"

export type ModuleLink = {
  id: string
  title: string
  url: string
  orderIndex: number
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
