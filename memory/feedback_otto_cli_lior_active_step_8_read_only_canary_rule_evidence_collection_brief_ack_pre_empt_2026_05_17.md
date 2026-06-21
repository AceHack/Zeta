---
name: Otto-CLI 2026-05-17 multi-tick deferral under Lior-active — canary-rule effective-binding evidence collection
description: 6-tick autonomous-loop session deferred all commit-bound work because the codeql-no-source canary rule binds while ps -A shows gemini.*Lior. Lior's current prompt has step 8 read-only (the destructive global-lock-cleanup the rule's empirical basis named). No commit-tree-corruption empirical data today because no commits attempted. Memory artifact records the observation + the brief-ack pre-empt pattern under sustained named-dep.
type: feedback
created: 2026-05-17T06:16Z
---

# Otto-CLI 2026-05-17 multi-tick deferral under Lior-active

## Session arc (6 ticks in ~14 min)

| Tick (UTC) | Disposition | Concrete artifact |
|---|---|---|
| 06:02Z | Substantive (#1 of session) | 0602Z tick shard + 3-thread verification for PR #4015 + commit plan A/B/C |
| 06:07Z | Substantive | Bus envelope `da3cd5d2` (work-assignment for 081KRHWGX0008QG0R001VR9FNA) + 0602Z shard follow-up section |
| 06:11Z | Brief-ack #1 | Refresh observation only |
| 06:13Z | Brief-ack #2 | Refresh observation only |
| 06:13:43Z | Brief-ack #3 | Refresh observation (named explicit) |
| 06:15:15Z | Brief-ack #4 | Refresh observation (named explicit, pre-empt plan) |
| 06:16:25Z | Pre-empt #5 | **This memory file** |

Per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
the counter discipline: 1-2 brief-acks acceptable with named bounded
wait; 3-5 require explicit naming each tick; #6 forces escalation.
Pre-empt at #4 or #5 is substrate-honest when high-value substrate
edit is ready.

This file IS the pre-empt at #5.

## Named bounded wait (unchanged across 6 ticks)

- **Primary**: Lior gemini procs exit `ps -A` (currently 3, stable
  through all 6 ticks: PIDs 22547 + 22561 + one more)
- **Secondary**: peer-Otto picks up `da3cd5d2` work-assignment
  envelope from `/tmp/zeta-bus/` (2h TTL, expires 08:10Z)
- **Tertiary**: peer-Otto claude-process count drops to a stable
  low (~5-15 range); observed bursty between 9 and 84 across the
  session

## Why all commit-bound work is deferred

Per
[`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md):

> The ONLY reliable safe-window check is the process list:
> ```bash
> if ps -A | grep -qE "gemini.*Lior|lior.*loop"; then
>   echo "Lior-gemini active — DO NOT create worktree"
>   echo "Use memory-file + bus-envelope substrate paths instead"
>   exit 1
> fi
> ```

The rule's wording is conservative: "DO NOT create worktree" while
Lior process is in `ps -A`. The rule's empirical basis (2026-05-15)
was Lior's destructive step 8 — *"Perform global lock cleanup: clear
stale git index locks"* — racing with worktree creation OR with the
`git add → git commit` window in the existing worktree, collapsing
the commit tree to ~1 root entry.

Per the
[0418Z shard](../docs/hygiene-history/ticks/2026/05/17/0418Z.md):

> Lior's current prompt (visible in the ps output) declares step 8
> as **read-only** ("DO NOT delete plugin directories"). That
> instruction-shift mitigates the previously-named trigger
> (destructive lock cleanup) but the canary rule's wording remains
> conservative — "ONLY reliable safe-window indicator is `ps -A`
> returning nothing." Until empirical evidence updates the rule,
> respect it as written.

That substrate-honest stance was reaffirmed in
[0602Z shard](../docs/hygiene-history/ticks/2026/05/17/0602Z.md)
and across the 4 brief-ack ticks. This memory file extends the
observation: the rule's effective binding is now CONSERVATIVE
relative to its empirical basis, because Lior's destructive op
is no longer in the prompt visible in `ps`.

## The canary-rule effective-binding question

When Lior's current prompt no longer contains the destructive op
the rule's basis named, the rule's binding becomes:

| Aspect | Status |
|---|---|
| Rule wording | Conservative: "ps -A returning nothing" is the safe window |
| Rule empirical basis (2026-05-15 corruption events) | Triggered by Lior's destructive step 8 (now read-only in current prompt) |
| Current empirical state (today) | No commit attempts → no new corruption data → no evidence of either continued risk OR safety |
| Effective binding | Rule binds (no empirical update); operating under it is safe-by-construction but operationally expensive (multi-hour deferrals) |

The rule should NOT be updated based on today's session alone —
no controlled-test data. A controlled test would attempt
explicit-path commits in a sidetick worktree under Lior-active
(with Lior's current prompt) with the post-commit ls-tree guard,
and observe N commits without corruption to gather evidence.

That test is itself substrate-honest work but is **out of scope
for today's deferral session** because:

1. It's a controlled experiment requiring a dedicated sidetick
2. It would require multi-hour observation across multiple
   Lior loop cycles
3. The downside of a single corrupted commit (broken PR, P0
   surface) outweighs the upside of one data point

The test would be a backlog row, not a tick-scope undertaking.

## What pre-empted at #5 (this artifact)

The session had 6 deferred commit groups inherited across the
0418Z + 0602Z shards (Groups A-F covering 081KRHWGX0008QG0R000M9RFY2 closure, Kestrel
notebook + 2026-05-17 entry, imaginary-stack research + 081KRQ1AB0008QG0R001YAF3TR,
Riven cursor handoff, bun/package.json + Otto-cwd memory, and the
new Group F for PR #4015 thread fixes A/B/C).

None of the 6 groups can be done without a commit; all 6 deferred
to next safe-window Otto. The pre-empt artifact here:

1. **This memory file** — captures the brief-ack pre-empt pattern
   under sustained named-dep (Lior process persists across all 6
   ticks; deferral is correct discipline)
2. **Documents the canary-rule effective-binding question** —
   substrate available for any future Otto deciding whether to
   propose a rule update
3. **Does NOT propose rule edit** — that needs controlled-test
   data, not session-observation

## Composes with

- [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md)
  — the rule whose effective binding this memory documents
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
  — the counter-with-escalation rule that disciplined this session's
  6 ticks; the pre-empt-at-#5 pattern operating here is exactly
  what the rule prescribes
- [`.claude/rules/encoding-rules-without-mechanizing.md`](../.claude/rules/encoding-rules-without-mechanizing.md)
  — the canary rule's effective binding question maps to the
  rules-need-real-binding discipline
- [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../.claude/rules/refresh-world-model-poll-pr-gate.md)
  rate-limit operational tiers — this session ran in Normal tier
  throughout (rate stayed 3389-4977 of 5000)
- [`.claude/rules/wake-time-substrate.md`](../.claude/rules/wake-time-substrate.md)
  — memory files alone are weather; this file lands as memory and
  composes with the existing rule pointers above
- [PR #4015](https://github.com/Lucent-Financial-Group/Zeta/pull/4015)
  — the BLOCKED-with-green-CI PR whose 3 verified thread findings
  triggered the fix-plan + bus envelope
- Bus envelope `da3cd5d2-219a-4c7a-a688-21168f05fae6` —
  discoverable advertisement of PR #4015 fix-plan for any safe-window
  Otto
- 0418Z + 0602Z tick shards — pair of inherited deferral plans
  this session continues

## Operational lesson for future-Otto cold-boot

When the named bounded wait is a process-persistence dependency
(Lior loop, peer-Otto saturation) AND the dependency persists
across many ticks:

1. The brief-ack pattern (1-2 ack → 3-5 named-ack → #6 forced
   escalation OR #4-#5 pre-empt) operates correctly across
   sustained named-deps
2. The counter does NOT reset on tick passage alone — only on
   named-dep clearing, maintainer speaking, or concrete artifact
3. Filesystem-only artifacts (memory files, tick shards, bus
   envelopes) are the substrate path under Lior-active + bus-
   contended primary
4. Multi-tick deferrals with concrete advisory artifacts (this
   memory file, bus envelope, tick shards) are the substrate-honest
   alternative to brief-ack repetition

The bus envelope `da3cd5d2` makes the PR #4015 fix-plan available
to any safe-window Otto without requiring substrate commits today.
That's the operational pattern: advertise + defer rather than
brief-ack + repeat.

## Substrate-honest framing

This memory file is NOT:

- Manufactured to escape brief-ack (the canary-rule effective-
  binding question IS substantively load-bearing; future-Otto
  may need it)
- A proposal to update the canary rule (needs controlled-test
  data, not session-observation)
- A general "stop respecting the rule" framing (the rule stays
  binding until empirical evidence updates it)
- A guarantee that the bus envelope WILL get picked up before
  TTL expiry (peer-Otto availability is bursty)

This memory file IS:

- An empirical record of the rule operating as conservative
  binding when its named risk has been mitigated in Lior's prompt
- Evidence-collection toward a future controlled-test backlog row
  IF anyone wants to gather the data
- A pre-empt artifact at brief-ack #5 per holding-rule discipline
- A composition pointer set for future-Otto cold-boot to the
  rules + shards + bus envelope that operate together under this
  pattern
