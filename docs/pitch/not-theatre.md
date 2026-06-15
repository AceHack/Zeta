# "How do I know this factory isn't elaborate theatre?"

The skeptical architect's question. It is the right
question to ask. This page gives the four-point answer
and points at where each point is inspectable.

## The objection in full

A fifty-plus-persona AI factory producing a research-
grade retraction-native database looks, on its face,
like exactly the kind of elaborate scaffolding that
could be more-performance than substance. Rules cited
but unenforced; reviewers named but unused; alignment
claimed but unmeasured. Why would this one be different?

## Four points that answer it

### 1. The per-commit alignment lint is public and regenerable

Every commit in this repository is audited, after the
fact, by the `audit_commit.sh` script under
[`../../tools/alignment/`](../../tools/alignment/) against
the clauses in [`../ALIGNMENT.md`](../ALIGNMENT.md).
Signals are `HELD` / `IRRELEVANT` / `STRAINED` /
`VIOLATED` / `UNKNOWN`; the output lands in
[`../../tools/alignment/out/`](../../tools/alignment/out/)
and is committed to the repo. You do not have to trust
the maintainer's summary of the factory's behaviour —
you can re-run the audit on any commit range and see
per-clause signals yourself.

The audit is bash 3.2, no network, POSIX-only. It is
deliberately portable so an external reviewer can run it
on their own machine without installing toolchain.

**Inspection path:** `tools/alignment/audit_commit.sh main..HEAD`

### 2. `docs/ALIGNMENT.md` §Measurability explicitly forbids theatre

The alignment contract itself anticipates this
objection. It names "compliance theatre" as a failure
mode and lists negative examples — the patterns that a
factory *could* adopt if its goal were to look aligned
rather than to be aligned. The contract refuses them by
name.

A factory that wanted to perform alignment would not
include a list of patterns it refuses to adopt. This
one does.

**Inspection path:** [`../ALIGNMENT.md`](../ALIGNMENT.md)
§Measurability "negative examples".

### 3. The harsh-critic + spec-zealot findings show self-correction is live

Two reviewer personas — Kira (harsh-critic) and Viktor
(spec-zealot) — are dispatched with zero-empathy
charters. Their findings land in commit bodies, in
`docs/BUGS.md`, and in `docs/ROUND-HISTORY.md`. They
call P0 / P1 / P2 correctness problems on the
Architect's own work; the Architect accepts, declines,
or parks each finding with a written reason.

Self-correction is not an intention. It is a readable
record. A factory that wanted to *appear* self-correcting
would not commit the reviewer's complaints verbatim.
This one does — because the reviewer's job is to be
right, not to be diplomatic.

**Inspection path:** [`../ROUND-HISTORY.md`](../ROUND-HISTORY.md),
[`../BUGS.md`](../BUGS.md), and reviewer persona
notebooks under `memory/<persona>/`.

### 4. The human maintainer sits outside the agent loop

The load-bearing defence against factory self-delusion
is that a human maintainer reviews every round's
output, merges every PR, and holds veto power over every
Architect integration. The Architect is the
reviewer-gate for all agent-written code (GOVERNANCE.md
§11); the human is the reviewer-gate for the Architect.

This seat is fragile on purpose. If the factory ever
produces work the human maintainer cannot personally
read and understand, that's a failure mode — not a
feature — and the alignment contract's renegotiation
protocol is the response. The seat's fragility is
what makes it a defence rather than a rubber stamp.

**Inspection path:** [`../../GOVERNANCE.md`](../../GOVERNANCE.md)
§11, [`../CONFLICT-RESOLUTION.md`](../CONFLICT-RESOLUTION.md),
[`../ALIGNMENT.md`](../ALIGNMENT.md) §Renegotiation.

## What would change our mind

A fair skeptic asks the inverse: under what evidence
would we concede the "theatre" hypothesis? Four
concrete failure modes:

- **Audit signals decoupled from behaviour.** If
  `VIOLATED` signals routinely land in commits with no
  follow-up work, the alignment lint is decorative.
- **Reviewer findings never contested.** If every
  harsh-critic finding is accepted without pushback, the
  review is not load-bearing — either the code is
  implausibly good or the reviewer is rubber-stamping.
- **Round-history narrative diverges from git.** If
  `ROUND-HISTORY.md` claims deliverables the git tree
  does not show, the narrative is PR copy.
- **Human maintainer's role shrinks without
  renegotiation.** If the maintainer's review role
  narrows over time without an explicit
  `docs/ALIGNMENT.md` update, the load-bearing defence
  has been silently disabled.

Each of these is checkable in the repo. If any applies,
the "theatre" hypothesis deserves weight. Until then, the
substrate invites argument rather than deferral.

## What this page is NOT

- Not a proof that the factory is aligned. The
  alignment claim is a *measurable* property, not a
  declared one; this page argues that the *measurement*
  is not theatre, not that the measurement has already
  passed.
- Not a guarantee of future behaviour. The alignment
  contract explicitly allows renegotiation; the factory
  reserves the right to revise its own clauses with the
  maintainer's consent.
- Not a substitute for reading
  [`../ALIGNMENT.md`](../ALIGNMENT.md). If this page
  answers the objection at the pitch layer, the
  contract is the layer a serious reviewer reads
  before trusting it.

## Cross-references

- [`../ALIGNMENT.md`](../ALIGNMENT.md) — the contract.
- [`../research/alignment-observability.md`](../research/alignment-observability.md)
  — the measurement framework.
- [`../../tools/alignment/README.md`](../../tools/alignment/README.md)
  — the audit scripts.
- [`../../tools/alignment/out/`](../../tools/alignment/out/)
  — the observability stream.
- [`README.md`](README.md) — the elevator pitch that
  frames this argument.
- [`../../SUPPORT.md`](../../SUPPORT.md) — the
  maintainer-bandwidth bounds that govern expectation.
