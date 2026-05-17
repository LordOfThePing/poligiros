import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendSessionRecordedEmail } from "@/lib/email"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessions = await prisma.sessionRecord.findMany({
    where: { studentId: session.user.id },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const {
    clientId,
    sessionNum,
    coacheeName,
    coacheeAge,
    coacheeSex,
    coacheeWorks,
    coacheePosition,
    sessionDate,
    mainOutputs,
    toolsAndResults,
    conclusions,
  } = body

  // Verify client belongs to this student
  const client = await prisma.client.findFirst({
    where: { id: clientId, studentId: session.user.id },
  })
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const record = await prisma.sessionRecord.create({
    data: {
      studentId: session.user.id,
      clientId,
      sessionNum: parseInt(sessionNum),
      coacheeName,
      coacheeAge,
      coacheeSex,
      coacheeWorks,
      coacheePosition: coacheeWorks ? coacheePosition : null,
      sessionDate: new Date(sessionDate),
      mainOutputs,
      toolsAndResults,
      conclusions,
    },
    include: { client: true, student: true },
  })

  // Fire-and-forget email to supervisor
  const supervisor = await prisma.user.findFirst({ where: { role: "SUPERVISOR" } })
  if (supervisor) {
    sendSessionRecordedEmail(
      supervisor.email,
      record.student.name,
      record.client.name,
      record.sessionNum
    ).catch(() => {})
  }

  return NextResponse.json(record, { status: 201 })
}
