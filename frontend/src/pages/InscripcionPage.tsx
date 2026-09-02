import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Loader2, CalendarX } from "lucide-react"
import { formatShortDate } from "@/lib/date"
import { apiTry } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"

type PublicCohort = { id: string; name: string }

type LinkState =
  | { kind: "loading" }
  | { kind: "dead"; message: string }
  | { kind: "open"; expiresAt: string; boundCohortId: string | null; cohorts: PublicCohort[] }

/**
 * Public self-signup, reached through an expiring shared link
 * (/inscripcion/:token). No account exists until the supervisor approves, so
 * the password chosen here is stored hashed on the request and copied over then.
 */
export default function InscripcionPage() {
  const { token } = useParams<{ token: string }>()
  const [link, setLink] = useState<LinkState>({ kind: "loading" })

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [especialidad, setEspecialidad] = useState("")
  const [motivation, setMotivation] = useState("")
  const [cohortId, setCohortId] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    apiTry(`/public/signup/${token}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          setLink({
            kind: "open",
            expiresAt: json.expiresAt,
            boundCohortId: json.boundCohortId,
            cohorts: json.cohorts ?? [],
          })
          if (json.boundCohortId) setCohortId(json.boundCohortId)
        } else {
          setLink({ kind: "dead", message: json.error || "Este link no es válido." })
        }
      })
      .catch(() => setLink({ kind: "dead", message: "No pudimos validar el link." }))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }

    setLoading(true)
    const res = await apiTry(`/public/signup/${token}`, {
      method: "POST",
      body: JSON.stringify({
        name, email, phone, especialidad, motivation,
        cohortId: cohortId || null,
        password,
      }),
    })

    if (res.ok) {
      setDone(true)
    } else {
      const json = await res.json().catch(() => ({ error: "" }))
      setError(json.error || "No pudimos registrar tu inscripción. Intentá de nuevo.")
    }
    setLoading(false)
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg py-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-brand-accent mb-2">Poligiros</h1>
          <p className="text-muted-foreground text-sm">
            Certificación en Coaching de Carrera y Bienestar Laboral
          </p>
        </div>
        {children}
      </div>
    </div>
  )

  if (link.kind === "loading") {
    return shell(
      <LoadingBadge />
    )
  }

  if (link.kind === "dead") {
    return shell(
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6 text-center space-y-3">
          <CalendarX className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="font-serif text-2xl text-foreground">Link no disponible</h2>
          <p className="text-sm text-muted-foreground">{link.message}</p>
          <Link to="/login" className="text-sm text-brand-accent hover:underline inline-block">
            Ir al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return shell(
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-brand-accent mx-auto" />
          <h2 className="font-serif text-2xl text-foreground">¡Listo!</h2>
          <p className="text-sm text-muted-foreground">
            Recibimos tu inscripción. Cuando sea aprobada te vamos a avisar por email y vas a
            poder ingresar con la contraseña que elegiste.
          </p>
          <Link to="/login" className="text-sm text-brand-accent hover:underline inline-block">
            Ir al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    )
  }

  const boundCohort = link.boundCohortId
    ? link.cohorts.find((c) => c.id === link.boundCohortId)
    : null

  return shell(
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Inscribite al CIC</CardTitle>
        <CardDescription>
          {boundCohort
            ? `Te estás inscribiendo a ${boundCohort.name}. `
            : ""}
          Completá tus datos. Vamos a revisar tu inscripción y te avisamos por email.
        </CardDescription>
        <p className="text-xs text-muted-foreground pt-1">
          Este link vence el {formatShortDate(link.expiresAt)}.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre y apellido *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="especialidad">Especialidad</Label>
              <Input
                id="especialidad"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                placeholder="Ej: RRHH, psicología..."
              />
            </div>
          </div>

          {!boundCohort && link.cohorts.length > 0 && (
            <div className="space-y-2">
              <Label>¿A qué CIC te querés anotar?</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una camada" />
                </SelectTrigger>
                <SelectContent>
                  {link.cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivation">¿Por qué te interesa?</Label>
            <Textarea
              id="motivation"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Repetir contraseña *</Label>
              <PasswordInput
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent hover:bg-brand-accent-dark"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar inscripción
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link to="/login" className="text-brand-accent hover:underline">Ingresá</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
