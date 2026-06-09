# Zeta platform controller — the generic Deployable→Kubernetes reconciler.
# Bun runtime; no build step (TS runs directly). Distroless-style: non-root.
FROM oven/bun:1.3.14-alpine

WORKDIR /app

# Dependencies first for layer caching (only @types/bun + typescript, dev-only —
# the runtime has zero production deps, it talks raw HTTPS to the API server).
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production

COPY src ./src

# Run as an unprivileged user; the bun base image ships the `bun` user (uid 1000).
USER bun

ENTRYPOINT ["bun", "run", "src/controller.ts"]
