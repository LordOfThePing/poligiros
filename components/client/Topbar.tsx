"use client"

import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function ClientTopbar() {
  const { data: session } = useSession()

  return (
    <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
      <h1 className="font-serif text-2xl text-brand-accent">Poligiros</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{session?.user?.name}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </div>
    </header>
  )
}
