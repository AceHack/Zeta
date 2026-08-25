---
id: 081KDU93J0OAZMF14J8R4K66ZR06XL
priority: P1
status: done
title: Non-mechanism setup realizers — consolidate quantum/elan/python-tools/dotnet-tools/agent-clis/local-llm/tlaps into mechanism-by-source before Ace migration (Aaron 2026-06-21)
effort: M
ask: Aaron 2026-06-21
created: 2026-06-21
last_updated: 2026-06-21
closed: 2026-06-21
closed_by: "#8920"
decomposition: leaf
depends_on: []
composes_with:
  - 081KSKBP80008QG0R002J03WGA
  - 081KSV2WD0008QG0R002A3QJ5Q
  - 081KLL7PPSUMF84HN7WN96ZEQ1P77U
  - tools/setup/
  - src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts
tags: [setup, install-graph, mechanism-by-source, GOVERNANCE-24, bash-retirement, declarative, devops]
type: chore
owner: Dejan
---

# 081KDU93J0OAZMF14J8R4K66ZR06XL — Non-mechanism setup realizers → mechanism-by-source

## Operator framing (Aaron 2026-06-21)

> *"get what we have clean first and stop scripts like quantum and elan and all the
> others that are not mechanism based like before first."*

PR #8907 established the target shape: **manifest = desired state**, **`tools/setup/mechanisms/*.sh` =
uniform realizer**, **`_when.sh` = platform filter**, **`ace-mechanism-pointers.json` = Ace-visible
dep graph**. Several install steps still use one-off `tools/setup/common/*.sh` scripts that duplicate
the same parse-manifest → invoke-package-manager logic with different ecosystems.

This row consolidates them **before** any Ace Bun-realizer work (081KSXN940008QG0R000R76H45 / 081KSKBP80008QG0R002VRN56K).

## Already mechanism-based (do not re-litigate)

| Mechanism | Manifest | Realizer |
|---|---|---|
| HTTPS → path | `manifests/from-url` | `mechanisms/from-url.sh` |
| `.deb` install | `manifests/from-deb` | `mechanisms/from-deb.sh` |
| PATH shim | `manifests/from-shim` | `mechanisms/from-shim.sh` |
| Vendor install script | `manifests/from-installer` | `mechanisms/from-installer.sh` |
| Platform gate | — | `mechanisms/_when.sh` |

Ace pointers: `tools/setup/ace-mechanism-pointers.json`, `src/Core.TypeScript/ace/setup-mechanism-pointers.ts`.

## Non-mechanism realizers to migrate (inventory)

Each row: existing script → proposed mechanism name → manifest (unchanged path unless noted).

| Current script | Manifest today | Proposed mechanism | Notes |
|---|---|---|---|
| `common/python-tools.sh` | `manifests/uv-tools` | `from-uv-tool` | `uv tool install`; idempotent upgrade pass |
| `common/dotnet-tools.sh` | `manifests/dotnet-tools` | `from-dotnet-global` | `dotnet tool install -g`; tier attrs |
| `common/dotnet-workloads.sh` | `manifests/dotnet-workloads` | `from-dotnet-workload` | workload install pattern |
| `common/agent-clis.sh` | `manifests/agent-clis` | `from-bun-global` | best-effort per CLI; codex repair stays in realizer or small hook |
| `common/quantum.sh` | `manifests/quantum` | `from-pypi-venv` | project `.venv` via `uv pip install`; opt-in `ZETA_INSTALL_QUANTUM` / `FULL` |
| `common/elan.sh` | *(inline pin today)* | `from-installer` or `from-elan` | elan-init.sh URL + `lean-toolchain` pin in manifest |
| `common/tlaps.sh` | *(inline TLAPM_COMMIT)* | `from-opam-git` | heavy; keep `ZETA_INSTALL_FULL` gate; pin commit in manifest |
| `common/local-llm.sh` | `manifests/local-llm` | `from-ollama` | mac brew vs linux binary split via `_when.sh` |
| `common/repo-bins.sh` | *(inline)* | `from-symlink` or extend `from-shim` | repo-local bin wiring |
| `common/sync-prior-art.ts` | — | audit | may stay edge script or become `from-url` rows |

## Explicitly **not** in scope (bootstrap / OS edge — stay shell)

- `install.sh`, `linux.sh`, `macos.sh` — orchestrators (should shrink to mechanism dispatch only)
- `common/mise.sh` — pre-Bun bootstrap
- `common/curl-fetch.sh` — shared fetch primitive for mechanisms
- `common/host-tier.sh`, `shellenv.sh`, `profile-edit.sh`
- `persona-keys/keyring.sh` — security edge
- `doctor.sh`, `host-loop-bootstrap.sh`

## Migration order (recommended)

1. **Thin manifest realizers** — `python-tools`, `dotnet-tools`, `agent-clis` (same loop shape as existing mechanisms).
2. **quantum** — already has Ace package test; swap realizer to mechanism; drop any duplicate paths (e.g. removed `qdk.sh`).
3. **elan** — manifest pin for installer URL + default-toolchain none; keep retry in mechanism.
4. **local-llm** — split OS paths via `_when.sh`.
5. **tlaps** — last (heaviest; opam source build).

After each step: update `linux.sh`/`macos.sh` dispatch, extend `ace-mechanism-pointers.json`, shrink
`check-bash-retirement-inventory.ts` allowlist.

## Acceptance

1. Every migrated ecosystem installs exclusively through `tools/setup/mechanisms/*` + manifest;
   corresponding `common/*.sh` deleted or reduced to a one-line `exec` shim (temporary; shim removed
   before row closes).
2. `linux.sh` mechanism dispatch list is the single ordering source; no hidden parallel install paths.
3. Install shields (`docker-*`, `wsl-install-sh-test`, `gate.yml` install step) pass without new flakes
   attributable to the migration.
4. `bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce` green with updated
   allowlist.
5. 081KSXN940008QG0R000R76H45 unblocked (Ace realizer work can resume on uniform mechanism graph).

## Steward vs owner-domain CI residuals (do not conflate)

These are **not** 081KDU93J0OAZMF14J8R4K66ZR06XL acceptance criteria — track on owner lanes:

| Check | Owner | Status |
|---|---|---|
| `build-and-test` — `Z3LawsTests` E-prover FOL | Formal solvers (Soraya / CVC5–E-prover) | **Done #8920** — `from-autotools-tarball` E 3.2 on Linux; smoke TPTP health gate |
| `cross-verify` — `zeta-ir-v2` / `zset-isa-v2` | Codegen (#8911/#8914/#8918) | **Done #8922+** — `cross-verify.ts` oracles; `INFRA_DIRS` skip removed post-8920 |

Steward work stops at install-graph hygiene + mechanical CI; domain tests stay with domain owners.

## Anchors

- `tools/setup/linux.sh` — current ordering (steps 4–11 are migration targets)
- `tools/setup/mechanisms/` — target realizer home
- GOVERNANCE §24 — one install script, three-way parity
- PR #8907 — mechanism-by-source precedent (Jammy formal solvers)
