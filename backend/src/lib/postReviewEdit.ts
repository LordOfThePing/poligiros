import { Prisma } from "@prisma/client"
import { prisma } from "./prisma.js"
import { notifyTarget } from "./notify.js"
import { sendSupervisionSubmittedEmail } from "./email.js"

export type PostReviewEditErrorCode = "not_completed" | "not_reviewed" | "pending_review"

const MESSAGES: Record<PostReviewEditErrorCode, string> = {
  not_completed: "El test todavía no fue completado.",
  not_reviewed: "Recién se puede editar después de que la supervisora lo revise.",
  pending_review: "Está esperando la revisión de la supervisora — vas a poder editarlo cuando lo revise.",
}

export class PostReviewEditError extends Error {
  constructor(public code: PostReviewEditErrorCode) {
    super(MESSAGES[code])
  }
}

/**
 * Coach and coachee may fix a test's answers as many times as they like, but
 * only while the supervision request sits in REVIEWED: saving flips it back to
 * PENDING (and notifies the supervisor), and from then on the result is frozen
 * again until she reviews it. So the cycle is review → edit → review → edit …,
 * never two edits stacked on top of one unreviewed change.
 *
 * `editedAt`/`editedBy` record the LAST edit; `reviewedAt` is never cleared, so
 * the supervision list can still tell a re-review from a first-time one.
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
  if (supervision.status !== "REVIEWED") throw new PostReviewEditError("pending_review")

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
