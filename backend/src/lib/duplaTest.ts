import { prisma } from "./prisma.js"

/**
 * What a coach's dupla partner sees of that coach's own test: the result plus
 * Gaby's devolución — the same feedback the owner reads on their TEST card
 * (`coachFeedback`, falling back to `supervisorNotes`, as `/student/modules`
 * does for a coach's self-test).
 */
export function duplaFeedback(
  supervision: { coachFeedback: string | null; supervisorNotes: string | null } | null,
): string | null {
  return supervision ? supervision.coachFeedback || supervision.supervisorNotes || null : null
}

/**
 * The latest completed result a coach has for `testId`, taken against their
 * own coach-as-coachee `Client`. `null` when they have not completed it.
 *
 * Callers own the access check (same-CIC peer, or the supervisor).
 */
export async function latestCoachTestResult(coachUserId: string, testId: string) {
  const client = await prisma.client.findUnique({ where: { userId: coachUserId } })
  if (!client) return null

  const assignment = await prisma.testAssignment.findFirst({
    where: { clientId: client.id, completedAt: { not: null }, testId },
    orderBy: { completedAt: "desc" },
    include: {
      response: true,
      test: { select: { type: true } },
      supervision: { select: { coachFeedback: true, supervisorNotes: true } },
    },
  })
  if (!assignment?.response) return null

  return {
    completedAt: assignment.completedAt!,
    testType: assignment.test.type,
    responses: assignment.response.responses,
    feedback: duplaFeedback(assignment.supervision),
  }
}
