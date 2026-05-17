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
