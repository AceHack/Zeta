# syntax=docker/dockerfile:1

# src/Core.TypeScript/ci/dockerfiles/ubuntu-install-sh-test/Dockerfile
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
# Post-install RUN layers (bun test, 2nd install.sh) invoke mise/uv outside install.sh's
# process — Docker does not persist install.sh's MISE_TRUSTED_CONFIG_PATHS export across layers.
ENV MISE_TRUSTED_CONFIG_PATHS=/zeta

WORKDIR /zeta
COPY . /zeta

# The entropy lever: bare ubuntu -> working substrate (incl. the local-LLM core).
# Exercise the one-liner dev-CLI installers (default-skip in non-interactive CI; the shields
# are where we test everything) + authenticate mise GitHub API lookups via a BuildKit secret
# (no 403 rate-limit). The token is mounted as a file for THIS RUN only — never baked into an
# image layer (the reason for --mount=type=secret over --build-arg). Both env vars are scoped
# to this RUN. || true keeps a local build (no --secret) working (empty token = unauth, as before).
RUN --mount=type=secret,id=github_token \
    ZETA_INSTALL_FULL=1 \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" \
    ./tools/setup/install.sh

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
    bun test src/Core.TypeScript/accelerator/local-llm.test.ts; \
    bun src/Core.TypeScript/accelerator/validate-local-llm.ts --root "$PWD"

# Idempotency / 2nd-run assert (operator 2026-05-31: "like our mac installs
# homebrew ... the windows should be the same idempotent install/update everything
# ... a 2nd run should not redo everything, it should efficiently just update
# what's needed and no more"). A re-run on an already-provisioned machine must NOT
# redo work — in particular it must NOT re-pull the 398MB model (the exact caching
# issue named). Run install.sh a SECOND time on the state the 1st RUN left (tools
# installed + model on disk), then ASSERT the idempotency signals. Per
# automated-tests-are-the-shield-assert-dont-skip.md the test ASSERTS the positive
# (model already-present + zero re-pull), it does not merely tolerate a no-op.
# The DAEMON doesn't persist across layers, so install.sh's local-LLM step starts
# its own `ollama serve` and reads the model from the persisted disk layer.
#
# Capture install.sh's exit status EXPLICITLY (Copilot review on PR #6240): a
# `install.sh | tee log` pipeline would take `tee`'s exit code, so a non-zero
# install.sh after the expected strings would still read green (a false-green hole
# in this very shield). ubuntu's /bin/sh is dash (no `set -o pipefail`), so don't
# pipe — redirect to the log, gate on `install.sh`'s own status via `if !`, then
# `cat` the log for CI visibility + the asserts.
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
      || { echo "FAIL: 2nd run did not report '${MODEL} already present' — idempotency hole (the local-LLM step should detect-first-skip)"; exit 1; }; \
    if grep -qF "pulling ${MODEL}" /tmp/install-2nd.log || grep -qF "pulling manifest" /tmp/install-2nd.log; then \
      echo "FAIL: 2nd run RE-PULLED the model — caching/idempotency regression (a re-run must reuse the on-disk model)"; exit 1; \
    fi; \
    echo "OK: 2nd run idempotent — ${MODEL} already present, zero re-pull"


# Apt-source resilience assert (operator 2026-06-01: "as long as it's not silent
# failure and the test catches the warning if it happens"). A third-party apt source
# the host image shipped that we don't control must NOT abort the whole install —
# linux.sh's `apt-get update` is graceful (warn + continue) while `apt-get install`
# stays strict. Inject an unreachable source (`.invalid` TLD, RFC-2606 reserved →
# guaranteed non-resolving, no real-network dependency), run install.sh, and ASSERT
# BOTH per automated-tests-are-the-shield-assert-dont-skip.md: (a) it still exits 0
# (graceful — pipefail did not abort), AND (b) the warning WAS emitted (NOT silent —
# a graceful path that warned about nothing would be a false-green hole). The strict
# half (a genuinely-missing NEEDED package still fails loudly) is preserved by the
# unchanged `apt-get install` — its packages come from the reachable archive, so the
# build's success also asserts the bogus source didn't poison real installs.
RUN set -eu; \
    SRC=/etc/apt/sources.list.d/zeta-unreachable-test.list; \
    echo "deb [trusted=yes] https://zeta-unreachable.invalid/ubuntu noble main" > "$SRC"; \
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
