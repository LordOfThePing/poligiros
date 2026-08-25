import { useEffect, useState } from "react"
import {
  BookOpen,
  ClipboardCheck,
  Eye,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessageSquare,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useAuth, type Role } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * The welcome guide: a short, role-specific "how this app works" popup.
 *
 * It opens by itself the first time a user lands on the app (remembered per
 * user id in localStorage) and can be reopened any time from the button both
 * sidebars render right above the profile banner.
 */

const SEEN_KEY = "poligiros.help-seen.v1"

/** Where coaches and the supervisor report app bugs. */
const SUPPORT_PHONE = "+54 9 11 0000-0000"

type Section = { icon: LucideIcon; title: string; lines: string[] }
type Guide = { title: string; intro: string; sections: Section[]; closing: string }

const COACH_GUIDE: Guide = {
  title: "¡Bienvenida a Poligiros!",
  intro:
    "Acá tenés todo el Programa en un solo lugar: las clases, los materiales, las tareas y los tests. Un repaso rápido de cómo se usa.",
  sections: [
    {
      icon: BookOpen,
      title: "Mi Programa",
      lines: [
        "Es tu lugar principal. Elegí tu CIC arriba y vas a ver las CLASES publicadas.",
        "Cada clase tiene tarjetas: Tarea, Entrega, Test y Recurso (PPT, bibliografía, archivos).",
        "Abrí una tarjeta, leé la consigna y tildala cuando la completes.",
      ],
    },
    {
      icon: MessageSquare,
      title: "Discusión",
      lines: [
        "A la derecha de cada tarjeta está el panel Discusión.",
        "Ahí escribís tu comentario o tu entrega. Podés sumar una foto y tocás Publicar.",
        "Es el espacio para conversar con Gaby y con tus compañeras.",
      ],
    },
    {
      icon: ListChecks,
      title: "Mis Tests",
      lines: [
        "Son los tests que hacés vos: Anclas de Carrera, Tablero de Ideas, Pirámide del Propósito y Modelo de Negocio.",
        "Al enviarlos, la tarjeta se tilda sola y el test va directo a supervisión.",
      ],
    },
    {
      icon: Users,
      title: "Práctica con coachees",
      lines: [
        "Se habilita más adelante. Cuando esté abierta aparecen tres secciones nuevas en el menú.",
        "Mis Clientes: cargás a tu coachee y le enviás un enlace para que haga el test. No necesita usuario.",
        "Supervisión: mandás el caso para que lo revisemos y recibís la devolución.",
        "Mis Registros: registrás cada sesión que hacés.",
      ],
    },
  ],
  closing:
    "Recorré la app con tranquilidad: todo queda guardado y podés volver a esta ayuda cuando quieras.",
}

const SUPERVISOR_GUIDE: Guide = {
  title: "¡Bienvenida, Supervisora!",
  intro:
    "Desde acá armás el contenido del Programa, lo liberás a cada camada y seguís el avance de tus coaches.",
  sections: [
    {
      icon: LayoutDashboard,
      title: "Panel",
      lines: ["El resumen de lo que está pendiente. Empezá el día por acá."],
    },
    {
      icon: BookOpen,
      title: "Módulos y contenido",
      lines: [
        "Acá armás cada CLASE y sus tarjetas (Tarea, Entrega, Test o Recurso).",
        "En cada tarjeta escribís la consigna y sumás links o archivos.",
        "Un módulo en Borrador no lo ve nadie. Publicalo y después liberalo a la camada que corresponda.",
      ],
    },
    {
      icon: GraduationCap,
      title: "Camadas (CIC)",
      lines: [
        "Creás la camada, inscribís coaches y copiás sus emails para la invitación de Zoom.",
        "El switch de práctica con coachees es lo que les abre Mis Clientes, Supervisión y Mis Registros.",
      ],
    },
    {
      icon: UserPlus,
      title: "Inscripciones",
      lines: [
        "Generás el link de inscripción (con vencimiento) y lo compartís.",
        "Las solicitudes quedan pendientes hasta que las aprobás. Recién ahí se crea el usuario.",
      ],
    },
    {
      icon: ClipboardCheck,
      title: "Seguimiento",
      lines: [
        "Tests a revisar, Tareas a revisar y Registros de sesión son tus tres bandejas.",
        "Al revisar un test escribís dos cosas: el feedback interno (lo ve solo la coach) y el feedback para el cliente (aparece en su enlace de resultados).",
      ],
    },
    {
      icon: Eye,
      title: "Vista de CIC",
      lines: [
        "Te muestra el programa tal como lo ven las coaches de esa camada.",
        "Usala para chequear qué está liberado antes de cada clase.",
      ],
    },
  ],
  closing: "Podés volver a esta ayuda cuando quieras desde el botón del panel izquierdo.",
}

const GUIDES: Record<Role, Guide> = {
  STUDENT_COACH: COACH_GUIDE,
  SUPERVISOR: SUPERVISOR_GUIDE,
}

function markSeen(userId: string) {
  try {
    localStorage.setItem(`${SEEN_KEY}.${userId}`, "1")
  } catch {
    /* private mode / storage disabled — it will just show again next time */
  }
}

function alreadySeen(userId: string) {
  try {
    return localStorage.getItem(`${SEEN_KEY}.${userId}`) === "1"
  } catch {
    return true
  }
}

export function HelpGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  if (!user) return null
  const guide = GUIDES[user.role]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-brand-accent">{guide.title}</DialogTitle>
          <DialogDescription>{guide.intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {guide.sections.map(({ icon: Icon, title, lines }) => (
            <div key={title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <ul className="mt-1 space-y-1">
                  {lines.map((line) => (
                    <li key={line} className="text-sm text-muted-foreground leading-snug">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          <div className="flex gap-3 rounded-lg bg-muted/60 p-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">¿Algo no funciona?</p>
              <p className="mt-1 text-sm text-muted-foreground leading-snug">
                Cualquier consulta sobre el funcionamiento de la app o un error, escribile al
                desarrollador: {SUPPORT_PHONE}.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{guide.closing}</p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The sidebar entry point: the "Cómo usar la app" button plus the dialog it
 * opens. Also opens the guide on its own the first time this user sees the app.
 */
export function HelpLauncher({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user || alreadySeen(user.id)) return
    markSeen(user.id)
    setOpen(true)
  }, [user])

  if (!user) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "sidebar-link sidebar-link-inactive w-full",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? "Cómo usar la app" : undefined}
        aria-label="Cómo usar la app"
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate text-left">Cómo usar la app</span>}
      </button>
      <HelpGuideDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
