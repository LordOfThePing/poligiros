"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Lock, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const TEST_ROUTES: Record<string, string> = {
  ANCLAS_CARRERA: "anclas-carrera",
  TABLERO_IDEAS: "tablero-ideas",
  PLAN_VITAL: "plan-vital",
  PIRAMIDE_PROPOSITO: "piramide-proposito",
}

const COMING_SOON = new Set(["PLAN_VITAL"])

const ESTIMATED_TIME: Record<string, string> = {
  ANCLAS_CARRERA: "~20 minutos",
  TABLERO_IDEAS: "~15 minutos",
  PLAN_VITAL: "Próximamente",
  PIRAMIDE_PROPOSITO: "~15 minutos",
}

type TestCard = {
  testType: string
  testTitle: string
  testDescription: string
  assignment: { id: string; completedAt: string | null; hasResponse: boolean } | null
}

export default function ClientHomePage() {
  const { data: session } = useSession()
  const [cards, setCards] = useState<TestCard[]>([])

  useEffect(() => {
    fetch("/api/client/assignments").then((r) => r.json()).then(setCards)
  }, [])

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="font-serif text-3xl text-foreground">
          Hola, {session?.user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Estos son tus instrumentos de autoconocimiento
        </p>
      </div>

      <div className="space-y-3">
        {cards.map((card) => {
          const isComingSoon = COMING_SOON.has(card.testType)
          const isCompleted = !!card.assignment?.completedAt
          const isAssigned = !!card.assignment && !isCompleted
          const isLocked = !card.assignment && !isComingSoon

          const content = (
            <div className={cn(
              "bg-white rounded-xl border border-border p-5 flex items-center gap-4 transition-all",
              isCompleted && "border-green-200 bg-green-50/30",
              (isLocked || isComingSoon) && "opacity-60 cursor-default",
              (isAssigned) && "hover:shadow-md cursor-pointer"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                isCompleted && "bg-green-100",
                isAssigned && "bg-brand-accent/10",
                (isLocked || isComingSoon) && "bg-muted",
              )}>
                {isCompleted
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : isComingSoon || isLocked
                  ? <Lock className="h-4 w-4 text-muted-foreground" />
                  : <span className="text-brand-accent font-bold text-sm">{card.testType.slice(0, 2)}</span>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground">{card.testTitle}</h3>
                  {isCompleted && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Enviado ✓</Badge>
                  )}
                  {(isComingSoon || isLocked) && (
                    <Badge variant="secondary" className="text-xs">Próximamente</Badge>
                  )}
                  {isAssigned && (
                    <span className="text-xs text-muted-foreground">{ESTIMATED_TIME[card.testType]}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{card.testDescription}</p>
              </div>

              {isAssigned && <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
            </div>
          )

          if (isAssigned && card.assignment) {
            return (
              <Link key={card.testType} href={`/client/test/${TEST_ROUTES[card.testType]}/${card.assignment.id}`}>
                {content}
              </Link>
            )
          }

          return <div key={card.testType}>{content}</div>
        })}
      </div>
    </div>
  )
}
