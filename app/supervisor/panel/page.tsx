"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Users, ClipboardList, ClipboardCheck, Star } from "lucide-react"
import { formatDistanceToNow } from "@/lib/date"

type Stats = {
  activeStudents: number
  pendingTests: number
  pendingSupervisions: number
  reviewsThisMonth: number
}

type ActivityEvent = {
  type: string
  description: string
  date: string
}

type ModuleProgress = {
  id: string
  title: string
  completedCount: number
  percentage: number
}

export default function SupervisorPanelPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>([])

  useEffect(() => {
    fetch("/api/supervisor/stats").then((r) => r.json()).then(setStats)
    fetch("/api/supervisor/activity").then((r) => r.json()).then(setActivity)
    fetch("/api/supervisor/module-progress").then((r) => r.json()).then(setModuleProgress)
  }, [])

  const statCards = [
    { label: "Alumnos activos", value: stats?.activeStudents, icon: Users, color: "text-brand-accent" },
    { label: "Tests pendientes", value: stats?.pendingTests, icon: ClipboardList, color: "text-amber-600" },
    { label: "Supervisiones pendientes", value: stats?.pendingSupervisions, icon: ClipboardCheck, color: "text-indigo-600" },
    { label: "Revisiones este mes", value: stats?.reviewsThisMonth, icon: Star, color: "text-brand-secondary" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Panel de Supervisión</h1>
        <p className="text-muted-foreground text-sm">Resumen general de la cohorte</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${color}`}>
                    {value ?? "—"}
                  </p>
                </div>
                <Icon className={`h-5 w-5 mt-1 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity feed */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((event, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 rounded-full bg-brand-accent shrink-0" />
                    <div>
                      <p className="text-foreground">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(event.date))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Module progress */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Progreso en módulos</CardTitle>
          </CardHeader>
          <CardContent>
            {moduleProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin módulos publicados</p>
            ) : (
              <ul className="space-y-4">
                {moduleProgress.map((m) => (
                  <li key={m.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground truncate max-w-[200px]">{m.title}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{m.percentage}%</span>
                    </div>
                    <Progress value={m.percentage} className="h-2" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
