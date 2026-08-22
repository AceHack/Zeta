# competence-outcomes/ — the competence ledger (one scope: who claimed what, and what use did)

**Register: `unmetered`. This store is EMPTY, and an empty store is not evidence about anyone.**

A single-scoped ledger (`db/ledgers/README.md` — *"A ledger holds exactly one scope"*) carrying the
event source for per-(agent, hat, jurisdiction) competence. It is **not** the uncertainty ledger:
that one carries ΔU and is commutative, while the estimator this feeds (ADF/TrueSkill) is
**order-dependent**, so this store defines a canonical fold order and cannot claim order-freedom.

## Shape

```
edges/<recorder>.jsonl      typed, signed treatment edges  (who claimed what about a subject)
outcomes/<recorder>.jsonl   facts about subjects           (what use did — no agent, no blame)
```

Append-only JSONL, one file per recorder so concurrent writers never contend, content-addressed and
deduplicated on read (apply-N-times == apply-once). Same pattern as `db/mutation-findings/`.
Timestamps are the timestamp **of the fact**, never a recording wall clock.

## The two invariants this store exists to keep

1. **No folded series admits review-derived evidence** — "upheld" is never defined by the board
   that aggregates.
2. **The labeler must not be the agent the label updates** — a judgment is fine; self-certification
   is not.

## Pointers

- `src/Core.TypeScript/planning/competence-attribution.ts` — the schema, the invariants, the query.
- `src/Core.TypeScript/planning/competence-report-layers.ts` — report → label → determination.
- `docs/research/2026-08-16-competence-is-measured-by-use-a-typed-treatment-graph-feeding-the-traveler-rank-ledger.md`
  — the design, the independence argument, and why this cannot be honestly populated yet.
- `src/Core/TravelerRankLedger.fs` + `src/Core.TypeScript/planning/traveler-rank-ledger.ts` — the
  estimator this feeds. Nothing here is wired into any aggregation.
