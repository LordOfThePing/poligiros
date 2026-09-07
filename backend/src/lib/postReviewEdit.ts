import { Prisma } from "@prisma/client"
import { prisma } from "./prisma.js"
import { notifyTarget } from "./notify.js"
import { sendSupervisionSubmittedEmail } from "./email.js"

export type PostReviewEditErrorCode = "not_completed" | "not_reviewed" | "already_edited"

const MESSAGES: Record<PostReviewEditErrorCode, string> = {
  not_completed: "El test todavía no fue completado.",
  not_reviewed: "Recién se puede editar después de que la supervisora lo revise por primera vez.",
  already_edited: "Este resultado ya usó su única edición.",
}

export class PostReviewEditError extends Error {
  constructor(public code: PostReviewEditErrorCode) {
    super(MESSAGES[code])
  }
}

/**
 * The coach and the coachee each get to fix a test's answers exactly once,
 * and only after the supervisor's first review — never before, and never a
 * second time (shared one-shot: whichever of them edits first uses it up).
 * Saving flips the (already-reviewed) supervision request back to PENDING so
 * the supervisor sees it again, and notifies them it needs a second look.
 */
export async function applyPostReviewEdit(
  assignmentId: string,
  responses: Prisma.InputJsonValue,
  editedBy: "coach" | "coachee"
) {
  const [existingResponse, supervision] = await Promise.all([
    prisma.testResponse.findUnique({ where: { assignmentId } }),
    prisma.supervisionRequest.findUnique({
      where: { assignmentId },
      include: { student: true, assignment: { include: { test: true, client: true } } },
    }),
  ])

  if (!existingResponse) throw new PostReviewEditError("not_completed")
  if (!supervision || !supervision.reviewedAt) throw new PostReviewEditError("not_reviewed")
  if (existingResponse.editedAt) throw new PostReviewEditError("already_edited")

  const [updated] = await prisma.$transaction([
    prisma.testResponse.update({
      where: { assignmentId },
      data: { responses, editedAt: new Date(), editedBy },
    }),
    prisma.supervisionRequest.update({
      where: { assignmentId },
      data: { status: "PENDING" },
    }),
  ])

  const to = await notifyTarget("supervisionRequest")
  for (const addr of to) {
    sendSupervisionSubmittedEmail(
      addr,
      supervision.student.name,
      supervision.assignment.client.name,
      `${supervision.assignment.test.title} (editado tras la revisión)`
    ).catch(() => {})
  }

  return updated
}
