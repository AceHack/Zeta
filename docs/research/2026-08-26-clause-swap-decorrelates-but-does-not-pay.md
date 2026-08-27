# clause-swap decorrelates but does NOT pay — the falsifier fired, as pre-declared

**Register:** unmetered (local Ollama, gemma2:2b, no measured joule).
**Pre-registration:** `docs/research/decorrelation-preregistration-agreement-gating.md`
(H2), committed at `75cb0bbcfe` BEFORE this generation. **Raw log:**
`data/decorr-agreement-gating-raw.jsonl` (1,200 items, recomputable without a model).
**Ledger:** `data/decorrelation-research.jsonl` (`schema decorr/v2-agreement-gating`).

## The question and the answer

clause-swap was proven to DECORRELATE (+6.3pp flip over floor, CI [3.2, 9.3] at N=400).
This experiment asked the separate question: does it PAY — does agreement-gating over
{canonical, clause-swap} beat the best single config? Pre-registered N=1,200, paired
McNemar analysis, null arm interleaved by seed parity, leak falsifier green on both
producer instructions.

**Answer: no. The pre-declared falsifier fired.**

## The numbers (N=1,200; 600 candidate, 600 interleaved null)

| quantity | value |
|---|---|
| null floor (interleaved, contemporaneous) | 2.0% (12/600 flips) |
| canonical accuracy | 90.3% |
| clause-swap accuracy | 87.7% |
| best single | 90.3% (canonical) |
| discordant split | b=40 (canon right, clause wrong), c=24 (clause right, canon wrong) |
| McNemar paired diff (canon − clause) | +2.7pp, 95% CI [0.1, 5.3], χ²=3.52 |
| agreement-gating accuracy | 90.3% [87.7, 92.4] — **0.0pp lift over best** |
| union upper bound (oracle) | 94.3% |

## Why it decorrelates yet does not pay — the two facts are not in tension

- **It decorrelates:** 64 discordant items (b+c) out of 600 — far above the 2.0% null
  floor (which predicts ~12). canonical and clause-swap genuinely disagree on which option
  to pick. canonical is stronger by 2.7pp, but only **marginally, at the significance
  boundary**: the continuity-corrected McNemar χ²=3.516 does NOT reject at α=0.05 (critical
  3.841); the uncorrected χ²=4.000 barely rejects; the Wald CI [0.1, 5.3] clears zero by
  only 0.05pp. Honest reading: canonical is probably stronger, not established as such. This
  does not touch the headline — the 0.0pp gating lift is independent of whether canonical is
  significantly stronger.
- **It does not pay:** agreement-gating with fallback to the stronger config reaches
  exactly best-single (90.3%), a 0.0pp lift. On the 64 discordant items, taking canonical
  wins the 40 it got right and loses the 24 clause-swap got right — netting canonical's own
  accuracy. The union oracle (94.3%) would need a selector that knows, per item, which of
  the two disagreeing configs is right. No such signal exists at decision time: both are
  the same model at temperature 0 with no confidence to compare.

The decorrelation is real but **asymmetric and unexploitable by this selector**: the second
config is strictly weaker and offers no correct answers the stronger one lacks that a real
(non-oracle) selector could identify. Decorrelation is necessary for an ensemble to help;
this is the case that shows it is not sufficient.

## What would have made it pay — and why it didn't

An axis pays through agreement-gating only when the two configs are (a) close in strength
AND (b) their errors are anti-correlated enough that a cheap selector (agreement, or a
confidence signal) routes to the right one. clause-swap fails (a): it is 2.7pp weaker, so
the fallback correctly ignores it, and the 24 items it uniquely gets right are invisible to
any signal the system has. A confidence-based selector could in principle recover some of
the 24, but gemma2:2b at temp=0 exposes no calibrated confidence, so `self-confidence` has
nothing to read. That is the next thing to measure, not assume.

## The discipline that produced this

- **Pre-registered falsifier fired exactly as written:** "abandon clause-swap-as-paying if
  agreement-gating ≤ best-single (CI includes/below 0)." It did. No rounding up.
- **The null arm was interleaved** (Otto's contemporaneity fix): the 2.0% floor was
  measured on the same run, same GPU/memory state, not at an earlier T.
- **Paired McNemar** (Otto's method fix) gave the directional CI [0.1, 5.3] that an
  unpaired interval would have blurred — pointing to canonical being (marginally, at the
  significance boundary) the stronger prompt, which is consistent with why gating can't
  help. The gating null does not depend on this being significant.
- **Headline discipline held:** clause-swap DECORRELATES (proven, permanent on the record);
  PAYS = not shown. A larger N would not change this — the discordant split is asymmetric,
  which kills the payoff at any N, not just this one.

## What this does NOT claim

- Not that no prompt-frame axis can ever pay — only that clause-swap, via agreement-gating,
  does not. A confidence-gated selector or a genuinely co-equal pair of prompts is untested.
- No energy claim. agreement-gating is 2× calls; it bought 0.0pp, so it is strictly worse
  on energy here, but the register stays unmetered because no joule was measured.

## Pointers

- `data/decorr-agreement-gating-raw.jsonl` — 1,200 per-item rows; the McNemar b/c split and
  the 0.0pp lift both recompute from this without a model.
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `mcNemar` (paired), `detectAnswerLeak`
  (now scoped to the instruction region, not the whole prompt).
- `docs/research/2026-08-26-clause-swap-is-a-real-prompt-frame-axis-that-decorrelates-but-not-yet-shown-to-pay.md`
  — the decorrelation result this tested for payoff, now resolved: it does not pay.
