# 081KQZVQW0008QG0R001FG05RZ Live-Noise Calibration Receipt - 2026-05-30

## Scope

This receipt calibrates the first live 081KQZVQW0008QG0R001FG05RZ factory-health coincidence
signal after merged-PR, trajectory-receipt, and Codex loop-run observations
were joined.

## Live Observation

Command:

```bash
bun tools/health/factory-health-monitor.ts --json
```

At `2026-05-30T08:37:25.354Z`, the monitor reported:

```text
76 event-window coincidence(s) detected
```

The underlying event sample had 212 bounded events in the 24-hour lookback:

| Source | Count |
| --- | ---: |
| merged PR | 100 |
| trajectory receipt | 18 |
| Codex loop run | 94 |

The 76 windows split by source set as:

| Window source set | Count |
| --- | ---: |
| Codex loop run + merged PR | 46 |
| Codex loop run + merged PR + trajectory receipt | 12 |
| merged PR | 9 |
| merged PR + trajectory receipt | 7 |
| Codex loop run + trajectory receipt | 2 |

The largest trajectory cluster was `codex + otto` with 31 windows. The two
latest 081KQZVQW0008QG0R001FG05RZ windows were deterministic lifecycle joins:

| Window start | Events |
| --- | --- |
| `2026-05-30T08:15:46Z` | PR #6095 merge, the same trajectory receipt commit, and the Codex gate that published the PR state |
| `2026-05-30T08:31:27Z` | PR #6096 merge, the same trajectory receipt commit, and the Codex gate that published the PR state |

## Calibration Verdict

The current warning volume is mostly source/lifecycle noise, not a bounded
shared-upstream incident.

The monitor is doing what the current source design asks: it joins every recent
merged PR, every recent trajectory receipt commit, and every recent completed
Codex forward gate within a five-minute sliding window. Under active factory
throughput, that produces expected windows whenever a PR merge, its durable
receipt commit, and the Codex gate that observed or published the state land in
the same lifecycle. That is useful as proof the 081KQZVQW0008QG0R001FG05RZ event plumbing works,
but it is too broad to treat each warning as an actionable hidden-cause signal.

The actionable signal is narrower: a coincidence should survive deduplication
of events that are different observations of the same PR lifecycle, or it
should involve a gate completion that publishes a new claim or PR update rather
than an ordinary periodic successful gate.

## Recommended Next Slice

Narrow the 081KQZVQW0008QG0R001FG05RZ coincidence source before adding another event source:

1. Collapse same-PR lifecycle triples where a merged PR event and a trajectory
   receipt event share the same merge commit or PR number.
2. Gate Codex loop-run events to publishing completions: claim branch pushed,
   PR opened, PR updated, PR merged, or claim cleaned.
3. Include a compact debug surface for the top coincidence windows so future
   receipts can inspect causes without re-running an ad hoc helper script.

## Verification

- `bun tools/health/factory-health-monitor.ts --json`
- Ad hoc read-only extraction using exported 081KQZVQW0008QG0R001FG05RZ helpers:
  `mergedPullRequestEventsFromJson`, `trajectoryReceiptEventsFromGitLog`,
  `loopRunReceiptEventsFromRunnerLog`, and `findCoincidenceWindows`
