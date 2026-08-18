import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = "Poligiros <notificaciones@poligiros.com>"
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173"

export async function sendSupervisionSubmittedEmail(
  supervisorEmail: string,
  studentName: string,
  clientName: string,
  testName: string
) {
  await resend.emails.send({
    from: FROM,
    to: supervisorEmail,
    subject: `Nueva supervisión de ${studentName}`,
    html: `
      <p>Hola Gaby,</p>
      <p><strong>${studentName}</strong> envió el test <strong>${testName}</strong> de su cliente <strong>${clientName}</strong> para supervisión.</p>
      <p><a href="${APP_URL}/supervisor/supervision">Ver pendientes →</a></p>
    `,
  })
}

export async function sendSupervisionReviewedEmail(
  studentEmail: string,
  clientName: string,
  testName: string,
  supervisorNotes: string
) {
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: `Supervisión revisada: ${testName} de ${clientName}`,
    html: `
      <p>Hola,</p>
      <p>Gaby revisó el test <strong>${testName}</strong> de tu cliente <strong>${clientName}</strong>.</p>
      ${supervisorNotes ? `<p><strong>Feedback:</strong> ${supervisorNotes}</p>` : ""}
      <p><a href="${APP_URL}/student/supervision">Ver historial →</a></p>
    `,
  })
}

export async function sendCoachInviteEmail(coachEmail: string, name: string, link: string) {
  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: "Te invitaron a Poligiros",
    html: `
      <p>Hola ${name || ""},</p>
      <p>Gaby te invitó a sumarte a su programa de coaching en Poligiros.</p>
      <p>Completá tu registro desde este enlace: <a href="${link}">${link}</a></p>
      <p>El enlace vence en 7 días.</p>
    `,
  })
}

export async function sendTestCompletedToCoach(
  coachEmail: string,
  coachName: string,
  clientName: string,
  testName: string
) {
  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: `${clientName} completó ${testName}`,
    html: `
      <p>Hola ${coachName || ""},</p>
      <p>Tu coachee <strong>${clientName}</strong> acaba de completar el ejercicio <strong>${testName}</strong>.</p>
      <p><a href="${APP_URL}/student/my-tests">Ver mis tests →</a></p>
    `,
  })
}

export async function sendTestCompletedToClient(
  clientEmail: string,
  clientName: string,
  testName: string,
  magicLink: string
) {
  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `Completaste ${testName}`,
    html: `
      <p>Hola ${clientName || ""},</p>
      <p>¡Bien hecho! Completaste el ejercicio <strong>${testName}</strong>.</p>
      <p>Podés ver tus resultados en cualquier momento desde este enlace:</p>
      <p><a href="${magicLink}">${magicLink}</a></p>
    `,
  })
}

export async function sendSessionRecordedEmail(
  supervisorEmail: string,
  studentName: string,
  clientName: string,
  sessionNum: number
) {
  await resend.emails.send({
    from: FROM,
    to: supervisorEmail,
    subject: `Nuevo registro de sesión de ${studentName}`,
    html: `
      <p>Hola Gaby,</p>
      <p><strong>${studentName}</strong> registró la sesión #${sessionNum} con su cliente <strong>${clientName}</strong>.</p>
      <p><a href="${APP_URL}/supervisor/registros">Ver registros →</a></p>
    `,
  })
}

/** Sent when the supervisor approves a public signup — the coach can log in already. */
export async function sendSignupApprovedEmail(coachEmail: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to: coachEmail,
    subject: "Tu inscripción al CIC fue aprobada",
    html: `
      <p>Hola ${name},</p>
      <p>Tu inscripción a la <strong>Certificación en Coaching de Carrera y Bienestar Laboral</strong> fue aprobada.</p>
      <p>Ya podés ingresar con el email y la contraseña que elegiste al inscribirte.</p>
      <p><a href="${APP_URL}/login">Ingresar →</a></p>
    `,
  })
}

/** Sent to the supervisor when somebody applies through the public link. */
export async function sendSignupReceivedEmail(
  supervisorEmail: string,
  name: string,
  email: string,
  cohortName: string | null
) {
  await resend.emails.send({
    from: FROM,
    to: supervisorEmail,
    subject: `Nueva inscripción: ${name}`,
    html: `
      <p>Hola Gaby,</p>
      <p><strong>${name}</strong> (${email}) se inscribió${cohortName ? ` a <strong>${cohortName}</strong>` : ""} y está esperando aprobación.</p>
      <p><a href="${APP_URL}/supervisor/inscripciones">Ver solicitudes →</a></p>
    `,
  })
}
