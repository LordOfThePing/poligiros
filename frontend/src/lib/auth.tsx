import React, { createContext, useContext, useEffect, useState } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { api } from "./api"

export type Role = "SUPERVISOR" | "STUDENT_COACH"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Hydrate on mount. A 401 returns a JSON error body, so guard on res.ok
    // instead of parsing it as a user (otherwise `user` becomes truthy).
    api("/auth/me")
      .then((res) => (res.ok ? (res.json() as Promise<AuthUser>) : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const res = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error("Login failed")

    const meRes = await api("/auth/me")
    if (!meRes.ok) throw new Error("Session hydration failed")
    setUser((await meRes.json()) as AuthUser)
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: JSON.stringify({}) })
    } catch {
      // ignore errors on logout
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

interface ProtectedRouteProps {
  roles?: Role[]
  children: React.ReactNode
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    // Redirect to the role's home
    if (user.role === "SUPERVISOR") return <Navigate to="/supervisor/panel" replace />
    if (user.role === "STUDENT_COACH") return <Navigate to="/student/programa" replace />
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
