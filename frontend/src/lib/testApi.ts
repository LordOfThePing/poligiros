// Transport-agnostic API for the test components, so the same Anclas / Tablero /
// Pirámide UIs work both for coachees (magic-link token flow) and for coaches
// taking tests logged-in (session flow). The component calls api.submit(...)
// etc. without knowing which transport it is.

// Strip any trailing slash so `${base}/submit` never becomes `//submit`.
const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "")

export type UploadResult = {
  fileUrl: string
  fileKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface TestApi {
  submit(responses: unknown): Promise<Response>
  aiInsight(payload: unknown): Promise<{ insight: string | null }>
  aiIdeas(payload: unknown): Promise<{ ideas: string[] }>
  /** Multipart upload — hoy sólo lo usa Collage. */
  uploadFile(file: File): Promise<{ ok: true; data: UploadResult } | { ok: false; error: string }>
}

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  }
}

function makeApi(base: string): TestApi {
  return {
    submit: (responses) => fetch(`${base}/submit`, post({ responses })),
    aiInsight: async (payload) => {
      try {
        const res = await fetch(`${base}/ai-insight`, post(payload))
        return res.ok ? await res.json() : { insight: null }
      } catch {
        return { insight: null }
      }
    },
    aiIdeas: async (payload) => {
      try {
        const res = await fetch(`${base}/ai-ideas`, post(payload))
        return res.ok ? await res.json() : { ideas: [] }
      } catch {
        return { ideas: [] }
      }
    },
    uploadFile: async (file) => {
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch(`${base}/upload`, {
          method: "POST",
          credentials: "include",
          body: fd,
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({ error: "" }))) as { error?: string }
          return { ok: false, error: j.error || "No se pudo subir el archivo" }
        }
        return { ok: true, data: (await res.json()) as UploadResult }
      } catch {
        return { ok: false, error: "Error de red" }
      }
    },
  }
}

/** Coachee flow — token is the credential. */
export const tokenTestApi = (token: string): TestApi => makeApi(`${API_URL}/client/t/${token}`)

/** Coach flow — authenticated session (httpOnly cookie). */
export const sessionTestApi = (assignmentId: string): TestApi =>
  makeApi(`${API_URL}/student/my-tests/${assignmentId}`)
