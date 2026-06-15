import OpenAI from "openai"

// Shared OpenAI helpers, reused by both transports (coachee token routes and
// coach session routes). All functions degrade gracefully: with no API key or
// on any error they return a null/empty result so the test can still be saved.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ANCHOR_NAMES: Record<string, string> = {
  TF: "Técnico/Funcional",
  GG: "Gerencia General",
  AU: "Autonomía",
  SE: "Seguridad/Estabilidad",
  CE: "Creativo-Emprendedor",
  SC: "Servicio a la Causa",
  PD: "Puro Desafío",
  EV: "Estilo de Vida",
}

/** Anclas de Carrera — a short personalized insight from the top-3 anchors. */
export async function generateAnclasInsight(
  ranking: string[],
  scores: Record<string, number>,
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null
  const top3 = (ranking ?? []).slice(0, 3)
  if (top3.length < 3) return null
  try {
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
    return completion.choices[0]?.message?.content ?? null
  } catch (e) {
    console.error("ai-insight generation failed:", e)
    return null
  }
}

/** Tablero de Ideas — generate fresh idea cards after the user finishes theirs. */
export async function generateTableroIdeas(input: {
  saber?: string[]
  querer?: string[]
  sonar?: string[]
  brainstormIdeas?: string[]
}): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return []
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sos un experto en ideación y orientación profesional. Generás ideas cortas (máximo 10 palabras), creativas y accionables, en español rioplatense. Devolvés SOLO un objeto JSON.",
        },
        {
          role: "user",
          content: `Basándote en este Tablero de Ideas de una persona:
SABER (su experiencia): ${(input.saber ?? []).join(", ")}
QUERER (lo que disfruta): ${(input.querer ?? []).join(", ")}
SOÑAR (sus aspiraciones): ${(input.sonar ?? []).join(", ")}
Ideas que ya pensó: ${(input.brainstormIdeas ?? []).join(" | ")}
Generá 5 ideas NUEVAS y distintas (negocios, trabajos u ocupaciones, proyectos) que conecten sus columnas y no repitan las que ya pensó.
Devolvé un JSON con esta forma exacta: { "ideas": ["idea 1", "idea 2", "idea 3", "idea 4", "idea 5"] }`,
        },
      ],
      max_tokens: 300,
    })
    const content = completion.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(content)
    return Array.isArray(parsed.ideas)
      ? parsed.ideas.filter((x: unknown): x is string => typeof x === "string").slice(0, 6)
      : []
  } catch (e) {
    console.error("ai-ideas generation failed:", e)
    return []
  }
}
