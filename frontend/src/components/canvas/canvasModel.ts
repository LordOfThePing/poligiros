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

export const INSTRUCTIONS: string[] = [
  "Lee cada recuadro y comprende qué se espera en cada parte del modelo.",
  "Escribe tus ideas con frases cortas y concretas.",
  "Empieza por la Propuesta de valor, ya que define el corazón del negocio.",
  "Completa luego los bloques externos (Clientes, Canales y Relación).",
  "Agrega las actividades, recursos y socios clave que necesitas para operar.",
  "Finaliza con los costos e ingresos del proyecto o empresa.",
]
