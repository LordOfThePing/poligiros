// Single source of truth for the Business Model Canvas (post-Tablero workspace).
// Keys MUST stay identical to the original F7 DevelopIdea canvas blocks so any
// content already saved in IdeaDevelopment.content keeps rendering.

export interface CanvasBlock {
  key: string
  label: string
  /** Guiding question shown via the per-block info hint (from the reference image). */
  question: string
  /** Soft pastel surface, approximating the reference image. */
  tint: string
  /** CSS grid-area name used by the desktop layout. */
  area: string
}

export const CANVAS_BLOCKS: CanvasBlock[] = [
  {
    key: "sociosClave",
    label: "Socios clave",
    question:
      "¿Con quién necesitas asociarte para operar tu negocio? Ej: proveedores, aliados estratégicos, distribuidores.",
    tint: "bg-purple-50 border-purple-200",
    area: "socios",
  },
  {
    key: "actividadesClave",
    label: "Actividades clave",
    question:
      "¿Qué actividades principales debe realizar tu negocio para funcionar? Ej: producción, marketing, desarrollo, atención al cliente.",
    tint: "bg-violet-50 border-violet-200",
    area: "actividades",
  },
  {
    key: "recursosClave",
    label: "Recursos clave",
    question:
      "¿Qué recursos necesitas para entregar tu propuesta de valor? Ej: personal, tecnología, materiales, marca, financiamiento.",
    tint: "bg-sky-50 border-sky-200",
    area: "recursos",
  },
  {
    key: "propuestaValor",
    label: "Propuesta de valor",
    question:
      "¿Qué ofreces y por qué es valioso para tu cliente? Ej: conveniencia, calidad, precio, experiencia, exclusividad.",
    tint: "bg-emerald-50 border-emerald-200",
    area: "propuesta",
  },
  {
    key: "relacionClientes",
    label: "Relaciones con los clientes",
    question:
      "¿Cómo interactúas y mantienes el vínculo con tus clientes? Ej: atención personalizada, automatizada, fidelización, comunidad.",
    tint: "bg-amber-50 border-amber-200",
    area: "relaciones",
  },
  {
    key: "canales",
    label: "Canales",
    question:
      "¿Cómo haces llegar tu producto o servicio a los clientes? Ej: redes sociales, tiendas físicas, app, distribuidores.",
    tint: "bg-violet-50 border-violet-200",
    area: "canales",
  },
  {
    key: "segmentos",
    label: "Segmento de clientes",
    question:
      "¿A quién te diriges? ¿Quiénes son tus usuarios o compradores ideales? Ej: adolescentes, empresas pequeñas, padres de familia, veganos.",
    tint: "bg-rose-50 border-rose-200",
    area: "segmentos",
  },
  {
    key: "estructuraCostos",
    label: "Estructura de costos",
    question:
      "¿Cuáles son los costos más importantes para operar tu negocio? Ej: personal, logística, tecnología, publicidad.",
    tint: "bg-emerald-50 border-emerald-200",
    area: "costos",
  },
  {
    key: "fuentesIngresos",
    label: "Flujo de ingresos",
    question:
      "¿Cómo ganas dinero? ¿Qué están dispuestos a pagar tus clientes? Ej: venta directa, suscripción, comisión, licencias.",
    tint: "bg-rose-50 border-rose-200",
    area: "ingresos",
  },
]

// Desktop layout mirroring the reference image: 5 top columns (cols 2 and 4 split
// into two stacked blocks), then a 2-block bottom row. Mobile stacks vertically.
export const CANVAS_GRID_AREAS = `
  "socios actividades propuesta relaciones segmentos"
  "socios recursos     propuesta canales    segmentos"
  "costos costos       costos    ingresos   ingresos"
`

// "Puesto de trabajo" mode — research workspace, the JOB alternative to the Canvas.
export const JOB_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "roles", label: "Puestos / roles a investigar", placeholder: "Uno por línea..." },
  { key: "busquedas", label: "Búsquedas y job postings", placeholder: "Dónde y qué buscaste..." },
  { key: "links", label: "Links encontrados", placeholder: "Pegá los links relevantes..." },
  { key: "notas", label: "Notas", placeholder: "Requisitos, observaciones, próximos pasos..." },
]

// "Freelance / Autónomo" mode — the third career path alongside Canvas (business)
// and JOB (employment). Frames the idea as an independent service offering.
export const FREELANCE_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "servicio", label: "Servicio que ofrezco", placeholder: "¿Qué servicio independiente vas a ofrecer?" },
  { key: "clientesObjetivo", label: "Clientes objetivo", placeholder: "¿A quién le vendés tu servicio?" },
  { key: "propuestaValor", label: "Propuesta de valor", placeholder: "¿Por qué te elegirían a vos y no a otro?" },
  { key: "tarifas", label: "Tarifas y modelo de cobro", placeholder: "Por hora, por proyecto, retainer mensual..." },
  { key: "canales", label: "Canales para conseguir clientes", placeholder: "Referidos, redes, plataformas, networking..." },
  { key: "herramientas", label: "Herramientas y recursos", placeholder: "Qué necesitás para entregar el servicio." },
  { key: "tiempos", label: "Disponibilidad y tiempos", placeholder: "Horas por semana, plazos, capacidad." },
  { key: "proximosPasos", label: "Próximos pasos", placeholder: "Acciones concretas para arrancar." },
]

// Customization config (task: add/remove/rename canvas labels). Stored in the
// response alongside `content` so renaming/removing/adding blocks persists.
export interface CanvasConfig {
  /** Override a block's label by its key. */
  labels?: Record<string, string>
  /** Keys of default blocks the user removed. */
  hidden?: string[]
  /** User-added custom blocks (rendered below the standard grid). */
  extra?: { key: string; label: string }[]
}

/** Resolve the effective canvas blocks for a given customization config. */
export function resolveCanvasBlocks(config?: CanvasConfig): {
  base: CanvasBlock[]
  extra: CanvasBlock[]
  hidden: CanvasBlock[]
} {
  const hiddenKeys = new Set(config?.hidden ?? [])
  const withLabel = (b: CanvasBlock): CanvasBlock => ({
    ...b,
    label: config?.labels?.[b.key] ?? b.label,
  })
  const base = CANVAS_BLOCKS.filter((b) => !hiddenKeys.has(b.key)).map(withLabel)
  const hidden = CANVAS_BLOCKS.filter((b) => hiddenKeys.has(b.key)).map(withLabel)
  const extra: CanvasBlock[] = (config?.extra ?? []).map((e) => ({
    key: e.key,
    label: e.label,
    question: "",
    tint: "bg-slate-50 border-slate-200",
    area: "",
  }))
  return { base, extra, hidden }
}

export const INSTRUCTIONS: string[] = [
  "Lee cada recuadro y comprende qué se espera en cada parte del modelo.",
  "Escribe tus ideas con frases cortas y concretas.",
  "Empieza por la Propuesta de valor, ya que define el corazón del negocio.",
  "Completa luego los bloques externos (Clientes, Canales y Relación).",
  "Agrega las actividades, recursos y socios clave que necesitas para operar.",
  "Finaliza con los costos e ingresos del proyecto o empresa.",
]
