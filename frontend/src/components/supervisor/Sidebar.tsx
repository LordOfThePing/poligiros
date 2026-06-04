import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileText,
  BookOpen,
  GraduationCap,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileBanner } from "@/components/ProfileBanner"

const links = [
  { href: "/supervisor/panel", label: "Panel", icon: LayoutDashboard },
  { href: "/supervisor/alumnos", label: "Alumnos", icon: Users },
  { href: "/supervisor/supervision", label: "Supervisión", icon: ClipboardCheck },
  { href: "/supervisor/registros", label: "Registros", icon: FileText },
  { href: "/supervisor/modulos", label: "Módulos", icon: BookOpen },
  { href: "/supervisor/cohortes", label: "Cohortes", icon: GraduationCap },
]

export function SupervisorSidebar() {
  const location = useLocation()
  const { logout } = useAuth()

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-border flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h1 className="font-serif text-2xl text-brand-accent">Poligiros</h1>
        <p className="text-xs text-muted-foreground mt-1">Supervisora</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={cn(
              "sidebar-link",
              location.pathname.startsWith(href)
                ? "sidebar-link-active"
                : "sidebar-link-inactive"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <ProfileBanner />
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground gap-3"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
