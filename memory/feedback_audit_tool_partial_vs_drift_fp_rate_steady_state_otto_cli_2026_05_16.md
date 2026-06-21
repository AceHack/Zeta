---
name: "audit-backlog-status-drift — empirical FP rate + partial-vs-drift skew of remaining candidates"
description: "After shipping the substrate-drift-catch infrastructure + 4 quality slices (PRs #3758, #3783, #3788, #3790, #3809), the audit tool surfaces ~31 status:open candidates from main. Empirical finding from manual partial-vs-drift verification: the easy-mode drift catches (rows where the entire scope IS the file) were taken in the early-to-mid 2026-05-16 session (081KRHWGX0008QG0R002DPG02X, 081KRMEXM0008QG0R000T0A28T, 081KRMEXM0008QG0R000X1PPGC, 081KRMEXM0008QG0R000HHAG77, 081KR50HA0008QG0R001Q071YY, 081KR7JY10008QG0R0018VG28R, 081KR50HA0008QG0R00257PHRR, 081KRHWGX0008QG0R0029WA0HQ, 081KQGDBJ0008QG0R003H0G5YQ — 9 closed via 2 Otto surfaces). The remaining ~22 candidates skew partial: file path exists from prior work but acceptance bullets specifically scoped to the row remain unshipped. Peer Otto-Desktop independently tracking this as ~25% FP rate per their tick shard at PR #3826."
type: feedback
created: 2026-05-16
---

# Audit tool empirical FP rate — partial-vs-drift skew

## The empirical finding

After the substrate-drift-catch infrastructure reached operational closure (~tick 34 of the 2026-05-16 session), continued operational use of `tools/hygiene/audit-backlog-status-drift.ts` reveals a clear skew in the remaining candidate population:

| Cohort | Drift verdict | Action |
|---|---|---|
| Easy-mode rows (entire scope IS the file) | Genuine drift | Close-row PR (9 closed this session) |
| Multi-slice rows where prior slices shipped the file | Partial-vs-drift | Leave open; specific in-progress work remains |
| Rows where the file is referenced for an additive sub-task | Partial-vs-drift | Leave open |

## Empirical sample from this session (Otto-CLI):

| Verification | Row | Result |
|---|---|---|
| Tick 38 | 081KRFA460008QG0R001KC0VBH (standing-by detector) | partial (2/7 bullets unchecked: launchd integration + proactive claim assignment) |
| Tick 39 | 081KRHWGX0008QG0R0014D2T5E (b0448 slice 3 install.ts) | partial (file from prior slices; `readCloudSchedule` etc. unshipped) |
| Tick 40 | 081KRHWGX0008QG0R003WEP6E9 (b0448 slice 6 README 4-layer table) | partial (README from prior; 0 "4-layer" mentions; all 6 bullets unchecked) |
| Tick 45 | 081KRA5AR0008QG0R000C3P8KP (grok.ts persona flag) | partial (file from prior peer-call work; `--persona` flag has zero grep hits) |

**4/4 in Otto-CLI's late-session checks = partial (0% genuine drift).** Peer Otto-Desktop independently reports ~25% FP rate per PR #3826's tick shard (`081KQNJ500008QG0R003ZC6PK8 = FP-3 (2nd example); FP rate climbing to 25%`).

The numbers diverge because the populations differ — Otto-CLI's late-session sample hit harder multi-slice rows; peer Otto-Desktop sampled a different cohort that includes some genuine drift. **Combined empirical estimate: ~0-25% of audit-tool candidates are genuine drift; ~75-100% are partial-vs-drift requiring manual discriminator pass.** The wide range reflects the sample-size and cohort dependency; both bounds are below the audit tool's raw candidate count, so the discriminator is doing real load-bearing work either way.

## Why this pattern emerges

The audit tool's heuristic is **"all primary-artifact paths exist on disk"**. This is necessary but not sufficient:

- **Necessary**: a row whose file doesn't exist can't be drift (work hasn't shipped).
- **Not sufficient**: a row whose file exists may still have unshipped acceptance bullets (multi-slice work where prior slices contributed the file).

The partial-vs-drift discriminator from `.claude/rules/backlog-item-start-gate.md` step 0 — "walk the Acceptance bullets; only close if every one is delivered" — IS doing the real load-bearing work. The tool surfaces; the discriminator filters.

## Future-improvement candidate (not yet a row)

A small wrapper that automates the first pass of the discriminator:

**`tools/hygiene/triage-drift-candidates.ts`** — for each audit-tool candidate, parse its Acceptance section; count `[ ]` vs `[x]` checkboxes; classify:

- **All `[x]`**: high-confidence drift; queue for close-row PR
- **Some `[ ]`**: partial; leave open (most-likely-noise)
- **No checkboxes at all**: manual review needed (some rows don't use checkbox style)

This would reduce ~75% of the manual partial-vs-drift work to "skim the auto-classification." Not urgent — the manual discipline works — but worth filing as a follow-up if the empirical FP rate stays at ~25%+.

## Composes with

- [`memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md`](feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md) — the foundational discipline
- [`memory/feedback_substrate_drift_catch_full_session_arc_infrastructure_eats_itself_otto_cli_2026_05_16.md`](feedback_substrate_drift_catch_full_session_arc_infrastructure_eats_itself_otto_cli_2026_05_16.md) — the session-cap arc memory
- [`memory/feedback_audit_backlog_status_drift_second_false_positive_class_inline_composes_with_otto_cli_2026_05_16.md`](feedback_audit_backlog_status_drift_second_false_positive_class_inline_composes_with_otto_cli_2026_05_16.md) — earlier FP class catalog
- [`.claude/rules/backlog-item-start-gate.md`](../.claude/rules/backlog-item-start-gate.md) — the discriminator the audit tool depends on
- [081KRQ1AB0008QG0R000QYJFZE](../docs/backlog/P3/081KRQ1AB0008QG0R000QYJFZE-audit-backlog-status-drift-detection-2026-05-16.md) — audit-tool spec
- [081KRQ1AB0008QG0R003DYANMC](../docs/backlog/P3/081KRQ1AB0008QG0R003DYANMC-audit-backlog-status-drift-quality-improvements-2026-05-16.md) — 4 quality slices follow-up
- [`tools/hygiene/audit-backlog-status-drift.ts`](../tools/hygiene/audit-backlog-status-drift.ts) — the audit tool

## Origin tick

Tick 43 of the 2026-05-16 session. Filed when brief-ack count was about to hit threshold #3 — converted to substantive substrate work per the counter-with-escalation discipline. Empirical observations from ticks 38-40 (3 of my own partial-vs-drift verifications) + peer Otto-Desktop's PR #3826 (FP-3 example; 25% FP rate tracking).
