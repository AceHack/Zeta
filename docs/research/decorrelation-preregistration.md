# Decorrelation research — pre-registration

**Committed BEFORE any generation it governs.** This file exists so a result cannot be
reverse-fit to a hypothesis. Per Otto's W7: pre-register hypothesis, stop-rule,
threshold, and refutation, commit the file first, then generate. An entry in
`data/decorrelation-research.jsonl` that cites a `preRegistrationSha` predating its
`measuredAt` is honest; one without is unregistered and must be read as exploratory
only.

## Why this program exists

Each axis that PROVABLY decorrelates is a permanent upgrade to the society's
intelligence-per-watt — without changing any model, just by composing existing models
differently. The ceiling is not model capability; it is composition. The research is
unbounded because the set of decorrelating axes is open (hat, model family, memory
load, quantization, seed, temperature, persona, prompt frame, and more not yet found).

The anti-sybil privacy boundaries are not incidental to this — they ENFORCE
decorrelation structurally. Personas cannot see each other's frosted/private state, so
two personas reasoning about the same question genuinely cannot copy each other. That
is engineered independence, not hoped-for independence, and it is the direct answer to
the ρ ≈ 0.479 that killed the naive vote.

## The standing corrections (from the review that reset this program)

1. **Read φ/φ_max, never raw φ.** φ has a marginal-bound ceiling. φ=0.112 at φ_max=0.344
   is 32% of the reachable association, not "nearly independent." Report φ, φ_max,
   φ/φ_max, plus a marginal-free measure (Yule's Q and κ).
2. **The union is an ORACLE, not a system.** "A or B correct" assumes a perfect
   selector. Report it as `unionUpperBound`. A real selector lands below it and may land
   below max(A,B); report that honestly.
3. **No `gain` until energy is measured.** Dividing by a hardcoded 2× is latency wearing
   energy units. The joule denominator must come from real latency/power.
4. **Every accuracy carries a 95% CI.** 100% on N=3 is not 100%.
5. **Power first.** Compute the N needed to resolve the effect before believing a gap.
   N=100 cannot resolve a 2-item difference (needs ~9,800 per arm near p=0.5).
6. **Every ledger entry carries a NULL ARM.** An axis that does not beat an edit built to
   change nothing is not an axis.
7. **Menu shuffling is ruled out as a candidate.** Stable slot positions are the
   universal-controller interface (learnable buttons). Reversed/permuted menus are a
   REFERENCE CEILING only. Candidates must preserve option ordering and indices.

## Pre-registered hypothesis (current)

**H1 (prompt-frame, text-only arms):** Perturbing only the instruction text (blank line,
one-token synonym, clause-swap, trailing whitespace) — while leaving option ordering and
indices byte-identical — produces φ/φ_max ≤ 0.1 and Yule's Q ≤ 0.1 against the canonical
prompt on `gemma2:2b`. In plain terms: text-only perturbations do NOT decorrelate.

- **Refutation:** any candidate arm with φ/φ_max > 0.1 AND a union-vs-best gap whose 95%
  CI excludes 0 at the pre-registered N refutes H1 for that arm (it DOES decorrelate).
- **Null arm:** `null-identity` (instruction unchanged). It must show φ/φ_max ≈ 0 and
  perfect agreement. If it does not, the harness is nondeterministic and the whole run
  is void.
- **Threshold:** φ/φ_max = 0.1 and Yule's Q = 0.1.
- **Stop-rule:** N = 400 items per arm (resolves a ~10pp union-vs-best gap at 80% power;
  a smaller gap is declared unresolvable at this N rather than claimed).
- **Register:** `unmetered` (local Ollama, no measured joule). Promotes to `metered` only
  when the energy denominator is measured.

### H1 outcome (recorded after the run at N=150)

**H1 largely HELD.** The null arm measured a 2.7% intrinsic noise floor (temp=0/seed=42 is
NOT deterministic on gemma2:2b — 4/150 identical-prompt items flipped). Against that floor:
blank-line (1.3%), synonym (2.7%), and trailing-whitespace (1.3%) are all WITHIN NOISE —
they do not decorrelate. clause-swap (7.3%) EXCEEDS the floor but is UNDERPOWERED
(union-vs-best gap needs N≈1,861 to resolve), so it is a live hypothesis, not a result.
menu-reversed (reference ceiling, interface-breaking) flips 26% — the bound on how much
decorrelation is physically available. Full write-up:
`docs/research/2026-08-26-prompt-frame-is-mostly-noise-and-temp0-is-not-deterministic.md`.

### Hat/verifier axis — RETRACTED (W10 leak)

A first hat-axis result claimed verification bought abstention (100% self-catch on hard
items). Otto found the leak: the verifier prompt named the correct answer as a rule while
the producer got only a hint. W10 confirmed it — handing the producer the same rule raised
its accuracy 58.7% → 98.0% (+39.3pp). The asymmetry was informational, not cognitive. See
`docs/research/2026-08-26-verification-buys-abstention-not-accuracy.md` (RETRACTED). Two
guards now stand against a repeat: `detectAnswerLeak` (W12, refuses a verifier prompt that
carries the answer key) and `suspectExtremeRate` (W13, flags any 100%/0% as a defect
signal). A real produce/verify asymmetry must be shown at EQUAL information with the leak
falsifier green on both prompts.

## The ledger schema (`data/decorrelation-research.jsonl`, `schema: "decorr/v2"`)

Every entry carries: `n`, full `table` (a,b,c,d), `phi`, `phiMax`, `phiRatio`, `yulesQ`,
`kappa`, `accuracyA`/`accuracyB`/`unionUpperBound` (each with 95% CI), `bestSingle`,
`agreementRate`, `requiredN`, `meanMsA`/`meanMsB` (recorded, not energy), `verdict`,
`register`, `preRegistrationSha`, `nullArmVerdict`, `measuredAt`.

The v1 prompt-frame entry (φ=0.112 called "decorrelates-usefully") is superseded. Its
honest re-reading: φ/φ_max = 0.324, Yule's Q = 0.500 — the arm was CORRELATED, and the
2pp union gain is inside the noise floor (needs ~9,800 items to resolve, not 100). The
correction is recorded in the ledger with `schema: "decorr/v2"` and this file's sha.

## Anchors (Beacon)

- Condorcet (1785); Ladha (1992) correlated-voter degradation; Nitzan–Paroush (1982),
  Grofman–Owen–Feld (1983) optimal weights — see `src/Bayesian/CondorcetBoundary.fs`.
- Yule (1900) for Q; Cohen (1960) for κ; Wilson (1927) for the score interval.
- The marginal-dependence of φ (its ceiling φ_max) — Guilford; Cureton.
- `.claude/rules/numerology-vs-number-theory.md` — "too many correlations is a WARNING";
  a matching count is not an identification; register every claim.
