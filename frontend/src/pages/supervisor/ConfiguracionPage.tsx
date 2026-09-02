import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Mail, Loader2, Repeat } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth"
import { apiJson, apiTry } from "@/lib/api"
import { LoadingBadge } from "@/components/LoadingBadge"

type Cohort = { id: string; name: string }
type LinkedCoach = { id: string; email: string; name: string; cohorts: Cohort[] }

type Settings = {
  testCompleteDays: number
  testResultsDays: number
  signupLinkDays: number
  notifySignupRequest: boolean
  notifySupervisionRequest: boolean
  notifySubmission: boolean
  notifySessionRecorded: boolean
  notifySecondaryEmail: string | null
}

type Recipient = { email: string | null; overridden: boolean }

/** The switchable notifications, in the order they read best. */
const NOTIFICATIONS: { key: keyof Settings; label: string; hint: string }[] = [
  {
    key: "notifySignupRequest",
    label: "Nueva inscripción",
    hint: "Alguien completó el formulario del link público y espera aprobación.",
  },
  {
    key: "notifySupervisionRequest",
    label: "Test enviado a supervisión",
    hint: "Un coach mandó un test de su coachee, o completó uno propio.",
  },
  {
    key: "notifySubmission",
    label: "Nueva tarea entregada",
    hint: "Un coach entregó una tarjeta de tipo Entrega.",
  },
  {
    key: "notifySessionRecorded",
    label: "Sesión registrada",
    hint: "Un coach cargó el registro de una sesión con su coachee.",
  },
]

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const [linkedCoach, setLinkedCoach] = useState<LinkedCoach | null | undefined>(undefined)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [cohortId, setCohortId] = useState("")
  const [linking, setLinking] = useState(false)
  const { switchAccount } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    apiJson<Settings>("/supervisor/settings").then(setSettings).catch(() => {})
    apiJson<Recipient>("/supervisor/notify-recipient").then(setRecipient).catch(() => {})
    apiJson<Cohort[]>("/supervisor/cohorts").then(setCohorts).catch(() => {})
    apiJson<{ coach: LinkedCoach | null }>("/supervisor/me/coach")
      .then((r) => setLinkedCoach(r.coach))
      .catch(() => setLinkedCoach(null))
  }, [])

  async function addToCohort() {
    if (!cohortId) return
    setLinking(true)
    const res = await apiTry("/supervisor/me/coach", {
      method: "POST",
      body: JSON.stringify({ cohortId }),
    })
    setLinking(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "Error" }))
      toast({ title: j.error || "No se pudo asignar el CIC", variant: "destructive" })
      return
    }
    const { coach } = await res.json()
    setLinkedCoach(coach)
    setCohortId("")
    toast({ title: "Listo" })
  }

  async function handleSwitch() {
    try {
      await switchAccount()
      navigate("/student/programa")
    } catch {
      toast({ title: "No se pudo cambiar de cuenta", variant: "destructive" })
    }
  }

  async function save(next: Settings) {
    setSaving(true)
    const res = await apiTry("/supervisor/settings", {
      method: "PUT",
      body: JSON.stringify(next),
    })
    setSaving(false)
    if (!res.ok) {
      toast({ title: "No se pudo guardar", variant: "destructive" })
      return
    }
    setSettings(await res.json())
  }

  /** Toggles save on the spot — a switch that needs a Guardar button lies. */
  async function toggle(key: keyof Settings, value: boolean) {
    if (!settings) return
    const next = { ...settings, [key]: value }
    setSettings(next)
    await save(next)
  }

  if (!settings) {
    return <LoadingBadge />
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Vencimiento de los links y qué eventos te avisan por mail.
        </p>
      </div>

      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="font-sans text-base font-medium">Notificaciones por email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            {recipient?.email ? (
              <span className="text-foreground break-all">{recipient.email}</span>
            ) : (
              <span className="text-destructive">
                No hay dirección configurada — no se envía ninguna notificación.
              </span>
            )}
            {recipient?.overridden && (
              <span className="text-xs text-muted-foreground shrink-0">
                (definida en SUPERVISOR_NOTIFY_EMAIL)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Por defecto va al email de tu cuenta. Para mandarlas a otra casilla, definí
            <code className="mx-1">SUPERVISOR_NOTIFY_EMAIL</code> en el <code>.env</code> del servidor.
          </p>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-muted-foreground">Email secundario de notificaciones</Label>
            <div className="flex items-end gap-2">
              <Input
                type="email"
                value={settings.notifySecondaryEmail ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, notifySecondaryEmail: e.target.value || null })
                }
                placeholder="opcional@correo.com"
                className="h-8 flex-1"
              />
              <Button
                size="sm"
                className="h-8"
                disabled={saving}
                onClick={() => save(settings)}
              >
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Guardar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada notificación también llega a esta casilla. Dejalo vacío para que solo se mande a la
              dirección principal.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {NOTIFICATIONS.map((n) => (
              <label key={n.key} className="flex items-start gap-3">
                <Switch
                  checked={Boolean(settings[n.key])}
                  onCheckedChange={(v) => toggle(n.key, v)}
                />
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{n.label}</span>
                  <span className="block text-xs text-muted-foreground">{n.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="font-sans text-base font-medium">Mi cuenta de coach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Tu identidad como coach: te permite ver un CIC igual que lo ve un coach realmente
            inscripto (módulos, tests, entregas) en vez de la vista de solo lectura de Preview.
            Cambiá de cuenta desde tu menú de usuario, arriba a la izquierda.
          </p>

          {linkedCoach === undefined ? (
            <LoadingBadge />
          ) : (
            <>
              {linkedCoach && (
                <div className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg px-3 py-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground break-all">{linkedCoach.email}</p>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {linkedCoach.cohorts.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin CIC asignado todavía</span>
                      ) : (
                        linkedCoach.cohorts.map((c) => (
                          <Badge key={c.id} variant="secondary" className="text-xs">{c.name}</Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSwitch}>
                    <Repeat className="h-3.5 w-3.5 mr-1.5" /> Cambiar a vista Coach
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {linkedCoach ? "Agregar a otro CIC" : "Asignate a un CIC para empezar"}
                </Label>
                <div className="flex items-end gap-2">
                  <Select value={cohortId} onValueChange={setCohortId}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Elegí un CIC" /></SelectTrigger>
                    <SelectContent>
                      {cohorts
                        .filter((c) => !linkedCoach?.cohorts.some((lc) => lc.id === c.id))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-8" disabled={linking || !cohortId} onClick={addToCohort}>
                    {linking && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {linkedCoach ? "Agregar" : "Crear cuenta"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="font-sans text-base font-medium">Vencimiento de links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Completar un test (días)</Label>
              <Input
                type="number"
                min={1}
                value={settings.testCompleteDays}
                onChange={(e) =>
                  setSettings({ ...settings, testCompleteDays: Number(e.target.value) })
                }
                className="h-8 w-28"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ver resultados (días)</Label>
              <Input
                type="number"
                min={1}
                value={settings.testResultsDays}
                onChange={(e) =>
                  setSettings({ ...settings, testResultsDays: Number(e.target.value) })
                }
                className="h-8 w-28"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Link de inscripción (días)</Label>
              <Input
                type="number"
                min={1}
                value={settings.signupLinkDays}
                onChange={(e) =>
                  setSettings({ ...settings, signupLinkDays: Number(e.target.value) })
                }
                className="h-8 w-28"
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-8" disabled={saving} onClick={() => save(settings)}>
                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Aplica a los links que se generen de acá en adelante; los ya emitidos mantienen su
            fecha.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
