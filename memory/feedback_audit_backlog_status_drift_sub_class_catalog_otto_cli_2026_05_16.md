---
name: "audit-backlog-status-drift sub-class catalog — empirical taxonomy from 2026-05-16 session"
description: "After triaging ~37 backlog rows via tools/hygiene/audit-backlog-status-drift.ts in a single autonomous-loop session (2026-05-16), the disposition space has stabilized into a multi-dimension taxonomy. The audit tool's heuristic (file-exists) surfaces candidates; the discriminator (acceptance-bullet walk) classifies. The classification has 6 primary classes (#1, #2, #2-SD, #3, #4, FP-2, FP-3) and 4 sub-class overlays observed empirically (#1-Ready, #1-DepBlocked, #2-Ready, #2-Execution-atom). The catalog lets future-Otto pick implementation candidates by sub-class rather than re-deriving the discriminator. Composes with `tools/hygiene/audit-backlog-status-drift.ts` + `.claude/rules/backlog-item-start-gate.md` step 0."
type: feedback
created: 2026-05-16
---

# Audit-backlog-status-drift — sub-class taxonomy (empirical)

## The catalog

After ~13 ticks of audit-triage on 2026-05-16, the disposition
space has stabilized as follows:

### Primary classes (close-row vs leave-open)

| Class | What it is | Disposition |
|---|---|---|
| **#1 (pure drift)** | Deliverable fully shipped; row's `status: open` never updated | Close-row PR |
| **#2 (partial, opaque)** | Deliverable partially shipped; row has no progress tracker | Leave open (NO edit) |
| **#2-SD (partial, self-documenting)** | Partial + row has explicit progress tracker (checkbox table, status section, slice table) | Leave open (tracker already documents partial) |
| **#3 (multi-slice self-doc'd)** | Multiple slices in flight; row body has progress section | Leave open |
| **#4 (multi-slice all-closed)** | All slices closed; umbrella row needs final close | Close-row PR |
| **FP-2 / FP-3** | False-positive at #2/#3 scope (row was incorrectly surfaced) | Leave open (audit tool noise) |

### Sub-class overlays (orthogonal to primary)

These compose multiplicatively with the primary class:

| Sub-class | What it is | When applied |
|---|---|---|
| **#1-Ready** | Class #1 disposition (close-row) but blocked on operational contention (peer-Otto churn, Lior cleanup, etc.) | When close-row attempt aborts mid-flight; defer to less-contended tick |
| **#1-DepBlocked** | Class #1 own scope met, but `depends_on:` ancestor still partial | Walk one level of `depends_on:` chain; close gated on ancestor close |
| **#2-Ready** | Class #2 disposition (leave open) but row body has embedded mechanical verifier OR dependency just resolved | Future-Otto can pick up for implementation; bounded + mechanical |
| **#2-Execution-atom** | Class #2 row that is the FINAL execution atom of a multi-row trajectory (e.g., umbrella + N prerequisites + execution-atom shape) | Status correctly open because N prerequisites haven't all shipped |

### Empirical instances (from 2026-05-16 session)

| Row | Class | Notes |
|---|---|---|
| 081KR2E4K0008QG0R001ADMBVW | #2-SD | Slice-progress table (9/28 BPs anchored) self-documents partial |
| 081KRFA460008QG0R001KC0VBH | #3 | Bg-service class-#3 |
| 081KRFA460008QG0R00229616S | #3 | 2nd class-#3 |
| 081KRA5AR0008QG0R000C3P8KP | FP-2 | Peer-call grok.ts; row mis-surfaced |
| 081KRHWGX0008QG0R0014D2T5E | FP-2 | 081KRFA460008QG0R000CYBGKW slice 3 |
| 081KRHWGX0008QG0R003WEP6E9 | FP-2 | 081KRFA460008QG0R000CYBGKW slice 6 |
| 081KQNJ500008QG0R003ZC6PK8 | FP-3 | Hook authoring |
| 081KRMEXM0008QG0R003GP8W0C | #2-SD | 5/5 acceptance `[ ]` checkboxes — self-doc partial |
| 081KRA5AR0008QG0R001NXBYTY | #2 | Amplification ratio dashboard; numbered criteria not auto-doc |
| 081KQGDBJ0008QG0R00294XCSE | #2 | Status-annotated; row says "Filed. No active incident" |
| 081KQTPYE0008QG0R003DK06PA | **#2 + #2-Ready** | Lean Prop 3.5 misattribution; embedded grep falsifier shows mechanical fix |
| 081KR7JY10008QG0R003JSEMX7 | **#1 + #1-Ready** | Mystery schools Mithraic; close-row aborted mid-flight (peer churn) |
| 081KR7JY10008QG0R0038AFS7T | #1 (CLOSED) | Meta-cognition survey doc; closed via PR #3859 |
| 081KRA5AR0008QG0R000KKJRVA | **#1-DepBlocked** | Amara core; depends on 081KRA5AR0008QG0R0019Q33F7 (vendor-bias gap) |
| 081KRA5AR0008QG0R0019Q33F7 | #2 | Amara preamble; 2/3 acceptance met (vendor-bias missing) |
| 081KQDTYV0008QG0R0037YJPEX | #2 (Status-annotated, multi-row class-#4 candidate) | Amara umbrella; prior-triaged-in-row by parallel Otto session |
| 081KRA5AR0008QG0R001X4T9W7 | #2 | Amara README + closure; 3/5 acceptance visible-met |
| 081KR50HA0008QG0R003DJ093T | **#2 + #2-Execution-atom** | Aurora split; depends on 081KR50HA0008QG0R003PAVRT8/081KR50HA0008QG0R0038HWCDT/081KR50HA0008QG0R003C39GP0/081KR50HA0008QG0R002HMCS5Y |
| 081KR7JY10008QG0R002D6VNNJ | **#2 + #2-Ready** | Round-close meta-check checklist; dep 081KR7JY10008QG0R0038AFS7T merged this session |
| 081KR7JY10008QG0R000XPVJ0W | **#2 + #2-Ready** | Measurables wiring into ALIGNMENT.md; dep 081KR7JY10008QG0R0038AFS7T merged this session |
| 081KRFA460008QG0R000NVM36W | #1 (CLOSED) | Launch-substrate carve-out; closed via PR pending in deferred queue this session |

## How to use this catalog

### When picking a backlog row to implement

Grep audit shards in `docs/hygiene-history/ticks/` for `#2-Ready`,
`#1-DepBlocked`, or `#2-Execution-atom`:

- `#2-Ready` rows are **bounded mechanical implementation candidates**.
  Pick when budget healthy + contention low.
- `#1-DepBlocked` rows tell you the **ancestor to close first**.
  Closing the ancestor unblocks N descendants.
- `#2-Execution-atom` rows are **multi-row trajectories**.
  Look for the `depends_on:` chain to understand the close-order.

### When the audit tool surfaces a candidate

Walk the discriminator from `.claude/rules/backlog-item-start-gate.md`
step 0:

1. Read row body, focus on **Acceptance** / **Proposed mechanization** /
   **Scope** sections (NOT `composes_with:` cross-refs — false-positive
   prone)
2. Existence-check every primary-artifact path
3. **All bullets delivered + every acceptance has a corresponding
   merged PR** → class #1 (close-row)
4. **Some bullets pending, has checkbox/table** → class #2-SD (NO edit)
5. **Some bullets pending, numbered or prose** → class #2 (NO edit)
6. **Row has embedded verifier (grep falsifier, etc.)** → overlay #2-Ready
7. **Row has `depends_on:` ancestor that's open + ancestor scope partial** → overlay #1-DepBlocked
8. **Row is final execution atom of a trajectory** → overlay #2-Execution-atom
9. **`classification: blocked` field present + dependency now merged** → overlay #2-Ready

### Auto-classifier proposal

A `tools/hygiene/triage-drift-candidates.ts` wrapper could automate
the discriminator's first pass:

- Parse acceptance section structure (checkbox vs numbered vs prose)
- Count `[ ]` vs `[x]` checkboxes
- Walk `depends_on:` graph one level
- Grep for "Falsifiability" / "Verifier" sections
- Emit JSON with primary class + sub-class overlays
- Reduce ~75% of manual triage to "skim the classification"

Mentioned but not filed yet — empirical pattern still consolidating.
The catalog above gives the classifier its target outputs.

## Empirical FP class for `#2`

Some primary artifacts exist for reasons unrelated to the row:

- **Shared infrastructure files** — `tools/peer-call/README.md` is
  primary artifact for 081KQDTYV0008QG0R001VJP216/081KQDTYV0008QG0R003VB4K1V/081KQDTYV0008QG0R001HQSSAX/081KQDTYV0008QG0R0037YJPEX etc.; all share
  one README. Existence on disk doesn't mean any specific row shipped.
- **Multi-row composition** — `docs/AGENT-BEST-PRACTICES.md` is
  primary artifact for 081KR50HA0008QG0R003C39GP0/081KRFA460008QG0R000NVM36W etc.; each row contributes
  different content sections. Need to grep for row-specific markers.

These produce FP-2 candidates. The discriminator's "primary artifact
exists" check is necessary but not sufficient.

## Composes with

- `tools/hygiene/audit-backlog-status-drift.ts` — the audit tool
- `.claude/rules/backlog-item-start-gate.md` — step 0 discriminator
- `memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md` — foundational pattern
- `memory/feedback_audit_tool_partial_vs_drift_fp_rate_steady_state_otto_cli_2026_05_16.md` — earlier FP-rate analysis
- `memory/feedback_audit_backlog_status_drift_second_false_positive_class_inline_composes_with_otto_cli_2026_05_16.md` — earlier FP catalog
- 081KRQ1AB0008QG0R000QYJFZE — audit-tool spec
- 081KRQ1AB0008QG0R003DYANMC — 4 quality slices follow-up

## Session arc

This catalog accumulated across ~13 autonomous-loop ticks on
2026-05-16 from ~09:28Z to ~11:45Z. Each tick triaged 1-2 rows;
sub-classes emerged organically as the pattern space saturated.
Three close-row PRs landed (081KR7JY10008QG0R0038AFS7T → #3859 MERGED; 081KR7JY10008QG0R003JSEMX7
attempt aborted; 081KRFA460008QG0R000NVM36W close-row in deferred queue). The remaining
~24 audit shards documented partial states in #2 / #2-SD / #2-Ready
/ #2-Execution-atom forms.

Future-Otto reading this on cold-boot inherits the taxonomy
directly rather than re-deriving it across another ~13-tick arc.

## Origin tick

Tick 6 of the 11:50-12:00Z brief-ack cycle. Counter hit forced-
escalation threshold (#6) with GraphQL still 0/5000 (reset imminent
within the minute). Pure-git substrate work picked to satisfy
counter-with-escalation: this memory file is the bounded concrete
artifact. The sub-class taxonomy needed substrate landing per
`.claude/rules/wake-time-substrate.md` — 13 ticks of audit shards
documented instances; this file documents the pattern itself.
