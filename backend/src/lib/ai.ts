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

// Concise definitions grounded in Edgar Schein's "Career Anchors" (la definición
// de cada ancla según su propio marco). Se inyectan en el prompt para que el
// insight se apoye en la teoría de Schein y no en generalidades.
const ANCHOR_DESCRIPTIONS: Record<string, string> = {
  TF: "Competencia Técnica/Funcional: se motiva por ser experto/a y alcanzar la maestría en un área específica; quiere que lo reconozcan por su pericia y evita roles que lo alejen de su especialidad.",
  GG: "Competencia Gerencial General: aspira a integrar funciones, liderar personas y asumir la responsabilidad por resultados globales; le atrae la autoridad, el análisis y el manejo interpersonal.",
  AU: "Autonomía/Independencia: prioriza la libertad para definir su propio trabajo, ritmo y reglas; le incomodan las normas rígidas y la supervisión cercana.",
  SE: "Seguridad/Estabilidad: busca previsibilidad, estabilidad laboral y financiera a largo plazo; valora la pertenencia, los beneficios y un futuro predecible.",
  CE: "Creatividad Emprendedora: necesita crear algo propio (un negocio, producto o proyecto), ser dueño/a de su creación y demostrar que puede construir desde cero.",
  SC: "Servicio/Dedicación a una causa: se motiva por contribuir a valores y causas que importan (ayudar a otros, mejorar el mundo); necesita que su trabajo tenga un propósito significativo.",
  PD: "Puro Desafío: se motiva por resolver problemas difíciles, vencer obstáculos y competir; busca desafíos cada vez más exigentes y se aburre con lo rutinario.",
  EV: "Estilo de Vida: busca integrar y equilibrar trabajo, familia y vida personal; prioriza la flexibilidad para sostener un estilo de vida integral por encima de la carrera en sí.",
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
    const anchorBlock = top3
      .map(
        (a, i) =>
          `${i + 1}. ${ANCHOR_NAMES[a]} (${a}) — ${scores[a]} puntos\n   Definición de Schein: ${ANCHOR_DESCRIPTIONS[a]}`,
      )
      .join("\n")

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sos un coach de carrera experto en el modelo de Anclas de Carrera de Edgar Schein. " +
            "Tu insight debe apoyarse fielmente en las definiciones de Schein de cada ancla (no en generalidades) " +
            "y reflejar cómo se combinan las anclas dominantes de la persona. " +
            "Escribís en español rioplatense, en segunda persona (vos), de forma cálida, concreta y personalizada. " +
            "Devolvés entre 4 y 6 oraciones, sin listas ni títulos.",
        },
        {
          role: "user",
          content: `Una persona completó el Test de Anclas de Carrera de Edgar Schein. Estas son sus 3 anclas dominantes (de mayor a menor):
${anchorBlock}

Generá un insight personalizado que:
- Interprete qué la mueve realmente combinando estas tres anclas (no las describas por separado de forma genérica).
- Mencione el tipo de trabajo, entorno y cultura organizacional donde más prosperaría.
- Señale una posible tensión o trade-off entre sus anclas (según Schein, las anclas en conflicto fuerzan decisiones) y cómo navegarla.
- Cierre con una recomendación práctica para sus próximas decisiones de carrera.`,
        },
      ],
      max_tokens: 320,
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
