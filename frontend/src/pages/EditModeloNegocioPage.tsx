import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { EditableResult } from "@/components/EditableResult"
import { LoadingBadge } from "@/components/LoadingBadge"
import { useToast } from "@/hooks/use-toast"
import { apiJson, apiTry } from "@/lib/api"

const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "")

type EditState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; testType: string; responses: Record<string, unknown> }

type FlowProps = {
  // Where to GET the current responses from.
  loadUrl: string
  // Where to PUT the saved responses.
  saveUrl: string
  // Where to go after saving / cancelling.
  backHref: string
  // Public (token) or authenticated.
  mode: "token" | "session"
}

function EditFlow({ loadUrl, saveUrl, backHref, mode }: FlowProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [state, setState] = useState<EditState>({ state: "loading" })

  useEffect(() => {
    const fetchIt = async () => {
      try {
        if (mode === "session") {
          const data = await apiJson<{
            testType: string
            responses: Record<string, unknown>
          }>(loadUrl)
          setState({ state: "ready", testType: data.testType, responses: data.responses })
          return
        }
        const res = await fetch(loadUrl, { credentials: "include" })
        if (!res.ok) throw new Error(await res.text())
        const data = (await res.json()) as { testType: string; responses: Record<string, unknown> }
        setState({ state: "ready", testType: data.testType, responses: data.responses })
      } catch (e) {
        setState({ state: "error", message: (e as Error).message || "No se pudo cargar" })
      }
    }
    fetchIt()
  }, [loadUrl, mode])

  async function save(responses: Record<string, unknown>) {
    const res =
      mode === "session"
        ? await apiTry(saveUrl, { method: "PUT", body: JSON.stringify({ responses }) })
        : await fetch(saveUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ responses }),
          })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ message: "No se pudo guardar" }))
      toast({
        title: j.message || "No se pudo guardar",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Resultado actualizado", description: "Vuelve a supervisión para una nueva revisión." })
    navigate(backHref)
  }

  return (
    <div className="min-h-dvh bg-brand-bg py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-4">
        <button
          onClick={() => navigate(backHref)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h1 className="font-serif text-2xl text-foreground">Editar resultado</h1>
        <p className="text-xs text-muted-foreground">
          Podés editar las veces que quieras. Cada edición vuelve a supervisión y le avisa a Gaby
          para que lea la versión más nueva.
        </p>
        {state.state === "loading" && <LoadingBadge />}
        {state.state === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        {state.state === "ready" && (
          <EditableResult testType={state.testType} responses={state.responses} onSave={save} />
        )}
      </div>
    </div>
  )
}

/** Coachee (token) full-screen editor for Modelo de Negocio. */
export function ClientEditModeloNegocioPage() {
  const { token } = useParams<{ token: string }>()
  return (
    <EditFlow
      mode="token"
      loadUrl={`${API_URL}/client/t/${token}`}
      saveUrl={`${API_URL}/client/t/${token}/edit`}
      backHref={`/t/${token}`}
    />
  )
}

/** Coach full-screen editor for Modelo de Negocio in a coachee's file. */
export function StudentEditModeloNegocioPage() {
  const { clientId, assignmentId } = useParams<{ clientId: string; assignmentId: string }>()
  return (
    <EditFlow
      mode="session"
      loadUrl={`/student/assignments/${assignmentId}`}
      saveUrl={`/student/responses/${assignmentId}`}
      backHref={`/student/clientes/${clientId}`}
    />
  )
}
