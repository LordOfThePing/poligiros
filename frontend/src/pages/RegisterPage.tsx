import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

type InviteState =
  | { state: "loading" }
  | { state: "ok"; email: string; name: string }
  | { state: "invalid"; message: string }

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { register } = useAuth()

  const [invite, setInvite] = useState<InviteState>({ state: "loading" })
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [phone, setPhone] = useState("")
  const [especialidad, setEspecialidad] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    api(`/auth/register/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const d = await res.json()
          setInvite({ state: "ok", email: d.email, name: d.name })
          setName(d.name ?? "")
        } else if (res.status === 410) {
          setInvite({ state: "invalid", message: "Esta invitación venció. Pedile a Gaby un nuevo enlace." })
        } else {
          setInvite({ state: "invalid", message: "Invitación inválida o ya utilizada." })
        }
      })
      .catch(() => setInvite({ state: "invalid", message: "No pudimos validar la invitación." }))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.")
    if (password !== confirm) return setError("Las contraseñas no coinciden.")
    setSubmitting(true)
    try {
      await register(token!, { name, password, phone, especialidad, bio })
      navigate("/student/programa", { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      setError(
        msg === "expired"
          ? "Esta invitación venció. Pedile a Gaby un nuevo enlace."
          : "No pudimos completar el registro. Intentá de nuevo."
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-brand-accent mb-2">Poligiros</h1>
          <p className="text-muted-foreground text-sm">Completá tu registro de coach</p>
        </div>

        <Card className="border-border shadow-sm">
          {invite.state === "loading" && (
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Validando invitación...
            </CardContent>
          )}

          {invite.state === "invalid" && (
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-2xl">⛔</p>
              <p className="text-sm text-muted-foreground">{invite.message}</p>
            </CardContent>
          )}

          {invite.state === "ok" && (
            <>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Crear tu cuenta</CardTitle>
                <CardDescription>Invitación para {invite.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Repetir</Label>
                      <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="especialidad">Especialidad</Label>
                    <Input id="especialidad" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Contanos brevemente sobre vos (opcional)" className="min-h-[80px]" />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
                  )}

                  <Button type="submit" className="w-full bg-brand-accent hover:bg-brand-accent-dark" disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</>
                    ) : (
                      "Crear cuenta e ingresar"
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
