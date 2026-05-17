import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const student = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      enrollments: { include: { cohort: true } },
      clients: {
        include: {
          assignments: {
            include: {
              test: true,
              response: true,
              supervision: true,
            },
          },
          sessions: { orderBy: { sessionNum: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      moduleProgress: { include: { module: true }, orderBy: { completedAt: "asc" } },
      supervisionRequests: {
        include: {
          assignment: { include: { test: true, client: true } },
          supervisor: true,
        },
        orderBy: { createdAt: "desc" },
      },
      sessionRecords: {
        include: { client: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(student)
}
