import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STUDENT_COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.moduleProgress.upsert({
    where: { userId_moduleId: { userId: session.user.id, moduleId: params.id } },
    update: {},
    create: { userId: session.user.id, moduleId: params.id },
  })

  return NextResponse.json({ ok: true })
}
