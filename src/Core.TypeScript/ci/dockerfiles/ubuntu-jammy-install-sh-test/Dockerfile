# syntax=docker/dockerfile:1

# src/Core.TypeScript/ci/dockerfiles/ubuntu-jammy-install-sh-test/Dockerfile
#
# Docker-based install.sh test on Ubuntu 22.04 (jammy) — sibling to
# ubuntu-install-sh-test (24.04/noble). Exercises linux.sh's jammy apt
# package aliases (libicu70/libssl3 vs noble libicu74/libssl3t64) on the
# LTS many dev boxes and cloud VMs still run.
#
# The build IS the test: a failing install.sh / assert fails the build.
# install.sh runs as root (linux.sh handles root-vs-sudo via `id -u`).

# Pinned by digest (per .claude/rules/dep-pin-search-first-authority.md).
# ubuntu:22.04 digest selected 2026-06-20 via `docker manifest inspect`;
# bump: re-query registry-1.docker.io/v2/library/ubuntu/manifests/22.04.
FROM ubuntu:22.04@sha256:ce941a2a18bbb922e434d6d6d2b31e571a5c3826eaf6ada0a41dcc905bd2d906

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils \
    && rm -rf /var/lib/apt/lists/*

ENV PATH=/root/.bun/bin:/root/.local/share/mise/shims:/root/.local/bin:/usr/local/bin:/usr/bin:/bin

WORKDIR /zeta
COPY . /zeta

RUN --mount=type=secret,id=github_token \
    ZETA_INSTALL_FULL=1 \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" \
    ./tools/setup/install.sh

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
    bun test src/Core.TypeScript/accelerator/local-llm.test.ts; \
    bun src/Core.TypeScript/accelerator/validate-local-llm.ts --root "$PWD"

RUN set -eu; \
    export PATH="/root/.local/bin:$PATH"; \
    MODEL="$(grep -E '^model' tools/setup/manifests/local-llm | awk '{print $2}')"; \
    echo "=== 2nd install.sh run (idempotency) ==="; \
    if ! ZETA_INSTALL_FULL=1 ./tools/setup/install.sh > /tmp/install-2nd.log 2>&1; then \
      cat /tmp/install-2nd.log; \
      echo "FAIL: 2nd install.sh run exited non-zero (a re-run must succeed cleanly)"; exit 1; \
    fi; \
    cat /tmp/install-2nd.log; \
    echo "=== idempotency asserts ==="; \
    grep -qF "local-llm model ${MODEL} already present" /tmp/install-2nd.log \
      || { echo "FAIL: 2nd run did not report '${MODEL} already present' — idempotency hole"; exit 1; }; \
    if grep -qF "pulling ${MODEL}" /tmp/install-2nd.log || grep -qF "pulling manifest" /tmp/install-2nd.log; then \
      echo "FAIL: 2nd run RE-PULLED the model — caching/idempotency regression"; exit 1; \
    fi; \
    echo "OK: 2nd run idempotent — ${MODEL} already present, zero re-pull"

RUN set -eu; \
    SRC=/etc/apt/sources.list.d/zeta-unreachable-test.list; \
    echo "deb [trusted=yes] https://zeta-unreachable.invalid/ubuntu jammy main" > "$SRC"; \
    echo "=== 3rd install.sh run (unreachable apt-source resilience) ==="; \
    if ! ZETA_INSTALL_FULL=1 ./tools/setup/install.sh > /tmp/install-resilience.log 2>&1; then \
      cat /tmp/install-resilience.log; \
      rm -f "$SRC"; \
      echo "FAIL: install.sh aborted on an unreachable third-party apt source (it must warn + continue)"; exit 1; \
    fi; \
    rm -f "$SRC"; \
    cat /tmp/install-resilience.log; \
    echo "=== resilience asserts ==="; \
    grep -qF "apt-get update reported errors" /tmp/install-resilience.log \
      || { echo "FAIL: graceful path took but emitted NO warning — silent failure is a shield hole"; exit 1; }; \
    echo "OK: unreachable apt source warned + continued (graceful, not silent)"
