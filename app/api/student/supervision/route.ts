import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendSupervisionSubmittedEmail } from "@/lib/email"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Completed assignments not yet submitted for supervision
  const clientsOfStudent = await prisma.client.findMany({
    where: { studentId: session.user.id },
    select: { id: true },
  })
  const clientIds = clientsOfStudent.map((c) => c.id)

  const [toSend, history] = await Promise.all([
    prisma.testAssignment.findMany({
      where: {
        clientId: { in: clientIds },
        completedAt: { not: null },
        supervision: null,
      },
      include: { test: true, client: true, response: true },
      orderBy: { completedAt: "desc" },
    }),
    prisma.supervisionRequest.findMany({
      where: { studentId: session.user.id },
      include: {
        assignment: {
          include: { test: true, client: true, response: true },
        },
        supervisor: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({ toSend, history })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { assignmentId, studentNotes } = await req.json()

  // Verify assignment belongs to this student's client
  const assignment = await prisma.testAssignment.findFirst({
    where: {
      id: assignmentId,
      client: { studentId: session.user.id },
      completedAt: { not: null },
    },
    include: { test: true, client: true },
  })
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  }

  const request = await prisma.supervisionRequest.create({
    data: {
      assignmentId,
      studentId: session.user.id,
      studentNotes,
    },
    include: {
      assignment: { include: { test: true, client: true } },
    },
  })

  // Fire-and-forget email to supervisor
  const supervisor = await prisma.user.findFirst({ where: { role: "SUPERVISOR" } })
  if (supervisor) {
    sendSupervisionSubmittedEmail(
      supervisor.email,
      session.user.name,
      assignment.client.name,
      assignment.test.title
    ).catch(() => {})
  }

  return NextResponse.json(request, { status: 201 })
}
