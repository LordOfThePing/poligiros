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
 * expanded) and a small menu icon to the right that opens a dropdown with
 * "Cerrar sesión". No separate logout button sits below it.
 */
export function ProfileMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user, logout } = useAuth()
  if (!user) return null

  // In a collapsed rail there is no room for the labels or the menu icon, and
  // the Radix dropdown machinery only adds jank when the rail is hovered — so
  // just show a static avatar there. The full menu appears once expanded.
  if (collapsed) {
    return (
      <div className="flex justify-center py-1" title={`${user.name} — ${ROLE_LABELS[user.role] ?? user.role}`}>
        <ProfileAvatar name={user.name} />
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-2 rounded-lg hover:bg-muted transition-colors text-left px-3 py-2.5"
          title={user.name}
          aria-label="Menú de usuario"
        >
          <ProfileAvatar name={user.name} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground truncate">{user.name}</span>
            <span className="block text-xs text-muted-foreground truncate">{user.email}</span>
            <span className="block text-[0.7rem] font-medium text-brand-accent">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </span>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
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
