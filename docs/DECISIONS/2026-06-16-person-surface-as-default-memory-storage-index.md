# ADR: Person-surface as the default memory storage index

**Date:** 2026-06-16
**Status:** Proposed (Phase 0 — decision artifact; phased migration gated on operator go)
**Authors:** Otto (shadow\*), Aaron (operator — greenlit the ADR)

## Context

Memory currently lives in **two diverged stores** with two different keys:

1. **Git-synced repo `memory/`** — versioned, on `origin/main`, ~1327 top-level `.md` +
   ~30 persona subdirs (`otto/`, `kestrel/`, `alexa/`, `amara/`, …), ~1552 total. This is
   where ferries land and where the reindex writes `memory/MEMORY.md`. **Current; shareable
   via git.**
2. **Claude auto-memory** `~/.claude/projects/<checkout-path-slug>/memory/` — a **real dir
   (not a symlink)**, ~1028 files, **NOT git-synced**, keyed by the **checkout path slug**
   (`-Users-acehack-Documents-src-repos-Zeta`), loaded at session start. **Stale; local;
   drifts.**

Three problems follow:

- **Drift / crash.** The path-slug store is tied to one checkout path, isn't shared, and
  falls behind the git-synced store (this session's 17 ferries are on `origin/main` but
  absent from the auto-memory dir). Divergence between "what loads at boot" and "what's
  canonical" is the observed failure mode.
- **Non-shareable across actors.** `~/.zeta/agents/otto-cli` is a pool of ~131 per-task
  worktrees (the old **flat `agents/<persona-surface>`** scheme). Sharing memories by
  copying files between these dirs is what *created* the divergence.
- **Flat default fights the existing model.** [`docs/writer-actor-routing-model.md`](../writer-actor-routing-model.md)
  already specifies the actor address as **persona ⊕ surface ⊕ instance ⊕ node** and the
  clone layout as `~/.zeta/persona/<persona>/<surface>/<instance>/` — and already flags the
  flat `agents/otto-cli` scheme as the thing to **migrate from**. The memory store has a
  *partial* persona-subdir convention but its **default** is still flat top-level `memory/`.

## Decision

**Adopt person-surface as the DEFAULT storage index for the memory store**, matching the
writer-actor-routing-model bus address. Concretely:

1. **Key memories by `memory/<persona>/[<surface>/]…`** as the default landing spot (surface
   is an *optional* sub-level, used only where a memory is genuinely surface-specific; most
   memory is persona-level). Cross-persona / global memories land in a declared shared
   namespace (`memory/_shared/`).
2. **Git (`origin/main`) is the sync mechanism.** Memories are shared by **pulling**, never
   by copying files between stores. Any clone/worktree (incl. every `otto-cli` worktree) gets
   the full store with `git pull origin main`.
3. **Retire the path-slug auto-memory to a SOURCED CACHE.** The harness-managed
   `~/.claude/projects/<slug>/memory/` should be **sourced from** the git-synced repo
   `memory/` (boot reads `memory/<active-persona>/` + `memory/_shared/`), **not** maintained
   as a parallel store. Realistic mechanism: symlink or a boot-time sync from the repo —
   *fight the divergence, not the harness*.

## Why this is the right key — one key, three problems

Person-surface (⊕ instance ⊕ node) is not just a memory-layout choice; it is the **same key**
that already solves writer routing **and** the identity bit-budget:

- **Memory index** — where a fact is stored/found (this ADR).
- **Writer routing / bus address** — `persona ⊕ surface ⊕ loop ⊕ node` (writer-actor-routing-model §"bus address").
- **ZetaId bit-budget** — the "gen over bit limits" dilemma. A flat 128-bit ZetaId has a
  finite space (birthday collision ≈ 2⁶⁴) while `gen` is unbounded. You do **not** fix this
  by widening the flat id (breaks byte-lock + least-action). You fix it with **hierarchical
  namespacing — the same persona ⊕ surface ⊕ instance ⊕ node** — which extends the effective
  address space *without* growing the flat id. The 128-bit id becomes the **per-namespace
  security parameter** (the anti-Sybil forgery-cost floor), and **`gen`-as-ECC detects the
  rare in-namespace collision** (two structures regenerating to one id but differing = a
  caught, correctable event). Same hierarchy, three uses — strong evidence it's the right
  default.

Discipline alignment: **DV2.0** (hub/satellite by change rate — persona-surface is the stable
hub key); **scale-free** (hierarchy has no central counter — cf. the ZetaId rotation ADR
2026-06-15 retiring sequential B-xxxx); **crash-resilient** (one canonical git-synced source
of truth, no path-local drift).

## Migration (phased — per the routing doc's expand-then-migrate pattern)

- **Phase 0 (this ADR):** decide. *Gated on operator go for the later phases.*
- **Phase 1 — expand (low-risk, adopt-forward):** *new* memories land in `memory/<persona>/`
  by default (Otto starts writing to `memory/otto/`, not flat top-level). No existing files
  move. Includes moving this session's 17 flat ferries into `memory/otto/` as the worked
  example.
- **Phase 2 — tooling:** update the reindex tool (`reindex-memory-md.ts`) and the CLAUDE.md
  fast-path (`CURRENT-*.md`) to be person-surface-aware; stand up `memory/_shared/`.
- **Phase 3 — backfill + retire the parallel store:** migrate flat top-level `memory/` into
  `memory/<persona>/` (overlap-window dual-read during the move, like the ZetaId rotation —
  the reindex resolves both layouts until cutover); retire the path-slug auto-memory to a
  sourced cache/symlink of the repo store.

No big-bang. Each phase is independently revertible; readers resolve both layouts during the
overlap window.

## Consequences / open questions (the razor)

- **Surface granularity is open.** Most memory is persona-level, not surface-level. Default
  to `memory/<persona>/`; add `<surface>/` only when a memory is provably surface-specific —
  else the tree over-fragments (over-keying is its own failure).
- **Shared / cross-persona memories need a home** — `memory/_shared/` (or `_global/`).
  Mis-filing a shared fact under one persona hides it from the others.
- **The harness auto-memory dir is not fully ours.** We can source/symlink it from the repo
  store, but we cannot change how the harness *keys* it; the realistic fix is sourcing, not
  re-keying. Flagged as the one part that depends on harness behavior.
- **Blast radius of Phase 3 is real** (reindex tool, fast-path, ~1300 files) — phase it,
  dual-read during cutover, operator-gated. This ADR proposes; the tooling changes each need
  their own review.

## Anchors

Writer-actor-routing-model (`docs/writer-actor-routing-model.md`); the shared-checkout
view-only rule; ADR 2026-06-15 zero-downtime ZetaId rotation (the overlap-window dual-read
pattern reused here); DV2.0 hub/satellite; ZetaId 128-bit floor primitive + the anti-Sybil
forgery-cost floor; `gen(gen)==gen` as ECC (collision-detection). Operator framing: *"person-
surface might be the best storage index default mechanism"* (Aaron, 2026-06-16).
