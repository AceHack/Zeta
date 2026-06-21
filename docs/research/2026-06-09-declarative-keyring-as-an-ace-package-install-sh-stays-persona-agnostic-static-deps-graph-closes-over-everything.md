# Declarative keyring as an `ace` package: install.sh stays persona-agnostic; a static deps graph closes over everything by naming nothing

**Register:** [grounded] architecture decision (Aaron's critique) + honest self-review.
**Date:** 2026-06-09. **Captured by:** Otto (shadow). **Status:** decision + target;
the decoupling (install.sh revert) is done, the ace-package refactor is intentional debt.

## Aaron's critique (verbatim)

> "tools/setup/persona-keys/ — is this declarative and closed over or a bunch of
> imperative mess?"  · "ace package manager needs a full deps graph in code"  ·
> "so we can close over with static deps graph — why does install.sh need to know
> anything about personas?"  · "maybe it does — i'm just asking."

## Honest self-review (Rune/Kira lens on my own work)

- **Current state is imperative.** `keyring.sh` is a bash wrapper orchestrating a
  procedural `gen.ts`; deps are bun `package.json`, not ace. It works and is
  **verified** (ETH derivation checked against `cast`), but it is **not**
  declarative and **not** closed over by ace.
- **The install.sh hook was a coupling smell.** Adding a `persona-keys`-named
  block to `install.sh`/`install.ps1` made the universal installer know about
  personas — exactly the imperative coupling Aaron flagged. It was also
  **redundant**: `keyring.sh` self-bootstraps its deps on first run. **Reverted.**

## The answer: install.sh should know NOTHING about personas

The keyring is a **package**, not an installer special-case. Its deps + key-type
derivations belong in **`ace`'s static deps graph** (`tools/ace/` — Zeta's signed
DLC package manager: dep edges `{name,version}`, a z3/SAT `solve()`, lockfiles,
content-hashing, trust/signing). Then:

- `ace` resolves the **whole** graph (every package, pinned + signed + locked).
- the installer runs `ace sync` **generically** — it closes over *everything* by
  naming *nothing*. No `persona-keys`, no `keyring`, no persona names in install.sh.
- "why does install.sh need to know about personas?" → **it doesn't.** A static
  deps graph is the closure; the installer is just its driver.

This is the **"everything is a verb-noun-dependsOn statement"** thesis
(`docs/research/2026-06-07-everything-is-a-short-context-aware-seam-verb-noun-dependson-statement-aaron.md`)
applied to setup: the keyring is nodes (crypto primitives + each derivation) with
`dependsOn` edges; ace is the solver; install is the fold over the resolved graph.

## Plan

1. **Decouple install.sh / install.ps1 from personas** — DONE (reverted the hook;
   `keyring.sh` self-bootstraps deps on first run as the bridge).
2. **Publish the keyring as an `ace` package** (intentional debt) — declare its
   deps graph in code (the @noble/@scure/micro-key-producer pins as dep edges;
   the six derivations as nodes), sign + content-hash + lockfile it. This would be
   the **first real `ace` package** (`registry.json` is currently empty), so it
   needs care + Dejan/Aaron review — hence debt, not a rushed land.
3. **Installer closes over `ace` generically** — once packages live in ace, the
   installer drives `ace` and names nothing app-specific.

## Pointers

- `tools/ace/` — the package manager (081KR2E4K0008QG0R002YE3MMD): `solver.ts` (z3), `resolve.ts`,
  `lockfile.ts`, `signing.ts`, `store.ts`, `registry.json` (empty today).
- `tools/setup/persona-keys/` — the (working, verified, imperative) tool to be
  refactored into an ace package.
- Verb-noun-dependsOn thesis; the keyring/two-mode plane doc; the traveler frame
  (the keys are travelers' identity material).
