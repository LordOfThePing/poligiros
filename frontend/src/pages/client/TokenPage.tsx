import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import AnclasTest from "./tests/AnclasTest"
import TableroTest from "./tests/TableroTest"
import PiramideTest from "./tests/PiramideTest"
import { ModeloNegocioTest } from "./tests/ModeloNegocioTest"
import ResultsView from "./ResultsView"
import { tokenTestApi, type TestApi } from "@/lib/testApi"

const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "")

type TokenState =
  | { state: "loading" }
  | { state: "form"; testType: string; assignmentId: string; title: string; prefillIdea?: string }
  | {
      state: "results"
      testType: string
      responses: Record<string, unknown>
      coachFeedback: string | null
      completedAt: string
    }
  | { state: "expired" }
  | { state: "error"; message: string }

export default function TokenPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<TokenState>({ state: "loading" })
  const [editing, setEditing] = useState(false)

  // The coachee (token) flow gets its own terracotta theme.
  useEffect(() => {
    document.documentElement.dataset.role = "COACHEE"
    return () => {
      if (document.documentElement.dataset.role === "COACHEE") {
        delete document.documentElement.dataset.role
      }
    }
  }, [])

  const load = useCallback(() => {
    if (!token) return
    fetch(`${API_URL}/client/t/${token}`, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 404) {
          setData({ state: "error", message: "Enlace inválido." })
          return
        }
        if (res.status === 410) {
          setData({ state: "expired" })
          return
        }
        const json = await res.json()
        setData(json)
      })
      .catch(() => setData({ state: "error", message: "Error de red." }))
  }, [token])

  useEffect(() => { load() }, [load])

  if (data.state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    )
  }

  if (data.state === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-4xl">⏰</p>
          <h1 className="font-serif text-2xl text-foreground">Este enlace caducó</h1>
          <p className="text-muted-foreground">Pedile uno nuevo a tu coach.</p>
        </div>
      </div>
    )
  }

  if (data.state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-serif text-2xl text-foreground">Enlace no encontrado</h1>
          <p className="text-muted-foreground">{data.message}</p>
        </div>
      </div>
    )
  }

  if (data.state === "results") {
    const wide = data.testType === "MODELO_NEGOCIO" || data.testType === "TABLERO_IDEAS"
    const canEdit = data.testType === "TABLERO_IDEAS"

    if (editing && canEdit) {
      const editApi: TestApi = {
        ...tokenTestApi(token!),
        submit: (responses) =>
          fetch(`${API_URL}/client/t/${token}/edit`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ responses }),
          }),
      }
      return (
        <div className="min-h-screen bg-brand-bg py-8">
          <div className="max-w-2xl mx-auto px-4">
            <div className="mb-4">
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                ← Volver a mis resultados
              </button>
            </div>
            <TableroTest
              api={editApi}
              assignmentId={`edit-${token}`}
              initialResponses={data.responses}
              onDone={() => {
                setEditing(false)
                load()
              }}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-brand-bg py-8">
        <div className={`${wide ? "max-w-6xl" : "max-w-2xl"} mx-auto px-4`}>
          <ResultsView
            testType={data.testType}
            responses={data.responses}
            coachFeedback={data.coachFeedback}
            completedAt={data.completedAt}
          />
          {canEdit && (
            <div className="mt-6 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar mis respuestas
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // state === "form"
  if (data.state === "form") {
    const api = tokenTestApi(token!)
    const wide = data.testType === "MODELO_NEGOCIO"
    return (
      <div className="min-h-screen bg-brand-bg py-8">
        <div className={`${wide ? "max-w-6xl" : "max-w-2xl"} mx-auto px-4`}>
          {data.testType === "ANCLAS_CARRERA" && (
            <AnclasTest api={api} assignmentId={data.assignmentId} />
          )}
          {data.testType === "TABLERO_IDEAS" && (
            <TableroTest api={api} assignmentId={data.assignmentId} />
          )}
          {data.testType === "PIRAMIDE_PROPOSITO" && (
            <PiramideTest api={api} assignmentId={data.assignmentId} />
          )}
          {data.testType === "MODELO_NEGOCIO" && (
            <ModeloNegocioTest api={api} assignmentId={data.assignmentId} prefillIdea={data.prefillIdea} />
          )}
          {!["ANCLAS_CARRERA", "TABLERO_IDEAS", "PIRAMIDE_PROPOSITO", "MODELO_NEGOCIO"].includes(data.testType) && (
            <div className="text-center py-16">
              <h2 className="font-serif text-2xl">{data.title}</h2>
              <p className="text-muted-foreground mt-2">Este tipo de test no está disponible en este momento.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
