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
    const isLoginPage = currentPath === "/login"
    const isTokenRoute = currentPath.startsWith("/t/")

    if (!isLoginPage && !isTokenRoute) {
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
