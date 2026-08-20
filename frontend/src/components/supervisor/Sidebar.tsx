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
  UserPlus,
  Inbox,
  Settings,
  Eye,
} from "lucide-react"
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar"
import { ProfileMenu } from "@/components/ProfileMenu"
import { useNotifications, badgeForRole } from "@/lib/useNotifications"

const links = [
  { href: "/supervisor/panel", label: "Panel", icon: LayoutDashboard },
  { href: "/supervisor/alumnos", label: "Alumnos", icon: Users },
  { href: "/supervisor/supervision", label: "Tests", icon: ClipboardCheck },
  { href: "/supervisor/registros", label: "Registros", icon: FileText },
  { href: "/supervisor/modulos", label: "Módulos", icon: BookOpen },
  { href: "/supervisor/preview", label: "Vista de CIC", icon: Eye },
  { href: "/supervisor/entregas", label: "Tareas", icon: Inbox },
  { href: "/supervisor/cohortes", label: "CIC", icon: GraduationCap },
  { href: "/supervisor/inscripciones", label: "Inscripciones", icon: UserPlus },
  { href: "/supervisor/configuracion", label: "Configuración", icon: Settings },
]

export function SupervisorSidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { supervisor } = useNotifications()

  return (
    <CollapsibleSidebar
      roleLabel="Supervisora"
      footer={({ expanded, keepOpen }) => (
        <ProfileMenu collapsed={!expanded} keepOpen={keepOpen} />
      )}
    >
      {({ expanded }) => (
        <div className={cn("space-y-1", !expanded && "flex flex-col items-center")}>
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
        </div>
      )}
    </CollapsibleSidebar>
  )
}
