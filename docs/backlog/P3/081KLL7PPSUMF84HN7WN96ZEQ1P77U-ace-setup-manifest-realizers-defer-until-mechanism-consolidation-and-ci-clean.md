---
id: B-0951
zetaid: 081KLL7PPSUMF84HN7WN96ZEQ1P77U
priority: P3
status: open
title: Ace setup-manifest realizers — defer Bun/Ace realizer swap until non-mechanism install scripts are consolidated and CI is clean (Aaron 2026-06-21)
effort: L
ask: Aaron 2026-06-21
created: 2026-06-21
last_updated: 2026-06-21
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

# B-0951 — Ace setup-manifest realizers (deferred)

## Operator framing (Aaron 2026-06-21)

> *"just backlog the ace stuff we need to get what we have clean first and stop
> scripts like quantum and elan and all the others that are not mechanism based
> like before first."*

The Ace declarative desired-state trajectory (B-0854, B-0288) stays **backlogged**.
Do **not** pursue Bun/Ace realizer swaps or Ace package pointer expansion for setup
manifests until:

1. **B-0950** lands — every non-mechanism `tools/setup/common/*.sh` realizer is folded
   into the mechanism-by-source pattern (`tools/setup/mechanisms/*` + manifests), same
   shape as #8907 (`from-url`, `from-deb`, `from-shim`, `from-installer`).
2. **CI is clean** on steward-mechanical work — flake fixes, inventory drift, install
   shields. Owner-domain reds (formal solvers, codegen oracles) stay with their domains.

## What was explored and parked

During PR #8920 steward work we mapped setup scripts to Ace conversion tiers. Conclusion:
most manifests are **already declarative**; the gap is inconsistent **realizer shape**
(one-off bash per ecosystem), not missing Ace packages. Examples already partially wired:

- `tools/setup/ace-mechanism-pointers.json` + `setup-mechanism-pointers.ts` (mechanisms)
- `src/Core.TypeScript/ace/packages/qsharp-reference-oracle-0.1.0.json` (quantum manifest)

**Parked until B-0950:** emit Ace pointers for `uv-tools`, `dotnet-tools`, `agent-clis`,
etc.; add Bun realizers under `src/Core.TypeScript/ace/`; shrink `linux.sh` to
`ace-realize`. That is Phase 2+ of B-0854, not the current critical path.

## Acceptance (when this row re-opens)

1. B-0950 complete — no orphan `common/*.sh` manifest realizers outside the mechanism
   tree (except documented bootstrap edges: `mise.sh`, `install.sh` routing, `keyring.sh`).
2. `check-bash-retirement-inventory.ts` allowlist reflects the shrunk surface.
3. Ace pointer generation extends to all mechanism manifests without duplicating manifest
   text (single source of truth in `tools/setup/manifests/*`).
4. Bun realizers run **post-mise** only; `install.sh` bootstrap edge unchanged until
   B-0854 Phase 3.

## Why P3

Correct long-horizon direction; wrong sequencing relative to substrate hygiene. Mechanism
consolidation first removes accidental complexity; Ace realizers second inherit a uniform
graph.
