import { MoreHorizontal, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Supervisora",
  STUDENT_COACH: "Coach",
}

/** The initials avatar shown in the sidebar profile. */
export function ProfileAvatar({ name }: { name?: string }) {
  const initials = (name ?? "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-white text-sm font-semibold">
      {initials}
    </span>
  )
}

/**
 * Sidebar footer profile: shows the logged-in user (avatar + name/email when
 * expanded) and a menu that opens a dropdown with "Cerrar sesión". In the
 * collapsed rail only the avatar shows, but it is still clickable to open the
 * same menu. No separate logout button sits below it.
 */
export function ProfileMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={
            collapsed
              ? "mx-auto flex rounded-full hover:ring-2 hover:ring-brand-accent/30 transition-shadow"
              : "w-full flex items-center gap-2 rounded-lg hover:bg-muted transition-colors text-left px-3 py-2.5"
          }
          title={collapsed ? `${user.name} — ${ROLE_LABELS[user.role] ?? user.role}` : user.name}
          aria-label="Menú de usuario"
        >
          <ProfileAvatar name={user.name} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground truncate">{user.name}</span>
                <span className="block text-xs text-muted-foreground truncate">{user.email}</span>
                <span className="block text-[0.7rem] font-medium text-brand-accent">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </span>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => logout()}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
