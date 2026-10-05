import { Prisma } from "@prisma/client"
import { prisma } from "./prisma.js"
import { notifyTarget } from "./notify.js"
import { sendSupervisionSubmittedEmail } from "./email.js"

export type PostReviewEditErrorCode = "not_completed"

const MESSAGES: Record<PostReviewEditErrorCode, string> = {
  not_completed: "El test todavía no fue completado.",
}

export class PostReviewEditError extends Error {
  constructor(public code: PostReviewEditErrorCode) {
    super(MESSAGES[code])
  }
}

/**
 * Coach and coachee may fix a test's answers as many times as they like, with
 * NO wait for the supervisor's devolución in between. Each edit flips the
 * supervision request to PENDING (if it was REVIEWED) and emails Gaby so she
 * always sees the latest version. Edits made while it is still PENDING just
 * update the response — she will read the newest version when she gets to it.
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

  const wasReviewed = supervision?.status === "REVIEWED"

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.testResponse.update({
      where: { assignmentId },
      data: { responses, editedAt: new Date(), editedBy },
    }),
  ]
  if (wasReviewed) {
    ops.push(
      prisma.supervisionRequest.update({
        where: { assignmentId },
        data: { status: "PENDING" },
      })
    )
  }

  const [updated] = (await prisma.$transaction(ops)) as [
    Awaited<ReturnType<typeof prisma.testResponse.update>>,
    ...unknown[],
  ]

  if (wasReviewed && supervision) {
    const target = await notifyTarget("supervisionRequest")
    if (target) {
      sendSupervisionSubmittedEmail(
        target.to,
        supervision.student.name,
        supervision.assignment.client.name,
        `${supervision.assignment.test.title} (editado tras la revisión)`,
        target.bcc
      ).catch(() => {})
    }
  }

  return updated
}
