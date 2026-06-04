import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { apiJson } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type MyAssignment = {
  id: string
  completedAt: string | null
  test: { type: string; title: string }
}

export default function StudentMyTestsPage() {
  const [tests, setTests] = useState<MyAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson<MyAssignment[]>("/student/my-tests")
      .then(setTests)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-muted-foreground text-sm py-8">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Mis Tests</h1>
        <p className="text-sm text-muted-foreground">Tests que te asignó tu coach</p>
      </div>

      {tests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no tenés tests asignados.</p>
      ) : (
        <div className="space-y-3">
          {tests.map((a) => (
            <Card key={a.id} className="bg-white">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{a.test.title}</p>
                  {a.completedAt ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs mt-1">Completado ✓</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs mt-1">Pendiente</Badge>
                  )}
                </div>
                {a.completedAt ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/student/my-tests/${a.id}`}>Ver resultado</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" className="bg-brand-accent hover:bg-brand-accent-dark">
                    <Link to={`/student/my-tests/${a.id}`}>Hacer test</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
