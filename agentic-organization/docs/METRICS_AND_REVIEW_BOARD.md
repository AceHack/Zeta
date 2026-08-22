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

`packages/metrics/src/review-board.ts`. The board **declares its aggregation
rule** as an `AggregationRule` value (`src/Core.TypeScript/society/aggregation-rule.ts`)
and its objective as a `Purpose`, and the pairing is machine-checked by
`classify` before anything is decided:

```text
DEFAULT_REVIEW_RULE   = union                 (k = 1)
REVIEW_BOARD_PURPOSE  = { kind: "recall" }
classify(purpose, rule) -> "dominates:recall"
```

Reviewers vote along explicit `ReviewDimension`s — `correctness`, `solid`,
`architecture_adherence`, `performance`, `testing` — the discussion axes the
operator named.

```text
CandidateFinding[] + ReviewerVote[] -> evaluateReviewBoard({ findings, votes, quorum?, rule? })
                                          -> per finding: FindingDecision
```

### Two numbers that used to be one number

`DEFAULT_REVIEW_QUORUM = 3` used to be **both** the minimum board size and the
agreement threshold. PR #10974 named what falls out of that: at the minimum
convening size the agreement threshold is `k = n`, which `ofKOfN` normalises to
`veto` — and a veto on a **discovery** task is `mirror-mismatch(recall, safety)`.
The rule did not merely fail to dominate; it dominated on the opposite axis.

They are now separate:

- **`quorum`** — an **attendance floor** only. How many distinct reviewers must
  show up before the board may sit. In `AggregationRule` terms a
  `liveness-precondition`, explicitly not an accuracy claim. Still 3; the board
  still returns `feedback` (`too_few_reviewers`) below it.
- **`rule`** — decides adoption, defaults to `union`, and is caller-overridable.

`FindingDecision.state` is an explicit DU:

- **adopted** — the rule was satisfied. Under `union` that means *any* reviewer
  agreed; a solitary true finding is no longer dropped.
- **withheld** — the rule was not satisfied. Under `union` that means **nobody**
  agreed (union is `k = 1`, not `k = 0`: it is not a check that cannot fail).
- **contested** — both sides satisfied the rule. Under a **recall-dominant** rule
  this is an annotation on an adopted finding, not an escalation: letting one
  disagreeing reviewer suppress a discovery would reinstate the mirror defect
  through the back door. Under any other rule it escalates, as before.

### Agreement is published, not spent

Every decision carries a `FindingConfidence`: `distinctAgree`,
`distinctDisagree`, `distinctAbstain`, `reviewerCount`, `agreementRatio`,
`contested`. **Nothing branches on it** — not in the board, not in the review
gate. A 1-of-3 finding and a 3-of-3 finding reach the same gate outcome and are
never indistinguishable. That is the point: the old quorum gate *consumed* this
number, and a withheld finding that is dropped is erasure.

`distinct` counting is unchanged and is not a consequence of the threshold: one
agent voting three times still counts once, so the confidence annotation cannot
be self-amplified.

### No weights

`toBooleanRule` returns `undefined` for a `weighted` rule, so a weighted rule is
**structurally unusable** here rather than merely discouraged — the board returns
`feedback` (`aggregation_rule_not_applicable`). Weighted aggregation waits on a
measured-competence ledger; no site in this repo has one, and calibration is not
competence.

### The declaration is checked, not trusted

A rule classifying as `mirror-mismatch` against the board's purpose is refused
outright (`aggregation_rule_mirror_mismatch`). Setting the rule back to `veto`,
or writing `ofKOfN(n, n, ...)`, now fails mechanically. Weaker verdicts are
permitted — a caller may legitimately pin `threshold(k, ...)`, and the tests do
exactly that so the assertions written for the pre-union regime stay under test.

### Why this is the constitution gate again

The **distinct-agreer** discipline is identical in shape to
`governance/src/constitution-gate.ts`: one agent voting three times counts once,
no self-amplification. The constitution gate ratifies *rule sets*; the review
board ratifies *review findings*. What differs, deliberately, is the aggregation
rule: ratification is a **legitimacy** question (a threshold is the right shape),
discovery is a **recall** question (union is). Same multi-oracle principle, two
purposes, and now each says which one it is. The vote-counting logic is restated
across the package boundary; the **algebra** is imported, so the classification
has one source of truth and cannot drift.

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
