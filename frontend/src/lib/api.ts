import { toast } from "@/hooks/use-toast"

// Strip any trailing slash so paths like `/auth/login` don't become `//auth/login`.
const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "")

export async function api(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (res.status === 401) {
    const currentPath = window.location.pathname
    // Public routes that must not bounce to /login on a 401. The /auth/me
    // hydration call in AuthProvider returns 401 when there is no session, so
    // any public page (register/invite, client token, self-signup) would get
    // eagerly redirected to login before it can render.
    const isPublicPage =
      currentPath === "/login" ||
      currentPath.startsWith("/invite/") ||
      currentPath.startsWith("/t/") ||
      currentPath.startsWith("/inscripcion/")

    if (!isPublicPage) {
      toast({ title: "Sesión expirada", variant: "destructive" })
      window.location.href = "/login"
    }
    // Return the response anyway so callers can handle it
    return res
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }

  return res
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init)
  return res.json() as Promise<T>
}

/** POST helper that sends JSON and returns the parsed response */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** PUT helper that sends JSON and returns the parsed response */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiJson<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

/** DELETE helper */
export async function apiDelete(path: string): Promise<void> {
  await api(path, { method: "DELETE" })
}

/**
 * Raw fetch to a token route — does NOT prepend API_URL (for FormData uploads),
 * but always sends credentials.
 */
export async function apiRaw(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...init,
    credentials: "include",
  })

  if (!res.ok && res.status !== 401) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }

  return res
}

/**
 * Like `apiRaw`, but NEVER throws on a non-2xx response — the caller inspects
 * `res.ok` and reads the error body. Use this whenever the API returns a
 * validation message meant to be shown to the user; `api`/`apiRaw` throw first,
 * which makes those `else` branches unreachable.
 */
export async function apiTry(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
}

/**
 * Multipart upload. Deliberately sets NO `Content-Type`: the browser has to add
 * it together with the multipart boundary, and forcing `application/json` (as
 * the other helpers do) makes the server unable to parse the form. Like
 * `apiTry`, it never throws — the caller reads `res.ok`.
 */
export async function apiUpload(path: string, form: FormData): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: form,
  })
}
