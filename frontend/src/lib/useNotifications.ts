import { useEffect, useState, useCallback } from "react"
import { apiJson } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export interface SupervisorCounts {
  pendingSupervisions: number
  pendingSubmissions: number
  pendingSignups: number
}

export interface StudentCounts {
  pendingTests: number
  pendingFeedback: number
}

const POLL_MS = 30_000

/**
 * Badge counts for the sidebar. Fetches the role-appropriate notifications
 * endpoint and re-polls every 30s so the balloons stay fresh without every
 * page having to trigger a manual refresh. Exposes `refresh` for callers that
 * want to force a re-fetch right after an action.
 */
export function useNotifications(): {
  supervisor: SupervisorCounts | null
  student: StudentCounts | null
  refresh: () => void
} {
  const { user } = useAuth()
  const [supervisor, setSupervisor] = useState<SupervisorCounts | null>(null)
  const [student, setStudent] = useState<StudentCounts | null>(null)

  const refresh = useCallback(() => {
    if (!user) return
    if (user.role === "SUPERVISOR") {
      apiJson<SupervisorCounts>("/supervisor/notifications").then(setSupervisor).catch(() => {})
    } else {
      apiJson<StudentCounts>("/student/notifications").then(setStudent).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { supervisor, student, refresh }
}

interface NavItem {
  href: string
  label: string
}

/**
 * Map sidebar nav items to their pending badge count for the current role.
 * Returns null where nothing should be shown.
 */
export function badgeForRole(
  role: string | undefined,
  item: NavItem,
  supervisor: SupervisorCounts | null,
  student: StudentCounts | null
): number | null {
  if (role === "SUPERVISOR" && supervisor) {
    if (item.href === "/supervisor/supervision") return supervisor.pendingSupervisions
    if (item.href === "/supervisor/entregas") return supervisor.pendingSubmissions
    if (item.href === "/supervisor/inscripciones") return supervisor.pendingSignups
  }
  if (role === "STUDENT_COACH" && student) {
    if (item.href === "/student/my-tests") return student.pendingTests
    if (item.href === "/student/supervision") return student.pendingFeedback
  }
  return null
}
