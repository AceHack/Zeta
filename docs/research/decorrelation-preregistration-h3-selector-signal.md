# Pre-registration — H3: is the 4.0pp headroom ADDRESSABLE by an observable signal

**Committed BEFORE generation.** H2 established: clause-swap decorrelates, but
agreement-gating captures 0.0pp of the oracle's 4.0pp headroom (union 94.3% vs best-single
90.3%; the 24 items clause-swap uniquely gets right are the prize). H3 asks the sharper,
better-posed question Otto named: **does any observable, non-oracle signal identify those
24 items** — i.e. can a real selector reach into the headroom at all?

## The honest prior, stated up front

If clause-swap is uniformly weaker (its 24 unique wins are essentially RANDOM — noise that
happened to land right), then **no signal exists**, the 4.0pp ceiling is provably
unreachable, and the correct finding is **"the headroom exists but is not addressable."**
That is a STRONGER, more closing result than "gating didn't work" — it retires the axis
rather than leaving it ambiguous. H3 is designed to be able to conclude exactly that.

## Hypothesis

**H3:** on the 64 discordant items, at least one inference-time-observable signal separates
the "clause-swap right, canonical wrong" cases (c=24) from the "canonical right, clause-swap
wrong" cases (b=40) well enough that a selector using ONLY that signal (never ground truth)
beats best-single (90.3%) with a CI excluding zero.

## Signals to test (pre-declared; inference-time observable, no ground truth)

1. **Token confidence (logprob):** the model's own probability on the chosen number token.
   Route to whichever config was more confident. Requires re-querying with `logprobs`.
2. **Self-consistency across resamples:** run each config K=5 times at temperature 0.7;
   the config with the more stable modal answer wins. Requires K resamples per config.
3. **Response-length / hedging:** already partially observable; a longer or hedged answer
   as a low-confidence proxy. Weakest signal; tested only if 1–2 fail.

**Primary signal: token confidence** (cheapest decisive test). Self-consistency is the
fallback. All three are scored the same way: a confidence-gated selector's accuracy vs
best-single, McNemar-paired against the canonical-only baseline, 95% CI.

## FALSIFIER (pre-declared) — what concludes "not addressable"

H3 is REJECTED (headroom declared unaddressable, axis closed) if, for every pre-declared
signal:

- the signal's value distribution on the c=24 (clause-wins) is statistically
  indistinguishable from its distribution on the b=40 (canonical-wins) — Mann–Whitney U at
  α=0.05 fails to reject — AND
- a selector gated on that signal does not beat best-single (CI includes/below 0).

Confirmation requires: some signal separates c from b (U rejects) AND a selector on it
beats best-single (CI excludes 0).

## N and power

The discriminating test is on the 64 discordant items (24 vs 40) — small, so only a LARGE
separation is detectable. Mann–Whitney at n1=24, n2=40 has ~80% power for a rank-biserial
correlation around 0.4 (a large effect). Stated consequence: a SMALL signal will read as
"not detected at this N," reported as underpowered, NOT as "no signal." To make the
selector-accuracy endpoint resolvable, the confidence signal is measured on the FULL 600
(not just the discordant 64), so the selector is scored on all items.

## Register

`unmetered`. Confidence gating is 2× calls (both configs) plus the logprob read (free with
the same call); self-consistency is 2×K calls (expensive — only if confidence fails).

## Leak falsifier

Both configs are producer prompts; `detectAnswerLeak` green on both instruction regions
(canonical, clause-swap). Reported per-arm.

## Headline discipline (Otto's standing note)

clause-swap DECORRELATES (proven). H3 tests whether it can PAY via a signal. Either
outcome — "a signal reaches the headroom" or "the headroom is unaddressable" — is
publishable; neither promotes the axis past what is measured.

## H3 outcome (recorded after the run at N=600)

**H3 CONFIRMED — the headroom is ADDRESSABLE by token confidence.** The confidence gap
perfectly separated the discordant groups (Mann–Whitney z=6.04, rank-biserial=1.000,
rejects — checked against W13 and found real, not degenerate: not a constant bias, gaps
bounded away from zero, though N=51 discordant is small). The confidence-gated selector hit
93.8% [91.6, 95.5] vs best-single 90.7% — **+3.2pp, McNemar CI [1.8, 4.6], resolved**,
capturing ~3.1 of the 3.6pp oracle headroom. The honest prior ("the 24 wins may be random")
was refuted: the model knows when its weaker framing is right. Full write-up:
`docs/research/2026-08-27-the-headroom-is-addressable-token-confidence-gating-pays.md`.
Next question is metered (accuracy-per-runner-second), not accuracy.

## Pointers

- `data/decorr-agreement-gating-raw.jsonl` — the 64 discordant items are already labeled;
  the structural "are the 24 random?" question can be examined here directly.
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `mcNemar`, `mannWhitneyU`.
- `docs/research/2026-08-26-clause-swap-decorrelates-but-does-not-pay.md` — H2, the 0.0pp lift.
