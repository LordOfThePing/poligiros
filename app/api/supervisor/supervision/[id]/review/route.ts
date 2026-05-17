import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendSupervisionReviewedEmail } from "@/lib/email"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { supervisorNotes } = await req.json()

  const request = await prisma.supervisionRequest.update({
    where: { id: params.id },
    data: {
      supervisorId: session.user.id,
      supervisorNotes,
      status: "REVIEWED",
      reviewedAt: new Date(),
    },
    include: {
      student: true,
      assignment: { include: { test: true, client: true } },
    },
  })

  // Fire-and-forget email to student
  sendSupervisionReviewedEmail(
    request.student.email,
    request.assignment.client.name,
    request.assignment.test.title,
    supervisorNotes ?? ""
  ).catch(() => {})

  return NextResponse.json(request)
}
