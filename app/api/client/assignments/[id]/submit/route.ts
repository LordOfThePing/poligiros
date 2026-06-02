import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "CLIENT_USER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify assignment belongs to this user's client profile
  const clientProfile = await prisma.client.findUnique({
    where: { userId: session.user.id },
  })
  if (!clientProfile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 })
  }

  const assignment = await prisma.testAssignment.findFirst({
    where: { id: params.id, clientId: clientProfile.id },
  })
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  }

  // [T1] Block retake: a completed test must not be overwritten (it may already
  // be under supervision). The token/login flow shows results read-only, but
  // guard at the boundary so a direct POST can't clobber an existing response.
  if (assignment.completedAt) {
    return NextResponse.json({ error: "Ya completaste este test" }, { status: 409 })
  }

  const { responses } = await req.json()

  const [testResponse] = await prisma.$transaction([
    prisma.testResponse.upsert({
      where: { assignmentId: params.id },
      update: { responses },
      create: { assignmentId: params.id, responses },
    }),
    prisma.testAssignment.update({
      where: { id: params.id },
      data: { completedAt: new Date() },
    }),
  ])

  return NextResponse.json(testResponse)
}
