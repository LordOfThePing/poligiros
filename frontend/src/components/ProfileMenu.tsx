import { useState } from "react"
import { MoreHorizontal, LogOut, Repeat } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Supervisora",
  STUDENT_COACH: "Coach",
  ADMIN: "Admin",
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
 *
 * A linked account gets its switch button right above the profile, always in
 * sight. Not while impersonating: /auth/switch acts on the real session, which
 * is the admin's, and that one has no linked account.
 */
export function ProfileMenu({
  collapsed = false,
  keepOpen,
}: {
  collapsed?: boolean
  /** Keep the sidebar expanded while the menu is open (prevents flicker). */
  keepOpen?: (open: boolean) => void
}) {
  const { user, logout, switchAccount } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  if (!user) return null

  const switchLabel = user.linkedUser
    ? `Cambiar a ${ROLE_LABELS[user.linkedUser.role] ?? user.linkedUser.role}`
    : ""

  async function handleSwitch() {
    setSwitching(true)
    try {
      const next = await switchAccount()
      navigate(next.role === "SUPERVISOR" ? "/supervisor/panel" : "/student/programa")
    } catch {
      toast({ title: "No se pudo cambiar de cuenta", variant: "destructive" })
    }
    setSwitching(false)
  }

  return (
    <>
    {user.linkedUser && !user.impersonatedBy && (
      <button
        type="button"
        onClick={handleSwitch}
        disabled={switching}
        title={collapsed ? switchLabel : undefined}
        aria-label={switchLabel}
        className={
          "flex items-center justify-center gap-2 rounded-lg border border-brand-accent text-brand-accent font-medium transition-colors hover:bg-brand-accent hover:text-white disabled:opacity-60 " +
          (collapsed ? "mx-auto h-9 w-9" : "w-full px-3 py-2 text-sm")
        }
      >
        <Repeat className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{switchLabel}</span>}
      </button>
    )}
    <DropdownMenu onOpenChange={(open) => keepOpen?.(open)}>
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
    </>
  )
}
