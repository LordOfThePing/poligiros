import { useState } from "react"
import { Button } from "@/components/ui/button"

// "Ver datos crudos" — reveals the underlying raw response for the tests that
// carry data beyond the formatted summary: Anclas (the 40 answers + bonus +
// final) and Pirámide (the raw fields). Reused by the client ResultsView and
// the supervisor ResponseViewer.
export function RawDataView({
  testType,
  responses,
}: {
  testType: string
  responses: Record<string, unknown>
}) {
  const [show, setShow] = useState(false)
  if (testType !== "ANCLAS_CARRERA" && testType !== "PIRAMIDE_PROPOSITO") return null

  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setShow((s) => !s)}>
        {show ? "Ocultar datos crudos" : "Ver datos crudos"}
      </Button>
      {show && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4 text-xs space-y-4">
          {testType === "ANCLAS_CARRERA" && <AnclasRaw responses={responses} />}
          {testType === "PIRAMIDE_PROPOSITO" && <PiramideRaw responses={responses} />}
        </div>
      )}
    </div>
  )
}

function AnclasRaw({ responses }: { responses: Record<string, unknown> }) {
  const raw = (responses.rawAnswers as number[] | undefined) ?? []
  const final = (responses.finalAnswers as number[] | undefined) ?? []
  const bonus = (responses.bonusItems as number[] | undefined) ?? []
  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-foreground mb-1.5">Respuestas (afirmación: 1-6)</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
          {raw.map((v, i) => (
            <span key={i} className="rounded bg-white border border-border px-1.5 py-1 text-center tabular-nums">
              {i + 1}: <span className="font-semibold text-foreground">{v}</span>
            </span>
          ))}
        </div>
      </div>
      {bonus.length > 0 && (
        <p>
          <span className="font-medium text-foreground">Ítems bonus (+4): </span>
          {bonus.map((i) => `#${i + 1}`).join(", ")}
        </p>
      )}
      {final.length > 0 && (
        <div>
          <p className="font-medium text-foreground mb-1.5">Respuestas finales (con bonus)</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
            {final.map((v, i) => (
              <span key={i} className="rounded bg-white border border-border px-1.5 py-1 text-center tabular-nums">
                {i + 1}: <span className="font-semibold text-foreground">{v}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PiramideRaw({ responses }: { responses: Record<string, unknown> }) {
  const fields = ["rol", "valores", "fortalezas", "contextos", "especialidad", "propositoFinal"]
  return (
    <div className="space-y-2">
      {fields.map((f) =>
        responses[f] ? (
          <p key={f}>
            <span className="font-medium text-foreground uppercase">{f}: </span>
            <span className="whitespace-pre-wrap">{String(responses[f])}</span>
          </p>
        ) : null,
      )}
    </div>
  )
}
