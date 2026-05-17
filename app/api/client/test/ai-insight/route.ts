import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional",
  GG: "Gerencia General",
  AU: "Autonomía",
  SE: "Seguridad/Estabilidad",
  CE: "Creativo-Empresario",
  SC: "Servicio a la Causa",
  PD: "Puro Desafío",
  EV: "Estilo de Vida",
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "CLIENT_USER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { ranking, scores } = await req.json()
  const top3 = (ranking as string[]).slice(0, 3)

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Sos un experto en coaching de carrera. Respondés en español rioplatense, de forma cálida, directa y personalizada. Máximo 4 oraciones.",
      },
      {
        role: "user",
        content: `Una persona completó el Test de Anclas de Carrera de Edgar Schein.
Sus top 3 anclas son:
1. ${ANCHOR_NAMES[top3[0]]} (${top3[0]}): ${scores[top3[0]]} puntos
2. ${ANCHOR_NAMES[top3[1]]} (${top3[1]}): ${scores[top3[1]]} puntos
3. ${ANCHOR_NAMES[top3[2]]} (${top3[2]}): ${scores[top3[2]]} puntos
Generá un insight personalizado sobre su perfil de carrera: qué tipo de trabajo, entorno y decisiones le darían más satisfacción a largo plazo.`,
      },
    ],
    max_tokens: 250,
  })

  const insight = completion.choices[0].message.content ?? ""
  return NextResponse.json({ insight })
}
