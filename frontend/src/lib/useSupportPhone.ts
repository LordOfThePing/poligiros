import { useEffect, useState } from "react"
import { api } from "./api"

type PublicConfig = {
  supportPhone: string | null
  googleEnabled: boolean
}

/** Module-level cache so every caller shares one fetch of GET /public/config. */
let cached: PublicConfig | undefined
let inFlight: Promise<PublicConfig> | null = null

function fetchConfig(): Promise<PublicConfig> {
  if (cached !== undefined) return Promise.resolve(cached)
  if (!inFlight) {
    inFlight = api("/public/config")
      .then((res) => (res.ok ? res.json() : { supportPhone: null, googleEnabled: false }))
      .then((data) => {
        cached = {
          supportPhone: data.supportPhone ?? null,
          googleEnabled: !!data.googleEnabled,
        }
        return cached
      })
      .catch(() => (cached = { supportPhone: null, googleEnabled: false }))
  }
  return inFlight
}

function useConfigField<K extends keyof PublicConfig>(key: K): PublicConfig[K] {
  const [value, setValue] = useState<PublicConfig[K]>(
    cached ? cached[key] : (key === "googleEnabled" ? (false as PublicConfig[K]) : (null as PublicConfig[K])),
  )

  useEffect(() => {
    let cancelled = false
    fetchConfig().then((c) => {
      if (!cancelled) setValue(c[key])
    })
    return () => {
      cancelled = true
    }
  }, [key])

  return value
}

/** The developer's WhatsApp number, set via the backend's SUPPORT_PHONE env var. */
export function useSupportPhone(): string | null {
  return useConfigField("supportPhone")
}

/** True when the backend has GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET configured. */
export function useGoogleEnabled(): boolean {
  return useConfigField("googleEnabled")
}
