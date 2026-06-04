import { useAuth } from "@/lib/auth"

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Supervisora",
  STUDENT_COACH: "Coach",
}

// Compact profile card for the sidebar footer (bottom-left), shown for the
// logged-in supervisor and coach. Reads the current user from useAuth().
export function ProfileBanner() {
  const { user } = useAuth()
  if (!user) return null

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-brand-accent/5 border border-brand-accent/15">
      <div className="h-9 w-9 rounded-full bg-brand-accent text-white flex items-center justify-center text-sm font-semibold shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-[0.7rem] font-medium text-brand-accent">{ROLE_LABELS[user.role] ?? user.role}</p>
      </div>
    </div>
  )
}
