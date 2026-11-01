/**
 * The one spelling of an email address we store and search for: lowercase, with
 * no whitespace and no invisible characters. `trim()` is not enough — it leaves
 * the zero-width and direction marks that copying an address from a contact
 * card or a chat brings along, and the row then looks right on screen but can
 * never be matched at login.
 */
export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\s\p{C}\p{Z}]/gu, "")
    .toLowerCase()
}

/**
 * Rewrites the accounts stored before every entry point normalized. Runs on each
 * boot and does nothing once they are clean. A row whose clean address is taken
 * is left alone and logged: which of the two is the real one is a human call.
 */
export async function repairUserEmails(): Promise<void> {
  const { prisma } = await import("./prisma.js")
  const users = await prisma.user.findMany({ select: { id: true, email: true } })

  for (const user of users) {
    const email = normalizeEmail(user.email)
    if (email === user.email) continue

    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (clash) {
      console.warn(`[email] Cuenta ${user.id}: su email limpio ya lo usa ${clash.id}, no se tocó`)
      continue
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { email } }),
      prisma.client.updateMany({ where: { userId: user.id }, data: { email } }),
    ])
    console.log(`[email] Cuenta ${user.id}: email normalizado`)
  }
}
