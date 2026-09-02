import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

/**
 * Forced after the supervisor resets a coach's password. The coach is logged in
 * with a temporary password and MUST choose a fresh one before continuing.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, changePassword, logout } = useAuth()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Reaching this page while logged out has no purpose — send them to login.
  if (!user) return <Navigate to="/login" replace />

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
      await changePassword(password)
      navigate(user?.role === "SUPERVISOR" ? "/supervisor/panel" : "/student/programa", {
        replace: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message || "No se pudo cambiar la contraseña" : "Ocurrió un error")
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
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Elegí una contraseña nueva</CardTitle>
            <CardDescription>
              Tu contraseña fue restablecida. Ingresá una nueva para continuar.
            </CardDescription>
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

              <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={logout}>
                Salir
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
