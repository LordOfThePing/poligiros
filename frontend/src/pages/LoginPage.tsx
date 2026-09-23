import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useGoogleEnabled } from "@/lib/useSupportPhone"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  disabled: "El login con Google no está configurado en el servidor.",
  state: "La sesión de Google expiró. Probá de nuevo.",
  token: "No pudimos completar el login con Google. Probá de nuevo.",
  userinfo: "No pudimos leer tu cuenta de Google. Probá de nuevo.",
  email: "No pudimos verificar el email de tu cuenta de Google.",
  not_found:
    "No encontramos una cuenta con ese email en Poligiros. Pedile a la coordinación que te invite.",
  not_activated:
    "Tu cuenta todavía no fue activada. Registrate con el link de invitación primero.",
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, user, loading: authLoading } = useAuth()
  const googleEnabled = useGoogleEnabled()
  // Pre-filled from the password-reset mail's link, so the coach only has to
  // paste the temporary password.
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const googleErrorCode = searchParams.get("googleError")
  const [error, setError] = useState(
    googleErrorCode ? GOOGLE_ERROR_MESSAGES[googleErrorCode] ?? "No pudimos ingresar con Google." : "",
  )

  const callbackUrl = searchParams.get("callbackUrl") || "/"

  // If already logged in, redirect appropriately (in an effect, not during render)
  useEffect(() => {
    if (!user) return
    if (user.mustChangePassword) {
      navigate("/cambiar-password", { replace: true })
    } else if (user.role === "SUPERVISOR") navigate("/supervisor/panel", { replace: true })
    else navigate("/student/programa", { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await login(email, password)
      navigate(callbackUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      setError(
        msg === "user_not_activated"
          ? "Tu cuenta aún no fue activada. Usá el enlace de invitación que te enviaron para registrarte."
          : "Email o contraseña incorrectos"
      )
      setLoading(false)
    }
  }

  // While the app pings /auth/me on load, show a brief loading screen instead of
  // flashing the form and then redirecting.
  if (authLoading && !user) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
          <p className="text-sm">Cargando usuario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-brand-accent mb-2">Poligiros</h1>
          <p className="text-muted-foreground text-sm">Plataforma de certificación en coaching de carrera</p>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Ingresar</CardTitle>
            <CardDescription>Ingresá tu email y contraseña para acceder</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-brand-accent hover:bg-brand-accent-dark"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>

              {googleEnabled && (
                <>
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-2 text-muted-foreground">o</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const params = new URLSearchParams({ callbackUrl })
                      window.location.href = `${API_URL}/auth/google/start?${params.toString()}`
                    }}
                  >
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    Ingresar con Google
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  )
}
