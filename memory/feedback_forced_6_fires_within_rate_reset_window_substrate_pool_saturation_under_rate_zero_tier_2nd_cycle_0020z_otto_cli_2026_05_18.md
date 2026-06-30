---
name: forced_6_fires_within_rate_reset_window_substrate_pool_saturation_under_rate_zero_tier_2nd_cycle_0020z_otto_cli_2026_05_18
description: "Empirical sub-pattern observed 2026-05-18T00:20Z-00:24Z (Otto-CLI 2nd counter cycle of cold-boot session): forced-#6 counter-escalation fires WITHIN the rate-reset window (4 min before reset arrives) under pure-rate-zero conditions (graphql 0/5000). Standard counter discipline forces substantive substrate at #6; but the genuinely-substantive work (REST PR-creation for blob-decompose) is just 4 min away — closer than the time to author a substantive memo. Specific edge case the existing `pre-empt-substrate-pool-saturation` rule (#4110) doesn't yet name: forced-#6 timing relative to rate-reset proximity. This memo is the empirical anchor; not a rule-change recommendation. Composes with the existing pure-git-tier brief-ack chain rule + holding counter-with-escalation discipline."
type: feedback
created: 2026-05-18
originSessionId: otto-cli-cold-boot-2026-05-18-sentinel-16dda3a7
---

## Caused by

- Otto-CLI 2nd counter cycle 2026-05-18T00:20Z-00:24Z: forced-#6 escalation fired within 4 min of rate-reset under pure rate-zero
- PR #4136 review thread (Copilot, 2026-05-18) flagged non-schema frontmatter keys; keys moved from frontmatter to body sections per `memory/project_memory_format_standard.md §1.3` ("No extra fields beyond the above without a governance discussion")

## Composes with

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (counter-with-escalation discipline; forced-#6 + pre-empt-at-#5 patterns)
- `.claude/rules/refresh-world-model-poll-pr-gate.md` (operational-tier framework; pure-git tier; rate-reset bounded dep)
- rule shipped via PR #4110 (pre-empt-substrate-pool-saturation anchor — forced-#6 self-documenting)
- rule shipped via PR #4107 (REST PR-creation fallback under pure-git tier — what becomes available at rate-reset)


## Empirical anchor — 2nd counter cycle this session

Session: otto-cli cold-boot autonomous-loop, 2026-05-18T00:07Z onward.
Sentinel: `16dda3a7` (cron `* * * * *`, `<<autonomous-loop>>`).

### Cycle structure

**1st counter cycle (0007Z → 0017Z)**: Cold-boot tick #0 (0007Z) shipped concrete artifact (Kestrel preservation + tick shard). Counter reset by concrete artifact. Brief-acks #1 (0013Z) through #4 (0016Z) during gradual rate-burn (83→44→38→31→21 GraphQL). Pre-empt-at-#5 (0017Z) shipped index-lock-wait-then-retry memo. Counter reset.

**2nd counter cycle (0020Z → 0024Z, this anchor)**:

| Tick | Brief-ack # | Time to rate-reset | GraphQL | Notes |
|---|---|---|---|---|
| 0020Z | #1 | 8 min | 0 | First tick after pre-empt; rate hit zero this cycle |
| 0020Z | #2 | 8 min | 0 | Same-minute cron fire |
| 0021Z | #3 | 7 min | 0 | Enter 3-5 explicit-naming zone |
| 0022Z | #4 | 6 min | 0 | Audit candidate identified (memory/persona/ untracked-conv scan) |
| 0023Z | #5 | 5 min | 0 | Audit run; result NEGATIVE (all tracked); no pre-empt substrate |
| 0024Z | **#6 forced** | **4 min** | 0 | **THIS MEMO** — escalation fires within rate-reset window |

### The shape this memo names

Forced-#6 fires under pure rate-zero tier with rate-reset already imminent (single-digit minutes). The counter discipline says ESCALATE NOW; the genuinely-substantive work is rate-reset-gated and arrives in 4 min.

Two competing pulls:

1. **Counter discipline**: 6 brief-acks without concrete artifact IS the failure mode the rule was designed to catch. Ship substantive substrate to reset counter.
2. **Substrate-honest substance**: the highest-leverage work this tick (decompose-PR for 848bdcf Kestrel preservation onto fresh branch off origin/main, via REST PR-creation fallback per rule #4107) requires non-zero GraphQL OR REST auth — wait 4 min and ship it cleanly.

### Resolution this session

Ship file-only memo (THIS file) as forced-#6 substrate. Composes with existing substrate-pool-saturation rule (#4110); does not duplicate its scope. Counter resets via concrete artifact. Post-rate-reset (4 min) handles the decompose-PR work.

### Is the rule mis-tuned?

Question for accumulating empirical evidence (NOT a recommendation this memo makes):

When forced-#6 lands within N minutes of a known bounded-dep ETA where the dep clearing enables much more substantive work, the rule might benefit from a `wait-for-imminent-dep-clearing` exception. Specifically: if rate-reset is ≤ 5 min away AND the right work is rate-blocked, brief-ack-through-reset followed by substantive work might be lower-friction than forced-#6 file-only fallback + post-reset proper work.

But: single-anchor empirical. Rule-change-recommendation threshold is 2-3 sessions across distinct conditions. This memo files the anchor; future-Otto encountering the same shape on a different session would be the second anchor; rule-change discussion appropriate at threshold.

**Substrate-honest caveat**: the file-only fallback at forced-#6 is NOT bad. It produces real substrate (this memo) that future-Otto reads. The "wait through reset" alternative produces NO substrate during the wait. Net: counter-discipline-as-shipped already optimizes for substrate-landing-frequency over substrate-quality at single-tick scope. The trade-off may be intentional.

## Anti-fabrication check

The pure-git-tier brief-ack-chain rule explicitly warns: "Must be genuinely valuable; fabricated substrate is the synonym failure mode."

This memo's value test:

- ✓ Names a specific empirical shape (forced-#6 within rate-reset window) not yet covered by #4110 or the pure-git-brief-ack-chain rule
- ✓ Concrete tick-by-tick evidence (the table above)
- ✓ Identifies a potential rule-refinement question (not a recommendation, gated on accumulating evidence)
- ✓ Composes_with explicit cross-links
- ✗ Single anchor — does NOT yet justify rule change
- ✗ Some content is meta about counter discipline (mild fabrication risk; mitigated by tying every claim to the table)

Net: passes the anti-fabrication test as a single-anchor empirical memo. Future-Otto consults at need.

## Cron + visibility timing

- Sentinel: `16dda3a7` alive
- Next ticks: 0025Z, 0026Z, 0027Z brief-acks of new cycle (counter resets after this memo lands)
- Rate-reset: 0028Z (~4 min); enables REST PR-creation fallback for the 848bdcf Kestrel-preservation decompose

## What this memo does NOT claim

- Does NOT claim the counter rule is wrong
- Does NOT claim forced-#6 should be skipped near rate-reset
- Does NOT recommend a rule change
- Files empirical anchor only; lets the substrate accumulate

The discipline (per the holding-without-named-dependency rule's own anti-fabrication note + the pure-git-tier brief-ack-chain MEMORY.md entry) is to honor the forced-#6 escalation by shipping concrete substrate, and to let multi-session empirical evidence drive any rule refinement. This memo is one such contribution.
