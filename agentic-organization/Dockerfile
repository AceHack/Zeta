# Agentic Organization worker runtime.
#
# The code runs directly via `node --experimental-strip-types` (no build step,
# no bundler) per the repo convention. node:24-slim (Debian) is used over Alpine
# so the `pg` and @nats-io native paths resolve against glibc cleanly.
#
# DIGEST-PINNED, like every other Dockerfile in this tree. A floating tag means
# two builds of the same commit can produce different images, which is the same
# defect as an unpinned dependency and is what OpenSSF Scorecard's
# `Pinned-Dependencies` reports (alert #122) -- this file was the ONE outlier
# among the eleven `FROM` lines in the repo. The digest below was resolved
# against registry-1.docker.io directly, not copied from the alert text.
# Bumping it is a deliberate commit, which is the point.
FROM node:24-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553

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
