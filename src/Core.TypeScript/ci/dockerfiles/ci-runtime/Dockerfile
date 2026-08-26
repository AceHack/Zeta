# syntax=docker/dockerfile:1

# src/Core.TypeScript/ci/dockerfiles/ci-runtime/Dockerfile
#
# THE CI RUNTIME IMAGE — a MATERIALIZATION, not a second definition.
#
# Aaron 2026-08-26: "there is only one ace and pre ace bootstrap".
# So this file has exactly two layers of substance and no third:
#
#   1. THE PRE-ACE BOOTSTRAP — the minimal, auditable seed that gets a bare
#      machine to the point where the repo's own installer can run. Four
#      packages. That is the whole of it.
#   2. `./tools/setup/install.sh` — everything after that.
#
# There is NO parallel package list here. If you are ever tempted to add an
# `apt-get install` line naming a tool that also appears in `tools/setup/`, stop:
# that is a second toolchain definition, it WILL drift, and the drift will be
# silent because the image is what CI runs while the script is what humans run.
# Add it to `tools/setup/manifests/apt` instead and rebuild.
#
# The four seed packages are the ones `tools/setup/linux.sh` needs BEFORE its own
# apt phase can run (curl for the mise tarball, ca-certificates for HTTPS, git for
# the repo probes, xz-utils to unpack). They are the same four the already-proven
# `ubuntu-install-sh-test` Dockerfile uses, and they are deliberately the only
# package names in this file.
#
# WHAT DRIFT DETECTION LOOKS LIKE HERE, and what it deliberately does not.
# We do NOT chase bit-reproducibility. Aaron 2026-08-26: "manifest comparison is
# fine, don't chase bit-reproducibility." `apt` resolves version RANGES against a
# mutable external mirror at build time, so two builds of this file from the same
# inputs are not byte-identical and no container runtime changes that (Podman and
# Buildah run the same non-deterministic build). The check that actually runs is
# `src/Core.TypeScript/ci/toolchain-manifest.ts --check`: the TEXT expectation is
# `.mise.toml` — the repo's single declared source for tool versions — and the
# IMAGE is the artifact under test. Same discipline as the golden vectors: the
# expectation is diffable text, the thing being judged is not.
#
# Pinned by digest per .claude/rules/dep-pin-search-first-authority.md. This is
# the same ubuntu:24.04 digest the sibling install-sh-test Dockerfile carries;
# bump both together by re-querying
# registry-1.docker.io/v2/library/ubuntu/manifests/24.04.
FROM ubuntu:24.04@sha256:c4a8d5503dfb2a3eb8ab5f807da5bc69a85730fb49b5cfca2330194ebcc41c7b

ENV DEBIAN_FRONTEND=noninteractive

# ── LAYER 1: THE PRE-ACE BOOTSTRAP. Four packages, and nothing else, ever. ─────
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Docker does not persist a RUN step's in-process exports into later layers, so
# the PATH install.sh sets for itself has to be restated here for every layer
# after it — and for every process a CI job later starts inside this image.
# install.sh puts mise in ~/.local/bin, its shims in ~/.local/share/mise/shims,
# and bun in ~/.bun/bin. Same fix as the sibling install-sh-test Dockerfiles.
ENV PATH=/root/.bun/bin:/root/.local/share/mise/shims:/root/.local/bin:/usr/local/bin:/usr/bin:/bin

# mise refuses to read a config file it has not been told to trust, and a job's
# workspace is mounted at a path this image cannot know at build time. These are
# the three that actually occur: `/github/workspace` is where GitHub Actions
# mounts the workspace for a job-level `container:`, `/__w` is the runner's work
# root, and `/w` is what the proof job's `docker run` uses. A consumer mounting
# somewhere else must set MISE_TRUSTED_CONFIG_PATHS itself; it is not silent —
# mise says exactly which file it distrusts.
ENV MISE_TRUSTED_CONFIG_PATHS=/zeta:/w:/__w:/github/workspace

# THE TIER IS DECLARED, NOT DETECTED. Every `Install toolchain` step in
# `gate.yml` declares `ZETA_HOST_TIER: slim` (22 of them, measured 2026-08-26),
# so `slim` is the tier that covers the dominant job class. Undeclared, a 16 GB
# host auto-detects `full` and pulls the whole 388-package / 713.0 MiB apt
# manifest instead of the 149-package / 139.7 MiB slim set — which is a
# RELIABILITY difference before it is a size one, since the mirror stalls that
# produce the exit-124 install failures land on the biggest archives.
ENV ZETA_HOST_TIER=slim

WORKDIR /zeta
COPY . /zeta

# ── LAYER 2: `ace` — i.e. everything the repo's own installer does. ───────────
# `ZETA_INSTALL_FULL` is deliberately UNSET: this image is a CI runtime, not a
# dev laptop, so the interactive vendor-CLI installers and the ollama model stay
# out. install.sh runs as root here; linux.sh handles root-vs-sudo via `id -u`.
# The GitHub token is a BuildKit secret mounted for this RUN only — never baked
# into a layer — and only authenticates mise's release-metadata lookups
# (1000/hr instead of an anonymous 60/hr that 403s). `|| true` keeps a local
# build with no `--secret` working, unauthenticated, exactly as before.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" \
    ./tools/setup/install.sh

# The image asserts its own usefulness at build time. If install.sh "succeeded" but
# left no bun on PATH, the build fails here rather than at some consumer's job three
# days later. Cheap, and it cannot pass vacuously: it runs the binaries.
#
# ORDER IS LOAD-BEARING: this runs while /zeta still holds the tree, because mise
# SHIMS RESOLVE A VERSION FROM THE NEAREST CONFIG walking up from the cwd. Run this
# from an empty directory with no `.mise.toml` above it and the shim has no version
# to select — a failure about the cwd, not about the toolchain, which would read as
# a broken image. Same reason `dotnet --version` needs `global.json` in scope. It is
# also why a consuming job must run from its checked-out workspace, which is exactly
# what a job-level `container:` does.
RUN bun --version && mise --version && dotnet --version

# The build context is a snapshot of the repo AT IMAGE BUILD TIME, and a job that
# read it would be reading a stale tree that looks exactly like a fresh one. That
# is the quiet failure this line exists to prevent: remove it, so a job that
# forgets to check out gets `No such file or directory` instead of last week's
# source. The toolchain itself lives in /root and /usr and is untouched.
#
# This does not shrink the image — the COPY layer is still there — and saying so
# is the point: this is a correctness measure, not a size one. Narrowing the
# build context to just the install inputs is a measured follow-up, not done here.
RUN rm -rf /zeta && mkdir -p /zeta

WORKDIR /zeta
