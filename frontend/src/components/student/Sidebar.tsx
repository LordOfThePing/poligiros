import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { BookOpen, Users, ClipboardCheck, FileText, ListChecks, type LucideIcon } from "lucide-react"
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar"
import { ProfileMenu } from "@/components/ProfileMenu"
import { HelpLauncher } from "@/components/HelpGuide"
import { useCoachAccess } from "@/lib/useCoachAccess"
import { useNotifications, badgeForRole } from "@/lib/useNotifications"

type NavItem = { href: string; label: string; icon: LucideIcon; needsPractice?: boolean }
type NavGroup = { title: string; items: NavItem[] }

// Practice items appear only once the supervisor enables practice for the cohort.
const groups: NavGroup[] = [
  {
    title: "Programa",
    items: [
      { href: "/student/programa", label: "Mi Programa", icon: BookOpen },
      { href: "/student/my-tests", label: "Mis Tests", icon: ListChecks },
    ],
  },
  {
    title: "Práctica",
    items: [
      { href: "/student/clientes", label: "Mis Coachees", icon: Users, needsPractice: true },
      { href: "/student/supervision", label: "Supervisión", icon: ClipboardCheck, needsPractice: true },
      { href: "/student/registros", label: "Mis Registros", icon: FileText, needsPractice: true },
    ],
  },
]

export function StudentSidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { access, loading } = useCoachAccess()
  const { student } = useNotifications()

  // While loading, show everything rather than flashing items away.
  const canPractice = loading || access?.practiceEnabled !== false

  const renderItem = ({ href, label, icon: Icon }: NavItem, expanded: boolean) => {
    const count = badgeForRole(user?.role, { href, label }, null, student)
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
      roleLabel="Coach"
      footer={({ expanded, keepOpen }) => (
        <div className="space-y-1">
          <HelpLauncher collapsed={!expanded} />
          <ProfileMenu collapsed={!expanded} keepOpen={keepOpen} />
        </div>
      )}
    >
      {({ expanded }) =>
        expanded ? (
          <>
            {groups.map((g) => {
              const items = g.items.filter((i) => !i.needsPractice || canPractice)
              if (items.length === 0 && g.title === "Práctica") return null
              return (
                <div key={g.title} className="space-y-4">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1">
                      {g.title}
                    </p>
                    <div className="space-y-1">
                      {items.map((item) => renderItem(item, true))}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <div className="flex flex-col items-center space-y-1">
            {groups
              .flatMap((g) => g.items)
              .filter((i) => !i.needsPractice || canPractice)
              .map((item) => renderItem(item, false))}
          </div>
        )
      }
    </CollapsibleSidebar>
  )
}
