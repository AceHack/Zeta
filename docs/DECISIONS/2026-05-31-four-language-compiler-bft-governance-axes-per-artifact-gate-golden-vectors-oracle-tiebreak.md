# ADR: 4-language compiler-BFT governance — correctness/distribution axes, per-artifact 4-language gate, golden-vectors-as-oracle + divergence tie-break

**Date:** 2026-05-31

**Status:** *SUPERSEDED by [ADR: 7-Language Matrix and Formal Verification Governance](2026-06-16-seven-language-matrix-and-formal-verification-governance.md)*
Product-team review (architect + PM personas) is incorporated below. This ADR records
the decisions agreed when landing the VISION "arena, not the throne" addition (PR #6260)
and answers the three governance gaps both reviewers flagged. Per the operator's
doctrine-process rule, the whys are stated to be **challengeable by newcomers**; if a why
is wrong, the ADR changes.

## Context

Zeta builds correctness-critical primitives in **four languages** — TypeScript, F#, C#,
Rust — as a **non-Byzantine "compiler-BFT"** (B-0944, *"the compilers don't lie"*): the
same logic, each compiler an independent oracle, agreement = high confidence the logic is
bit-perfect. Already shipped: the observe-algebra in all four (B-0867.27, PRs 6248 / 6251 /
6253 / 6255) and the observe-fold additive monoid in C#+F# (B-0867.28, PR 6259). The
operator framed a per-language **role split** (voice, with Ani, 2026-05-31): F# =
correctness core, TS = distribution core, C# = 2nd distribution core, Rust = low-level
core — plus the **clean-room structure** (F# = the "dirty" spec informed by harvested
prior-art concepts; Rust/TS/C# = clean-room impls from the F# spec; VISION Product 1).

Product-team review of that framing converged on three governance gaps this ADR closes:
the F#/TS "two axes of primary" need reconciling (it supersedes an existing VISION bullet);
"4 implementations of everything" is 4× surface unless gated per-artifact; and there is no
written tie-break for when the four disagree.

## Decision 1 — Two axes of "primary"; supersede "First-class F#, polyglot over time" (re: the DB)

There are **two orthogonal axes of authority**, and conflating them is the error:

- **F# is correctness-authoritative** — it carries the heavy math + formal proofs (TLA+,
  Lean) and is the clean-room **spec** the other implementations are written from.
- **TS is distribution-authoritative** — it is the primary distribution surface (almost
  every agent harness has Node/Bun/TS; vendor apps + skill stores).
- **C# = 2nd distribution** — wide enterprise reach; BCL-clean surface that must NOT expose
  an F# (FSharp.Core) dependency to consumers (real market insight: C# devs reject F# DLLs).
- **Rust = low-level + WASM** — systems guarantees; WASM target.

This **supersedes the existing VISION bullet "First-class F#, polyglot over time"** *for the
DB*: F# is no longer "the primary language with polyglot drift" — it is correctness-/spec-
authoritative while TS is distribution-authoritative. (The VISION Product-1 bullet now
points here.)

**Why (challenge it):** "primary" was doing two jobs (who's authoritative for *correctness*
vs for *reach*). Naming both axes removes the contradiction a reader hits between "F# is
primary" and "TS is the distribution king." *Newcomer pushback:* is two-axis over-engineered
vs just "F# core, TS shipping layer"? — the axes matter precisely because they can disagree
about which language a given artifact should live in (Decision 2).

## Decision 2 — Per-artifact 4-language gate (4-language = a correctness budget, spent on PRIMITIVES not SURFACES)

Not every artifact gets four implementations. **All-four is earned only by a kernel
primitive that is:**

1. **small** + **pure** + **total** (a function/algebra, not stateful machinery), AND
2. a **correctness oracle** others execute (carries shared golden vectors), AND
3. genuinely executed on **≥2 distribution targets**.

Examples that earn all-4: the observe-algebra, tri-boolean / TriFloat, ZetaId. Everything
above the primitive layer:

- **Default TypeScript** (distribution).
- **+ F#** where correctness/proof is needed (the spec).
- **+ C# behind a port/shim** when a *named* enterprise consumer can't take the shim — prefer
  a pure-C# façade over the F# core (B-0445 already shipped this pattern, PR #3120) over a
  full re-implementation.
- **+ Rust** only when a *named* WASM/systems customer exists.

**Minimum viable to ship:** TS (distribution) + F# (correctness/spec) **now**; C# via shim
**now-ish**; Rust + full-parity C# **later/research** (gate on a named customer).

**Why (challenge it):** four parallel impls is a 4× change-tax; spending it everywhere buys
little and risks drift. Spending it on frozen kernel primitives — where bit-exact agreement
is a real correctness signal (B-0949 caught a real bound bug via cross-language divergence) —
is where the BFT pays. *Newcomer pushback:* does the gate's "small+pure+total" exclude things
that *should* be cross-checked (e.g. a stateful but security-critical component)? — then widen
the gate for that named case + record why.

## Decision 3 — Golden vectors are the oracle; F# is one signer; divergence tie-break

- **The shared golden vectors are the oracle** — not any single language. F# is the clean-room
  **spec** the others implement from, but the *vectors* (not F#) are the authority no
  implementation can override. **No single implementation, including F#, self-certifies.**
- **On cross-language divergence:** treat it as a **spec-ambiguity / real-bug ticket**, never
  resolved by "ship whichever 3 agree" majority vote. Investigate (the B-0949 precedent:
  divergence surfaced a genuine bug). F# (the spec) is authoritative for what the vectors
  *should be*; once the vectors are corrected, all four are fixed to match them.

**Why (challenge it):** a self-certifying oracle is a confident single point of failure; the
proofs check the *spec*, the BFT checks the *implementations*, and the vectors are the shared
ground truth that closes the loop. *Newcomer pushback:* if F# decides what the vectors should
be, isn't F# still the de-facto authority? — yes for *spec intent*, but a vectors change is
visible + reviewable + must be matched by all four; the gate against silent single-oracle
trust is that no impl ships by out-voting the vectors.

## Consequences

- VISION Product-1 "First-class F#, polyglot over time" bullet is superseded re: the DB
  (pointer added).
- The clean-room / per-language-licensing structure (VISION #6260) composes: F# = dirty spec
  (research-licensed); clean-room impls = permissive — that licensing decision is flagged for
  separate legal review and is NOT decided here.
- New cross-language primitives apply Decision 2's gate before being written in all four.

## Open (for Max review before lock)

- The concrete **N** for "persistent KPI miss" (referenced by the autonomy section; not a
  DB-BFT item but cross-referenced).
- Exact wiring of the divergence-triage ticket flow (compose with B-0949 / the parity tests).
- Whether C# should always be shim-over-F# or sometimes full-parity (per named consumer).

## Composes with

- B-0944 (tri-boolean / compiler-parity-BFT — "compilers don't lie") · B-0867.27 (observe
  4-language) · B-0867.28 (observe-fold monoid) · B-0445 (C# shim over F#) · B-0949
  (divergence caught a real bug — the healthy precedent) · B-0952 (good-citizen / clean-room
  upstream) · VISION Product 1 (arena-not-throne + clean-room) · `.claude/rules/bcl-interface-
  boundary-own-your-interfaces-hexagonal.md` · `.claude/rules/dep-pin-search-first-authority.md`.
