import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check, Ban, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatShortDate } from "@/lib/date"
import { apiJson, apiTry } from "@/lib/api"
import { copyToClipboard, signupUrl, type SignupLink } from "@/lib/signup"

type Cohort = { id: string; name: string }

/** Only the field this panel needs, to prefill the expiry of a new link. */
type Settings = { signupLinkDays: number }

/** No cohort bound — the applicant picks from the active CICs. */
const ANY_COHORT = "__any__"

export function SignupLinksPanel() {
  const { toast } = useToast()
  const [links, setLinks] = useState<SignupLink[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [newCohort, setNewCohort] = useState<string>(ANY_COHORT)
  const [newDays, setNewDays] = useState<string>("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    apiJson<SignupLink[]>("/supervisor/signup-links").then(setLinks).catch(() => {})
    apiJson<Cohort[]>("/supervisor/cohorts").then(setCohorts).catch(() => {})
    // Only to prefill the days field with the configured default.
    apiJson<Settings>("/supervisor/settings")
      .then((s) => setNewDays(String(s.signupLinkDays)))
      .catch(() => {})
  }, [])

  async function copy(link: SignupLink) {
    if (await copyToClipboard(signupUrl(link), "Copiá el link:")) {
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
      toast({ title: "Link copiado" })
    }
  }

  async function generate() {
    const res = await apiTry("/supervisor/signup-links", {
      method: "POST",
      body: JSON.stringify({
        cohortId: newCohort === ANY_COHORT ? null : newCohort,
        days: newDays ? Number(newDays) : undefined,
      }),
    })
    if (!res.ok) {
      toast({ title: "No se pudo generar el link", variant: "destructive" })
      return
    }
    const created: SignupLink = await res.json()
    setLinks((prev) => [created, ...prev])
    toast({ title: "Link generado" })
  }

  async function disable(link: SignupLink) {
    if (!confirm("¿Dar de baja este link? Quien lo tenga ya no va a poder inscribirse.")) return
    const res = await apiTry(`/supervisor/signup-links/${link.id}/disable`, { method: "POST" })
    if (!res.ok) return
    const updated: SignupLink = await res.json()
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
  }


  function status(link: SignupLink): { label: string; className: string } {
    if (link.disabled) return { label: "Dado de baja", className: "bg-slate-100 text-slate-600" }
    if (new Date(link.expiresAt).getTime() < Date.now()) {
      return { label: "Vencido", className: "bg-red-100 text-red-700" }
    }
    return { label: "Activo", className: "bg-green-100 text-green-800" }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="font-sans text-base font-medium">Links de inscripción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CIC</Label>
              <Select value={newCohort} onValueChange={setNewCohort}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_COHORT}>Que elija el postulante</SelectItem>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vence en (días)</Label>
              <Input
                type="number"
                min={1}
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                className="h-8 w-24"
              />
            </div>
            <Button size="sm" className="h-8 bg-brand-accent hover:bg-brand-accent-dark" onClick={generate}>
              <Plus className="h-3 w-3 mr-1" /> Generar link
            </Button>
          </div>

          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay links todavía. Generá uno para compartir la inscripción.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const st = status(link)
                return (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center gap-3 bg-muted/40 rounded-lg px-3 py-2"
                  >
                    <Badge className={`${st.className} hover:${st.className}`}>{st.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{signupUrl(link)}</p>
                      <p className="text-xs text-muted-foreground">
                        {link.cohort ? link.cohort.name : "Sin CIC fijo"} · vence{" "}
                        {formatShortDate(link.expiresAt)} · {link._count.requests}{" "}
                        {link._count.requests === 1 ? "inscripción" : "inscripciones"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => copy(link)}>
                      {copiedId === link.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    {!link.disabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => disable(link)}
                      >
                        <Ban className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
