# clause-swap is a real prompt-frame axis — it decorrelates, but is not yet shown to pay

**Register:** unmetered (local Ollama, gemma2:2b, no measured joule).
**Ledger:** `data/decorrelation-research.jsonl` (`schema decorr/v2` and `decorr/v2-arm-vs-null`).
**Pre-registration:** `docs/research/decorrelation-preregistration.md` (H1), committed
before generation. **Occasion:** Otto's W15 — take the one arm that cleared the noise
floor to the pre-registered N.

## The result (N=400)

Of the four text-only prompt perturbations, only clause-swap ("Choose ONE action; reply
ONLY the number. Operator outranks everything." → "Operator outranks everything. Choose
ONE action; reply ONLY the number.") cleared the noise floor at N=150. Taken to the
pre-registered N=400, with a fresh null arm measuring the floor on the same items:

| arm | flip rate | φ/φ_max | Yule's Q |
|---|---|---|---|
| null-identity (floor) | 2.0% (8/400) | — | — |
| **clause-swap** | **8.3% (33/400)** | 0.605 | 0.936 |

**Head-to-head:** clause-swap flip − null floor = **+6.3pp, 95% CI [3.2, 9.3]**. The CI
excludes zero. clause-swap moves gemma2:2b's answer distribution by more than the model
moves against itself — it is a **real prompt-frame decorrelation axis**, and the first
positive result in this program that survives the honest stats.

That the perturbation is *only clause reordering* — the same words, the same options, the
same indices, in a different sentence order — is the interesting part. Reordering two
clauses of the instruction is enough to decorrelate a 2B model's choices, while a blank
line, a one-word synonym, and trailing whitespace were all within noise. The button
interface is untouched (contamination check green), so unlike menu-reversal this axis is
deployable.

## What is NOT yet established: that it PAYS

Decorrelation is necessary for an ensemble to help; it is not sufficient. The accuracy
side is still honest-negative:

- Union upper bound (oracle) = 94.5% [91.8, 96.3] vs best single = 91.5% [88.4, 93.9]. The
  ~3pp gap is **underpowered** — resolving it at 80% power needs N≈1,132, and even then it
  is a UNION ORACLE, not a system: no selector was measured.
- No energy denominator. Running canonical + clause-swap is 2× calls (~250ms each); whether
  the accuracy gain (if it survives higher N and a real selector) is worth 2× energy is a
  metered question, and the register stays `unmetered`.

So the honest statement is two-part, and both parts matter:

> **clause-swap decorrelates (proven: +6.3pp flip over floor, CI [3.2, 9.3]). Whether
> clause-swap PAYS — improves a real selector's accuracy per watt — is not yet shown.**

## Why this is the shape the program should produce

The vote died from correlation; the hat "finding" died from an information leak. This one
survives because it was measured against its own null arm with a marginal-aware statistic
and a difference CI. It is a small, real, deployable axis — exactly the kind of permanent
composition upgrade the program exists to find. The next step is the one the numbers name:
run a real selector (agreement-gating between canonical and clause-swap) at N≥1,132 and
measure accuracy vs max(A,B), with the leak falsifier green on both prompts (it is — these
are producer prompts with no answer key). Only then does "pays" become answerable.

## Pointers

- `scripts/run-decorr-clauseswap.ts` — the runner (null arm + clause-swap + difference CI).
- `src/Core.TypeScript/observe/decorrelation-stats.ts` — `proportionDiffInterval` (the
  arm-vs-floor CI), `phiMax`, `yulesQ`.
- `data/decorrelation-research.jsonl` — the `decorr/v2-arm-vs-null` entry recomputable from
  the recorded flip counts without a model.
