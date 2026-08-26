---
id: 081M102M6Y2087G0R000407SW3
type: task
state: backlog
priority: P1
slug: split-harny-as-the-first-isolated-published-package-ace-inst
title: "Split Harny as the first isolated published package; Ace installs it; clone-at-tag stays sufficient"
created: 2026-08-26T22:21:36.580Z
depends_on: ["081M100RB97087G0R0008EAAY7"]
composes_with: ["081M102M6X5087G0R001VWNYS2"]
---

# Split Harny as the first isolated published package; Ace installs it; clone-at-tag stays sufficient

After the custom agent harness (Harny) is dogfooded in the monorepo,
it is the first extract. Goal: isolated published artifact, small
toolchain, no cascade of the whole Zeta tree into every cache.

Ace installs Harny (package manager of package managers). Harny
references Ace/Zeta as **declared packages**, not as a copy of
`src/Core.TypeScript/**`.

## Must

- In-tree `src/Core.TypeScript/harny/` is the seed (login + indexed search).
- Extract criteria: Harny builds and tests without F#/dotnet/Nix.
- Zeta/Forge/Ace remain peer repos per the 2026-04-22 ADR — not
  submodules (cycle cannot be a DAG).
- Indexing stays inside Harny so agents do not full-search a giant tree.
- Monorepo cache pain is the reason, not a vibe: one package = one
  small CI.

## Pointers

- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
- `src/Core.TypeScript/harny/harny.ts`
- `src/Core.TypeScript/search/inverted/`
