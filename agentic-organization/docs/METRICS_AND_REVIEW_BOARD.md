---
title: Metrics and the 3-Agent Review Board
canonical_name: Agentic Organization
status: v0
ideas: [2, 4]
extends:
  - OBSERVABILITY_AND_SELF_HEALING.md
  - BUSINESS_QUALITY_GATE_SYSTEM.md
composes_with:
  - ./OBSERVE_COMPOSER_AND_RUN_STATE.md
  - ./SUPERVISOR_CHAIN_COMMUNICATION.md
  - ./DOC_FRONTMATTER_CONVENTION.md
code_anchors:
  - ../packages/metrics/src/code-metrics.ts
  - ../packages/metrics/src/review-board.ts
  - ../packages/metrics/src/mcp-tools.ts
  - ../packages/governance/src/constitution-gate.ts
supersedes: []
---

# Metrics and the 3-Agent Review Board

Operator idea 4, sharpened (2026-05-29): metrics have **two layers** — a
*quantitative* layer gathered mechanically like test coverage, and a
*qualitative* layer run by a board of reviewer agents who must **agree** before a
comment is published. The qualitative layer is the constitution gate (idea 2)
applied to review findings: ≥3 distinct reviewers, agreement required.

## Quantitative — "coverage for structure"

`packages/metrics/src/code-metrics.ts` measures source text the way a coverage
tool measures execution: deterministic, no judgment, just numbers.

| Metric (`CodeMetricKind`) | What it catches | Default warn / flag |
|---|---|---|
| `longest_function` | sprawling functions | 40 / 80 lines |
| `longest_class` | **god classes** | 200 / 400 lines |
| `file_length` | god files | 400 / 800 lines |
| `max_nesting_depth` | tangled control flow | 4 / 6 |

`analyzeSource(filePath, source, thresholds?)` returns a `CodeMetricsReport` with
the measured spans plus a list of `MetricFinding`s. Each finding is an explicit
DU on `metric` + `severity` (`ok`/`warn`/`flag`), so a "god class" finding is
structurally distinct from a "long file" finding — never collapsed into a generic
"too big" string. These are **heuristics that flag candidates**, not verdicts;
the verdict is the review board's.

## Qualitative — the 3-agent review board

`packages/metrics/src/review-board.ts`. A candidate finding becomes a published
comment only when a **quorum of distinct reviewer agents agree**. Reviewers vote
along explicit `ReviewDimension`s — `correctness`, `solid`,
`architecture_adherence`, `performance`, `testing` — the discussion axes the
operator named.

```text
CandidateFinding[]  +  ReviewerVote[]  ->  evaluateReviewBoard({ findings, votes, quorum? })
                                              -> per finding: FindingDecision
```

`FindingDecision.state` is an explicit DU:

- **adopted** — ≥ quorum *distinct* reviewers agreed and fewer than quorum
  disagreed; the comment is published
- **withheld** — too few distinct agreers; the comment is dropped (no
  single reviewer can force a comment through)
- **contested** — quorum agreed *and* quorum disagreed; escalate rather than
  silently pick a side

The board returns `feedback` (`too_few_reviewers`) if fewer than quorum distinct
reviewers participated at all — a 2-agent board cannot adopt anything when quorum
is 3.

### Why this is the constitution gate again

The agreement rule is identical in shape to
`governance/src/constitution-gate.ts`: **distinct** agreers (one agent voting
three times counts once — no self-amplification), quorum-gated, with disagreement
able to veto. The constitution gate ratifies *rule sets*; the review board
ratifies *review findings*. Same multi-oracle principle, two scopes. They live in
different packages (no cross-import across the boundary), so the logic is restated
rather than shared — but the semantics are deliberately the same, and both are
explicit DUs with no buried thresholds.

This is also why a review board sits naturally on the observe/compose keystone:
"publish this review comment" is exactly the kind of side effect that should pass
a gate before `decide()` lets a run act on it.

## MCP tool interface (hosting is a TODO)

`packages/metrics/src/mcp-tools.ts` exposes both layers as MCP tools — **the
interface only**. `METRICS_TOOL_DESCRIPTORS` advertises:

- `analyze_source` — gather quantitative metrics for one file
- `run_review_board` — run the ≥3-agent board over findings + votes

`dispatchMetricsTool(name, args)` is the pure in-process router an MCP server's
`call_tool` would delegate to; it returns an explicit `MetricsToolResult` DU
(`ok` with a typed payload per tool, or `feedback` for unknown-tool / bad-args).

The actual server **hosting is deliberately stubbed** (`// TODO(mcp-host)` in
`mcp-tools.ts`): advertise the descriptors via `list_tools`, map `call_tool` onto
`dispatchMetricsTool`, run over the cluster MCP gateway transport, and enforce
hat-token preflight before dispatch (metrics reads are low-risk; publishing review
comments is a scoped authority per `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`). Per the
operator: build the tooling + the interface now, host the server later.

## Status

Implemented and tested: quantitative metrics, the qualitative review board, and
the MCP tool dispatch interface (`packages/metrics`, 15 tests; full suite 346
green). Design/next: the MCP server host behind `dispatchMetricsTool`; wiring
metric findings into the supervisor-chain so a `flag` becomes a triaged work
item; and persisting review decisions as evidence on the work item.
