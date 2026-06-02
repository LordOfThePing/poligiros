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
