import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { apiTry } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

/**
 * Landing page of the mailed password link, shared by "olvidé mi contraseña" and
 * the change from Configuración. The link is single-use: a used, replaced or
 * expired one lands on the "pedí otro" state.
 */
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { clearMustChange } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    apiTry(`/auth/password-reset/${token}`)
      .then(async (res) => setEmail(res.ok ? (await res.json()).email : null))
      .catch(() => setEmail(null))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }
    setLoading(true)
    try {
      const res = await apiTry(`/auth/password-reset/${token}`, {
        method: "POST",
        body: JSON.stringify({ password }),
      })
      if (res.status === 410) {
        setEmail(null)
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error)
      }
      clearMustChange()
      toast({ title: "Listo, tu contraseña ya está actualizada" })
      navigate(`/login?email=${encodeURIComponent(email ?? "")}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo cambiar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-brand-accent mb-2">Poligiros</h1>
          <p className="text-muted-foreground text-sm">Cambiá tu contraseña</p>
        </div>

        <Card className="border-border shadow-sm">
          {email === undefined ? (
            <CardContent className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
            </CardContent>
          ) : email === null ? (
            <>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Este link ya no sirve</CardTitle>
                <CardDescription>
                  Los links vencen en 1 hora, se usan una sola vez y solo vale el último que pediste.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full bg-brand-accent hover:bg-brand-accent-dark">
                  <Link to="/olvide-password">Pedir otro link</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Elegí una contraseña nueva</CardTitle>
                <CardDescription className="break-all">{email}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña nueva</Label>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Repetir contraseña</Label>
                    <PasswordInput
                      id="confirm"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                      </>
                    ) : (
                      "Guardar contraseña"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
