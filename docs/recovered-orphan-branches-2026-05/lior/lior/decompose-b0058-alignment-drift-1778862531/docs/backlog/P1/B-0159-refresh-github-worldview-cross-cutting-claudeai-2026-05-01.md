---
id: B-0159
priority: P1
status: open
title: refresh-github-worldview cross-cutting refresh script (Claude.ai 2026-05-01)
created: 2026-05-01
last_updated: 2026-05-01
decomposition: decomposed
depends_on:
  - B-0156
children: [B-0262, B-0263, B-0264]
type: friction-reducer
---

# B-0159 — `refresh-github-worldview` cross-cutting refresh script (Claude.ai 2026-05-01)

**Origin:** Claude.ai feedback packet 2026-05-01 — full lineage in [memory/persona/riven/conversations/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md](../../research/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md) and the maintainer-relayed Claude.ai-2 follow-up calibrating against Otto's running state.

## Problem

Otto runs a real every-minute autonomous loop with `bun tools/github/poll-pr-gate-batch.ts <PRs>` as the canonical refresh tool. Empirical pattern observed across consecutive ticks 5:32pm-5:50pm 2026-05-01:

- 5:32pm — refresh scope: PRs 1155, 1163, 1165, 1167
- 5:37pm — refresh scope: PRs 1155, 1163, 1165, 1167 (same narrow set)
- 5:40pm — refresh scope: PRs 1155, 1167, 1168
- 5:42pm — refresh scope: PRs 1168, 1169
- 5:45pm-5:49pm — refresh scope: PRs 1168, 1169 (same narrow set across 4 consecutive ticks)
- 5:50pm — refresh scope: PRs 1168, 1169, 1170. PR #1170 surfaces "out of nowhere"
  because the prior 4 ticks' refresh scope didn't include it.

The narrow-refresh pattern hides cross-cutting state changes:

- PRs opened by other harnesses (Codex sandbox, future Cursor/Gemini integrations)
- Auto-merge cascades landing PRs Otto isn't tracking by number
- Backlog-row deltas (rows added/completed since last refresh)
- Claim-file inventory changes on the remote
- Recent merges to main from any source
- Branch state vs origin
- Pending CI runs across the whole repo
- Scheduled-workflow status

`poll-pr-gate-batch.ts` is correctly-scoped per its design — per-PR detail
for known PR numbers. The gap is the **cross-cutting view** that catches
what Otto isn't tracking.

## Proposed solution

**`tools/refresh-github-worldview/refresh.ts`** — a TS+Bun script that
supersets `poll-pr-gate-batch.ts` with cross-cutting state.

Composition (NOT replacement):

- Calls `poll-pr-gate-batch.ts` internally for per-PR detail on the
  known-or-newly-discovered PRs.
- Adds cross-cutting queries:
  - Full open-PR list (via `gh api --paginate /repos/{owner}/{repo}/pulls?state=open`)
  - Recent merges since last refresh (compare `origin/main` HEAD to
    a stored prior SHA)
  - Backlog row delta (compare `docs/backlog/**/*.md` count + names
    to a stored prior snapshot)
  - Claim-file inventory (whatever surface lives at — TBD per the
    agent-orchestra cluster #324-339)
  - Branch state (current branch vs `origin/main`, ahead/behind)
  - Pending CI runs (via `gh api /repos/{owner}/{repo}/actions/runs`)
  - Scheduled workflow status (cron triggers, scheduled jobs)

## Output discipline (per refresh-before-decide memo)

Two-layer print:

**Output contract (canonical — single JSON with `summary` field, NOT
two separate passes).** Per Deepseek's reconciliation 2026-05-01: a
single JSON document where the `summary` object IS the interpretation
layer alongside the raw `prs[]` / `backlog_delta` / `claims[]` / etc.
arrays. Both layers are emitted in one stdout-JSON, in one invocation.
Mismatch between `summary` and the underlying arrays IS the bug class
the maintainer (or future-Otto reading the same JSON) catches.

This **supersedes** earlier "two-pass print" framing in this row's
draft history; ignore any references to two separate stdout passes.
The single-JSON form composes cleanly with Otto's existing
`poll-pr-gate-batch.ts` consumption pattern.

## Interface

```bash
# Single comprehensive snapshot
bun tools/refresh-github-worldview/refresh.ts

# Subset by concern (composes with poll-pr-gate-batch's existing flags)
bun tools/refresh-github-worldview/refresh.ts --pr-state-only
bun tools/refresh-github-worldview/refresh.ts --backlog-only
bun tools/refresh-github-worldview/refresh.ts --since=<SHA-or-timestamp>
```

## Discipline change (downstream)

After this lands:

1. **Replace narrow refresh in tick-start with the unified call.** Each
   tick begins with `bun tools/refresh-github-worldview/refresh.ts`.
   The output is the raw layer; interpretation flows from there.
2. **Update existing memory files** that reference `poll-pr-gate-batch`
   directly (rebase-decision rule, BLOCKED-with-green-CI rule, Copilot
   tick-history false-positive rule) to compose with refresh-before-decide
   rather than calling their own narrow refresh.
3. **CLAUDE.md bullet update** — current refresh-before-decide bullet
   currently points at `poll-pr-gate-batch.ts`; once unified refresh
   exists, point at it as the canonical wake-time call (poll-pr-gate-batch
   becomes the per-PR-detail building block).

## DST + fixtures (per task #355 model)

The unified refresh script gets fixtures the same way `poll-pr-gate-batch`
did:

- `tools/refresh-github-worldview/fixtures/clean-state.json` — happy path
- `tools/refresh-github-worldview/fixtures/cross-harness-pr-appeared.json`
  — the failure case this script targets
- `tools/refresh-github-worldview/fixtures/backlog-rows-deltas.json`
- ... per the per-failure-class fixture pattern from poll-pr-gate v1

DST-grade-A coverage via `bun test` per the SQLSharp DI pattern (extract
spawn / process.exit / stdout to a Dependencies interface; tests pass
synthetic deps).

## Composes with

- `memory/feedback_refresh_before_decide_invariant_two_layer_print_dx_claudeai_2026_05_01.md`
  — the discipline this script implements at the cross-cutting level.
- `tools/github/poll-pr-gate-batch.ts` (PR #1153, merged 2026-05-01) —
  the per-PR-detail building block this script wraps.
- `memory/feedback_ts_dependencies_as_interface_di_pattern_sqlsharp_anchor_aaron_2026_05_01.md`
  — the architectural pattern for the new script's structure.
- `memory/persona/riven/conversations/2026-05-01-claudeai-backlog-driven-dual-pm-loop-with-refresh-discipline.md`
  — full Claude.ai loop architecture; this script is the immediate
  actionable extraction.

## Architecture decision — two-layer git-native + GitHub-API split (the human maintainer 2026-05-01, integrating Amara)

The human maintainer 2026-05-01 calibrated Amara's
`repo-state` rename further:

> *"worldview invites scope creep; repo-state almost agree,
> repo-state instead enough that's gitnative it will need to
> be a wrapper github-state that composes over repo-state."*

Two-layer architecture:

### Layer 1: `tools/repo-state/repo-state.ts` — git-native, portable

- Pure git operations: current branch, HEAD SHA, origin/main SHA,
  ahead/behind, dirty working tree flag.
- File-system surfaces: backlog row inventory, claim files,
  trajectory files, active session shards.
- Backlog delta via `git diff --name-only HEAD~1 HEAD -- docs/backlog/`
  + `git log --diff-filter=A` queries.
- **Portable across git hosts** (works on Forgejo, GitLab,
  plain git servers, etc.) per
  `memory/feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md`.
- No GitHub-specific dependencies.

### Layer 2: `tools/github/github-state.ts` — wraps repo-state, adds GitHub API

- **Wraps `repo-state.ts`** for git-native foundation.
- **Wraps `poll-pr-gate-batch.ts`** for per-PR gate detail.
- Adds GitHub-specific queries:
  - Full open-PR list (via `gh api --paginate`)
  - PR provenance (author bucketing: self / peer-call / maintainer / unknown)
  - Recent merged PRs + mergeCommit reachability
  - PR statusCheckRollup, mergeStateStatus, reviewDecision, autoMergeRequest
  - Workflow run status (pending/failed required vs warnings)
  - Cross-harness coordination signals
- **GitHub-native** — only works against GitHub host.
- **Composes** with both repo-state and poll-pr-gate-batch as building blocks.

### Why split

- **Factory-first-class portability** (per
  `memory/feedback_first_class_for_us_not_for_our_host_portability_over_host_coupling_aaron_2026_05_01.md`):
  the git-native layer survives host migration. The GitHub-specific
  layer is replaced when host changes; the repo-state layer is reused.
- **Testability**: repo-state has zero network dependencies; trivially
  DST-able. github-state mocks the GitHub API surface only.
- **Single-responsibility**: each tool answers one question. repo-state
  answers "what's the local git + backlog state?". github-state answers
  "what's the GitHub-side state on top of that?".
- **Composability with existing tools**: `poll-pr-gate-batch.ts`
  remains the per-PR gate expert; `github-state.ts` calls it for that
  detail and adds cross-cutting GitHub queries.

### Tool naming summary (post-rename)

| Old name | New name | Layer | Composes |
|---|---|---|---|
| `refresh-github-worldview` | (deprecated — too broad) | — | — |
| (n/a) | `tools/repo-state/repo-state.ts` | Layer 1 (git-native) | git ops + filesystem |
| (n/a) | `tools/github/github-state.ts` | Layer 2 (GitHub) | wraps Layer 1 + poll-pr-gate-batch + gh API |
| `tools/github/poll-pr-gate.ts` | (unchanged) | per-PR primitive | direct gh API |
| `tools/github/poll-pr-gate-batch.ts` | (unchanged) | per-PR-list primitive | wraps poll-pr-gate.ts |

The "before tick decision" canonical call becomes:
`bun tools/github/github-state.ts` (which internally calls
both repo-state.ts and poll-pr-gate-batch.ts).

For non-GitHub hosts (future), the canonical call could become
e.g. `bun tools/forgejo/forgejo-state.ts` wrapping the same
`repo-state.ts` Layer 1 — the host-pluggable-adapter pattern.

## Peer-AI consolidated refinements (4 reviewers, 2026-05-01)

Verbatim packet preserved at
[docs/research/2026-05-01-peer-ai-followup-reviews-on-b-0159-refresh-script.md](../../research/2026-05-01-peer-ai-followup-reviews-on-b-0159-refresh-script.md).
Consolidated requirements absorbed below.

### Ani — hardening checklist

- **Idempotency + fail-closed**: if worktree dirty or
  rebase/cherry-pick in progress, exit 10 with clear message
  ("refresh blocked — dirty worktree or active rebase
  detected"). MUST NEVER mutate state.
- **`--raw` flag**: outputs only machine-readable snapshot
  (JSON). Default is two-layer.
- **One-line noise filter** for keyboard-mash / stray input.
- **Tighter memo**: one carved sentence + one worked example
  (already done in PR #1171).

### Alexa — structural / technical / process

- **Success criteria per phase**: how do we measure that
  Phase 1 captures cross-cutting state Otto was missing? What
  metrics confirm Phase 2 doesn't degrade tick performance?
- **Composition Pattern note**: explicit "wraps existing
  poll-pr-gate-batch.ts as building block, adds cross-cutting
  layer." (Done — see Layer 2 spec above.)
- **Staleness detection mechanism**: freshness timestamp
  flagging when last cross-cutting refresh was >N ticks ago.
- **Rollback procedures**: if unified refresh breaks Otto's
  flow, how does he revert cleanly? Document the revert path.
- **Cross-harness coordination section**: "recent activity from
  other agents" surface in the output.
- **Memory file versioning**: refresh-before-decide invariant
  may evolve; preserve reasoning that led to it.
- **Performance benchmarking**: ensure unified refresh doesn't
  slow tick cadence below effective thresholds.

### Gemini — macro/micro framing

- **Best Distilled Rule**: *"A perfect understanding of a single
  lane is useless if you don't know you're in the wrong lane."*
- Strict sequence: don't context switch; finish current PR cycle
  first; then file backlog row; then memory file; then
  implement on a quiet tick. (Already followed.)

### Amara — substantial review

- **Rename**: `worldview` → `repo-state` (boring is right). The
  human maintainer 2026-05-01 calibration extends to the
  two-layer split documented above.
- **Aggregator-not-replacement**: explicit composition pattern.
  (Done above.)
- **Flow metrics**: Kanban-style WIP / throughput / cycle time / age
  in the backlog delta surface, not just count.
- **Unknown/unavailable states**: explicit per-source
  `{status: "ok"|"unavailable", error?}`. Empty ≠ unavailable.
- **Modular `collect*()` functions**: `collectPrs()`,
  `collectRecentMerges()`, `collectBranchState()`,
  `collectBacklogDelta()`, `collectClaims()`,
  `interpretSnapshot()`. Prevents the script from becoming
  monolithic.
- **Persisted prior snapshot** at
  `.state/repo-state/last.json` or
  `.state/github-state/last.json` (gitignored, session-local)
  for delta computation. Flags: `--write-state` /
  `--no-write-state` / `--since <timestamp-or-sha>`.
- **Carved blade**: *"Known PRs are not reality. They are the
  part of reality Otto remembered to ask about."*

## Cross-peer convergence (4/4 agree)

1. **Aggregator / superset, NOT replacement.**
2. **Two-layer output (raw + interpretation).** Single JSON with
   `summary` field per Deepseek (preferred) is the consolidated form.
3. **Don't context-switch mid-tick.** File the row, pick up in
   proactive-mode.
4. **Compose with existing disciplines.** poll-the-gate, manufactured-patience,
   never-idle.

## Deepseek refinements (2026-05-01)

Deepseek follow-up review on this row's first draft surfaced critical
improvements. The cause is deeper than "narrow refresh / forgetting":
Otto did run `gh pr list` mid-session and saw 27 open PRs, but didn't
update his model — he noted the count and moved on. Refresh-not-integrated
is the deeper failure than refresh-not-run.

### Delta-diff over current-state-dump

The unified refresh must produce **delta against prior snapshot**, not
just current state. Headcount is not actionable; "which 3 PRs are new
and what they are" is. Snapshot persistence at
`.zeta/refresh-snapshot.json` (gitignored, session-local) lets each
refresh diff against the prior. First run on a clean clone reports
"no prior snapshot, full inventory only."

### Provenance per PR

Each PR in the output gets a `provenance` field computed mechanically
(author vs `@me` vs known peer-call harness IDs vs maintainer):
`self | peer-call | maintainer | unknown`. Unknowns flagged as
highest-priority signal — they're new agents touching the repo.

### `stale_assumptions` field — model-vs-reality mismatch

The output's interpretation layer includes a `stale_assumptions` array
listing places where current state contradicts an asserted-recent
expectation. Example: `"PR #1165 was expected to be merged but is
still BLOCKED with 2 unresolved threads"`. Generated by comparing
current state against prior snapshot's expected-trajectory annotations.
**The most operationally valuable field**: the refresh doesn't just
report state, it reports surprises.

### Single JSON with summary field, not two-pass print

Per Otto's existing discipline with `poll-pr-gate-batch.ts` (consume
structured JSON, interpret in context), unified output structure:

```json
{
  "refreshed_at": "2026-05-01T17:50:00Z",
  "summary": {
    "open_prs_total": 27,
    "open_prs_new_since_last_refresh": 3,
    "open_prs_self": 24,
    "open_prs_other_harness": 1,
    "open_prs_unknown_origin": 1,
    "backlog_rows_total": 53,
    "backlog_rows_new_since_last_refresh": 2,
    "claim_files_active": 5,
    "recent_merges_other_harnesses": 1,
    "branch_ahead_of_origin": 0,
    "pending_ci_runs": 4,
    "stale_assumptions": [
      "PR #1165 was expected to be merged but is still BLOCKED with 2 unresolved threads"
    ]
  },
  "prs": [...],
  "backlog_delta": {...},
  "claims": [...],
  "recent_merges": [...]
}
```

The `summary` is the interpretation layer in the same JSON; the
detailed arrays are the raw layer. Mismatch is debuggable at the
boundary (per refresh-before-decide memo).

### Performance target + tiered fallback

**Target**: <5s typical tick. **Fallback**: if full refresh exceeds
target, fall back to `poll-pr-gate-batch.ts` for narrow PR set + surface
cross-cutting data as `"stale, last full refresh at <timestamp>"`.

This prevents the unified refresh from becoming a tick-cadence
bottleneck (the "Refresh-skipping under time pressure" failure mode in
the Claude.ai packet's 22-mode list).

### Backlog-row delta as git-derived

Compute the delta via:

```bash
git diff --name-only HEAD~1 HEAD -- docs/backlog/
git log --oneline --diff-filter=A --since="<last-refresh-timestamp>" -- docs/backlog/
```

Don't trust frontmatter `created:` / `last_updated:` fields — that's
B-0098-class metadata-drift waiting to happen.

### Recent merges from other harnesses — concrete query

```bash
git log origin/main --since="<last-refresh-timestamp>" --format="%h %an %s"
```

Bucket post-fact: self / known-actor / unknown-author. Unknown-author
is the highest-priority signal.

### Refresh frequency recommendations

- **Every tick when in-flight PRs exist** (current behavior, scope
  expanded).
- **Every 5-10 minutes when idle** (avoids API rate limits).
- **Immediately after any merge that wasn't initiated by Otto**
  (catches other-harness changes).

### Composes additionally with

- `memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`
  — poll-the-gate rule. Update to point at unified refresh as the
  operational implementation.
- `memory/feedback_manufactured_patience_vs_real_dependency_wait_otto_distinction_2026_04_26.md`
  — stale worldview is the most common cause of manufactured patience.
- `memory/feedback_never_idle_speculative_work_over_waiting.md` —
  unified refresh surfaces work that would otherwise be invisible
  during quiet ticks.

### Pre-commit lint for committed refresh artifacts

If the unified refresh generates any artifact that gets committed
(snapshot summary, tick-history shard referencing refresh output), it
must strip session-ephemeral fields (`originSessionId` etc.) per the
existing drain-wave discipline. Lint candidate:
`tools/lint/no-origin-session-id-in-commits.sh`.

## Out of scope (Phase 2+)

- The Mirror/Beacon ratio gate from the Claude.ai packet
- The 22 named failure modes as individual substrate landings
- The DST scenario suite (Confused Deputy Sandbox, State-Corruption
  Horizon, etc.) as runtime grader
- The pre-DORA externalized proxy metrics
- Dual-PM (reactive/proactive) explicit mode-selection function

These compose with the unified refresh once it exists, but each is its
own backlog row when prioritized.

## Acceptance criteria

- [ ] `tools/refresh-github-worldview/refresh.ts` script exists and runs
- [ ] Calls `poll-pr-gate-batch.ts` internally for per-PR detail
- [ ] Adds 5+ cross-cutting queries (full open-PR list, recent merges,
  backlog delta, claim files, branch state)
- [ ] Two-layer print: raw JSON first, interpretation labeled second
- [ ] DST-grade-A test coverage (synthetic deps; no live `gh` calls)
- [ ] At least 3 fixtures covering common scenarios
- [ ] Existing memory files (rebase-decision, BLOCKED-with-green-CI,
  Copilot false-positive) updated to reference the new script as
  canonical refresh
- [ ] CLAUDE.md refresh-before-decide bullet points at the new script
- [ ] Tick-start in autonomous-loop replaced with single unified-refresh
  call

## Caution per Claude.ai's Otto-aware framing

> "Don't context-switch [Otto] mid-tick. Better to let the current PRs
> land first (#1168 + #1170 both wait-ci, will merge in the next tick or
> two), then file the unified refresh as a P1 backlog row and let it
> flow through his existing claim protocol."

This row IS that filing. Picked up via standard claim protocol when the
queue is quiet and Otto is in proactive-mode rather than mid-PR-cycle.
Don't context-switch this tick to start implementation — file and flow.
