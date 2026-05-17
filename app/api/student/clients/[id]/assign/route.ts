import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { testId } = await req.json()

  // Verify client belongs to this student
  const client = await prisma.client.findFirst({
    where: { id: params.id, studentId: session.user.id },
  })
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Don't allow assigning PLAN_VITAL
  const test = await prisma.test.findUnique({ where: { id: testId } })
  if (!test || test.type === "PLAN_VITAL") {
    return NextResponse.json({ error: "Test not assignable" }, { status: 400 })
  }

  const assignment = await prisma.testAssignment.upsert({
    where: { testId_clientId: { testId, clientId: params.id } },
    update: {},
    create: {
      testId,
      clientId: params.id,
      assignedBy: session.user.id,
    },
    include: { test: true, response: true, supervision: true },
  })

  return NextResponse.json(assignment, { status: 201 })
}
