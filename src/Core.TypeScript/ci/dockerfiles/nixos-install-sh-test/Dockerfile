# syntax=docker/dockerfile:1

# tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile
#
# B-0849 Phase 1 — fast-iteration test harness for tools/setup/install.sh
# on NixOS userspace. Validates that linux.sh's /etc/NIXOS detection
# branch (added in iter-5.5.1 PR #5389) correctly routes to common/
# mise.sh + bootstrap installs cleanly.
#
# Cycle time: ~30-60 sec (vs B-0831 QEMU full-install ~15 min vs
# physical USB install ~30+ min). Complementary to B-0831 cascade #6.
#
# Operator framing 2026-05-27: "we should add docker based nixos
# install.sh testing so we can iterate quick that's an easy
# dockerfile" + "nixos*" (correcting earlier typo).
#
# Why nixos/nix base: provides nix-the-package-manager + nix-shell +
# /nix/store userspace. NOT a full NixOS init system (no systemd in
# the container), so this validates install.sh's userspace behavior
# only — full-system tests still belong in B-0831 QEMU cascade.
#
# Required runtime arg: none. Repo gets COPY'd at build time. The
# install.sh runs as root in the container (CI usage pattern) — the
# linux.sh script handles root-vs-sudo via `id -u` check, so this
# matches CI runner contexts.

# Base image pinned per Copilot review on PR #5393 — non-pinned :latest
# makes test non-deterministic (base image bumps break CI without repo
# changes). Bump procedure (per
# .claude/rules/dep-pin-search-first-authority.md): visit Docker Hub
# nixos/nix tags page (https://hub.docker.com/r/nixos/nix/tags),
# select current latest stable, ideally pin by digest (sha256:...)
# for content-addressed reproducibility. Pin selected 2026-05-27;
# the implementer at next bump documents the new pin's selection
# date in this comment.
FROM nixos/nix:2.31.2@sha256:29fc5fe207f159ceb0143c25c19c774062fee02ce5eda118f3067547b3054894

# /etc/NIXOS marker file — what linux.sh's NixOS detection branch uses
# to skip the apt step (per iter-5.5.1 PR #5389). Without this marker
# the test would not exercise the NixOS-specific path; install.sh
# would bail with "this script currently supports Debian/Ubuntu only".
RUN touch /etc/NIXOS

# Pre-stage mise + bun PATH for ALL subsequent RUN layers (per Copilot
# review on PR #5393: P0 — tools/setup/install.sh exports PATH only in
# its own process; Docker doesn't persist exports across RUN layers;
# without this ENV, the validation RUNs below would fail because
# mise/bun aren't on PATH in the fresh layer's shell). install.sh
# installs mise to ~/.local/bin/mise and shims to ~/.local/share/mise/
# shims/; bun --global lands at ~/.bun/bin/.
ENV PATH=/root/.bun/bin:/root/.local/share/mise/shims:/root/.local/bin:/nix/var/nix/profiles/default/bin:/usr/local/bin:/usr/bin:/bin
ENV MISE_TRUSTED_CONFIG_PATHS=/workspace

# Install the NixOS userspace commands install.sh invokes plus the runtime
# libraries expected by the dynamically linked .mise.toml toolchain downloads
# (node, dotnet, java, etc.). nix-env rebuilds the default profile, so keep
# the command set explicit instead of relying on the base image profile.
RUN set -eu; \
    nix-env -iA \
    nixpkgs.nix \
    nixpkgs.bash \
    nixpkgs.coreutils \
    nixpkgs.findutils \
    nixpkgs.gnugrep \
    nixpkgs.gnused \
    nixpkgs.gawk \
    nixpkgs.curl \
    nixpkgs.gnutar \
    nixpkgs.gzip \
    nixpkgs.unzip \
    nixpkgs.icu \
    nixpkgs.gcc \
    nixpkgs.openssl \
    nixpkgs.gcc.cc.lib \
    nixpkgs.zlib \
    nixpkgs.glibc; \
    mkdir -p /usr/local/bin; \
    cc_path="$(command -v gcc)"; \
    test -x "$cc_path"; \
    ln -sf "$cc_path" /usr/local/bin/cc; \
    mkdir -p /usr/local/nix-compat-lib; \
    for lib in \
      /nix/store/*-icu4c-*/lib/*.so* \
      /nix/store/*-openssl-*/lib/*.so* \
      /nix/store/*-xgcc-*-lib/lib/*.so* \
      /nix/store/*-zlib-*/lib/*.so*; do \
        [ -e "$lib" ] || continue; \
        ln -sf "$lib" /usr/local/nix-compat-lib/; \
    done

# The pinned mise release is dynamically linked and asks the kernel for
# the conventional FHS loader path. nixos/nix keeps glibc in /nix/store,
# so expose the loader path this test needs without changing install.sh.
RUN set -eu; \
    glibc_loader="$(find /nix/store -maxdepth 3 -path '*-glibc-*/lib/ld-linux-*.so.*' | head -n 1)"; \
    test -n "$glibc_loader"; \
    case "$(uname -m)" in \
      x86_64) mkdir -p /lib64 && ln -sf "$glibc_loader" /lib64/ld-linux-x86-64.so.2 ;; \
      aarch64|arm64) mkdir -p /lib && ln -sf "$glibc_loader" /lib/ld-linux-aarch64.so.1 ;; \
      *) echo "unsupported Docker test architecture: $(uname -m)" >&2; exit 1 ;; \
    esac; \
    ln -sfn "$(dirname "$glibc_loader")" /usr/local/nix-glibc-lib
ENV LD_LIBRARY_PATH=/usr/local/nix-glibc-lib:/usr/local/nix-compat-lib:/nix/var/nix/profiles/default/lib:/nix/var/nix/profiles/default/lib64

# Enable nix flakes (needed for tools/setup/common/mise.sh and other
# substrate that uses flake-style invocation).
RUN mkdir -p /etc/nix && \
    echo "experimental-features = nix-command flakes" > /etc/nix/nix.conf

# Workspace = repo root mounted at build time
WORKDIR /workspace

# COPY only the install-relevant subset (substrate-honest: don't COPY
# .git or unrelated tooling that would invalidate cache on unrelated
# changes). The install.sh + linux.sh + macos.sh + common/ +
# manifests/ + .mise.toml are all that's needed for this harness.
COPY tools/setup /workspace/tools/setup
COPY .mise.toml /workspace/.mise.toml
# package.json + bun.lock pin TS-runtime deps if install.sh references
# them (e.g., bun --version checks); copy to mirror dev environment
COPY package.json bun.lock* /workspace/
# src/Core.TypeScript/ace — Bun setup realizers (setup-realize.ts + setup-realizers/)
COPY src/Core.TypeScript/ace /workspace/src/Core.TypeScript/ace
# src/Core.TypeScript/privilege — the elevator resolver the setup realizers import.
# `from-deb.ts` and `install-pinned-artifact.ts` must resolve `sudo` to an absolute,
# root-owned, setuid path rather than through PATH (docs/BUGS.md P1, 2026-08-24), so the
# resolver is now part of the install-relevant subset. Omitting it does not silently weaken
# the install -- the import fails and the build stops, which is how this line got written.
COPY src/Core.TypeScript/privilege /workspace/src/Core.TypeScript/privilege
# src/Core.TypeScript/accelerator carries the local-LLM primitive's validator + tests
# (validate-local-llm.ts + local-llm.test.ts) for validation step 4 below.
COPY src/Core.TypeScript/accelerator /workspace/src/Core.TypeScript/accelerator

# Run install.sh — this exercises:
#   1. install.sh dispatch (detects Linux → linux.sh)
#   2. linux.sh /etc/NIXOS detection → skip apt step
#   3. mise.sh installation
#   4. common/mise.sh installs .mise.toml runtimes (bun, node, python,
#      java, uv, actionlint, shellcheck, etc.)
#   5. downstream common/* steps (python-tools, elan, dotnet-tools,
#      verifiers, shellenv)
# Exits non-zero if any step fails — the docker build itself fails,
# which CI surfaces as a build failure.
# Exercise the one-liner dev-CLI installers (default-skip in non-interactive CI; the shields
# are where we test everything) + authenticate mise GitHub API lookups via a BuildKit secret
# (no 403). Token mounted as a file for THIS RUN only — never baked into an image layer (vs
# --build-arg). Both env vars scoped to this RUN. || true keeps local builds (no --secret) ok.
RUN --mount=type=secret,id=github_token \
    ZETA_INSTALL_FULL=1 \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" \
    tools/setup/install.sh

# Validation step 1: bun installed via mise AND matches .mise.toml pin
# `bun = "1.3"` exactly (per Copilot review on PR #5393 — earlier check
# was `^1\.` which would let `bun = "1.5"` drift past unnoticed).
# Future bumps of .mise.toml bun pin require updating this regex too;
# composes with .claude/rules/dep-pin-search-first-authority.md.
RUN bash -lc 'eval "$(mise activate bash)" && bun --version | grep -q "^1\.3\." || (echo "ERROR: bun version mismatch (expected 1.3.x per .mise.toml)" && bun --version && exit 1)'

# Validation step 2: every manifests/from-bun-global package is installable
# via bun (validates the iter-5.5.0 substrate's bun install --global
# pattern works on NixOS userspace). Doesn't actually run the CLIs
# (would need auth); just verifies install succeeds + declared binaries
# land at the expected path.
# set -o pipefail ensures `bun install ... | tail -5` propagates bun's
# non-zero exit (per Copilot review on PR #5393 — without pipefail the
# pipeline returns tail's exit status which masks install failures
# when a cached/stale claude binary already exists at the path).
RUN bash -lc 'set -eo pipefail && eval "$(mise activate bash)" && \
    mkdir -p /root/.bun/bin && \
    while IFS= read -r line || [ -n "$line" ]; do \
      line="${line%%#*}"; line="$(echo "$line" | xargs)"; [ -z "$line" ] && continue; \
      set -- $line; pkg="$1"; bin=""; shift || true; \
      for tok in "$@"; do case "$tok" in bin=*) bin="${tok#bin=}" ;; esac; done; \
      BUN_INSTALL=/root/.bun bun install --global "$pkg" 2>&1 | tail -5; \
      if [ -n "$bin" ]; then test -x "/root/.bun/bin/$bin" || (echo "ERROR: $bin not at expected path" && exit 1); fi; \
    done < tools/setup/manifests/from-bun-global'

# Validation step 3: gh installed via mise / nix (the iter-5.5.0 Bug 5
# fix added gh to common.nix systemPackages; in Docker we don't have
# the NixOS module evaluating, so we install via nix-shell as a proxy
# check).
RUN nix-shell -p gh --run 'gh --version | head -1'

# Validation step 4 (B-0941): the local-LLM primitive ACTUALLY WORKS on NixOS —
# closes the false-green where the nixos test passed by SKIPPING. install.sh's
# local-llm.sh nix-branch installed ollama (FHS-safe via nix) + pulled the pinned
# model during step 130; the model persists on disk, the daemon does not across
# layers, so start it here and ASSERT (not skip): pinned model present + a REAL
# chooseIndex probe + the run-anywhere mock tests. A skip-to-green here would
# reintroduce the exact hole B-0941 names — so this RUN fails the build if the
# local-LLM is absent. (assert-don't-skip per the shield rule.)
RUN bash -lc 'set -eu; eval "$(mise activate bash)"; \
    export PATH="$HOME/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"; \
    command -v ollama; \
    (ollama serve >/tmp/ollama.log 2>&1 &); \
    for _ in $(seq 1 30); do \
      curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break; \
      sleep 1; \
    done; \
    curl -fsS http://127.0.0.1:11434/api/version || { echo "=== ollama serve log (/tmp/ollama.log) — daemon not reachable ==="; cat /tmp/ollama.log 2>/dev/null || echo "(no /tmp/ollama.log)"; echo "=== end serve log ==="; exit 7; }; \
    MODEL="$(grep -E "^model" tools/setup/manifests/from-ollama | awk "{print \$2}")"; \
    echo "asserting model: $MODEL"; \
    ollama list; \
    ollama list | awk "NR>1 {print \$1}" | grep -qx "$MODEL"; \
    bun test src/Core.TypeScript/accelerator/local-llm.test.ts; \
    bun src/Core.TypeScript/accelerator/validate-local-llm.ts --root "$PWD"'

# Final marker — if all steps succeed, this echo lands in the build
# output as the success signal for CI.
RUN echo "B-0849 Phase 1 Docker harness validation COMPLETE — install.sh + mise + bun + claude-code all working on NixOS userspace"
