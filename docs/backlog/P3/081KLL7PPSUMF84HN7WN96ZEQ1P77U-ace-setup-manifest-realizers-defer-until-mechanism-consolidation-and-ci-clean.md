---
id: 081KLL7PPSUMF84HN7WN96ZEQ1P77U
priority: P2
status: in-progress
title: Ace setup-manifest realizers — Bun realizers post-mechanism consolidation (Aaron 2026-06-21)
effort: L
ask: Aaron 2026-06-21
created: 2026-06-21
last_updated: 2026-07-02
unblocked: 2026-06-21
decomposition: leaf
depends_on:
  - 081KDU93J0OAZMF14J8R4K66ZR06XL
composes_with:
  - 081KSKBP80008QG0R002VRN56K
  - 081KR2E4K0008QG0R002YE3MMD
  - tools/setup/
  - src/Core.TypeScript/ace/
tags: [ace-package-manager, setup, defer, mechanism-by-source, install-graph, bash-retirement, desired-state]
type: chore
---

# 081KLL7PPSUMF84HN7WN96ZEQ1P77U — Ace setup-manifest realizers

## Status 2026-07-02 (slice 4 complete)

Prerequisites satisfied: **081KDU93…** (#8920) + **#8948** gate green. Row **P2 /
in-progress** — all mechanism realizers Bun-ported; cutover next.

- **Slice 1 (#8984):** `setup-realize.ts` + `from-uv-tool` + `from-bun-global`.
- **Slice 2 (#8992):** dotnet/bun-link realizers + `realize_mechanism()` router.
- **Slice 3 (#9075):** `from-elan`, `from-url` + `curl-fetch` helper.
- **Slice 4 (#9188):** final 7 — `from-deb`, `from-shim`, `from-autotools-tarball`,
  `from-uv-venv`, `from-opam-git`, `from-installer`, `from-ollama` + shared `when.ts`.
- **Coverage:** 14 / 14 mechanism realizers Bun-ported.
- **Next:** `linux.sh` → `ace-realize --all` cutover; retire shell `.sh` fallbacks when
  confident.

## Status 2026-07-02 (slice 3)

## Status 2026-07-01

## Status 2026-06-21 (historical)

Prerequisites satisfied: **081KDU93…** (#8920) + **#8948** gate green. Row **re-opened
P2 / in-progress** — Bun realizer slice 1 landed in branch:
`src/Core.TypeScript/ace/setup-realize.ts` + `from-uv-tool` + `from-bun-global` realizers.
Shell realizers remain until `linux.sh` → `ace-realize --all` cutover.

## Operator framing (Aaron 2026-06-21)

> *"just backlog the ace stuff we need to get what we have clean first and stop
> scripts like quantum and elan and all the others that are not mechanism based
> like before first."*

The Ace declarative desired-state trajectory (081KSKBP80008QG0R002VRN56K, 081KR2E4K0008QG0R002YE3MMD) stays **backlogged**.
Do **not** pursue Bun/Ace realizer swaps or Ace package pointer expansion for setup
manifests until:

1. **081KDU93J0OAZMF14J8R4K66ZR06XL** landed (#8920) — non-mechanism `common/*.sh` realizers folded into
   `tools/setup/mechanisms/*` + manifests; Ace mechanism pointers cover the full graph.
2. **CI is clean** on steward-mechanical work — gate green on mechanism consolidation merge.

## What was explored and parked

During PR #8920 steward work we mapped setup scripts to Ace conversion tiers. Conclusion:
most manifests are **already declarative**; the gap is inconsistent **realizer shape**
(one-off bash per ecosystem), not missing Ace packages. Examples already partially wired:

- `tools/setup/ace-mechanism-pointers.json` + `setup-mechanism-pointers.ts` (mechanisms)
- `src/Core.TypeScript/ace/packages/qsharp-reference-oracle-0.1.0.json` (quantum manifest)

**Parked until 081KDU93J0OAZMF14J8R4K66ZR06XL:** emit Ace pointers for `uv-tools`, `dotnet-tools`, `agent-clis`,
etc.; add Bun realizers under `src/Core.TypeScript/ace/`; shrink `linux.sh` to
`ace-realize`. That is Phase 2+ of 081KSKBP80008QG0R002VRN56K, not the current critical path.

## Acceptance (when this row re-opens)

1. 081KDU93J0OAZMF14J8R4K66ZR06XL complete — no orphan `common/*.sh` manifest realizers outside the mechanism
   tree (except documented bootstrap edges: `mise.sh`, `install.sh` routing, `keyring.sh`).
2. `check-bash-retirement-inventory.ts` allowlist reflects the shrunk surface.
3. Ace pointer generation extends to all mechanism manifests without duplicating manifest
   text (single source of truth in `tools/setup/manifests/*`).
4. Bun realizers run **post-mise** only; `install.sh` bootstrap edge unchanged until
   081KSKBP80008QG0R002VRN56K Phase 3.

## Why P3

Correct long-horizon direction; wrong sequencing relative to substrate hygiene. Mechanism
consolidation first removes accidental complexity; Ace realizers second inherit a uniform
graph.
