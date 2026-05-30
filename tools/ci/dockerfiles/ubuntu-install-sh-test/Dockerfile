# tools/ci/dockerfiles/ubuntu-install-sh-test/Dockerfile
#
# Docker-based install.sh test on Ubuntu userspace — sibling to
# nixos-install-sh-test (operator 2026-05-30: "center our docker tests around
# ubuntu and nixos and have tests for both with install.sh"). Proves the entropy
# lever on Ubuntu: a bare ubuntu image + install.sh => working substrate,
# INCLUDING the core local-LLM primitive (ollama + pinned model + real probe).
#
# NixOS is primary (declarative-by-construction; boots the real hardware via the
# USB/ISO). Ubuntu is made to ACT declarative via install.sh + the manifests
# (per B-0940) — this test guards that retrofit.
#
# The build IS the test: a failing install.sh / assert fails the build.
# install.sh runs as root (linux.sh handles root-vs-sudo via `id -u`).

# Pinned by digest (per .claude/rules/dep-pin-search-first-authority.md; matches
# the nixos Dockerfile's digest-pin discipline). ubuntu:24.04 digest selected
# 2026-05-30 via the Docker registry API; bump: re-query
# registry-1.docker.io/v2/library/ubuntu/manifests/24.04 for the current digest.
FROM ubuntu:24.04@sha256:c4a8d5503dfb2a3eb8ab5f807da5bc69a85730fb49b5cfca2330194ebcc41c7b

ENV DEBIAN_FRONTEND=noninteractive

# Bootstrap prereqs install.sh needs before its own apt step runs: curl (mise +
# ollama downloads), ca-certificates (HTTPS), git, xz-utils. install.sh's apt
# step (manifests/apt) then installs the full set incl. zstd (ollama .tar.zst).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Pre-stage mise + bun + ollama PATH for ALL subsequent RUN layers — Docker does
# NOT persist install.sh's in-process PATH exports across layers (same fix as the
# nixos Dockerfile). install.sh installs mise to ~/.local/bin, shims to
# ~/.local/share/mise/shims, bun to ~/.bun/bin, ollama to ~/.local/bin.
ENV PATH=/root/.bun/bin:/root/.local/share/mise/shims:/root/.local/bin:/usr/local/bin:/usr/bin:/bin

WORKDIR /zeta
COPY . /zeta

# The entropy lever: bare ubuntu -> working substrate (incl. the local-LLM core).
RUN ./tools/setup/install.sh

# Validate the local-LLM primitive end-to-end. The MODEL persists on disk
# (install.sh pulled it into a layer); the DAEMON does not persist across RUN
# layers, so start it here, assert the pinned model, then run the REAL chooseIndex
# probe + the run-anywhere mock tests.
RUN set -eu; \
    export PATH="/root/.local/bin:$PATH"; \
    command -v ollama; \
    (ollama serve >/tmp/ollama.log 2>&1 &); \
    for _ in $(seq 1 30); do \
      curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break; \
      sleep 1; \
    done; \
    curl -fsS http://127.0.0.1:11434/api/version; \
    MODEL="$(grep -E '^model' tools/setup/manifests/local-llm | awk '{print $2}')"; \
    echo "asserting model: $MODEL"; \
    ollama list; \
    ollama list | awk 'NR>1 {print $1}' | grep -qx "$MODEL"; \
    bun test tools/accelerator/local-llm.test.ts; \
    bun tools/accelerator/validate-local-llm.ts --root "$PWD"
