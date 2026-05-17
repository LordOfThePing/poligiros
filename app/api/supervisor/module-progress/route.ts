import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const totalStudents = await prisma.user.count({ where: { role: "STUDENT_COACH" } })

  const modules = await prisma.module.findMany({
    where: { published: true },
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { progress: true } } },
  })

  const result = modules.map((m) => ({
    id: m.id,
    title: m.title,
    completedCount: m._count.progress,
    percentage: totalStudents > 0 ? Math.round((m._count.progress / totalStudents) * 100) : 0,
  }))

  return NextResponse.json(result)
}
