---
id: 081KRQ1AB0008QG0R003DYANMC
priority: P3
status: closed
title: "Audit-backlog-status-drift — quality improvements per PR #3758 reviewer findings"
tier: factory-hygiene
effort: S
created: 2026-05-16
last_updated: 2026-05-16
closed: 2026-05-16
depends_on: [081KRQ1AB0008QG0R000QYJFZE]
composes_with: [081KRQ1AB0008QG0R000QYJFZE]
tags: [audit, hygiene, follow-up, reviewer-findings, mechanization]
type: feature
---

# Audit-backlog-status-drift — quality improvements

## Origin

Follow-up to [081KRQ1AB0008QG0R000QYJFZE](081KRQ1AB0008QG0R000QYJFZE-audit-backlog-status-drift-detection-2026-05-16.md). PR #3758 (the audit-tool implementation) attracted 4 additional reviewer findings on the e5e7143 commit (after the regex-order + SKIP_SECTIONS + nested-headings fixes). Each finding is valid; this row captures them as a follow-up slice rather than continuing the iteration treadmill on the original PR.

## The four findings

### Finding 1 — Mixed-bullet path extraction (Codex P1, PR #3758 line 172)

> Do not skip the entire line when an inline cross-reference token appears.

Current behaviour: `INLINE_CROSSREF_PATTERNS.some((re) => re.test(line))` skips the WHOLE line. This is correct for pure cross-reference bullets like `- Composes with \`tools/x.ts\`` but is overly aggressive for mixed bullets like `- Add \`tools/new.ts\` per [081KQDTYV0008QG0R0022KG2KY] convention` — the path `tools/new.ts` is a deliverable, the `per [081KQDTYV0008QG0R0022KG2KY]` is just a citation.

**Proposed fix**: only skip the line if the cross-ref keyword appears at the START of the bullet (after `^[\s*-]+\s+`). Mid-line cross-refs allow extraction.

### Finding 2 — cwd-relative path resolution (Copilot P1, PR #3758 line 212)

> Tool assumes cwd = repo root. `enumerateOpenRows()` reads `docs/backlog/...` and `findDriftCandidates()` calls `existsSync(p)` on relative paths. If invoked from another cwd, the paths fail to resolve.

**Proposed fix**: detect repo root via `git rev-parse --show-toplevel` (or accept it as a CLI flag with default), then resolve all paths absolute from that root. Use `path.resolve(repoRoot, p)` in `existsSync` calls.

### Finding 3 — Error handling on read failures (Copilot P1, PR #3758 line 202)

> `enumerateOpenRows()` can throw and abort the whole run on a single unreadable/edge-case backlog file (e.g., permission denied, transient FS error).

**Proposed fix**: wrap `readFileSync` in `try/catch`; on failure, emit a stderr warning naming the failed file and skip that row (continue with the next). The full audit completes; the operator sees the partial-result warning.

### Finding 4 — `--check` mode for CI integration (Copilot P1, PR #3758 line 277)

> 081KRQ1AB0008QG0R000QYJFZE spec calls for a CI-friendly "check/enforce" mode (non-zero exit when drift candidates are found). `main()` currently always exits 0.

**Proposed fix**: add `--check` flag. When set, `main()` returns 0 if no candidates, non-zero (e.g., 65) if any candidates. Default behaviour (detect-only) unchanged.

## Acceptance

- Mixed-bullet path extraction: extracts deliverables from bullets that contain cross-ref tokens mid-line; skips only bullets that START with cross-ref keywords. Regression tests cover both cases.
- cwd-independent path resolution: tool runs correctly from any directory; verified via `cd /tmp && bun /path/to/tools/hygiene/audit-backlog-status-drift.ts`.
- Error handling: tool emits stderr warning + continues on unreadable files; verified via mock fixture with a permission-denied file.
- `--check` mode: returns non-zero when candidates present; default mode unchanged. CI wire-up can later add this flag to a GitHub Actions cron.
- 16-test baseline preserved; ≥3 new regression tests for the new behaviour.

## Composes with

- [081KRQ1AB0008QG0R000QYJFZE](081KRQ1AB0008QG0R000QYJFZE-audit-backlog-status-drift-detection-2026-05-16.md) — parent row (audit-tool spec + first-slice impl)
- PR #3758 reviewer findings (verbatim references above)
- [`.claude/rules/backlog-item-start-gate.md`](../../../.claude/rules/backlog-item-start-gate.md) step 0 — the discipline the audit tool mechanizes
- [`memory/feedback_substrate_drift_catch_pattern_*.md`](../../../memory/) — the discipline substrate

## Why P3

Same as 081KRQ1AB0008QG0R000QYJFZE — friction-reducer. Each improvement is small and additive; together they take the tool from "first slice" to "operationally robust." Not P2 because the first slice already works for the common case (30+ live candidates detected correctly). Not P4 because the findings are concrete + actionable + recent.

## Non-goals

- `--prune-claims` flag (still deferred per 081KRQ1AB0008QG0R000QYJFZE)
- `--open-close-pr` flag (still deferred per 081KRQ1AB0008QG0R000QYJFZE)
- Cross-row drift detection (per 081KRMEXM0008QG0R003FZNK3E — different audit)
- Auto-merge integration (separate concern; the tool is a detector, not an actor)

## Origin tick

Tick 15 of the 2026-05-16 session. PR #3758 review-cycle 2 produced these 4 findings on commit `e5e7143`; this row captures them as follow-up substrate so PR #3758 can ship cleanly.

## Resolution (2026-05-16)

All four slices shipped within the same 2026-05-16 session that filed this row:

| Slice | Finding | PR | Merge commit |
|---|---|---|---|
| 1 | `--check` flag for CI integration | [#3783](https://github.com/Lucent-Financial-Group/Zeta/pull/3783) | `0a57a814` |
| 2 | try/catch on FS reads (don't abort on bad file) | [#3788](https://github.com/Lucent-Financial-Group/Zeta/pull/3788) | `6809f6e3` |
| 3 | chdir to repo root via `git rev-parse` (cwd-independent) + 2 regression tests | [#3790](https://github.com/Lucent-Financial-Group/Zeta/pull/3790) | `472024dc` |
| 4 | Mixed-bullet extraction (paths before cross-ref tokens are deliverables) + tsc-strict guard | [#3809](https://github.com/Lucent-Financial-Group/Zeta/pull/3809) | `eb04e3d` |

**Acceptance bullets**: every bullet in the Acceptance section has a corresponding merged PR. Verified per `.claude/rules/backlog-item-start-gate.md` step 0 partial-vs-drift discriminator.

**Test count**: 16 (081KRQ1AB0008QG0R000QYJFZE first slice) → 20 (after slices 3 + 4 added 2 + 2 regression tests). All passing on main.

**Infrastructure-eats-itself**: this row was caught as a genuine drift candidate by the audit tool it specified. The 6-layer substrate-drift-catch infrastructure has now reached full operational closure on main.
