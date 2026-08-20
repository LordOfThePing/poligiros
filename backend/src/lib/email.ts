import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Sender address. Configurable because the domain has to be VERIFIED in Resend
 * (SPF/DKIM records on its DNS) — without that, Resend rejects the send. Being
 * able to point this at a domain whose DNS you control avoids a code change.
 */
const FROM = process.env.EMAIL_FROM || "Poligiros <notificaciones@poligiros.com>"
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173"

/**
 * Single exit point for every email.
 *
 * Callers are fire-and-forget on purpose (a failed notification must never break
 * the request that triggered it), but swallowing the error silently meant a
 * misconfigured key or an unverified domain looked exactly like "everything is
 * fine". This logs instead, so the container output says what happened.
 */
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY sin configurar — no se envió "${subject}" a ${to}`)
    return
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) {
      console.error(`[email] Resend rechazó "${subject}" a ${to}:`, error.message)
    }
  } catch (e) {
    console.error(`[email] Falló el envío de "${subject}" a ${to}:`, e)
  }
}

export async function sendSupervisionSubmittedEmail(
  supervisorEmail: string,
  studentName: string,
  clientName: string,
  testName: string
) {
  await send(supervisorEmail, `Nueva supervisión de ${studentName}`, `
      <p>Hola Gaby,</p>
      <p><strong>${studentName}</strong> envió el test <strong>${testName}</strong> de su cliente <strong>${clientName}</strong> para supervisión.</p>
      <p><a href="${APP_URL}/supervisor/supervision">Ver pendientes →</a></p>
    `)
}

export async function sendSupervisionReviewedEmail(
  studentEmail: string,
  clientName: string,
  testName: string,
  supervisorNotes: string
) {
  await send(studentEmail, `Supervisión revisada: ${testName} de ${clientName}`, `
      <p>Hola,</p>
      <p>Gaby revisó el test <strong>${testName}</strong> de tu cliente <strong>${clientName}</strong>.</p>
      ${supervisorNotes ? `<p><strong>Feedback:</strong> ${supervisorNotes}</p>` : ""}
      <p><a href="${APP_URL}/student/supervision">Ver historial →</a></p>
    `)
}

export async function sendCoachInviteEmail(coachEmail: string, name: string, link: string) {
  await send(coachEmail, "Te invitaron a Poligiros", `
      <p>Hola ${name || ""},</p>
      <p>Gaby te invitó a sumarte a su programa de coaching en Poligiros.</p>
      <p>Completá tu registro desde este enlace: <a href="${link}">${link}</a></p>
      <p>El enlace vence en 7 días.</p>
    `)
}

export async function sendTestCompletedToCoach(
  coachEmail: string,
  coachName: string,
  clientName: string,
  testName: string
) {
  await send(coachEmail, `${clientName} completó ${testName}`, `
      <p>Hola ${coachName || ""},</p>
      <p>Tu coachee <strong>${clientName}</strong> acaba de completar el ejercicio <strong>${testName}</strong>.</p>
      <p><a href="${APP_URL}/student/my-tests">Ver mis tests →</a></p>
    `)
}

export async function sendTestCompletedToClient(
  clientEmail: string,
  clientName: string,
  testName: string,
  magicLink: string
) {
  await send(clientEmail, `Completaste ${testName}`, `
      <p>Hola ${clientName || ""},</p>
      <p>¡Bien hecho! Completaste el ejercicio <strong>${testName}</strong>.</p>
      <p>Podés ver tus resultados en cualquier momento desde este enlace:</p>
      <p><a href="${magicLink}">${magicLink}</a></p>
    `)
}

export async function sendSessionRecordedEmail(
  supervisorEmail: string,
  studentName: string,
  clientName: string,
  sessionNum: number
) {
  await send(supervisorEmail, `Nuevo registro de sesión de ${studentName}`, `
      <p>Hola Gaby,</p>
      <p><strong>${studentName}</strong> registró la sesión #${sessionNum} con su cliente <strong>${clientName}</strong>.</p>
      <p><a href="${APP_URL}/supervisor/registros">Ver registros →</a></p>
    `)
}

/** Sent when the supervisor approves a public signup — the coach can log in already. */
export async function sendSignupApprovedEmail(coachEmail: string, name: string) {
  await send(coachEmail, "Tu inscripción al CIC fue aprobada", `
      <p>Hola ${name},</p>
      <p>Tu inscripción a la <strong>Certificación en Coaching de Carrera y Bienestar Laboral</strong> fue aprobada.</p>
      <p>Ya podés ingresar con el email y la contraseña que elegiste al inscribirte.</p>
      <p><a href="${APP_URL}/login">Ingresar →</a></p>
    `)
}

/** Sent to the supervisor when somebody applies through the public link. */
export async function sendSignupReceivedEmail(
  supervisorEmail: string,
  name: string,
  email: string,
  cohortName: string | null
) {
  await send(supervisorEmail, `Nueva inscripción: ${name}`, `
      <p>Hola Gaby,</p>
      <p><strong>${name}</strong> (${email}) se inscribió${cohortName ? ` a <strong>${cohortName}</strong>` : ""} y está esperando aprobación.</p>
      <p><a href="${APP_URL}/supervisor/inscripciones">Ver solicitudes →</a></p>
    `)
}

/** Sent to the supervisor when a coach hands in an ENTREGA card. */
export async function sendSubmissionReceivedEmail(
  supervisorEmail: string,
  coachName: string,
  moduleTitle: string,
  itemTitle: string
) {
  await send(supervisorEmail, `Nueva entrega de ${coachName}`, `
      <p>Hola Gaby,</p>
      <p><strong>${coachName}</strong> entregó <strong>${itemTitle}</strong> de ${moduleTitle}.</p>
      <p><a href="${APP_URL}/supervisor/entregas">Ver entregas →</a></p>
    `)
}

/** Sent to the coach when the supervisor reviews their submission. */
export async function sendSubmissionReviewedEmail(
  coachEmail: string,
  itemTitle: string,
  feedback: string
) {
  await send(coachEmail, `Gaby devolvió tu entrega: ${itemTitle}`, `
      <p>Hola,</p>
      <p>Gaby revisó tu entrega de <strong>${itemTitle}</strong>.</p>
      ${feedback ? `<p><strong>Devolución:</strong> ${feedback}</p>` : ""}
      <p><a href="${APP_URL}/student/programa">Ver en Mi Programa →</a></p>
    `)
}

/**
 * Sent to a coach after Gaby resets their password. They log in with the
 * temporary password and are forced to pick a new one right away.
 */
export async function sendCoachPasswordResetEmail(coachEmail: string, tempPassword: string) {
  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: "Tu contraseña de Poligiros fue restablecida",
    html: `
      <p>Hola,</p>
      <p>Te restablecimos la contraseña de la plataforma Poligiros.</p>
      <p>Ingresá con esta contraseña temporal:</p>
      <p style="font-size:18px;font-weight:600">${tempPassword}</p>
      <p>Al entrar te vamos a pedir que elijas una contraseña nueva.</p>
      <p><a href="${APP_URL}/login">Ir al inicio de sesión →</a></p>
    `,
  })
}
