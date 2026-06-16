// Transport-agnostic API for the test components, so the same Anclas / Tablero /
// Pirámide UIs work both for coachees (magic-link token flow) and for coaches
// taking tests logged-in (session flow). The component calls api.submit(...)
// etc. without knowing which transport it is.

// Strip any trailing slash so `${base}/submit` never becomes `//submit`.
const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "")

export interface DevelopmentData {
  selectedIdea: string
  kind: string | null
  content: Record<string, unknown>
}

export interface TestApi {
  submit(responses: unknown): Promise<Response>
  aiInsight(payload: unknown): Promise<{ insight: string | null }>
  aiIdeas(payload: unknown): Promise<{ ideas: string[] }>
  getDevelopment(): Promise<DevelopmentData>
  saveDevelopment(data: { kind: string; content: unknown; selectedIdea?: string }): Promise<Response>
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
    getDevelopment: async () => {
      try {
        const res = await fetch(`${base}/develop`, { credentials: "include" })
        return res.ok ? await res.json() : { selectedIdea: "", kind: null, content: {} }
      } catch {
        return { selectedIdea: "", kind: null, content: {} }
      }
    },
    saveDevelopment: (data) =>
      fetch(`${base}/develop`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }),
  }
}

/** Coachee flow — token is the credential. */
export const tokenTestApi = (token: string): TestApi => makeApi(`${API_URL}/client/t/${token}`)

/** Coach flow — authenticated session (httpOnly cookie). */
export const sessionTestApi = (assignmentId: string): TestApi =>
  makeApi(`${API_URL}/student/my-tests/${assignmentId}`)
