import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cohorts = await prisma.cohort.findMany({
    orderBy: { startDate: "desc" },
    include: {
      enrollments: { include: { user: true } },
      _count: { select: { enrollments: true } },
    },
  })

  return NextResponse.json(cohorts)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, startDate } = await req.json()

  const cohort = await prisma.cohort.create({
    data: { name, startDate: new Date(startDate), active: true },
    include: { enrollments: { include: { user: true } }, _count: { select: { enrollments: true } } },
  })

  return NextResponse.json(cohort, { status: 201 })
}
