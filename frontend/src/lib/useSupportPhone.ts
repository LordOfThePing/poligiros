import { useEffect, useState } from "react"
import { api } from "./api"

/** Module-level cache so every caller shares one fetch of GET /public/config. */
let cached: string | null | undefined
let inFlight: Promise<string | null> | null = null

function fetchSupportPhone(): Promise<string | null> {
  if (cached !== undefined) return Promise.resolve(cached)
  if (!inFlight) {
    inFlight = api("/public/config")
      .then((res) => (res.ok ? res.json() : { supportPhone: null }))
      .then((data) => (cached = data.supportPhone ?? null))
      .catch(() => (cached = null))
  }
  return inFlight
}

/** The developer's WhatsApp number, set via the backend's SUPPORT_PHONE env var. */
export function useSupportPhone(): string | null {
  const [phone, setPhone] = useState<string | null>(cached ?? null)

  useEffect(() => {
    let cancelled = false
    fetchSupportPhone().then((p) => {
      if (!cancelled) setPhone(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return phone
}
