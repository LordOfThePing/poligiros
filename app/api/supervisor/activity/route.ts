import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [testResponses, supervisionRequests, sessionRecords] = await Promise.all([
    prisma.testResponse.findMany({
      take: 10,
      orderBy: { submittedAt: "desc" },
      include: {
        assignment: {
          include: {
            test: true,
            client: { include: { student: true } },
          },
        },
      },
    }),
    prisma.supervisionRequest.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        student: true,
        assignment: {
          include: { test: true, client: true },
        },
      },
    }),
    prisma.sessionRecord.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { student: true, client: true },
    }),
  ])

  type ActivityEvent = {
    type: string
    description: string
    date: Date
  }

  const events: ActivityEvent[] = [
    ...testResponses.map((r) => ({
      type: "test_submitted",
      description: `${r.assignment.client.student.name} envió el test "${r.assignment.test.title}" de ${r.assignment.client.name}`,
      date: r.submittedAt,
    })),
    ...supervisionRequests.map((s) => ({
      type: "supervision_sent",
      description: `${s.student.name} envió supervisión para "${s.assignment.test.title}" de ${s.assignment.client.name}`,
      date: s.createdAt,
    })),
    ...sessionRecords.map((s) => ({
      type: "session_recorded",
      description: `${s.student.name} registró la sesión #${s.sessionNum} con ${s.client.name}`,
      date: s.createdAt,
    })),
  ]

  events.sort((a, b) => b.date.getTime() - a.date.getTime())

  return NextResponse.json(events.slice(0, 10))
}
