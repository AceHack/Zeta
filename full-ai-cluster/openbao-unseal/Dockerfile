# zeta-bao-unseal — Shamir unseal sidecar for kind/CI OpenBao.
#
# Build context is the repository root (see build-platform-images.yml
# matrix entry `zeta-bao-unseal`). Runtime is a bun bundle of
# src/Core.TypeScript/cluster/openbao-unseal-sidecar.ts. Do not commit
# the compiled JS.
#
# Missing share cache must WAIT, not crash-loop: directoryShareFetcher
# returns [] when the mount is absent, and validateShares refuses a
# short set without throwing. A sidecar CrashLoopBackOff is
# indistinguishable from a broken store.
#
# extraContainers stay out of Application.yaml until this image is
# anonymously pullable (GHCR 200) and pinned by digest.

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS build
WORKDIR /src
COPY src/Core.TypeScript/cluster/openbao-unseal-sidecar.ts \
     src/Core.TypeScript/cluster/vault-unsealer.ts \
     src/Core.TypeScript/cluster/ephemeral-vault-init.ts \
     ./
RUN bun build ./openbao-unseal-sidecar.ts --target bun --outfile /out/openbao-unseal-sidecar.js

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0
WORKDIR /app
COPY --from=build /out/openbao-unseal-sidecar.js .
USER bun
ENTRYPOINT ["bun", "/app/openbao-unseal-sidecar.js"]
