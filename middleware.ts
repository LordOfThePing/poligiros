import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Already at correct role-based root
    if (pathname === "/supervisor" || pathname === "/student" || pathname === "/client") {
      return NextResponse.next()
    }

    // Root redirect based on role
    if (pathname === "/") {
      if (!token) return NextResponse.redirect(new URL("/login", req.url))
      const dest =
        token.role === "SUPERVISOR"
          ? "/supervisor/panel"
          : token.role === "STUDENT_COACH"
          ? "/student/programa"
          : "/client"
      return NextResponse.redirect(new URL(dest, req.url))
    }

    // Guard supervisor routes
    if (pathname.startsWith("/supervisor") && token?.role !== "SUPERVISOR") {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Guard student routes
    if (pathname.startsWith("/student") && token?.role !== "STUDENT_COACH") {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Guard client routes
    if (pathname.startsWith("/client") && token?.role !== "CLIENT_USER") {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // Public routes
        if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
}
