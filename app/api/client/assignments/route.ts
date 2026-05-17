import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "CLIENT_USER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientProfile = await prisma.client.findUnique({
    where: { userId: session.user.id },
    include: {
      assignments: {
        include: { test: true, response: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  })

  if (!clientProfile) return NextResponse.json([], { status: 200 })

  // Build a full list of all 4 tests, merged with assignments
  const allTests = await prisma.test.findMany({ orderBy: { orderIndex: "asc" } })

  const result = allTests.map((test) => {
    const assignment = clientProfile.assignments.find((a) => a.test.type === test.type)
    return {
      testType: test.type,
      testTitle: test.title,
      testDescription: test.description,
      assignment: assignment
        ? {
            id: assignment.id,
            completedAt: assignment.completedAt,
            hasResponse: !!assignment.response,
          }
        : null,
    }
  })

  return NextResponse.json(result)
}
