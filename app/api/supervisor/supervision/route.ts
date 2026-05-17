import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const requests = await prisma.supervisionRequest.findMany({
    include: {
      student: true,
      supervisor: true,
      assignment: {
        include: { test: true, client: true, response: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(requests)
}
