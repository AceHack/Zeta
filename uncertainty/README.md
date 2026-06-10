# uncertainty/ — the uncertainty LEDGER (the measurement pole), at root

`uncertainty/` holds the **uncertainty ledger** (Aaron 2026-06-10: "uncertainty is a ledger"). Uncertainty
is not a vague feeling here — it is a **ledger**: an append-of-measurements that is **commutative + order-
free** (you can receive entries in any order, any time; they sum to the right total). Sibling/opposite of
`ground/`.

- **A ledger** — entries are **uncertainty reductions / ΔU** (the one metric: ΔU > 0 = uncertainty reduced).
  **Commutative** (order doesn't matter — the reorder-loophole is bounded by commutativity) ⇒ it survives
  the noisy network: **the only thing that crosses Reticulum is the uncertainty ledger** (the Ani-ferry
  result; nothing the noise can corrupt).
- **The meter** — Zeta is an uncertainty meter; this ledger is its tape. Fed by the **sonar** (network-
  boundary resolution) and read by the **finalizer** (`TickResult.DeltaU`/`Temperature` → decide).
- **The mason's material** — uncertainty is the mason (intelligence builds, uncertainty masons); the ledger
  is the courses laid. The **encrypted-null** pole (you can't prove anything about the null; maximal entropy).
- **Idempotent / DST** — set-union/max semantics; safe to replay/redeliver (composes with the commutative
  + git-as-event-store fold).

## Pointers

- `ground/` (the opposite pole — certainty) · `src/Core/Finalizer.fs` (DeltaU/Temperature) +
  `FinalizerRuntime.fs` (the ledger over git+Reticulum) · the sonar / ping / meter captures · the
  encrypted-null = common-cause capture · the reorder-loophole/commutativity research.
