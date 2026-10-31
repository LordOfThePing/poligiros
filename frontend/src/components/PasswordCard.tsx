import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Mail } from "lucide-react"
import { apiTry } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

/**
 * Configuración card, one for every role. Changing the password is always
 * confirmed by mail: this only asks for the link, and the new password is chosen
 * on the page it opens.
 */
export function PasswordCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  // The supervisor's coach identity is only reached via POST /auth/switch, so a
  // password on it would never be used.
  const linkedToSupervisor = user?.linkedUser?.role === "SUPERVISOR"

  async function requestLink() {
    setSending(true)
    try {
      const res = await apiTry("/auth/password-change/request", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error)
      setSentTo(body.email)
    } catch (err) {
      toast({
        title: err instanceof Error && err.message ? err.message : "No se pudo enviar el mail",
        variant: "destructive",
      })
    }
    setSending(false)
  }

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="font-sans text-base font-medium">Contraseña</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {user?.impersonatedBy ? (
          <p className="text-xs text-muted-foreground">
            No disponible mientras ves la app como otro usuario.
          </p>
        ) : linkedToSupervisor ? (
          <p className="text-xs text-muted-foreground">
            Esta cuenta entra desde tu cuenta de supervisora: cambiá la contraseña desde allá.
          </p>
        ) : sentTo ? (
          <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-foreground">
              Te mandamos un link a <strong className="break-all">{sentTo}</strong>. Abrilo para
              elegir la contraseña nueva; vence en 1 hora.
            </span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Por seguridad, te mandamos un link a tu email para confirmar que sos vos. Tu contraseña
              actual sigue funcionando hasta que elijas la nueva.
            </p>
            <Button size="sm" variant="outline" disabled={sending} onClick={requestLink}>
              {sending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Cambiar contraseña
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
