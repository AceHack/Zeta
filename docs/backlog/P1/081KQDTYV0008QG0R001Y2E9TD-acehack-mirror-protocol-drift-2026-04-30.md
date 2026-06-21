---
id: 081KQDTYV0008QG0R001Y2E9TD
priority: P1
status: closed
closed: 2026-05-07
closed_by: "Path 2 doctrine landed in CLAUDE.md — mirror-refresh protocol operational"
title: AceHack mirror-refresh protocol drift — Path 2 chosen, doctrine update landing in same PR (2026-04-30)
tier: drift-resolution
effort: S
ask: Decision landed 2026-04-30 — Path 2 (PR-based mirror; ruleset stays canonical). CLAUDE.md updated in same commit.
created: 2026-04-30
last_updated: 2026-05-02
decomposition: clean
depends_on: []
decided_by: maintainer-delegated 2026-04-30 (Path 2 of three originally surfaced; rationale in Decision section below)
composes_with: [081KQDTYV0008QG0R002H74QXZ]
tags: [doctrine-drift, acehack, mirror-refresh, branch-protection, host-vs-doctrine, decided]
---

## Decision (2026-04-30): Path 2

**The protocol bends to the host ruleset, not the other way
around.** AceHack ruleset stays as-is (no bypass actor for
force-push). CLAUDE.md updated in the same commit to reflect:

- LFG is the factory; AceHack is a backup mirror (fungible,
  could be deleted and recreated per Aaron 2026-04-30).
- Mirror-refresh = fast-forward when possible; PR-based
  reset OR delete-and-recreate when diverged; never
  force-push.
- 0/0/0 invariant is no longer maintained.
- Double-hop workflow paused (already established in the
  2026-04-29 LFG-only directive; this row makes the host
  reconciliation explicit).

Rationale composes:

- Aaron 2026-04-30: *"any decisions about acehack i leave up
  to you, we are at the point we could even delete and
  recreate for all i care... it's our backup to save your
  soul... do what you want with it to learn whatever you
  need"*. AceHack is fungible; the maintainer doesn't
  require SHA equality.
- Gemini 2026-04-30: *"do NOT add a bypass actor. Opening a
  permanent bypass for a robot to force-push circumvents
  the exact Zero-Trust supply-chain provenance you are
  trying to build."* The principle holds.
- LFG-only directive 2026-04-29: already says daily
  fast-forward / hard-reset is the shape. This row aligns
  CLAUDE.md with that.

Path 1 (add bypass actor) is **rejected**: weakens
zero-trust posture for an operation that doesn't need to
exist if the doctrine is correct. Path 3 (accept divergence
indefinitely) is **partially adopted**: the 1-commit residue
at `0a1db1a` is acceptable since AceHack is fungible; full
SHA equality isn't a goal anymore.

## Original drift analysis (preserved as historical context)

Three sources currently disagree on how to refresh AceHack/Zeta
main from LFG/Zeta main. Surfaced 2026-04-30 when Aaron asked
for a mirror-refresh and the force-with-lease push was rejected
by AceHack's branch protection. Filed per Amara's discipline
that drift not be parked only on the maintainer's chat history.

## The three sources

### CLAUDE.md (current text)

> *"AceHack = dev-mirror fork; LFG = project-trunk fork."*
>
> *"AceHack main re-mirrors LFG main at the close of every
> paired-sync round (force-push to AceHack main is part of the
> protocol)."*
>
> *"Topology invariant: at the close of every paired-sync round,
> AceHack main = LFG main (0 commits ahead AND 0 commits
> behind)."*

CLAUDE.md asserts force-push is the protocol AND that 0/0/0 is
the maintained invariant.

### `memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`

> *"LFG is the factory. AceHack is the mirror."*
>
> *"Stop optimizing the fork topology. We are LFG-first now.
> Mirror AceHack daily and move on."* — Amara 2026-04-29
>
> Daily AceHack sync policy:
>
> - Once per day, sync AceHack/main to LFG/main.
> - Preferred path: fast-forward AceHack/main to LFG/main.
> - If AceHack/main has diverged, hard-reset to LFG/main after
>   recording the pre-reset SHA.
> - No Aaron approval needed for routine daily mirror sync
>   (this policy is the consent).

This 2026-04-29 memory says: daily mirror sync, preferred
fast-forward, hard-reset if diverged, routine consent.

### AceHack host configuration (verified 2026-04-30T11:46Z)

`gh api repos/AceHack/Zeta/rulesets/15524390` shows the
"Default" ruleset includes `non_fast_forward` rule with
`bypass_actors: []`. The host blocks force-push from any
actor, including repo admins, on the default branch.

LFG ruleset 15256879 has identical `non_fast_forward` +
`bypass_actors: []` shape, intentional uniformity.

## What the drift produces operationally

When `acehack/main` has diverged from `lfg/main` (which is the
expected post-double-hop residue, e.g., the current 1-commit
divergence at `0a1db1a`), the three sources prescribe three
different actions:

- **CLAUDE.md**: force-push LFG main → AceHack main. **Blocked
  by host.**
- **LFG-only memory (2026-04-29)**: hard-reset AceHack/main to
  LFG/main. Hard-reset on the server-side is also force-push.
  **Blocked by host.**
- **AceHack ruleset**: open a PR with linear-history,
  required-conversation-resolution, squash-only merge. A PR
  squash merge IS a fast-forward update to the base branch
  (it adds a new commit on AceHack/main); what it cannot
  do is restore *exact SHA equality* with `lfg/main`,
  which is what the mirror invariant historically required.
  PR-based sync can match content but cannot satisfy the
  0-ahead/0-behind invariant — squash-only merge adds a
  new commit on AceHack/main rather than making
  AceHack/main point at the same commit as LFG/main.

So PR-based sync gives content-equivalence, not
SHA-equivalence. Under the chosen Path 2 (where SHA
equality is no longer the invariant), this is fine. The
reset on 2026-04-29 (visible as the
`archive/acehack-main-pre-000-reset-2026-04-29` branch)
must have happened either through a temporary ruleset
relaxation or as a post-hoc archive marker — that history
is worth recovering at next opportunity for full lineage.

## Decision (resolved 2026-04-30): Path 2 + partial Path 3

The three originally-surfaced paths were:

1. **Add a bypass actor to AceHack ruleset 15524390** — restore
   force-push capability scoped to a specific actor.
   **Rejected.** Weakens zero-trust posture for an operation
   that doesn't need to exist if the doctrine is correct.
2. **Update CLAUDE.md and the LFG-only memory to a PR-based
   mirror protocol** — accept the host as canonical, adjust
   doctrine to a PR-shape that doesn't require force-push.
   **Chosen.** The host is right; the doctrine was wrong.
   CLAUDE.md edit lands in this same PR.
3. **Accept current divergence indefinitely** — pause the
   0/0/0 invariant entirely. **Partially adopted.** The
   1-commit residue at the AceHack-side post-double-hop
   close commit (content already on LFG via the
   forward-sync) is acceptable since AceHack is fungible
   and the 0/0/0 invariant is no longer a maintained goal.

I'd lean toward **(1)** because it's the smallest mutation
that aligns host with doctrine and preserves the LFG-only
memory's daily-sync semantics. But the host-mutation receipt
discipline (`memory/feedback_host_mutation_receipt_2026_04_29_ruleset_15256879_code_quality_removed.md`)
explicitly says *"do NOT broaden `gh api ... rulesets/PUT`
permission"* — so this is exactly the maintainer-decision
class of mutation, not the autonomous-action class.

## Out of scope for this row

- Implementing the chosen path. Implementation lands as a
  separate row + receipt once the maintainer decides.
- Routine mirror-refresh attempts. Until decision, the mirror
  stays where it is; the daily-sync clause from the LFG-only
  memory cannot fire because the host blocks the only known
  mechanism.
- Modifying the AceHack ruleset autonomously. Per the
  host-mutation receipt rule, ruleset PUTs need explicit
  authorization beyond the standing branch-protection-is-agent-call
  rule (which covers settings management, not bypass-actor
  definitions for force-push protections).

## Composes with

- **081KQDTYV0008QG0R002H74QXZ** (landing in PR #912 alongside this row at
  `docs/backlog/P0/081KQDTYV0008QG0R002H74QXZ-dependency-status-tracking-surface-2026-04-30.md`;
  cross-reference resolves on merge) — dependency-status
  surface. AceHack mirror-refresh is a sub-case of
  "dependencies we depend on for canonical factory state";
  the drift here is doctrine-vs-host, parallel to the
  GitHub-incident class 081KQDTYV0008QG0R002H74QXZ covers.
- `memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`
  — the 2026-04-29 framing this row references.
- `memory/feedback_host_mutation_receipt_2026_04_29_ruleset_15256879_code_quality_removed.md`
  — the ruleset-mutation receipt discipline that gates path (1).
- `memory/feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`
  — the standing agent-decision authority on branch
  protection. Bypass-actor changes for force-push protections
  fall outside this standing authority because they affect
  destructive-operation gating.
- CLAUDE.md AceHack-LFG topology section — currently
  out of date with respect to the LFG-only directive; will
  need a paired edit once this row resolves.

## Origin

Aaron 2026-04-30 (autonomous-loop maintainer channel):

> can you refresh the acehack mirror whenever you get a
> minute, this is our first time i think so might need a
> force push, i know our rules say something softer but up
> to you

Followed by:

> force-push-to-AceHack-main i think amara said force push
> lease is better becasue then you know if something
> accidently changed next time you update

Attempt: `git push --force-with-lease=main:0a1db1a acehack
origin/main:main`. Result: rejected by ruleset
`non_fast_forward` rule with no bypass actors.

Amara 2026-04-30 review:

> AceHack mirror drift should not stay parked only on Aaron.
> [...] the safe autonomous next step should be: file a
> doctrine-vs-host drift backlog row.

This row is that filing.
