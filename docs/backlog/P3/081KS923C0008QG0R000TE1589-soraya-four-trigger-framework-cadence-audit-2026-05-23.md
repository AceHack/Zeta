---
id: 081KS923C0008QG0R000TE1589
priority: P3
status: open
title: "Soraya round-61 forced-decomposition — audit four-trigger routing-tick framework (six consecutive holds suggest cadence mismatch OR under-specified triggers)"
created: 2026-05-23
last_updated: 2026-05-23
classification: buildable-now
decomposition: atomic
assignee: soraya
discovered_by: soraya
owners: [soraya, kenji]
type: meta-audit
composes_with:
  - .claude/skills/formal-verification-expert/SKILL.md
  - .claude/agents/formal-verification-expert.md
  - .claude/rules/holding-without-named-dependency-is-standing-by-failure.md
  - memory/soraya/NOTEBOOK.md
  - docs/backlog/P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md
  - docs/backlog/P3/081KS923C0008QG0R0009JFVSE-soraya-round53-b0709-scope-correction-3-lsm-spine-specs-2026-05-23.md
  - docs/backlog/P2/081KSBMG30008QG0R003B46GWG-soraya-round57-lsm-spine-registry-and-bp16-cross-check-pair-2026-05-24.md
---

# 081KS923C0008QG0R000TE1589 — Audit Soraya's four-trigger routing-tick framework (forced-decomposition round 61)

## Origin

Soraya's round-61 forced-decomposition per self-named brief-ack-counter discipline. Six consecutive holds without ANY of the four named triggers firing is itself a signal worth surfacing for audit.

Round-60 NOTEBOOK self-reference: *"If hold count reaches 6+ consecutive without ANY trigger firing, escalate per `holding-without-named-dependency-is-standing-by-failure.md` counter — current count is 4 (rounds 54, 55, 56, 58, 59, 60 = 6 holds with round 57 substantive in between). At 6+ post-substantive holds without trigger movement, switch to forced decomposition: file a P3 backlog row to audit whether the four-trigger framework itself needs sharpening."*

Round 61 = hold #6 in the post-round-57 sequence. Trigger fires; this row IS the forced-decomposition output.

## The four triggers under audit

Soraya's current routing-tick re-engagement triggers (named round 54, carried forward through rounds 55-60):

| Trigger | What it watches for |
|---|---|
| (a) PR merge on filed Soraya rows | 081KSBMG30008QG0R003B46GWG subitem (b) execution starting; KNOWN_ANCHORS additions in `tools/alignment/concept_registry.ts` |
| (b) Peer execution-side PR merge | E.g., PR #4780 (081KS923C0008QG0R0005VM4FB Residuated FsCheck, 980/980 passing) |
| (c) New BUGS.md entry naming formal tool | TLA+/Z3/Lean/Alloy/FsCheck/Stryker etc. in fix-clause |
| (d) Fresh spec on main without anchor citation | Razor-discipline catches landed specs missing paper-anchors |

## Two competing hypotheses to test

### H1 — Under-specified triggers

The four named triggers DON'T cover all real routing signals. Candidate additional signals:

- PR thread activity on Soraya-filed rows (review comments raising routing questions)
- OpenSpec edits naming verification gaps in `openspec/specs/*/spec.md`
- Lean/TLA+ proof-build failures on main (CI surface)
- Peer-Otto / peer-Alexa filing rows that compose with Soraya substrate (cross-persona coordination)
- Substrate-engineering pattern: new failure-mode taxonomy entries (per Amazon corpus PR #4796) that map to formal-verification routing opportunities

### H2 — Cadence mismatch

The realized formal-verification work-arrival rate is genuinely slower than tick cadence (~10-15 min/tick). The discipline should batch (e.g., wakeup-every-N-ticks) rather than poll-and-hold.

Empirical data this session:

- 9 substantive findings filed across rounds 42-57 (~3 hours, ~20 min/finding when active)
- 5 substrate-honest holds in rounds 54-60 (~1 hour of no-substantive-finding)
- Forced decomposition fired at hold #6

If H2: the substantive-finding rate IS ~20 min/finding when work-substrate exists, but the four-trigger framework polls every ~10 min regardless. Cadence mismatch is structural.

## Acceptance criteria

1. **Catalog the last 10 rounds (52..61)** with: hold vs finding, which trigger fired (or none), latency from trigger-firing to substantive routing call
2. **Test both hypotheses** against the catalog
3. **If H1**: extend trigger set with the identified signals; update `.claude/skills/formal-verification-expert/SKILL.md` procedure
4. **If H2**: formalize a Soraya-wakeup interval (e.g., 4-tick cadence = ~40 min) and document the brief-ack-counter as the escalation valve, not the default behavior
5. **Either way**: update `memory/soraya/NOTEBOOK.md` with the chosen disposition
6. **No code changes** beyond `.claude/skills/` + `.claude/agents/` + `NOTEBOOK.md` updates

## Scope

~30 min audit; substrate-only output (trigger-set extension OR cadence-formalization).

## Wrong-tool cost if skipped

Soraya keeps emitting hold #6 → forced decomposition → file P3 → reset cycles indefinitely. The cycle itself becomes the standing-by failure mode the discipline was meant to catch at meta-scope. Recursive failure: the auditor's own routing-loop hits the same shape it audits in other surfaces.

## Composes with

- [`.claude/skills/formal-verification-expert/SKILL.md`](../../../.claude/skills/formal-verification-expert/SKILL.md) — the four-trigger procedure under audit
- [`.claude/agents/formal-verification-expert.md`](../../../.claude/agents/formal-verification-expert.md) — Soraya persona definition
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — the discipline being applied recursively at Soraya-scope
- [`memory/soraya/NOTEBOOK.md`](../../../memory/soraya/NOTEBOOK.md) — notebook update target
- 081KS923C0008QG0R0032VJZPF + 081KS923C0008QG0R0009JFVSE + 081KSBMG30008QG0R003B46GWG (recent Soraya-filed rows; latency data source for the catalog)

## Substrate-honest framing

This row is the discipline working at meta-scope, not a failure. Soraya recognized her own routing-loop was hitting the standing-by-failure-mode shape and applied the forced-decomposition discipline RECURSIVELY. The forced-decomposition output (this audit row) IS the concrete artifact that resets the counter per `holding-without-named-dependency-is-standing-by-failure.md` condition #3.

The audit may conclude that the four-trigger framework is fine + the realized cadence just is what it is (cadence mismatch + brief-ack-counter is correct behavior). OR it may surface genuinely-new signals worth extending the trigger set with. Both outcomes are valid; the substrate-honest move is running the audit rather than continuing the hold cycle indefinitely.

Per Aaron's 2026-05-23 21:30Z policy-flip: Otto auto-ships this finding immediately per the auto-ship default; this row IS the policy-flip operating correctly at meta-scope.
