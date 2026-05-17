import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clients = await prisma.client.findMany({
    where: { studentId: session.user.id },
    include: {
      assignments: {
        include: { test: true, response: true, supervision: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(clients)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, email } = await req.json()

  const client = await prisma.client.create({
    data: { studentId: session.user.id, name, email },
    include: { assignments: { include: { test: true, response: true, supervision: true } } },
  })

  return NextResponse.json(client, { status: 201 })
}
