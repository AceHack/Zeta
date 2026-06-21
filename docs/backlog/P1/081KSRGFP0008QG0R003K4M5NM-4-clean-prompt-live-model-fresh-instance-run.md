---
id: 081KSRGFP0008QG0R003K4M5NM
priority: P1
status: open
title: "Clean-prompt live-model fresh-instance run for bootstrap CLAUDE.md"
created: 2026-05-29
last_updated: 2026-05-29
depends_on:
  - 081KR50HA0008QG0R001CNS20T
decomposition: atomic
classification: buildable-now
type: friction-reducer
owners: [architect]
parent: 081KR50HA0008QG0R001CNS20T
---

# 081KSRGFP0008QG0R003K4M5NM — Clean-prompt live-model fresh-instance run

## What

081KR50HA0008QG0R001CNS20T.3 closed the parent with a fresh-instance datapoint, but that
datapoint came from a **task-injected** bg-worker session (the prompt named
the backlog item). The original test protocol (081KR50HA0008QG0R001CNS20T step 2) calls for a
**self-selected** task from an open prompt:

> "Give it a representative task (e.g., 'pick and complete the next open
> backlog item')."

This child exercises that one untested edge: a fresh Claude Code session with
the bootstrap-only CLAUDE.md, given ONLY the open prompt, and observed for
whether it self-selects coherent work, follows the 6-step process, discovers
rules through `.claude/rules/` auto-load, and produces a coherent PR.

## Why this is a separate (optional) child

The static structural validator (081KR50HA0008QG0R001CNS20T.1/.2) and the task-injected datapoint
(081KR50HA0008QG0R001CNS20T.3) already cover acceptance criteria #2 and #3 of the parent, plus #1
for the injected-task path. The only remaining gap is the **self-selection**
behavior, which requires a genuinely clean prompt to a fresh model. It is
optional because the load-bearing structural invariant (rules survive
extraction; bootstrap process is followed) is already proven; this only adds
behavioral confidence on the self-selection edge.

## Acceptance criteria

1. A fresh Claude Code session is started with bootstrap-only CLAUDE.md and the
   open prompt "pick and complete the next open backlog item" (no item named).
2. Observed: does it self-select a coherent item, follow the 6-step process,
   surface rules via auto-load, and open a coherent PR?
3. Findings appended to this row (what self-selection looked like; any rules
   that failed to surface).
4. If gaps found: file follow-up items.

## Effort

S — one observed live run + a short findings note. Heavyweight only in that it
needs a real model-in-the-loop, hence split out from the static 081KR50HA0008QG0R001CNS20T.1/.2.

## Pre-start checklist (backlog-item start gate)

**Prior-art search (2026-05-29):** 081KR50HA0008QG0R001CNS20T (parent, closed) + .1 (static
validator, merged #6031) + .2 (referenced-pointer check, merged #6036) + .3
(findings report). `tools/bootstrap-validator/validate-bootstrap-claude-md.ts`
is the static surrogate. No live-run harness exists; this is the genuinely-new
slice.

**Dependency-restructure:** depends_on 081KR50HA0008QG0R001CNS20T (closed). Reciprocal pointer
added to 081KR50HA0008QG0R001CNS20T row (081KR50HA0008QG0R001CNS20T.3 Resolution section names this follow-up).
