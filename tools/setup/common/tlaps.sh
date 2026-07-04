#!/usr/bin/env bash
#
# tools/setup/common/tlaps.sh — builds TLAPS (`tlapm`, the TLA+ Proof
# Manager) from source via an opam source-build. Mirrors the shape of
# common/elan.sh (idempotency guard; subprocess of macos.sh/linux.sh).
#
# WHY opam SOURCE-BUILD (not a binary download):
#   Upstream tlapm's latest BINARY release is 2022 and ships ONLY
#   x86_64 self-extracting `.bin` installers (i386-darwin,
#   x86_64-linux-gnu) — NO arm64, NO tarball. This is a macOS-arm64
#   dev machine + CI has arm64 runners, so the binary path cannot
#   serve us. Building from source via opam compiles natively on
#   arm64 → the only true cross-OS path. (Aaron path-A 2026-06-05:
#   "the right long-term cross-OS solution"; Dejan's design.)
#
# HEAVY BUILD — gated behind ZETA_INSTALL_FULL:
#   An OCaml-from-source build (a dedicated opam switch + ~30 OCaml
#   deps + the vendored Zenon backend) is heavy and slow. It does NOT
#   belong on a minimal install. macos.sh/linux.sh only invoke this
#   script when ZETA_INSTALL_FULL=1 (same gate one-liner-tools.sh
#   uses for its heavy/optional installers). GOVERNANCE §24: the gate
#   keeps install.sh's dev/CI/devcontainer minimal modes fast; the
#   full mode (or an explicit ZETA_INSTALL_FULL=1) opts into TLAPS.
#
# SUPPLY-CHAIN PIN:
#   tlapm is pinned to an EXACT commit (no `latest`, no `curl|sh`),
#   mirroring the v1.8.0 TLC-jar exact-pin discipline. opam fetches
#   that commit over git+https and builds it. Bump procedure: update
#   TLAPM_COMMIT below to a newer tlaplus/tlapm commit (the repo has
#   no release tags as of 2026-06; main is the canonical ref) and
#   re-run — opam re-pins + rebuilds.
#
# IDEMPOTENT: safe to run N times = run-once effect. If `tlapm` is
# already resolvable in the build switch, this is a no-op.
#
# DEBT (named, not hidden):
#   - Isabelle backend is DEFERRED. tlapm's SMT (Z3) + Zenon backends
#     discharge the obligations we need; the Isabelle backend is a
#     separate heavy install (a full Isabelle distribution) and is not
#     wired here. Proofs needing `BY Isabelle` will not discharge until
#     it lands.
#   - The system `z3` (manifests/brew + manifests/apt) is the SMT
#     backend. tlapm finds it on PATH.

set -euo pipefail

# Pinned tlapm source commit (tlaplus/tlapm). Exact-pin per the
# supply-chain discipline above. No release tags exist upstream; main
# is canonical. Bump this + re-run to upgrade.
TLAPM_COMMIT="1eabe97dbb9b91fb4f8081fe104c6b3fad826940"  # main @ 2026-06-05

# Dedicated opam switch for the TLAPS build — keeps tlapm's OCaml deps
# isolated from any other opam usage on the machine. OCaml 5.1.0 is the
# version upstream DEVELOPING.md builds against.
TLAPS_SWITCH="tlaps-build"
OCAML_VERSION="5.1.0"

if ! command -v opam >/dev/null 2>&1; then
  echo "warning: opam not on PATH — TLAPS build skipped."
  echo "  opam is declared in tools/setup/manifests/{brew,apt}; ensure the"
  echo "  system-package step ran before common/tlaps.sh."
  exit 0
fi

# ── opam init (idempotent) ──────────────────────────────────────────
# --bare: no default switch yet (we create our own below).
# --no-setup: don't touch shell rc files (managed shellenv owns PATH).
# --disable-sandboxing: bubblewrap/sandbox-exec is unavailable in many
#   CI containers + devcontainers; opam builds are reproducible without
#   it here (we pin the exact source commit). `opam init` is a no-op if
#   ~/.opam already exists.
if [ ! -d "${OPAMROOT:-$HOME/.opam}" ]; then
  echo "↓ initializing opam (bare, no shell setup, no sandbox)..."
  opam init --bare --no-setup --disable-sandboxing --yes
fi

# ── Build switch (idempotent) ───────────────────────────────────────
if ! opam switch list --short 2>/dev/null | grep -qx "$TLAPS_SWITCH"; then
  echo "↓ creating opam switch '$TLAPS_SWITCH' (OCaml $OCAML_VERSION)..."
  opam switch create "$TLAPS_SWITCH" "ocaml-base-compiler.$OCAML_VERSION" --yes
fi

# Bring the switch into THIS shell's environment for the rest of the run.
eval "$(opam env --switch="$TLAPS_SWITCH" --set-switch)"

# ── tlapm (idempotent) ──────────────────────────────────────────────
# If tlapm is already installed in the switch, no-op (run-once effect).
if opam exec -- tlapm --version >/dev/null 2>&1; then
  echo "✓ tlapm already installed: $(opam exec -- tlapm --version 2>&1 | head -n1)"
else
  echo "↓ building tlapm from source at ${TLAPM_COMMIT}..."
  echo "  (heavy OCaml build — first run compiles ~30 deps + the Zenon backend)"
  # WHY NOT `opam install tlapm` directly: on this pinned commit, the
  # upstream tlapm.opam `build:` field ends with
  #   dune install -p name --create-install-files name
  #   make -C %{lib}%/tlapm -f Makefile.post-install
  # The `--create-install-files` mode writes .install METADATA instead
  # of populating the switch prefix, so `%{lib}%/tlapm` does not exist
  # when the post-install make runs → "No such file or directory. Stop."
  # (verified failure on macOS-arm64, 2026-06-05). The opam package's
  # own packaging is the bug, not arm64. So we follow the upstream
  # DEVELOPING.md flow instead, which works cleanly on arm64:
  #   opam install ./ --deps-only   (opam still manages all OCaml deps)
  #   dune build
  #   dune install --prefix=$OPAM_SWITCH_PREFIX
  #   make -C $PREFIX/lib/tlapm -f Makefile.post-install
  # Pin metadata is still recorded (traceability) but install is manual.
  opam pin add -n -y tlapm \
    "https://github.com/tlaplus/tlapm.git#${TLAPM_COMMIT}" || true

  TLAPM_SRC="$(mktemp -d)"
  trap 'rm -rf "${TLAPM_SRC}"' EXIT
  git clone "https://github.com/tlaplus/tlapm.git" "$TLAPM_SRC"
  git -C "$TLAPM_SRC" checkout -q "$TLAPM_COMMIT"

  # opam manages the OCaml deps (re2, core, dune, camlzip, ... + the
  # vendored Zenon build deps). --deps-only: build deps, not tlapm.
  # No --with-test: we build with `-p tlapm @install` (not @runtest),
  # so the test-only deps (ounit2, alcotest, ...) aren't required.
  opam install -y "$TLAPM_SRC/." --deps-only

  # Build + install into the switch prefix (the DEVELOPING.md `make`
  # + `make install` targets, inlined so we don't depend on gmake).
  (
    cd "$TLAPM_SRC"
    # -p tlapm: build ONLY the tlapm package's @install alias. A bare
    # `dune build` also builds the optional `lsp`/`eio_main` subprojects
    # (lsp/bin/dune, lsp/test/dune) whose deps we deliberately do NOT
    # install (depopts) → "Library eio_main not found". Package-scoping
    # matches what the upstream opam build does (`dune build -p name`).
    dune build -p tlapm @install
    dune install -p tlapm --prefix="$OPAM_SWITCH_PREFIX"
    # Post-install: chmod the backend prover binaries (Zenon etc.).
    make -C "$OPAM_SWITCH_PREFIX/lib/tlapm" -f Makefile.post-install
  )
  # TLAPM_SRC cleanup happens via the EXIT trap above.
fi

# ── fstar (idempotent) ──────────────────────────────────────────────
if opam exec -- fstar --version >/dev/null 2>&1 || opam exec -- fstar.exe --version >/dev/null 2>&1; then
  echo "✓ fstar already installed"
else
  echo "↓ installing fstar inside the '$TLAPS_SWITCH' switch..."
  opam install -y fstar
fi

# ── Verify ──────────────────────────────────────────────────────────
if opam exec -- tlapm --version >/dev/null 2>&1; then
  echo "✓ tlapm: $(opam exec -- tlapm --version 2>&1 | head -n1)"
else
  echo "warning: tlapm build attempted but 'tlapm' is still not resolvable."
fi

if opam exec -- fstar --version >/dev/null 2>&1; then
  echo "✓ fstar: $(opam exec -- fstar --version 2>&1 | head -n1)"
  echo "  (invoke via: opam exec --switch=$TLAPS_SWITCH -- fstar ...)"
elif opam exec -- fstar.exe --version >/dev/null 2>&1; then
  echo "✓ fstar: $(opam exec -- fstar.exe --version 2>&1 | head -n1)"
  echo "  (invoke via: opam exec --switch=$TLAPS_SWITCH -- fstar.exe ...,"
  echo "   or activate the switch: eval \"\$(opam env --switch=$TLAPS_SWITCH)\")"
else
  echo "warning: fstar build attempted but 'fstar/fstar.exe' is still not resolvable."
fi
