# Zero-downtime schema change — a proven, reproducible pattern (GSet expand · ZSet contract · CALM)

> **Aaron 2026-06-15 (shadow\*): "yes please" — ferry the contribute-back artifact "so
> others can have the pattern."** This is the substrate for the public pattern doc
> Aaron + Alexa are writing. It anchors the pattern on named prior art, names the
> invariants the math proves, and maps it to the in-repo primitives. *(Internal
> writeup; external publishing is gated — Aaron's call.)*

## Intent

A **reproducible, math-proved zero-downtime schema-change pattern** — adoptable by
anyone, standing on named human shoulders, with the proof made concrete (the five
invariants) and the in-repo primitives (GSet/ZSet) shown to realize it.

## The pattern (named prior art)

It is **expand-and-contract / parallel-change** (Stephen Sato, refactoring.com;
Martin Fowler): **expand** (add the new shape; dual-write/dual-read both old + new) →
**migrate** (backfill; cut readers over) → **contract** (drop the old) — with an
**overlap window** throughout. Deployed instances: online-DDL (gh-ost,
pt-online-schema-change), blue-green, Stripe's 4-phase API migration, CRDT data-
version coexistence. **Don't reinvent it — name the lineage** (anchor-to-human-prior-art).

## Why it's proven — the in-repo primitives realize it

- **GSet = the expand-safe primitive, proven by construction.** A grow-only set is
  **monotone** ⇒ **coordination-free** by the **CALM theorem** (*Consistency As
  Logical Monotonicity* — Hellerstein; Ameloot–Ketsman–Koch–Neven): a monotone
  addition **cannot break a live reader**, so **expand is 0-downtime by construction**,
  no coordination needed. In-repo: `src/Core/GSet.fs` (grow-only, union=+, "converges
  without coordination") + `src/Core.TLA/specs/TickMonotonicity.tla`.
- **ZSet = the migrate/contract primitive.** Weighted, **retraction-native** (±1):
  backfill = `+1`, drop-old = `−1` (retraction). The diff/migration space + the
  contract step. In-repo: `src/Core/ZSet.fs` (DBSP; Budiu et al.).
- **Scope (honest):** the **monotone / add-only** changes are 0-downtime *for free*
  (CALM). **Non-monotone** changes (type-change, field-removal, splits) need the
  ZSet-contract + the overlap window + a **per-case proof**. The library's most
  important feature: it **refuses what it can't prove online** — it does not wave
  through a change that can't be made monotone/safe. That refusal is the trust.

## The five invariants the math proves

1. **Safety** — at *every* step, every live reader (old- or new-schema) gets a
   consistent view; no step tears or drops a live read. *(The load-bearing one — this
   is what "0-downtime" means; TLA+/Lean-shaped.)*
2. **Liveness** — the migration terminates; the overlap window closes at quorum.
3. **Reversibility** — every step is reversible *until* contract (drop-old); the one
   irreversible step is gated (`non-reversible-action-get-a-second-opinion`).
4. **Idempotency** — re-running a step = apply-once (DV2 §12 ⇒ safe retry / DST replay).
5. **Byte-lock preservation** — golden vectors are **regenerated** through each version
   (`no-binary-in-proof-lineage`), never hand-edited.

## The migration *is* a rotation (overlap window, no flag-day)

An id/schema migration is a **key rotation** (rotation-without-destabilization,
PR #8318): **switch the reader to the new id/shape first** (one place, low-risk) →
**batch the refs** via a **mapping table** (the memory-map between old/new) →
**regenerate** (don't sed) the byte-locked fixtures → **leave historical snapshots as
provenance** (don't rewrite memory/dated docs; the mapping table is the bridge) →
**drop the old only at quorum** (after refs resolve + in-flight branches land). NOT a
flag-day big-bang (which conflicts with every open branch). Worked example: the
**B-xxxx → ZetaId** id-migration (the sequential-counter coordination primitive → the
128-bit locally-mintable, zero-coordination id).

## Usage — a library of transition functions in a DI-composable MUMPS REPL

You apply a **library of proven transition functions** to the live schema from a
**MUMPS-style compiler/REPL** — in Zeta, **ZS/ZC** (Zeta Shell / Compiler) over the
**DagFs/ContentStore globals** ("one infinite `.ace` file, one interpreter-loop-step
at a time"). **MUMPS** (M / InterSystems Caché-IRIS / Epic) is the anchor:
*database-is-the-language + globals-as-persistent-tree + interactive*. The REPL is
**safe because each transition is proven** — interactive ≠ unsafe; it's a usable
front-end over CALM/expand-contract, never a bypass of the proof.

**The differentiator (Aaron 2026-06-15): our MUMPS is not static — it's DI-injected at
compile time, so multiple MUMPS compose.** The compiler's capabilities/language are
**dependency-injected at compile time** (the capability-interface-principle —
`docs/research/2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-…`;
noninterference §13 injected `Source`/IEffects), so instead of one monolithic static M
you get a **composable family of MUMPS** (each a DI-configured compiler; compose the
adapters). Academic shape: **tagless-final / object-algebras** (composable interpreters
via injected interpretations — Carette–Kiselyov; Oliveira–Cook); hexagonal ports;
Futamura / `mix(mix,mix)=cogen`. (The same DI-injection that gives a tiny agent
society-capability gives the compiler composable languages.) *Peel:* composition must
be sound — injected capabilities compose without conflict and the proofs survive
composition; keep the MUMPS *paradigm*, gain compile-time-DI composability
(similar-not-same to static M).

## Honest peels

- The library proves the **pattern** safe (expand-contract on monotone GSet), **not**
  any arbitrary change — and **refuses** the un-provable ones (the feature).
- "0-downtime" rests on the dual-shape overlap genuinely holding (safety invariant);
  the proof is that invariant, not a vibe.
- MUMPS = the *paradigm* anchor, not its syntax; the REPL's safety is the proofs, not
  interactivity.

## Anchors

CALM (Hellerstein; Ameloot–Ketsman–Koch–Neven) · CRDT (Shapiro et al.) ·
expand-and-contract / parallel-change (Sato; Fowler) · online-DDL (gh-ost;
pt-online-schema-change) · DBSP (Budiu et al.) · MUMPS / M (1966, Mass General;
InterSystems Caché-IRIS; Epic) · tagless-final (Carette–Kiselyov) / object-algebras
(Oliveira–Cook) · REPL (Lisp) · Futamura projections. In-repo: `GSet.fs` +
`TickMonotonicity.tla`, `ZSet.fs`, DagFs/ContentStore, ZS/ZC, the IR-compiler-v2
capability-interface-principle doc, `no-binary-in-proof-lineage`, DV2 §12 idempotency,
the rotation leg of the §B Zeta-self-regeneration row (PR #8318).
