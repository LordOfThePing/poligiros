import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [modules, progress] = await Promise.all([
    prisma.module.findMany({
      where: { published: true },
      orderBy: { orderIndex: "asc" },
      include: { materials: true },
    }),
    prisma.moduleProgress.findMany({
      where: { userId: session.user.id },
    }),
  ])

  const completedIds = new Set(progress.map((p) => p.moduleId))

  const result = modules.map((m, idx) => ({
    ...m,
    completed: completedIds.has(m.id),
    locked: idx > 0 && !completedIds.has(modules[idx - 1].id),
  }))

  return NextResponse.json(result)
}
