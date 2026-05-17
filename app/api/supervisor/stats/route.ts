import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeStudents, pendingTests, pendingSupervisions, reviewsThisMonth] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT_COACH" } }),
      prisma.testAssignment.count({ where: { completedAt: null } }),
      prisma.supervisionRequest.count({ where: { status: "PENDING" } }),
      prisma.supervisionRequest.count({
        where: { status: "REVIEWED", reviewedAt: { gte: startOfMonth } },
      }),
    ])

  return NextResponse.json({
    activeStudents,
    pendingTests,
    pendingSupervisions,
    reviewsThisMonth,
  })
}
