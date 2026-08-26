---
id: 081M102M6X5087G0R001VWNYS2
type: task
state: backlog
priority: P1
slug: ace-pre-bootstrap-published-binary-one-liner-or-minimal-from
title: "Ace pre-bootstrap: published binary one-liner or minimal from-source seed that never requires Ace to exist"
created: 2026-08-26T22:21:36.550Z
depends_on: ["081M100RB97087G0R0008EAAY7"]
composes_with: ["081M102M6Y2087G0R000407SW3"]
---

# Ace pre-bootstrap: published binary one-liner or minimal from-source seed that never requires Ace to exist

Ace is the bootstrap. Two legal ways in, both required forever
(`.claude/rules/clone-at-tag-stays-sufficient.md` — Ace may be the good
path, never the only path):

1. **Published Ace artifact** + one-line installer (pinned SHA, same
   shape as `install-pinned-artifact.ts`).
2. **Pre-bootstrap**: the smallest toolchain that can *build* Ace from
   source (bun or node + this repo/tag), then Ace takes over.

A third bootstrap, later: Ace's own **compiler-compiler** (Futamura
projections — `Cogen.fs` / `MixCogen.fs` already ship in-tree). That is
how Ace stops depending on a host compiler.

## Must

- One-liner does not `curl|sh` an unpinned URL.
- Pre-bootstrap inventory is named and tiny (no full mise/dotnet/nix).
- `clone` at a tag of the Ace repo still builds Ace without Ace on PATH.
- Harny is an Ace package, not a bootstrap dependency.

## Pointers

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
- `src/Core.TypeScript/ace/install-pinned-artifact.ts`
- `docs/trajectories/own-ai-harness/RESUME.md` phase B
