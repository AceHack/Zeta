# Agentic Organization worker runtime.
#
# The code runs directly via `node --experimental-strip-types` (no build step,
# no bundler) per the repo convention. node:24-slim (Debian) is used over Alpine
# so the `pg` and @nats-io native paths resolve against glibc cleanly.
FROM node:24-slim

WORKDIR /app

# Install only production deps first for layer caching. package-lock.json is the
# pinned dependency graph (@nats-io/jetstream, @nats-io/transport-node, pg).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the source. No compile — strip-types runs the .ts directly.
COPY tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Run as the non-root node user (defense in depth; the worker needs no root).
USER node

# The worker is a long-running process driven by the always-on loop. SIGTERM is
# handled by the entrypoint (graceful shutdown of cockroach + nats ports).
ENV NODE_ENV=production
ENTRYPOINT ["node", "--experimental-strip-types", "apps/workers/src/main.ts"]
