import type { JWTPayload } from "./auth.js"

export type AppVariables = {
  user: JWTPayload
  /** The real admin identity when authMiddleware is impersonating (see auth.ts). */
  admin?: JWTPayload
}
