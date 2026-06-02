# ─── Stage 1: Build ───────────────────────────────────────────────────────────
# node:20-slim (Debian) instead of alpine: Prisma's query/schema engines need
# OpenSSL/glibc, and alpine (musl) requires fragile binaryTarget juggling. Slim
# + openssl is the combination Prisma documents and "just works".
FROM node:20-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Install ALL dependencies (devDeps included — tsc/prisma are needed to build).
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and Prisma schema
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client, then compile TypeScript
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Carry over the built output, generated Prisma client, schema, and deps.
# (node_modules includes the prisma CLI for `migrate deploy` and tsx for `db:seed`.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001

# Apply migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
