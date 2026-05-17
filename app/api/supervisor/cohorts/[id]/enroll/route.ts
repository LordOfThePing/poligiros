import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email } = await req.json()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado con ese email" }, { status: 404 })
  }
  if (user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "El usuario no es un student coach" }, { status: 400 })
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_cohortId: { userId: user.id, cohortId: params.id } },
    update: {},
    create: { userId: user.id, cohortId: params.id },
    include: { user: true },
  })

  return NextResponse.json(enrollment, { status: 201 })
}
