---
id: 081M0TP4ZNQ087G0R001F1HKTB
type: bug
state: backlog
priority: P2
slug: the-local-llm-chooser-is-not-a-function-same-model-same-seed
title: "the local-LLM chooser is not a function — same model, same seed, same prompts, different answer"
created: 2026-08-24T20:07:22.551Z
depends_on: []
composes_with: []
---

# the local-LLM chooser is not a function — same model, same seed, same prompts, different answer

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0TP4ZNQ087G0R001F1HKTB-*.md` glob. -->

## The measurement

From the production-roster ρ run (PR #14932). Same model, same seed, same
prompts, two invocations:

> **199/200 items identical; one item flipped `'1'` → `'0'`.**

That is a **0.5% divergence rate on an otherwise byte-identical replay.**

## Why it matters

**Manifesto §7 (Deterministic Simulation Testing)** and the N-oracle byte-lock
both rest on the same assumption: **the thing being replayed is a function.**
Same inputs, same outputs, every time. A chooser that returns a different answer
to identical inputs is not a function, so:

- **DST replay of any path through the local-LLM chooser does not hold.** A
  replay that diverges is indistinguishable from a replay that found a bug.
- **A byte-lock over that path cannot be earned.** The golden vector would be
  one sample from a distribution, and a mismatch would carry no information.

## Honest scope — what this does NOT say

**This is not a general falsification of DST in this repo.** Pure code paths
remain deterministic and their DST claims are unaffected. The failure is
confined to `localLlmParticipant` (`observe/run-loop-real.ts` →
`resolveParticipant`), where the "function" is an external model invocation.

Nor is it surprising in hindsight: sampling temperature, non-associative float
reduction across batches, and GPU kernel non-determinism are all known sources.
**What is new is that it was measured here, on this path, at this rate** — and
that nothing in the repo previously distinguished "the chooser is a function"
from "the chooser has never been observed to disagree with itself."

## The fix direction — record, do not re-invoke

The architecture already has the right answer and it is not "make the LLM
deterministic" (which is not achievable from outside the model).

**§13 noninterference:** entropy enters ONLY through declared, metered channels,
and every crossing is metered at the membrane and posted to the ledger. **An LLM
chooser IS an entropy source.** It should therefore be treated as a crossing —
its output **recorded at the membrane on first execution and replayed from the
record**, never re-invoked during replay.

That converts a non-function into a recorded input, which is exactly what makes
DST survive real network IO elsewhere in this substrate. The chooser stops being
something DST must reproduce and becomes something DST reads.

## Falsifier

Invoke the chooser twice under identical (model, seed, prompt) and assert
byte-identical output over N items. **It must fail today** — if it passes, the
divergence was not reproduced and this row is unsubstantiated rather than fixed.
Then implement record/replay and assert the replay leg is byte-identical by
construction.

Note the falsifier is **probabilistic at n=200 (~0.5%)**; a single 200-item
comparison can pass by luck. State n and the observed rate, do not treat one
clean run as a refutation.

## Provenance

Measured by the ρ-production-roster run (work-item
`081M0TJY389087G0R000TTF41C`, PR #14932) as a finding it was not looking for.
Filed separately because it is unrelated to fleet pricing, contradicts a
manifesto spec, and would otherwise survive only in a merged PR body.
