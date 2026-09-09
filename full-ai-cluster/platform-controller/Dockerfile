# Zeta platform controller — the generic Deployable→Kubernetes reconciler.
# Bun runtime; no build step (TS runs directly). Distroless-style: non-root.
FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0

WORKDIR /app

# Dependencies first for layer caching (only @types/bun + typescript, dev-only —
# the runtime has zero production deps, it talks raw HTTPS to the API server).
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production

COPY src ./src

# Run as an unprivileged user; the bun base image ships the `bun` user (uid 1000).
USER bun

ENTRYPOINT ["bun", "run", "src/controller.ts"]
