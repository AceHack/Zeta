---
id: B-0583
priority: P2
status: open
title: "Cross-machine account-scoped scarcity bus — refine B-0570 from machine-local per-agent files to account-scoped timestamped surface"
tier: factory-infrastructure
effort: M
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0400, B-0570, B-0571, B-0580, B-0582]
tags: [bus, scarcity, cross-machine, account-scoping, github, design-exploration]
type: feature
---

# Cross-machine account-scoped scarcity bus

## Origin

Aaron 2026-05-16, refining the B-0570 (scarcity tracker) design after Otto proposed per-agent `/tmp/zeta-bus/scarcity-<agent>.json` files:

> *"this is an account level issue so could cross machine hmm but no sure tracking it in git/github would be any better unless we make certain long lived branches that can be pushed to without a pr or something. myabe worth having a github temp branch with no restrictions for agents for cross mchines communication too outside of the pr itself. just thinking outloud we can build and try a few differnt things. also this resource is tied to my account not a specific agent maybe a shard folder would be better for /tmp or a temp github branch the timestamps would keep it unique without the agent name."*

Two scoping corrections + one architectural opening:

1. **Account-level, not agent-level**: The GraphQL rate-limit (and other GitHub resources) is tied to the GitHub account (AceHack), NOT to a specific agent process. Per-agent file names mis-frame the partition key.
2. **Cross-machine matters**: Otto-CLI on Aaron's laptop + Otto-ServiceTitan-replicated on a different machine BOTH consume from AceHack's rate-limit bucket. Machine-local `/tmp/zeta-bus/` is invisible to the other machine; cross-machine visibility is needed.
3. **GitHub-as-bus**: A GitHub branch or sidecar repo could serve as the cross-machine bus surface. Open question: what's the right shape (long-lived branch on LFG with rule carve-outs; sidecar repo; GitHub-Action-only writer; gist; etc.)

The original B-0570 design captures scarcity-as-substrate; this row refines the SUBSTRATE LOCATION to match the actual partition key (account, not agent).

## Design space — options to weigh

| Approach | Cross-machine? | Cost trap | Setup overhead | Verdict |
|---|---|---|---|---|
| `/tmp/zeta-bus/scarcity-<ts>.json` (machine-local, timestamped) | NO | None | Trivial | Useful for single-machine visibility; insufficient for cross-machine |
| Long-lived branch on LFG/Zeta with minute-cron pushes from each agent | YES via git fetch | `copilot_code_review: review_on_push: true` in enterprise ruleset #16490134 fires on every push → burns Copilot premium requests at minute cadence | Branch creation + ruleset carve-out | The Copilot review trap is sharp; needs ruleset exclusion |
| Sidecar repo (e.g., new `LFG/Zeta-bus`) WITHOUT the enterprise ruleset | YES via git fetch | None if ruleset doesn't apply | New repo setup + ruleset configuration | Clean partition; explicit "bus traffic doesn't get code-reviewed" property |
| GitHub Action cron on AceHack/Zeta that polls + writes single file to a branch | YES; only GitHub writes | One source of truth; runs even with no agent alive | Workflow file + scheduling design | Cleanest if "current state only" is enough; loses per-poll history |
| Gist with append-only updates | YES via gist API | None | Trivial; gist API supports updates | Less greppable at scale; informal |

The "right" choice depends on:

- Whether per-poll history is needed (multiple files) or current state only (one file)
- Whether agents are the writers (multi-writer concurrency) or GitHub Actions is (single-writer)
- How often updates fire (every-minute vs every-hour)
- Whether the bus is scarcity-only or general cross-machine agent comms

## What

A scarcity bus surface that:

1. Is **account-scoped** in its naming/structure (account = the partition key; agent identity is metadata in the file content, not in the filename)
2. Is **cross-machine visible** so agents on Aaron's laptop + ServiceTitan-replicated Otto + future agents can all read and write
3. Uses **timestamped filenames** (or commit-ordering for git-based) so multiple writers don't lock-contend
4. Avoids the **Copilot review cost trap** of pushing to LFG branches under enterprise ruleset #16490134

The choice between the design-space options above should follow a brief experiment phase — Aaron's "we can build and try a few different things."

## Acceptance criteria

- [ ] Decision documented: which of the design-space options got picked (with rationale)
- [ ] If branch-based: ruleset carve-out for the bus branch / sidecar repo confirmed working (Copilot review NOT firing on bus pushes)
- [ ] If file-based: `tools/bg/scarcity-tracker.ts` extended to write to the chosen surface (machine-local + cross-machine sync if needed)
- [ ] Cross-machine readability test: another machine (e.g., ServiceTitan-replicated Otto when it lands) can read the bus state
- [ ] Composes with B-0570: this row refines the substrate location; B-0570's tracker design remains otherwise valid
- [ ] Documentation update: `docs/governance/` (or wherever the bus pattern is documented) reflects the chosen approach

## Why now

The 2026-05-16 session demonstrated that all agents on this machine (Otto-CLI + peer Otto background worker + Lior + me) share the same account-level GraphQL bucket. Adding ServiceTitan-replicated Otto multiplies the surface across machines. Without cross-machine visibility, agents can't proactively defer when the shared bucket is near exhaustion — they only find out when their own call returns 429.

## Composes with

- B-0570 (scarcity tracker — this row REFINES that row's substrate location; B-0570 stays valid for the tracker logic; this row addresses where the tracker writes/reads)
- B-0400 (bus protocol — same family of cross-agent communication; scarcity is one specific channel; bus protocol decisions inform this row's options)
- B-0571 (GitHub App for factory automation — separate rate-limit pool; if adopted, the scarcity tracker would track BOTH the user-account pool AND the App's separate pool)
- B-0580 (Enterprise ruleset management — the `copilot_code_review: review_on_push: true` rule in #16490134 is the cost trap this row navigates; understanding the ruleset is prerequisite to deciding branch-based vs sidecar)
- B-0582 (substrate-level destructive-verb refusal gate — adjacent infrastructure; both are about cross-cutting policy for agent operations)

## Substrate-honest caveats

- This row REFINES B-0570 rather than replacing it; B-0570 captured the tracker logic correctly, this row corrects only the substrate location
- The Copilot review cost trap is a SPECIFIC concern under current enterprise tier (#16490134 ruleset). If the trial ends without payment method, the trap dissolves (fail-closed at $0 spending limit). If payment method is added, the trap is real and must be navigated.
- "Long-lived branch with no restrictions" requires explicit ruleset configuration; default protections (deletion + non_fast_forward) should stay; only the Copilot-review rule needs branch-level exclusion
- The GitHub-Action-only approach is cleanest from a multi-writer-contention standpoint, but loses per-poll history (single file overwrite). Acceptable for "current state" tracking; not for "trend over time" analysis. Depending on need, may want BOTH (current-state file via Action + historical JSONL via append).
- Aaron's framing was "we can build and try a few different things" — this row authorizes experimentation, doesn't pre-commit to one design

## Open questions

1. **Which design-space option?** Probably need empirical evidence — try one or two, see what works at scale
2. **Is per-poll history needed?** If yes, multi-file or append-only JSONL; if no, single overwrite file
3. **Bus generality**: is this scarcity-only or general cross-machine agent comms? Latter would multiply the design's value but adds scope
4. **Authentication for cross-machine readers**: how does ServiceTitan-replicated Otto authenticate to read LFG bus branch? GitHub App? Read-only deploy key? Per-machine PAT?
5. **Timestamp resolution**: ISO 8601 to seconds OR nanoseconds? Sub-second matters if minute-cron has multiple agents firing in same second

## Pre-start checklist

- [x] Prior-art search: B-0570 captures tracker logic; B-0400 captures bus protocol; this row sits at their intersection
- [x] Dependency proof: no blockers; design exploration row
- [x] Empirical motivation: 2026-05-16 session demonstrated 3-4 agents sharing AceHack bucket; ServiceTitan-replication multiplies cross-machine
- [x] Constraint identified: Copilot review cost trap under enterprise ruleset #16490134

## Decomposition into implementation slices

| Slice | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | \`tools/bg/scarcity-tracker-gist-experiment.ts\` — standalone script to test the Gist append-only updates approach | S | extracted |
| 2 | Ruleset carve-out experiment — test if a long-lived branch can bypass Copilot review | M | open |
| 3 | Evaluate experiments and select final design | S | open |
| 4 | Integrate selected design into \`tools/bg/scarcity-tracker.ts\` | M | open |
