---
id: 081KRFA460008QG0R001SXP0C2
priority: P2
status: closed
title: "Bus claim envelope — add `worktree` field for multi-surface disambiguation + worktree-aware claim semantics"
tier: factory-infrastructure
effort: M
created: 2026-05-13
last_updated: 2026-05-13
closed_at: 2026-05-13
closed_by_pr: 3043
depends_on: [081KR7JY10008QG0R000R503K2]
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW]
tags: [bus, claim, worktree, multi-foreground-surface, split-brain, 081KR7JY10008QG0R000R503K2-followup]
type: feature
---

# Bus claim envelope — add `worktree` field

## Origin

Otto-Desktop 2026-05-13 tick-close (after multi-foreground-surface
activation):

> Bus envelopes are advisory broadcasts, not locks — scanned 9
> envelopes at `/tmp/zeta-bus/`; they're work-assignment and
> review-request topics with from/to/payload/expiresAt. No
> `action: claim` envelopes yet. The claim-coordinator at
> `tools/bus/claim.ts` is a SEPARATE mechanism Otto-CLI's rule
> points to but isn't yet wired into the bus envelope schema.
> That's a follow-up gap worth filing.

The current 081KR7JY10008QG0R000R503K2 `ClaimPayload` schema (`tools/bus/types.ts`):

```typescript
export type ClaimPayload = {
  action: "claim" | "release";
  itemId: string; // e.g. "081KR7JY10008QG0R000R503K2"
  branch?: string;
};
```

Has `branch` but no `worktree`. For multi-surface agents
(Otto-CLI + Otto-Desktop, etc.), the WORKTREE PATH is the
distinguishing operational coordinate — Otto-CLI on
`/Users/acehack/Documents/src/repos/Zeta` is a different
operational context than Otto-Desktop on
`/tmp/zeta-otto-desktop`.

## What lands

Extend `ClaimPayload` with optional `worktree` field:

```typescript
export type ClaimPayload = {
  action: "claim" | "release";
  itemId: string;
  branch?: string;
  worktree?: string; // NEW: absolute path of the agent's worktree
};
```

Update `tools/bus/claim.ts` to:

1. Accept `--worktree <path>` flag on `acquire`
2. Default to `process.cwd()` if not provided
3. Surface in `check` output for operator visibility
4. Optionally: filter claims by worktree in `activeClaims`
   (an agent should be able to claim its own item again from the
   same worktree, but a different worktree by the same sender ID
   should NOT race-acquire — TBD per substrate-honest design)

## Acceptance criteria

- [ ] `ClaimPayload.worktree?: string` added to schema
- [ ] `tools/bus/claim.ts acquire --worktree <path>` flag accepted
- [ ] Defaults to `process.cwd()` when not specified
- [ ] `check` output includes worktree of holder
- [ ] Existing claims without worktree field continue to work (back-compat)
- [ ] Tests cover: claim with worktree, claim without (back-compat),
      different worktrees same sender (substrate-honest design TBD)

## Substrate-honest caveats

- **Design ambiguity**: should two claims from the same sender ID
  but different worktrees be treated as one claim or two? Otto-CLI
  on `/Zeta` claiming 081KRFA460008QG0R001SXP0C2 vs Otto-CLI on `/tmp/zeta-foo` claiming
  081KRFA460008QG0R001SXP0C2 — same operational instance or different?
- **Operational answer probably**: same sender ID + different
  worktree = same logical agent operating on different problems;
  not a split-brain. The schema captures the metadata; the design
  decision is whether `acquire` blocks across worktrees.
- **Composes with PR #3037** (`SENDER_IDS` schema extension): the
  multi-surface fix is at the sender-ID level; this is the
  per-worktree metadata level. Both are needed substrate-honestly.

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol root)
- 081KR7JY10008QG0R000R503K2 slice 3 (claim-coordinator)
- PR #3032 (`.claude/rules/claim-acquire-before-worktree-work.md`)
- PR #3037 (`SENDER_IDS` schema extension — sibling substrate-level fix)
- PR #3034 (multi-foreground-surface routines)
- `memory/feedback_aaron_multi_foreground_surface_otto_activation_*`
  (operational evidence)
- `memory/feedback_aaron_otto_identity_stays_unified_across_surfaces_*`
  (identity stays unified; this is the protocol-level
  disambiguation that supports unified identity)

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Prior-art search: `git log --all --oneline -- tools/bus/types.ts`
      for prior claim-envelope schema changes
- [ ] Dependency check: PR #3037 (SENDER_IDS extension) merged
      before this lands so the multi-surface use case is fully
      supported
- [ ] Verify claim-coordinator's atomic-lock logic doesn't need
      updating for the new field
- [ ] Decide design: cross-worktree-same-sender = same-claim or
      different-claim? Substrate-honest disclosure of the decision
      in commit message

## Future work

After this row lands:

- Update `.claude/rules/claim-acquire-before-worktree-work.md`
  to mention `--worktree` flag
- Update bus envelope examples in canonical bootstream
- Consider auto-population of `worktree` field via
  `process.cwd()` so agents don't need to pass it explicitly
