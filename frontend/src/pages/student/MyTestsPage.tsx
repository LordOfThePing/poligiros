import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { apiJson } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoadingBadge } from "@/components/LoadingBadge"

type MyAssignment = {
  id: string
  completedAt: string | null
  test: { type: string; title: string }
  /** Feedback from Gaby on a test the coach took on themself. */
  feedback: string | null
}

export default function StudentMyTestsPage() {
  const [tests, setTests] = useState<MyAssignment[]>([])
  const [loading, setLoading] = useState(true)
  // Which card's feedback is expanded.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    apiJson<MyAssignment[]>("/student/my-tests")
      .then(setTests)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingBadge />

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Mis Tests</h1>
        <p className="text-sm text-muted-foreground">Tests que te asignó tu coach</p>
      </div>

      {tests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no tenés tests asignados.</p>
      ) : (
        <div className="space-y-3">
          {tests.map((a) => {
            const open = expandedId === a.id
            return (
              <Card key={a.id} className="bg-white">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{a.test.title}</p>
                      {a.completedAt ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs mt-1">Completado ✓</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs mt-1">Pendiente</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.completedAt && a.feedback && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(open ? null : a.id)}
                          className="text-brand-accent hover:text-brand-accent"
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          Feedback de Gaby
                        </Button>
                      )}
                      {a.completedAt ? (
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/student/my-tests/${a.id}`}>Ver resultado</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" className="bg-brand-accent hover:bg-brand-accent-dark">
                          <Link to={`/student/my-tests/${a.id}`}>Hacer test</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {open && a.feedback && (
                    <div className="mt-3 bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1.5">Feedback de Gaby</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{a.feedback}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
