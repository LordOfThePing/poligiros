import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await prisma.client.findFirst({
    where: { id: params.id, studentId: session.user.id },
    include: {
      assignments: {
        include: { test: true, response: true, supervision: true },
        orderBy: { assignedAt: "asc" },
      },
      sessions: { orderBy: { sessionNum: "asc" } },
    },
  })

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(client)
}
