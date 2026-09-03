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
  Award,
  type LucideIcon,
} from "lucide-react"
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar"
import { ProfileMenu } from "@/components/ProfileMenu"
import { HelpLauncher, SupportLink } from "@/components/HelpGuide"
import { useNotifications, badgeForRole } from "@/lib/useNotifications"

type NavItem = { href: string; label: string; icon: LucideIcon }
type NavGroup = { title: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    title: "Principal",
    items: [{ href: "/supervisor/panel", label: "Panel", icon: LayoutDashboard }],
  },
  {
    title: "Alumnos",
    items: [
      { href: "/supervisor/alumnos", label: "Alumnos", icon: Users },
      { href: "/supervisor/preview", label: "Vista de CIC", icon: Eye },
    ],
  },
  {
    title: "Seguimiento",
    items: [
      { href: "/supervisor/supervision", label: "Tests a revisar", icon: ClipboardCheck },
      { href: "/supervisor/entregas", label: "Tareas a revisar", icon: Inbox },
      { href: "/supervisor/registros", label: "Registros de sesión", icon: FileText },
    ],
  },
  {
    title: "Programa",
    items: [{ href: "/supervisor/modulos", label: "Módulos y contenido", icon: BookOpen }],
  },
  {
    title: "Administración",
    items: [
      { href: "/supervisor/cohortes", label: "Camadas (CIC)", icon: GraduationCap },
      { href: "/supervisor/pools", label: "Coaches certificados", icon: Award },
      { href: "/supervisor/inscripciones", label: "Inscripciones", icon: UserPlus },
      { href: "/supervisor/configuracion", label: "Configuración", icon: Settings },
    ],
  },
]

export function SupervisorSidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { supervisor } = useNotifications()

  const renderItem = ({ href, label, icon: Icon }: NavItem, expanded: boolean) => {
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
  }

  return (
    <CollapsibleSidebar
      roleLabel="Supervisora"
      footer={({ expanded, keepOpen }) => (
        <div className="space-y-1">
          <SupportLink collapsed={!expanded} />
          <HelpLauncher collapsed={!expanded} />
          <ProfileMenu collapsed={!expanded} keepOpen={keepOpen} />
        </div>
      )}
    >
      {({ expanded }) =>
        expanded ? (
          <nav className="space-y-4">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1">
                  {g.title}
                </p>
                <div className="space-y-1">
                  {g.items.map((item) => renderItem(item, true))}
                </div>
              </div>
            ))}
          </nav>
        ) : (
          <div className="flex flex-col items-center space-y-1">
            {groups.flatMap((g) => g.items).map((item) => renderItem(item, false))}
          </div>
        )
      }
    </CollapsibleSidebar>
  )
}
