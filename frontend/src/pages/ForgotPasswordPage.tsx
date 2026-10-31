import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { apiTry } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

/**
 * "Olvidé mi contraseña". The API answers the same for any address, so the
 * confirmation is worded as a maybe and never reveals whether the account exists.
 */
export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await apiTry("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
    } catch {
      setError("No pudimos procesar el pedido. Probá de nuevo en unos minutos.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-brand-accent mb-2">Poligiros</h1>
          <p className="text-muted-foreground text-sm">Recuperá el acceso a tu cuenta</p>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Olvidé mi contraseña</CardTitle>
            <CardDescription>
              {sent
                ? "Revisá tu casilla, y también la carpeta de spam."
                : "Ingresá tu email y te mandamos un link para elegir una contraseña nueva."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <p className="text-sm text-foreground">
                Si <strong className="break-all">{email}</strong> tiene una cuenta activa en Poligiros,
                en unos minutos le llega el link. Vence en 1 hora.
              </p>
            ) : (
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    "Enviar link"
                  )}
                </Button>
              </form>
            )}

            <Button asChild variant="ghost" className="w-full text-muted-foreground">
              <Link to="/login">Volver a ingresar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
