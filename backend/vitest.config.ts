import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // auth.ts reads JWT_SECRET at module load, so set it before tests import it.
    env: { JWT_SECRET: "test-secret-key" },
  },
})
