import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const cohort = await prisma.cohort.update({
    where: { id: params.id },
    data: body,
    include: { enrollments: { include: { user: true } }, _count: { select: { enrollments: true } } },
  })

  return NextResponse.json(cohort)
}
