/** Shared shapes for the public signup links (used by the CIC page and the
 *  Inscripciones page, so the two stay in sync). */

export type SignupLink = {
  id: string
  token: string
  expiresAt: string
  disabled: boolean
  createdAt: string
  cohort: { id: string; name: string } | null
  pool: { id: string; name: string } | null
  _count: { requests: number }
}

/** The public URL a candidate opens. */
export function signupUrl(link: SignupLink): string {
  return `${window.location.origin}/inscripcion/${link.token}`
}

/** Usable right now: neither revoked nor past its expiry. */
export function isSignupLinkActive(link: SignupLink): boolean {
  return !link.disabled && new Date(link.expiresAt).getTime() > Date.now()
}

/**
 * Copy to the clipboard, falling back to a selectable prompt.
 * `navigator.clipboard` needs a secure context and can also be blocked by
 * permissions, and a silent failure here looks like the button is broken.
 */
export async function copyToClipboard(text: string, promptLabel: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt(promptLabel, text)
    return false
  }
}
