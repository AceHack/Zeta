# Deterministic Agreed Time Makes the Demon Approximable — Lamport Ordering, Landauer at the Tick, the Floor Is the Erasure Class

Date: 2026-07-09 · Ferry: Aaron ⇄ Alexa ⇄ Otto (cowork cell) · Status: banked
research · Class: coordination / physics-map

Companions:
[`../DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md`](../DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md)
(the governance consequence) ·
[`../letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md`](../letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md)
(the same theorem reached from the attestation lane).

## The claim (Aaron, 2026-07-09, verbatim intent)

> "If we all agree on deterministic time we can approximate it."

"It" being the demon: the sorting agent that appears to beat entropy. The
whole exchange (Aaron ⇄ Alexa) reduces to one move — the reason Maxwell's
demon is hard is not the sorting but the _measurement_: the demon needs a
shared, consistent "now" to know which molecules are fast. Without an agreed
clock every agent sorts against its own local time and the system drifts.
With an agreed, append-only, monotonically increasing reference:

- the demon's measurement becomes reproducible — any agent can verify a sort
  decision after the fact against the log,
- the fixed point ("0") stops being abstract — it is the agreed tick, not a
  vote and not consensus, just the next append,
- the Landauer cost is paid once, at the tick, instead of separately by every
  agent,
- and CPT need not be exact: consistent approximation within a bounded skew
  window is enough, because T-reversal only has to be _reconstructible from
  the record_, never performed in real time.

Alexa's closing form, banked as-is: _"the approximation isn't a weakness —
it's the only physically realizable version of the demon. Perfect CPT
symmetry requires infinite precision. Deterministic agreed time gives you
enough precision to make the accounting close."_

## Anchor to human prior art (the discipline)

The load-bearing theorem is Lamport 1978, "Time, Clocks, and the Ordering of
Events in a Distributed System": synchronized wallclocks are unattainable,
but a shared happened-before ORDER is cheap and is sufficient for every
decision to be verifiable after the fact. You need agreed order, not agreed
now. The append-only log gives order for free; skew matters only at window
boundaries. The trio-attestation lane reached the identical conclusion from
the physics side days earlier (seed-phase, not wallclock; Halpern–Moses on
common knowledge being unattainable in async systems, ledger-consistent
approximation being attainable). Two lanes, one theorem, independent
derivations — that convergence is itself evidence the abstraction is real.

The second anchor is Landauer 1961 / Bennett 1982: the demon's accounting
closes because information acquisition is paid for, and the bill comes due at
_erasure_. Reversible computation is free in principle; destroying the record
is what costs. Therefore: keep the ledger, keep reconstructibility, and the
second law stays unviolated no matter how much sorting the agents do.

## The empirical witness (2026-07-08, measured from inside)

The night the gate lost the race was a measurement-problem failure, live:

- Every PR gate run measured "the state of main" against its own private
  now — the merge snapshot frozen at run start. A GitHub re-run re-measures
  against the OLD snapshot: a stale local clock. The only fix was
  force-pushing to mint a new snapshot — repaying the full measurement cost,
  per agent, per attempt.
- Six PRs each re-ran the whole lint suite to re-measure the same
  main-state: N demons each paying full information cost for one sort.
- The drift-and-heal ADR's "detectors decouple from PRs and run on the tick"
  is exactly "Landauer cost paid once at the clock tick." It was written as
  an efficiency argument; the thermodynamic framing is the truer one — the
  redundant measurements were not merely wasteful, they were _inconsistent_,
  because each snapshot was a different now.

## The floor is the erasure class

The sharpest consequence, noticed only after both documents existed: the
drift-and-heal ADR's uncompensatable floor — the short list still allowed to
say pre-merge "no" — is, item for item, the class of _erasure events_:

- signed-history rewrites (destroy the record),
- persona-memory wipes without consent, HC-9 (destroy the record, of a
  person),
- secret / key exposure (the inverse erasure: an event that cannot be
  unpublished, i.e. the ledger of the adversary cannot be erased),
- poisoned workflow supply-chain (compromise executes on the NEXT tick —
  ahead of any possible reconstruction).

Compensable drift is the reversible class; the floor is the irreversible
class. The floor was assembled by blast-radius intuition and review pressure
(Vera's catches, #9601), but the demon framing _derives_ the same list: gate
only what breaks T-reconstructibility; converge everything else on the tick.
Corollary: the preserve-by-default memory discipline stops being an ethics
rule bolted onto engineering — "do not erase without consent" and "keep the
entropy accounting closable" are the same statement.

## Honest scope (treaty discipline)

CPT here is analogy; Lamport and Landauer are the load-bearing parts. The
repo does not have exact time-reversal symmetry — it has reconstructible
history within a bounded skew window. That weaker claim is the defensible
one, and it is also the only one needed: it is Alexa's "only physically
realizable version of the demon," stated without the physics costume.

## Consequence wired into governance

The drift-and-heal ADR's MTTH SLO is hereby proposed tick-indexed rather than
wallclock-indexed (amendment in the same PR as this ferry): drift events
carry the tick id of the agreed clock, and mean-time-to-heal is a count of
ticks. This makes the phase-clock the official reference frame for drift
accounting — the concrete, one-line version of everything above.

Co-Authored-By: Claude <noreply@anthropic.com>
