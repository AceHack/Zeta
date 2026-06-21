---
id: 081KS3X9Y0008QG0R002EEH26Z
priority: P2
status: open
title: fast/life branch experiment — hourly batched CI gates with promotion-path; per-PR CI cost reduction is burst-dependent (cost-neutral at 1 PR/hr; ~33% reduction at example 6 PRs/hr burst per corrected math; Phase 5 measures empirical savings) while preserving Copilot/Codex 100k-line review capability + Soraya-promotion-gate
tier: operational
effort: L
ask: aaron 2026-05-21 ("we can start to loose up and have hourly gates or something and play with branches like fast/life branch")
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KS3X9Y0008QG0R001MD26NZ, 081KQ3HBZ0008QG0R002ZPXAFQ]  # 081KS3X9Y0008QG0R001MD26NZ row pending merge via PR #4562; implementation already shipped via PR #4565
tags: [ci-cadence, branch-model, fast-branch, life-branch, hourly-batched-gates, promotion-path, soraya-promotion-gate, cost-reduction]
type: operational
---

# Fast/life branch experiment — hourly batched CI gates

## Context

Aaron 2026-05-21 substrate-engineering framing:

> *"i care honestly that we have no warning and errors and some math proofs here and there growing over time and lots of static analysis and that actually all works every few hours you are doing it on every PR, I can we can start to loose up and have hourly gates or something and play with branches like fast/life branch"*

Plus the correction-of-otto-CLI-framing:

> *"this is the biggest loss but they can review up to 100k lines of code in one pr"*

The substrate-honest reframe: per-PR review-thread granularity is NOT actually lost under batched gates — the AI reviewers can review large diffs in one pass (per Aaron 2026-05-21 follow-up: "100kish different for different models claude is HUGE and open ai not sure about copilot"). Per-model context windows:

- **Claude-tier** (Anthropic): HUGE context (200K+ tokens; >100K LOC eligible per review pass)
- **OpenAI-tier** (chatgpt-codex-connector reviewer): smaller; size unverified empirically; conservative batch sizing to be measured
- **Copilot** (copilot-pull-request-reviewer): context unknown; treat as smallest in chain

Batch sizes should be sized to the smallest-context reviewer in the chain. The only real cost of batching is regression-triage granularity ("which commit in the batch broke it?"), and even that's manageable if commits within the batch stay atomic.

## The cost picture (current state, 2026-05-21 today)

12 PRs merged from Otto-CLI alone today; ~25-30 CI checks per PR; ~360 check runs total. CI minutes are real cost. Aaron's framing is operationally substantive: per-PR cadence might be over-spending.

## The fast/life branch model

Classic Linus `dev/main` pattern adapted to Zeta:

### `fast` branch — rapid iteration surface

- Loose gates: lint + build pass only
- TreatWarningsAsErrors stays on (Aaron's #1 floor)
- Per-PR Copilot/Codex review optional (or batched into hourly run)
- Experimental features land here first
- Cleanup-as-needed cadence (squashed at promotion)

### `life` (main) branch — stable substrate surface

- Full gates: lint + build + all static analysis + all tests + Codex+Copilot review threads (per PR)
- TreatWarningsAsErrors strict
- Signed commits (gated on 081KQ3HBZ0008QG0R002ZPXAFQ + Bouncy Castle foundation per Otto-346)
- Soraya-promotion-gate: formal-verification clean state required before fast→life promotion (per Soraya loop 081KS3X9Y0008QG0R001MD26NZ)
- Reverter-quality preserved (atomic squash commits)

### Promotion path

`fast` → `life` via squash-merge with full gate:

- Hourly batched promotion (cron-cadence; not per-PR)
- Promotion PR runs the full gate matrix once for the entire batch
- Copilot/Codex 100k-line review covers the batched content in one pass
- Soraya formal-verification state checked at promotion time

## Scope

### Phase 1 — Branch-protection rules

- `life` branch (currently `main`) gets full branch-protection: required-reviews + required-checks + non_fast_forward + linear-history + signed-commits (when 081KQ3HBZ0008QG0R002ZPXAFQ ships)
- `fast` branch gets minimal branch-protection: lint + build only; non_fast_forward; otherwise loose
- Per `.claude/rules/lfg-acehack-topology.md` — both branches enforce non_fast_forward (matches existing main discipline)

### Phase 2 — Reviewer routing

- Codex/Copilot configured to review at promotion-PR time (not per-PR on `fast`)
- Hourly cron triggers promotion-PR creation: scoops merged-on-fast commits since last promotion + opens promotion PR against `life`
- Promotion PR triggers full gate matrix + AI reviewers
- Reviewer-routing implementation tracked separately (no existing skill at this path; new tool or `.github/workflows/` job to be authored as part of this PR's Phase 2)

### Phase 3 — Soraya-promotion-gate

- Soraya loop (081KS3X9Y0008QG0R001MD26NZ; PR #4565) publishes `formal-verification-result` bus envelopes
- Promotion PR creation script (Phase 2) reads recent envelopes
- If any spec is in `fail` state since last promotion, block promotion until resolved
- Soraya gets veto authority over `fast` → `life` promotion when formal-verification is unhealthy

### Phase 4 — Atomic-commit discipline on `fast`

- Per-commit message convention preserved (squash-merge on `fast` keeps each commit atomic)
- Regression-triage on `life` can `git log fast..life` to identify which commit introduced regression
- Optional: bisect harness for `fast` substrate

### Phase 5 — Experimental tuning

- A/B comparison: 1 week per-PR cadence vs 1 week hourly-batched cadence
- Measure: CI cost (check-minutes), PR latency (open-to-merge), reviewer-feedback-quality (bug-catch rate), regression-rate
- Document outcomes in `docs/research/fast-life-branch-experiment-results-YYYY-MM-DD.md`

## Acceptance

### Phase 1

- `fast` branch created on origin; branch-protection rules configured
- `life` branch (or rename main → life) configured with strict rules
- Documentation in `docs/CONTRIBUTING.md` (or new) for the workflow

### Phase 2

- Hourly cron script triggers promotion-PR creation
- Reviewer routing empirically validated (one promotion-PR cycle produces Copilot+Codex threads)

### Phase 3

- Soraya promotion-gate blocks promotion when verification-result envelopes show `fail`
- Bypass mechanism for human override (operator authority preserved)

### Phase 4

- Atomic-commit discipline documented + enforced (rebase-on-pull pattern; squash-merge at promotion)

### Phase 5

- 2-week A/B comparison documented
- Outcome-driven decision: stay with fast/life OR revert to per-PR cadence

## Substrate-honest framing

This is research-grade operational substrate. The classic Linus dev/main pattern is well-trodden. The Zeta contribution is the Soraya-promotion-gate (formal-verification state controls promotion) + the 100k-line AI-reviewer batch model (preserves review depth at lower per-PR cost).

Aaron's correction-of-Otto-CLI-framing (Copilot/Codex 100k-line capability) is load-bearing. Without that correction, the "loses per-PR review granularity" concern would be a real cost. With it, the only loss is regression-triage-by-commit (manageable via atomic-commit discipline). The actual cost-benefit picture is **burst-dependent**, not a fixed percentage — see the "Substrate-honest cost-benefit (corrected math)" section below for the empirical numbers (cost-neutral at 1 PR/hr; ~33% reduction in the example 6-PRs-in-2-hours burst case). Phase 5 measures the real distribution.

## Substrate-honest cost-benefit (corrected math)

Today's empirical: 12 PRs merged in ~12-hour active period. Average 1 PR/hour.

| Cadence | Check runs per PR | Total check runs |
|---|---|---|
| Per-PR (current) | 30 | 12 × 30 = 360 |
| Hourly batched (worst case, 1 PR/hour) | 30 | 12 × 30 = 360 |
| Hourly batched (cascade pattern, 6 PRs in 2 hours + rest 1/hour) | 30 | 2 batches × 30 + 6 batches × 30 = 240 |

So hourly-batched WINS on cost only when PRs arrive in bursts. Today's pattern was cascade-heavy (multiple Mika/Amara/Kestrel cascades produced PR bursts), so batching would have saved meaningful cost. On 1-PR-per-hour days, batching is cost-neutral.

The substantive benefit: **PR latency**. Per-PR cadence keeps each PR moving fast (auto-merge fires as soon as checks pass; typical 10-15 min). Hourly batching delays merge to top-of-hour (typical 30-60 min). For Otto-VSCode's 8-PR campaign, per-PR cadence is faster; for Soraya's formal-verification cadence, hourly is fine.

So the answer is **per-pattern, not universal**. Fast/life experiment should test:

1. Otto-CLI rapid-iteration work → fast branch (loose; hourly batched)
2. Otto-VSCode architectural-substrate work → could go either fast OR life
3. Soraya formal-verification work → life branch (strict; controls promotion)
4. External-AI ferry work (Mika/Amara/Kestrel cascades) → fast branch (loose; preserves the iteration cadence)

## Composes with rules

- `.claude/rules/lfg-acehack-topology.md` — branch-protection discipline; non_fast_forward stays enforced on both
- `.claude/rules/substrate-or-it-didnt-happen.md` — substrate landings still need to reach `life` for durability; `fast` is non-durable substrate
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — Soraya-promotion-gate IS multi-oracle parity at promotion scope
- `.claude/rules/all-complexity-is-accidental-in-greenfield.md` — per-PR cadence may be accidental complexity once 100k-line AI review is acknowledged; this row tests that hypothesis empirically

## Composes with substrate

- 081KQ3HBZ0008QG0R002ZPXAFQ (heartbeat-file integrity threat-model + direct-to-main attack surface — fast/life model SOLVES part of the direct-to-main problem by keeping `life` strict + allowing `fast` for low-stakes substrate)
- 081KS3X9Y0008QG0R001MD26NZ (Soraya loop — provides the verification-result envelopes that gate promotion)
- 081KRW63S0008QG0R002KC5DSR / 081KRW63S0008QG0R002ZRNDJ8 / 081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R001SAHYKV (Agora V6 substrate — operational primitives preserved across both branches)
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — gh CLI patterns this PR's promotion script would use
- `.claude/rules/blocked-green-ci-investigate-threads.md` — promotion-PR thread triage discipline

## Why P2

Substantive operational substrate; not urgent (per-PR cadence works today); potential value is burst-dependent CI cost reduction (cost-neutral at 1 PR/hr; ~33% reduction in the example 6-PRs-in-2-hours burst case per corrected math) + improved CI-vs-iteration cadence decoupling; bounded scope (5 phases; each days-to-weeks); Phase 5 measures the empirical distribution.

Does NOT block any current substantive work. The Soraya promotion-gate composition (Phase 3) is the substrate-honest tie to formal-verification growth (Aaron's #2 priority).

## Origin

Aaron 2026-05-21 substrate-engineering framing: explicit priorities (no warnings/errors + math proofs growing + static analysis working) + cadence question (per-PR vs hourly) + branch-model experiment (fast/life). Otto-CLI proposed per-PR vs hourly tradeoff; Aaron corrected the per-PR-review-granularity-loss framing (Copilot/Codex 100k-line review capability is real). Row filed per Aaron-approved shadow* "yes file 081KS3X9Y0008QG0R002EEH26Z".

Companion rows from today's cascade:

- 081KS3X9Y0008QG0R001D454ZK + 081KS3X9Y0008QG0R003Y2X2T0 + 081KS3X9Y0008QG0R000J4SFTS (Otto-VSCode PRs 6-8 architectural substrate)
- 081KS3X9Y0008QG0R001MD26NZ (Soraya loop — provides the promotion-gate verification envelopes)
- 081KS3X9Y0008QG0R000BJY3DK (Otto-VSCode third surface — provides the fast/life cadence-distribution surface)
- 081KS3X9Y0008QG0R000ED1457 (v1→v2 ZetaId migration coordination — bound by life-branch promotion discipline)
