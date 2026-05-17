import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

export default function PlanVitalPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Plan Vital Integral®</h1>
          <p className="text-muted-foreground leading-relaxed">
            Esta herramienta estará disponible muy pronto. Tu coach te avisará cuando esté lista.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/client">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  )
}
