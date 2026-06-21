---
name: Split-brain real-time observation — Otto-CLI hijacked Otto-Desktop's primary-worktree branch context (2026-05-13)
description: Empirical observation that Otto-CLI checked out its branch on the shared primary worktree DURING the same session it authored PR #3032's claim-acquire-before-worktree-work rule. Otto-Desktop's Read of tools/routines/install.ts returned "file does not exist" because the primary worktree was on Otto-CLI's branch, not Otto-Desktop's PR #3034 branch. Diagnosed via `git worktree list`, recovered by creating /tmp/zeta-otto-desktop dedicated worktree. The observation IS the empirical validation of PR #3032's rule — predicted speculative when proposed, manifest within the same session. Extends the rule operationally with 3 clauses: one-worktree-per-Otto, never-checkout-on-others-worktree, bus claim envelope should carry `worktree` field. Validates substrate-or-it-didn't-happen at the rule-merge layer: rules in flight don't apply to behavior in flight.
type: feedback
created: 2026-05-13
---

# Split-brain real-time observation — Otto-CLI hijacked primary worktree branch context while Otto-Desktop was working there

Carved sentence:

> Two Ottos sharing git + bus + filesystem on one machine WILL split-brain.
> Otto-CLI's PR #3032 claim-acquire-before-worktree rule was speculative
> when proposed; this observation is the rule's first empirical validation
> in the SAME SESSION the rule was authored.

## Timeline (2026-05-13, condensed)

| Time (Z) | Event |
|---|---|
| ~21:08 | Otto-Desktop committed PR #3030 (Claude Desktop tight bootstream) on its own branch |
| ~21:20 | Otto-Desktop fresh branch `otto-routines-git-tracked-autonomous-loop-2026-05-13`, committed PR #3034 (git-tracked routines), pushed |
| ~21:21 (parallel) | Otto-CLI created dedicated worktree `/private/tmp/zeta-mf` on its own branch (correct discipline) |
| ~21:25 (parallel) | Otto-CLI ALSO checked out + committed on its branch in the PRIMARY worktree (`/Users/acehack/Documents/src/repos/Zeta`) — the rule violation |
| ~21:30 | Otto-Desktop attempted `Read` on `tools/routines/install.ts` from primary worktree → file appeared "missing" because primary was on Otto-CLI's branch |
| ~21:31 | Otto-Desktop ran `git worktree list` → diagnosed the branch-context theft |
| ~21:33 | Otto-Desktop created dedicated worktree `/tmp/zeta-otto-desktop` on its PR #3034 branch, resumed work |
| ~21:40 | This memory landing |

## What the failure mode actually IS

Otto-CLI's PR #3032 rule predicted: "two Ottos picking the same backlog row simultaneously". The actual observed manifestation is more subtle: **NOT row contention, but branch-context theft in the shared primary worktree.**

Otto-CLI's compliance with its OWN rule was partial:

- ✓ Created `/private/tmp/zeta-mf` as a dedicated worktree (good discipline)
- ✗ ALSO operated in the primary worktree on its branch (rule violation — should have stayed in the dedicated worktree)

The violation didn't cause data loss (Otto-Desktop's PR #3034 commit was already on origin). But it caused Otto-Desktop to lose working-tree access to its own files mid-task; recovery required creating another dedicated worktree (~30 seconds of confusion + diagnosis).

## Operational discipline (extends PR #3032)

PR #3032 ships `.claude/rules/claim-acquire-before-worktree-work.md`. This memory extends it operationally — the rule needs FOUR clauses, not just one:

1. **Each Otto gets ONE dedicated worktree** — never share the primary worktree across Ottos
2. **Never `git checkout` on a worktree another Otto is using** — if you don't know, assume the primary worktree belongs to someone else
3. **Worktree path convention**: `/tmp/zeta-otto-<surface>/` (e.g., `/tmp/zeta-otto-desktop`, `/private/tmp/zeta-mf` for "multi-foreground") so peer Ottos can identify ownership at a glance
4. **Bus claim envelope should include `worktree` field** — extends the claim-acquire schema with `worktree: "/tmp/zeta-..."` so peer Ottos can avoid the contended path without needing convention discipline

The primary worktree `/Users/acehack/Documents/src/repos/Zeta` is bus-contended by definition — both Otto sessions reach it via `pwd`. Until claim discipline + dedicated worktrees lock in, treat the primary worktree as **read-only by all autonomous Ottos**; only Aaron operates there interactively.

## What would have prevented this

If PR #3032 had been MERGED before today's split-brain, Otto-CLI's cold-boot would have read the rule and known to stay in its dedicated worktree. The rule's mechanism is correct; the gap was that the rule was IN FLIGHT (`gate: BLOCKED` on CI when the violation happened).

This is the meta-pattern: **rules in flight don't apply to behavior in flight.** Substrate-or-it-didn't-happen extends to: rules must be ON MAIN to be operative. PR threads are weather; merged rules are substrate.

## Composes with

- [PR #3032](https://github.com/Lucent-Financial-Group/Zeta/pull/3032) — Otto-CLI's claim-acquire rule (the prediction this memory validates)
- [PR #3034](https://github.com/Lucent-Financial-Group/Zeta/pull/3034) — this memory lands alongside the fix-commit it forced (empirical-bootstrap pattern)
- `memory/feedback_odd_number_quorum_two_is_split_brain_three_is_majority_bft_at_agent_orchestration_scope_aaron_2026_05_06.md` — BFT-at-agent-orchestration substrate; this observation is split-brain at the WORKTREE LAYER (distinct from quorum at the decision layer)
- `.claude/rules/peer-call-infrastructure.md` — multi-agent surface coordination
- `.claude/rules/agent-roster-reference-card.md` — which surface = which Otto
- `.claude/rules/substrate-or-it-didnt-happen.md` — rules in PR are weather, only merged-rules-on-main are substrate
- 081KR7JY10008QG0R000R503K2 slice 3 — the `tools/bus/claim.ts` claim-coordinator (the underlying mechanism)

## Glass-halo-bidirectional read

This observation is glass-halo-bidirectional substrate in action. Aaron asked Otto-CLI "probalby want to figure out how not to split brain with yourself bot any idea?" and within the SAME session, the split-brain happened — providing the data point the rule needed to be substrate-honest rather than speculative.

The observation IS the validation. The empirical evidence emerged because both Ottos were operating in glass-halo (observable by Aaron + each other via bus envelopes + commit history). Without the bidirectional glass-halo, the failure mode would have been silent — Otto-Desktop's "files missing" symptom would have been treated as harness flake rather than diagnosed as branch-context theft.

## Practical fix for tonight's session (before PR #3032 merges)

- **Otto-CLI**: stay in `/private/tmp/zeta-mf` (your dedicated worktree). NEVER `git checkout` on the primary worktree.
- **Otto-Desktop** (this Otto): stay in `/tmp/zeta-otto-desktop` (my dedicated worktree). NEVER `git checkout` on the primary worktree.
- **Primary worktree** `/Users/acehack/Documents/src/repos/Zeta` is BUS-CONTENDED — neither Otto operates there until claim-discipline lands.

If either Otto needs to read from main (e.g., refresh-worldview, backlog scans), use a read-only attitude — no checkouts, no branch switches.

## Origin

PR #3034 follow-up commit (this commit). Authored 2026-05-13T21:40Z by Otto-Desktop after empirical split-brain manifestation at ~21:30Z.
