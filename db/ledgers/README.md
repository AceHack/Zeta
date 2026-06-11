# ledgers/ — the ledger shape, and MANY single-scoped ledgers (never one)

`ledgers/` is the home of Zeta's **ledgers** — append-only books the physics-accounting demon (the
room/cell) writes to after it measures. **Plural, and SINGLE-SCOPED** (Aaron 2026-06-10): not one
ledger that carries everything, but **many ledgers, each scoped to one kind of thing**.

## The ledger SHAPE (what every ledger is)

A **ledger** is the canonical append-only accounting shape:

- **append-only** — entries are posted, never edited in place (corrections are new entries, like a
  Z-set retraction `−1`, not a mutation). The history is the truth.
- **posted by the demon** — the room/cell measures (`mea`) and **posts the change** to the ledger (the
  finalizer's merge-to-`main` is the posting). See
  `docs/research/2026-06-10-tests-become-cells-with-strict-boundaries-*` (room = physics-accounting demon).
- **balances / idempotent** — entries are keyed to their cause, so re-posting the same measurement is
  an upsert, not a double-count (discipline #6; double-entry integrity).
- **content-addressed** — it rides the MerkleDAG; the ledger's head is its root hash (replayable, DST).

This is the **ledger shape** — a candidate canonical shape alongside the fixed-point catalog
([`shapes/`](../shapes/)); to formalize with the math team (append-only commutative monoid / G-Set fold).

## MANY ledgers, each single-scoped (Aaron 2026-06-10)

> Aaron: "we need a ledger shape but we don't just have one — we have multiple and they are single
> scoped. A ledger for money does not also carry pictures, and one for text does not carry pictures, etc."

**A ledger holds exactly one scope.** The money ledger carries money; the text ledger carries text; the
picture ledger carries pictures; the uncertainty ledger carries ΔU. **No ledger mixes scopes.** This is
the never-one + discriminator principle ([`boards/`](../boards/)) and **DV2.0** (partition substrate by
kind/change-rate) applied to ledgers:

| ledger (scope) | carries | written by |
|---|---|---|
| `uncertainty` | ΔU (uncertainty reductions) | every `mea` (the demon's primary book) — see [`uncertainty/`](../uncertainty/) |
| `money` | value / payments / the bug→reward economy | `measure` of economic value |
| `text` | text entries | text-scoped runs |
| `pictures` | images | image-scoped runs |
| … | one scope each | its scoped demon |

Why single-scope: a typed, single-scope ledger is **byte-lockable, schema-clean, and independently
replayable** — mixing scopes (money + pictures in one book) breaks the type, bloats the proof lineage,
and entangles change-rates. Pick the ledger by its scope/discriminator; never assume one.

*(Peel: the ledger shape + single-scope rule are the doctrine; the only built instance today is the
uncertainty ledger (`uncertainty/` + the finalizer ΔU). The money/text/picture ledgers are scopes to
stand up as needed. "Ledger shape as a canonical shape" routes to the math team — Soraya/Sova.)*

## Pointers

- [`uncertainty/`](../uncertainty/) — the uncertainty ledger (the demon's primary book; ΔU).
- `src/Core/Finalizer*.fs` — the demon/tick that posts ΔU · [`sims/`](../sims/) + [`clis/`](../clis/)
  (`mea` posts; `sim` posts nothing).
- [`shapes/`](../shapes/) — the fixed-point shape catalog (the ledger shape is a sibling, to formalize).
- [`boards/`](../boards/) — never-one / discriminator · `dv2-data-split-discipline` (partition by scope).
- `docs/research/2026-06-10-tests-become-cells-with-strict-boundaries-*` — room = physics-accounting demon.
