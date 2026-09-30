import { useNavigate } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { apiTry } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

/**
 * Sticky banner that only renders while the session is an admin impersonating
 * another user (see /auth/me → impersonatedBy). Clicking "Volver" clears the
 * impersonation cookie and full-reloads so every page refetches under the real
 * admin identity, without having to prop-drill or refactor a query cache.
 */
export function ImpersonationBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user?.impersonatedBy) return null

  async function stop() {
    await apiTry("/admin/impersonate", { method: "DELETE" })
    // Full reload so every mounted page re-hydrates as the admin.
    window.location.href = "/admin"
    navigate("/admin", { replace: true })
  }

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-black text-sm shadow">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 justify-between">
        <div className="truncate">
          <strong>Admin:</strong> estás viendo la app como{" "}
          <strong>{user.name}</strong> <span className="opacity-70">({user.email} · {user.role})</span>
        </div>
        <Button size="sm" variant="secondary" onClick={stop} className="shrink-0">
          <LogOut className="h-4 w-4 mr-1" />
          Volver a admin
        </Button>
      </div>
    </div>
  )
}
