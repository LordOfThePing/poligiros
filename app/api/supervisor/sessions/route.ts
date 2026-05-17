import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get("studentId")
  const clientId = searchParams.get("clientId")

  const sessions = await prisma.sessionRecord.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { student: true, client: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(sessions)
}
