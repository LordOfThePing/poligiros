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
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar"
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
    <CollapsibleSidebar roleLabel="Supervisora">
      {({ expanded }) => (
        <>
          <nav className="space-y-1">
            {links.map(({ href, label, icon: Icon }) => {
              const count = badgeForRole(user?.role, { href, label }, supervisor, null)
              const active = location.pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    "sidebar-link relative",
                    expanded ? "" : "justify-center px-0",
                    active ? "sidebar-link-active" : "sidebar-link-inactive"
                  )}
                  title={expanded ? undefined : label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {expanded && <span className="flex-1 truncate">{label}</span>}
                  {expanded && typeof count === "number" && count > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.7rem] font-semibold leading-none text-white">
                      {count}
                    </span>
                  )}
                  {!expanded && typeof count === "number" && count > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-semibold leading-none text-white">
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className={cn("border-t border-border space-y-2", expanded ? "p-4" : "px-2 pt-3")}>
            <ProfileBanner collapsed={!expanded} />
            <Button
              variant="ghost"
              className={cn(
                "text-muted-foreground hover:text-foreground gap-3",
                expanded ? "w-full justify-start" : "w-full justify-center px-0"
              )}
              onClick={logout}
              title={expanded ? undefined : "Cerrar sesión"}
            >
              <LogOut className="h-4 w-4" />
              {expanded && "Cerrar sesión"}
            </Button>
          </div>
        </>
      )}
    </CollapsibleSidebar>
  )
}
