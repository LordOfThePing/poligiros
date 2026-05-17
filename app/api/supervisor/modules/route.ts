import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const modules = await prisma.module.findMany({
    orderBy: { orderIndex: "asc" },
    include: { materials: true },
  })

  return NextResponse.json(modules)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { title, description, videoUrl, orderIndex } = body

  const maxOrder = await prisma.module.aggregate({ _max: { orderIndex: true } })
  const nextOrder = orderIndex ?? (maxOrder._max.orderIndex ?? 0) + 1

  const module = await prisma.module.create({
    data: { title, description, videoUrl, orderIndex: nextOrder, published: false },
    include: { materials: true },
  })

  return NextResponse.json(module, { status: 201 })
}
