import { PasswordCard } from "@/components/PasswordCard"

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl text-foreground mb-1">Configuración</h1>
        <p className="text-muted-foreground text-sm">Los datos de acceso a tu cuenta.</p>
      </div>
      <PasswordCard />
    </div>
  )
}
