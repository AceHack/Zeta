---
id: 081M0QSQ3VH087G0R003WA2QC7
type: task
state: backlog
priority: P2
slug: design-the-1-z-set-error-model-errors-should-retract-the-pri
title: "Design the -1 z-set error model: errors should retract the prior that produced them, not merely report louder — but the Z-set analogy breaks at exactness and attribution, so the primitive is an ordinal witnessed observation against a NAMED prior"
created: 2026-08-23T17:11:59.089Z
depends_on: []
composes_with: []
---

# Design the -1 z-set error model: errors should retract the prior that produced them, not merely report louder — but the Z-set analogy breaks at exactness and attribution, so the primitive is an ordinal witnessed observation against a NAMED prior

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QSQ3VH087G0R003WA2QC7-*.md` glob. -->

**Register:** `toy` / proposed (`.claude/rules/toy-is-free-metered-must-be-earned.md`). Nothing
here is metered. **Do not build this inside a task-shaped script** — a half-built error framework
is worse than none.

## Origin (Aaron, 2026-08-22)

> *"…our interfaces and CLIs and commands and such that are tuned for AI and good teaching
> feedback that does not force **louder limit erasure** on errors, but instead gives teaching and
> **potential generator function updates in -1 zsets**."*

## The three parts, separated

1. **"louder limit erasure"** — the failure mode: an error flattened into a louder *"it failed"*.
   What is erased is *what the caller should now believe differently*, so the only remaining
   escalation is volume. Every bare `exit 1` with a message is this.
2. **"teaching"** — the error explains the model the caller had wrong. **Already demonstrated**
   on one real file: `tools/setup/op-token-setup.ts` renders `assumed` / `observed` /
   `believe now` / `next` on every refusal, with a falsifier proving no secret leaks into it.
3. **"generator function updates in -1 zsets"** — the open, novel half. This item.

## The claim to be designed

An error should emit a **retraction** against the prior that produced the wrong behaviour, so the
**generator** is corrected rather than the failure merely reported. Error handling becomes a
Z-set operation on the generating model, not a terminal state.

## The check that must come first (and its provisional answer)

`src/Core/ZSet.fs` already has retraction, and the config-topology fold already models
grant(+1)/revoke(−1). **A shared `-1` is not an identification**
(`.claude/rules/numerology-vs-number-theory.md`): the count matches, and matching counts identify
nothing. Provisional analysis in
`docs/research/2026-08-22-closing-over-the-os-is-the-point-of-bash-retirement-carbon-on-windows-and-linux-is-the-anchor.md` §4.1:

| Z-set retraction invariant | transfers? |
|---|---|
| names the **exact tuple** asserted | **no** — an error knows what failed, not which prior caused it; attribution is a causal claim on correlational evidence |
| `+1` then `-1` sums to **∅** | **no** — a partially-wrong prior retracted whole is over-correction |
| commutative with other operations | **plausibly yes**, if the `-1` is against a declared prior, not a wall-clock-ordered observation |
| idempotent under redelivery | **yes**, with an idempotency key |

**So the analogy breaks at exactness and attribution and holds at commutativity and
idempotency.** That finding is the value here; it says the design is **not** "errors emit `-1`
tuples into the generator's Z-set" but closer to **"an error emits an ordinal, witnessed
observation against an explicitly NAMED prior; only a declared prior may be retracted"** — which
is `Evidence.AssertedOnly` / `supportsClaim` (`src/Core/DerivationProtocol.fs`) plus the
ordinal-not-cardinal register the uncertainty ledger already uses (`db/uncertainty/README.md`).

## Acceptance

1. A written design that states which Z-set invariants it claims and which it disclaims.
2. A worked example on an existing failure path (the op-token-setup refusals are the candidate).
3. A falsifier: a test that fails if a retraction is emitted against a prior that was never
   declared — the vacuity guard for the whole idea.
4. Only then a `toy` → `unmetered`/`metered` promotion, with the evidence named.

## Related

- `081M00VNHB3087G0R001WHTKTH` — shell-deprecation umbrella (where the observation arose)
- `081M0QSM5RD087G0R000THMGGQ` — the op-token-setup conversion that demonstrates part 2
