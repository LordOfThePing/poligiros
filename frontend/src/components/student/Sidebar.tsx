import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { BookOpen, Users, ClipboardCheck, FileText, ListChecks } from "lucide-react"
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar"
import { ProfileMenu } from "@/components/ProfileMenu"
import { useCoachAccess } from "@/lib/useCoachAccess"
import { useNotifications, badgeForRole } from "@/lib/useNotifications"

const links = [
  { href: "/student/programa", label: "Mi Programa", icon: BookOpen },
  { href: "/student/my-tests", label: "Mis Tests", icon: ListChecks },
  // Only once the supervisor opens practice with coachees for the cohort.
  { href: "/student/clientes", label: "Mis Clientes", icon: Users, needsPractice: true },
  { href: "/student/supervision", label: "Supervisión", icon: ClipboardCheck, needsPractice: true },
  { href: "/student/registros", label: "Mis Registros", icon: FileText, needsPractice: true },
]

export function StudentSidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { access, loading } = useCoachAccess()
  const { student } = useNotifications()

  // While loading, show everything rather than flashing items away.
  const visibleLinks = links.filter(
    (l) => !l.needsPractice || loading || access?.practiceEnabled !== false
  )

  return (
    <CollapsibleSidebar roleLabel="Coach">
      {({ expanded }) => (
        <>
          <div className={cn("space-y-1", !expanded && "flex flex-col items-center")}>
            {visibleLinks.map(({ href, label, icon: Icon }) => {
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
            })}
          </div>

          <div className={cn("border-t border-border", expanded ? "p-2.5" : "px-2 py-3")}>
            <ProfileMenu collapsed={!expanded} />
          </div>
        </>
      )}
    </CollapsibleSidebar>
  )
}
