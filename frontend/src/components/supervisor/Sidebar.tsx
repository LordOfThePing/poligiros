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
  UserPlus,
  Inbox,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileBanner } from "@/components/ProfileBanner"
import { useNotifications, badgeForRole } from "@/lib/useNotifications"

const links = [
  { href: "/supervisor/panel", label: "Panel", icon: LayoutDashboard },
  { href: "/supervisor/alumnos", label: "Alumnos", icon: Users },
  { href: "/supervisor/supervision", label: "Tests", icon: ClipboardCheck },
  { href: "/supervisor/registros", label: "Registros", icon: FileText },
  { href: "/supervisor/modulos", label: "Módulos", icon: BookOpen },
  { href: "/supervisor/entregas", label: "Tareas", icon: Inbox },
  { href: "/supervisor/cohortes", label: "CIC", icon: GraduationCap },
  { href: "/supervisor/inscripciones", label: "Inscripciones", icon: UserPlus },
  { href: "/supervisor/configuracion", label: "Configuración", icon: Settings },
]

export function SupervisorSidebar() {
  const location = useLocation()
  const { logout, user } = useAuth()
  const { supervisor } = useNotifications()

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-border flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h1 className="font-serif text-2xl text-brand-accent">Poligiros</h1>
        <p className="text-xs text-muted-foreground mt-1">Supervisora</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const count = badgeForRole(user?.role, { href, label }, supervisor, null)
          return (
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
              <span className="flex-1">{label}</span>
              {typeof count === "number" && count > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.7rem] font-semibold leading-none text-white">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
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
