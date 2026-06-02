import { Hono } from "hono"
import { cors } from "hono/cors"
import { serve } from "@hono/node-server"
import { authMiddleware, requireRole } from "./lib/auth.js"
import authRoutes from "./routes/auth.js"
import clientRoutes from "./routes/client.js"
import studentRoutes from "./routes/student.js"
import supervisorRoutes from "./routes/supervisor.js"
import type { AppVariables } from "./lib/types.js"

const app = new Hono<{ Variables: AppVariables }>()

/* ─────────────────────────────────────────
   CORS
───────────────────────────────────────── */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

app.use(
  "/*",
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
)

/* ─────────────────────────────────────────
   Health
───────────────────────────────────────── */
app.get("/health", (c) => c.json({ ok: true }))

/* ─────────────────────────────────────────
   Auth (public)
───────────────────────────────────────── */
app.route("/auth", authRoutes)

/* ─────────────────────────────────────────
   Client token routes (NO auth middleware — token is the credential)
───────────────────────────────────────── */
app.route("/client", clientRoutes)

/* ─────────────────────────────────────────
   Student routes (cookie auth + role guard)
───────────────────────────────────────── */
app.use("/student/*", authMiddleware)
app.use("/student/*", requireRole("STUDENT_COACH"))
app.route("/student", studentRoutes)

/* ─────────────────────────────────────────
   Supervisor routes (cookie auth + role guard)
───────────────────────────────────────── */
app.use("/supervisor/*", authMiddleware)
app.use("/supervisor/*", requireRole("SUPERVISOR"))
app.route("/supervisor", supervisorRoutes)

/* ─────────────────────────────────────────
   Tests (any authenticated user)
───────────────────────────────────────── */
app.use("/tests", authMiddleware)
app.get("/tests", async (c) => {
  const { prisma } = await import("./lib/prisma.js")
  const tests = await prisma.test.findMany({ orderBy: { orderIndex: "asc" } })
  return c.json(tests)
})

/* ─────────────────────────────────────────
   Start server
───────────────────────────────────────── */
const PORT = parseInt(process.env.PORT || "3001", 10)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🚀 Poligiros API running on http://localhost:${info.port}`)
})

export default app
