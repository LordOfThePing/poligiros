import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT_COACH" },
    include: {
      enrollments: { include: { cohort: true } },
      clients: {
        include: {
          assignments: { include: { response: true } },
        },
      },
      moduleProgress: true,
      sessionRecords: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  })

  const result = students.map((s) => {
    const totalTests = s.clients.reduce((sum, c) => sum + c.assignments.length, 0)
    const completedTests = s.clients.reduce(
      (sum, c) => sum + c.assignments.filter((a) => a.completedAt).length,
      0
    )

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      cohort: s.enrollments[0]?.cohort?.name ?? "Sin cohorte",
      clientCount: s.clients.length,
      testsSubmitted: completedTests,
      modulesCompleted: s.moduleProgress.length,
      lastActivity: s.sessionRecords[0]?.createdAt ?? s.enrollments[0]?.enrolledAt ?? s.createdAt,
    }
  })

  return NextResponse.json(result)
}
