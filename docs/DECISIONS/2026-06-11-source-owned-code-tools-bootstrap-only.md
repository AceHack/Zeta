# ADR: Source-owned code and bootstrap-only tools

**Status:** Accepted
**Date:** 2026-06-11
**Backlog:** (to be filed for repo-wide migration; this ADR ships the boundary and the Q# first slice)

## Context & Problem Statement

Zeta's runtime, oracle, package-manager, and verification code has grown across
both `src/` and `tools/`. That makes ownership blurry: a TypeScript oracle under
`tools/` looks like disposable machine setup even when it is actually load-bearing
source substrate. The operator clarified the desired boundary on 2026-06-11:

> keep all code in source and tool is just for pre ace install.sh setup on dev
> and build machine and such everyting else is src so only .sh and .ps1 in tools

The repository still has substantial historical code under `tools/`, so a hard
enforcement gate would immediately fail main. We need to record the target rule
and migrate in slices without hiding the debt.

## Considered Options

- **Option 1: Keep the current mixed layout** — Runtime, oracle, and setup code
  may live under either `src/` or `tools/`.
- **Option 2: Source-owned code boundary** — All code lives under `src/`; `tools/`
  is reserved for bootstrap/install shell and PowerShell entrypoints.
- **Option 3: Immediate hard gate** — Add a CI rule that rejects every non-shell
  file under `tools/` immediately.

## Pros & Cons of the Options

### Option 1: Keep the current mixed layout

- **Pros:** No migration work.
- **Cons:** Continues the ambiguity; source code can hide under setup names; gates
  and reviewers must remember special cases.

### Option 2: Source-owned code boundary

- **Pros:** Clear ownership. Runtime, oracle, package-manager, and verification
  code all live in the source tree. `tools/` becomes the narrow bootstrap edge for
  dev/build machines.
- **Cons:** Requires staged migration of existing historical code under `tools/`.

### Option 3: Immediate hard gate

- **Pros:** Enforces the final rule mechanically.
- **Cons:** Not currently shippable: the repository has hundreds of existing
  code-like files under `tools/`, so this would turn main red before migration.

## Decision Outcome

- **Chosen Option:** Option 2. Zeta code is source-owned. The intended final
  shape is:
  - `src/` owns runtime code, oracle code, package-manager code, CI helper code,
    generators, and verification programs.
  - `tools/` owns bootstrap/install entrypoints for developer and build machines,
    limited to shell and PowerShell where practical.
  - Existing non-shell files under `tools/` are grandfathered migration debt, not
    precedent for new code.

- **Consequences:**
  - New code should default to `src/`, even when it is an oracle or generator.
  - Migration should proceed in small, tested slices instead of one giant rename.
  - A hard `tools/` file-type gate should land only after the historical debt is
    small enough for the gate to be useful instead of noisy.
  - The first slice moves the Q# reference oracle from `tools/qsharp-oracle/` to
    `src/Core.QSharp.ReferenceOracle/` and runs both source-owned oracle tests in
    CI cross-verification.
