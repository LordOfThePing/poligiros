import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadToR2 } from "@/lib/r2"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File
  const title = formData.get("title") as string

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const key = `modules/${params.id}/${Date.now()}-${file.name}`
  const fileUrl = await uploadToR2(key, buffer, file.type)

  const material = await prisma.material.create({
    data: {
      moduleId: params.id,
      title: title || file.name,
      fileUrl,
      fileType: file.type,
    },
  })

  return NextResponse.json(material, { status: 201 })
}
