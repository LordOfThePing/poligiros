/** Shared shapes for module content (cards + links). Nothing is ever uploaded:
 *  every resource is a link to Drive / Docs / Zoom / an article. */

export type ModuleItemKind =
  | "TAREA"
  | "BIBLIOGRAFIA"
  | "PRESENTACION"
  | "LINK"
  | "RECURSO"
  | "TEST"
  | "ENTREGA"
  | "REGISTRO"

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

/** The catalog test behind a kind = TEST card. */
export type LinkedTest = { id: string; type: string; title: string }

export type ModuleItem = {
  id: string
  title: string
  description: string | null
  kind: ModuleItemKind
  orderIndex: number
  links: ModuleLink[]
  /** Only for kind = TEST. */
  testId: string | null
  test: LinkedTest | null
  /** Optional cover image (R2 public URL) shown above this item when opened. */
  coverImageUrl: string | null
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

/** A blog-style comment on a card, with an optional photo shown flat. */
export type ModuleItemComment = {
  id: string
  text: string
  imageUrl: string | null
  createdAt: string
  user: { id: string; name: string; role: string }
}

/** Student view adds their own progress, per item and derived per module. */
/** kind = ENTREGA only: what this coach handed in, if anything. */
export type OwnSubmission = {
  id: string
  text: string
  submittedAt: string
  feedback: string | null
  reviewedAt: string | null
}

/** kind = TEST only: the supervisor's feedback on a test the coach took on themself. */
export type OwnSupervision = {
  feedback: string | null
  reviewedAt: string | null
}

/** A peer of the same CIC, pickable as a dupla partner. */
export type DuplaCandidate = { id: string; name: string; email: string }

/** kind = REGISTRO only: the session THIS coach ran on their partner. */
export type OwnPractice = {
  id: string
  coachee: { id: string; name: string }
  sessionDate: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
  submittedAt: string
  feedback: string | null
  reviewedAt: string | null
}

/** The session a partner ran on ME. No feedback: that devolución is theirs. */
export type PracticeAboutMe = {
  id: string
  coach: { id: string; name: string }
  sessionDate: string | null
  mainOutputs: string
  toolsAndResults: string
  conclusions: string
  submittedAt: string
}

export type StudentModuleItem = ModuleItem & {
  completed: boolean
  /** kind = TEST only: the coach own assignment, created on first open. */
  assignmentId: string | null
  submitted: boolean
  /** kind = TEST only: feedback from Gaby on the coach's own test. */
  supervision: OwnSupervision | null
  submission: OwnSubmission | null
  practice: OwnPractice | null
  practiceAboutMe: PracticeAboutMe | null
}

export type StudentModule = Omit<Module, "items"> & {
  items: StudentModuleItem[]
  /** Derived server-side: has items and all of them are done. */
  completed: boolean
}

export const ITEM_KINDS: ModuleItemKind[] = [
  "TAREA",
  "BIBLIOGRAFIA",
  "PRESENTACION",
  "LINK",
  "RECURSO",
  "TEST",
  "ENTREGA",
  "REGISTRO",
]

export const KIND_LABEL: Record<ModuleItemKind, string> = {
  TAREA: "Tarea",
  BIBLIOGRAFIA: "Bibliografía",
  PRESENTACION: "Presentación",
  LINK: "Link",
  RECURSO: "Recurso",
  TEST: "Test",
  ENTREGA: "Entrega",
  REGISTRO: "Registro de sesión",
}

/** Tailwind classes per kind, so a class page is scannable at a glance. */
export const KIND_BADGE: Record<ModuleItemKind, string> = {
  TAREA: "bg-amber-100 text-amber-800",
  BIBLIOGRAFIA: "bg-sky-100 text-sky-800",
  PRESENTACION: "bg-violet-100 text-violet-800",
  LINK: "bg-emerald-100 text-emerald-800",
  RECURSO: "bg-slate-100 text-slate-700",
  TEST: "bg-rose-100 text-rose-800",
  ENTREGA: "bg-indigo-100 text-indigo-800",
  REGISTRO: "bg-teal-100 text-teal-800",
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
