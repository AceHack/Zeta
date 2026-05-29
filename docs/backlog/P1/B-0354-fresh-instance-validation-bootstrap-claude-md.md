---
id: B-0354
priority: P1
status: open
title: "Fresh-instance validation test for bootstrap CLAUDE.md"
created: 2026-05-09
last_updated: 2026-05-29
depends_on:
  - B-0353
decomposition: multi-child (re-decomp pass 1, smallest safe slice)
classification: buildable-now
type: friction-reducer
owners: [architect]
parent: B-0329
---

# B-0354 — Fresh-instance validation test

## What

Run a fresh Claude Code session with the bootstrap-only
CLAUDE.md and verify it produces coherent first-PR behavior
equivalent to the current doctrine-based CLAUDE.md.

## Test protocol

1. Start fresh Claude Code session in the repo.
2. Give it a representative task (e.g., "pick and complete
   the next open backlog item").
3. Observe whether it:
   - Reads the bootstrap process and follows the steps
   - Discovers rules through `.claude/rules/` auto-load
   - Produces a coherent PR with correct build gate
   - Handles edge cases (stuck, need escalation, etc.)
4. Document findings: what worked, what was missed, what
   rules failed to surface.

## Acceptance criteria

1. Fresh instance completes a representative task
   successfully.
2. No critical rules lost in the extraction (all behavioral
   rules accessible via `.claude/rules/` auto-load).
3. Findings documented as a test report on this row.
4. If gaps found: file follow-up items for each gap.

## Effort

S — 1-2 hours of testing + documentation.

## Pre-start checklist (backlog-item start gate)

**Prior-art search (2026-05-11 Riven):** Searched `docs/backlog/**/B-03*.md`, `docs/BACKLOG.md`, `docs/trajectories/*/RESUME.md` for "bootstrap CLAUDE", "fresh-instance", "B-0329", "B-0353". Found related in B-0329 (parent), B-0353 (closed predecessor), B-0348 (extraction classify), B-0315 (trim context). No duplicate test harness exists. Surfaces: BACKLOG.md lines 187-188, B-0329 decomposition tree.

**Dependency-restructure:** B-0353 closed (2026-05-10). No broken pointers. Added reciprocal note to B-0329. Supersession via decision-archaeology on B-0329/B-0353 lineage complete (no B-0169 gaps).

## Re-decomposition (smallest safe slice, one bounded step)

Re-decomp assumes prior "atomic" classification was mistaken (test protocol is inherently multi-phase). Split into 3 atomic children (TS-first where possible, per Rule 0):

- B-0354.1: TS harness skeleton for fresh-instance bootstrap validator (script that checks CLAUDE.md length <50, .claude/rules/ presence, 6-step process)
- B-0354.2: Execute minimal validation in isolated TS context + focused check (no real Claude spawn)
- B-0354.3: Document findings + file any gap children; update parent B-0329

Each child: one PR, run `bun` checks + build gate, no broad test execution yet.

## Progress

**B-0354.1 landed (2026-05-29, otto-cli bg-worker):** static structural-validation
harness skeleton at `tools/bootstrap-validator/validate-bootstrap-claude-md.ts`
(+ `.test.ts`, 15 tests pass). Checks: CLAUDE.md exists; 6-step bootstrap process
present (`## 1.`..`## 6.`); `.claude/rules/` auto-load surface non-empty; conciseness
(soft warn). CLI flags `--json` / `--root` / `--max-lines` / `--help`; exit codes
0 pass / 1 usage / 3 fail. No Claude spawn (that is B-0354.2/.3).

**Recalibration finding (assume-decomposition-has-mistakes):** the child sketch's
"CLAUDE.md length <50" bound is empirically wrong — the live bootstrap CLAUDE.md is
~76 lines and that IS the correct bootstrap form. Hard `<50` would fail a correct
file. Load-bearing invariant is structural (6-step process + rules auto-load surface),
so conciseness is a SOFT `--max-lines` warn (default 150), not a hard fail.

Remaining: **B-0354.2** (execute minimal validation), **B-0354.3** (document findings
and file gap children, update parent B-0329).
